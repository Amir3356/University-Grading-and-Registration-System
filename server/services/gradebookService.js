import * as gbRepo from '../repositories/gradebookRepository.js';
import { getOfferingById } from '../repositories/offeringRepository.js';
import { ConflictError, NotFoundError, ValidationError, ForbiddenError } from '../utils/errors.js';
import { logAudit } from '../utils/auditLogger.js';

export async function getGradebook(offeringId, caller) {
  const offering = await getOfferingById(offeringId);
  if (!offering) throw new NotFoundError('Course offering');

  if (caller.roleId === 'teacher' && offering.teacher_id !== caller.teacherId) {
    throw new ForbiddenError('You can only access the gradebook for your assigned offerings.');
  }

  return await gbRepo.getGradebookData(offeringId);
}

export async function saveScores(offeringId, { changes, reason }, caller) {
  const gradebook = await gbRepo.getGradebookData(offeringId);
  if (!gradebook) throw new NotFoundError('Course offering');

  if (gradebook.locked) {
    throw new ConflictError('Gradebook is locked because final grades have already been submitted.');
  }

  // Reason check: if requiresReason is true, default reason if not provided
  if (gradebook.requiresReason && (!reason || !String(reason).trim())) {
    reason = 'Grade adjustment / revision';
  }

  const asmMap = {};
  for (const a of gradebook.assessments) {
    asmMap[a.id] = a;
  }

  const enrMap = {};
  for (const r of gradebook.rows) {
    enrMap[r.enrollmentId] = r;
  }

  // Auto-resolve or create enrollment for students passed by studentId
  for (const change of changes) {
    if (!change.enrollmentId && change.studentId) {
      const enr = await gbRepo.findOrCreateEnrollment(offeringId, change.studentId);
      change.enrollmentId = enr.id;
      if (!enrMap[enr.id]) {
        enrMap[enr.id] = {
          enrollmentId: enr.id,
          enrollment: { status: enr.status, isRepeat: enr.is_repeat },
          marks: {},
        };
      }
    }
  }

  // Field validation
  const fieldErrors = {};
  for (const change of changes) {
    const key = `${change.enrollmentId}:${change.assessmentId}`;
    const enr = enrMap[change.enrollmentId];
    if (!enr) {
      fieldErrors[key] = 'Cannot record marks: student does not match the assigned department and year of study.';
      continue;
    }
    if (enr.enrollment.status === 'withdrawn') {
      fieldErrors[key] = 'Student has withdrawn from this course.';
      continue;
    }

    const asm = asmMap[change.assessmentId];
    if (!asm) {
      fieldErrors[key] = 'Assessment not found.';
      continue;
    }

    if (change.marks !== null && change.marks !== undefined && change.marks !== '') {
      const num = Number(change.marks);
      if (Number.isNaN(num)) {
        fieldErrors[key] = 'Must be a number.';
      } else if (num < 0) {
        fieldErrors[key] = 'Cannot be negative.';
      } else if (num > asm.maxMarks) {
        fieldErrors[key] = `Cannot exceed ${asm.maxMarks}.`;
      }
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    throw new ValidationError('Please correct the highlighted mark entry errors.', fieldErrors);
  }

  const result = await gbRepo.saveScoreChanges(offeringId, changes, reason, caller);

  await logAudit({
    actor: caller,
    action: 'update',
    entityType: 'score',
    entityId: offeringId,
    entityName: `${gradebook.offering?.courseCode || ''} (Section ${gradebook.offering?.section || 'A'})`,
    departmentId: caller?.departmentId,
    description: `Updated assessment marks for ${changes.length} student record(s)`,
    details: {
      offeringId,
      scoresUpdatedCount: changes.length,
      reason: reason || null,
    },
  });

  return result;
}

export async function importScores(offeringId, { records, dryRun = true, reason }, caller) {
  const gradebook = await gbRepo.getGradebookData(offeringId);
  if (!gradebook) throw new NotFoundError('Course offering');

  if (gradebook.locked) {
    throw new ConflictError('Gradebook is locked because final grades have already been submitted.');
  }

  if (!Array.isArray(records) || records.length === 0) {
    throw new ValidationError('CSV records array cannot be empty.');
  }

  // Assessment matching
  const asmByName = {};
  for (const a of gradebook.assessments) {
    asmByName[a.name.toLowerCase().trim()] = a;
  }

  const matchedColumns = [];
  const unknownColumns = [];
  const firstRow = records[0] || {};
  const ignoredCols = ['name', 'student name', 'total', 'grade'];

  for (const col of Object.keys(firstRow)) {
    const norm = col.toLowerCase().trim();
    if (['student_id', 'student id', 'studentid', 'student_number', 'student number'].includes(norm)) {
      continue;
    }
    if (ignoredCols.includes(norm)) continue;

    if (asmByName[norm]) {
      matchedColumns.push(col);
    } else {
      unknownColumns.push(col);
    }
  }

  // Student matching
  const studentByNumber = {};
  for (const r of gradebook.rows) {
    studentByNumber[r.student.studentNumber.toLowerCase().trim()] = r;
  }

  const errors = [];
  const changes = [];

  for (let idx = 0; idx < records.length; idx++) {
    const row = records[idx];
    const rowNum = idx + 1;

    // Resolve student ID
    const stuIdVal = row.student_id || row['student id'] || row.studentid || row.student_number || row['student number'];
    if (!stuIdVal) {
      errors.push({ row: rowNum, message: 'Missing Student ID column value.' });
      continue;
    }

    const enr = studentByNumber[String(stuIdVal).toLowerCase().trim()];
    if (!enr) {
      errors.push({ row: rowNum, message: `Student ${stuIdVal} is not enrolled in this course.` });
      continue;
    }

    if (enr.enrollment.status === 'withdrawn') {
      errors.push({ row: rowNum, message: `Student ${stuIdVal} has withdrawn from this course.` });
      continue;
    }

    // Match assessment scores
    for (const col of matchedColumns) {
      const val = row[col];
      if (val === undefined || val === null || String(val).trim() === '') {
        continue; // Empty cells skipped
      }
      const num = Number(val);
      const asm = asmByName[col.toLowerCase().trim()];
      if (Number.isNaN(num)) {
        errors.push({ row: rowNum, message: `Invalid mark "${val}" for assessment ${col}: must be a number.` });
      } else if (num < 0) {
        errors.push({ row: rowNum, message: `Mark cannot be negative for assessment ${col}.` });
      } else if (num > asm.maxMarks) {
        errors.push({ row: rowNum, message: `Mark (${num}) exceeds maximum allowed (${asm.maxMarks}) for ${col}.` });
      } else {
        changes.push({
          enrollmentId: enr.enrollmentId,
          assessmentId: asm.id,
          marks: num,
        });
      }
    }
  }

  const result = {
    matchedColumns,
    unknownColumns,
    errors,
    changeCount: changes.length,
    changes,
    applied: false,
  };

  if (errors.length > 0) {
    return result;
  }

  if (!dryRun) {
    await saveScores(offeringId, { changes, reason }, caller);
    result.applied = true;
  }

  return result;
}

export async function getGradeHistory(offeringId) {
  return await gbRepo.getGradeHistory(offeringId);
}

export async function getOfferingPerformance(offeringId) {
  const gradebook = await gbRepo.getGradebookData(offeringId);
  if (!gradebook) throw new NotFoundError('Course offering');

  const struggling = gradebook.rows.filter(
    (r) => r.enrollment.status !== 'withdrawn' && r.runningPercent < gradebook.passMark && r.enteredCount > 0
  );

  return {
    offering: gradebook.offering,
    assessments: gradebook.assessments,
    rows: gradebook.rows,
    stats: gradebook.stats,
    struggling,
    passMark: gradebook.passMark,
  };
}

export async function clearScores(offeringId, assessmentId, caller) {
  const enrollments = await gbRepo.getActiveEnrollmentIds(offeringId);
  const changes = enrollments.map((r) => ({
    enrollmentId: r.id,
    assessmentId,
    marks: null,
  }));
  return await saveScores(offeringId, { changes, reason: 'Scores cleared by instructor' }, caller);
}

