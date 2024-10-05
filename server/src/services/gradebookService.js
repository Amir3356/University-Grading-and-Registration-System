import * as gbRepo from '../repositories/gradebookRepository.js';
import { getOfferingById } from '../repositories/offeringRepository.js';
import { listAssessmentsByOffering } from '../repositories/assessmentRepository.js';
import { ConflictError, NotFoundError, ValidationError, ForbiddenError } from '../utils/errors.js';
import { query } from '../config/database.js';
import { roundTo2 } from '../utils/gpaCalculator.js';

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

  // Reason check: if requiresReason is true, modifying an EXISTING score requires reason
  if (gradebook.requiresReason && (!reason || !String(reason).trim())) {
    // Check if any change touches an existing mark
    const touchesExisting = changes.some((c) => {
      const row = gradebook.rows.find((r) => r.enrollmentId === c.enrollmentId);
      return row && row.marks && row.marks[c.assessmentId] !== undefined;
    });
    if (touchesExisting) {
      throw new ValidationError('A reason is required to modify existing marks after grades have been returned.', {
        reason: 'Please provide a reason for changing previously submitted marks.',
      });
    }
  }

  const asmMap = {};
  for (const a of gradebook.assessments) {
    asmMap[a.id] = a;
  }

  const enrMap = {};
  for (const r of gradebook.rows) {
    enrMap[r.enrollmentId] = r;
  }

  // Field validation
  const fieldErrors = {};
  for (const change of changes) {
    const key = `${change.enrollmentId}:${change.assessmentId}`;
    const enr = enrMap[change.enrollmentId];
    if (!enr) {
      fieldErrors[key] = 'Enrollment not found.';
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

  return await gbRepo.saveScoreChanges(offeringId, changes, reason, caller);
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

export async function getImportTemplate(offeringId) {
  const gradebook = await gbRepo.getGradebookData(offeringId);
  if (!gradebook) throw new NotFoundError('Course offering');

  const headers = ['student_id', 'name', ...gradebook.assessments.map((a) => a.name)];
  const rows = gradebook.rows
    .filter((r) => r.enrollment.status !== 'withdrawn')
    .map((r) => {
      const line = [r.student.studentNumber, `"${r.student.name}"`];
      for (const a of gradebook.assessments) {
        line.push(r.marks[a.id] ?? '');
      }
      return line.join(',');
    });

  return [headers.join(','), ...rows].join('\n');
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

export async function getStudentOfferingPerformance(offeringId, enrollmentId) {
  const gradebook = await gbRepo.getGradebookData(offeringId);
  if (!gradebook) throw new NotFoundError('Course offering');

  const row = gradebook.rows.find((r) => r.enrollmentId === enrollmentId);
  if (!row) throw new NotFoundError('Student enrollment');

  const assessmentDetails = gradebook.assessments.map((a) => {
    const mark = row.marks[a.id] ?? null;
    const percent = mark !== null && a.maxMarks > 0 ? roundTo2((mark / a.maxMarks) * 100) : null;
    const avgObj = gradebook.stats.assessmentAverages.find((avg) => avg.assessmentId === a.id);
    return {
      ...a,
      marks: mark,
      percent,
      classAveragePercent: avgObj?.averagePercent || 0,
    };
  });

  const atRisk = row.runningPercent < gradebook.passMark;

  return {
    offering: gradebook.offering,
    student: row.student,
    enrollment: row.enrollment,
    total: row.total,
    runningPercent: row.runningPercent,
    letter: row.letter,
    complete: row.complete,
    assessments: assessmentDetails,
    classAverage: gradebook.stats.runningAverage || 0,
    atRisk,
  };
}

export async function getGradeSheet(offeringId) {
  const { getCourseGradeSheet } = await import('../repositories/reportRepository.js');
  return await getCourseGradeSheet(offeringId);
}
