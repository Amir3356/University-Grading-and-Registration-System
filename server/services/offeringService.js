import * as offRepo from '../repositories/offeringRepository.js';
import { newId } from '../utils/idGenerator.js';
import { ConflictError, NotFoundError, ValidationError, ForbiddenError } from '../utils/errors.js';
import { query } from '../config/database.js';

export async function listOfferings(filters, caller) {
  if (caller.roleId === 'dept_head') {
    filters.departmentId = caller.departmentId;
  }
  return await offRepo.listOfferings(filters);
}

export async function getOfferingById(id, caller) {
  const offering = await offRepo.getOfferingById(id);
  if (!offering) throw new NotFoundError('Course offering');

  if (caller.roleId === 'teacher' && offering.teacher_id !== caller.teacherId) {
    throw new ForbiddenError('You can only access course offerings assigned to you.');
  }

  if (caller.roleId === 'dept_head' && offering.course?.department?.id !== caller.departmentId) {
    throw new ForbiddenError('You can only access course offerings in your department.');
  }

  return offering;
}

export async function createOffering(data, caller) {
  if (!data.courseId) throw new ValidationError('Course is required.', { courseId: 'Required' });
  if (!data.semesterId) throw new ValidationError('Semester is required.', { semesterId: 'Required' });
  if (!data.teacherId) throw new ValidationError('Teacher is required.', { teacherId: 'Required' });
  if (!data.section?.trim()) throw new ValidationError('Section is required.', { section: 'Required' });
  const capacity = parseInt(data.capacity, 10);
  if (Number.isNaN(capacity) || capacity < 1 || capacity > 500) {
    throw new ValidationError('Capacity must be between 1 and 500.', { capacity: 'Must be between 1 and 500.' });
  }

  // Check for duplicate offering (same course, semester, section)
  const existingOff = await query(
    `SELECT id FROM course_offerings WHERE course_id = $1 AND semester_id = $2 AND UPPER(section) = UPPER($3) LIMIT 1`,
    [data.courseId, data.semesterId, data.section.trim()]
  );
  if (existingOff.rows.length > 0) {
    throw new ConflictError(
      `An offering for this course, semester, and Section '${data.section.trim().toUpperCase()}' already exists. Please choose a different section (e.g. B, C).`,
      { section: `Section ${data.section.trim().toUpperCase()} already exists for this semester.` }
    );
  }

  let resolvedTeacherId = data.teacherId;
  const tRes = await query(`SELECT id, user_id FROM teachers WHERE id = $1 OR user_id = $1 LIMIT 1`, [data.teacherId]);
  if (tRes.rows.length > 0) {
    resolvedTeacherId = tRes.rows[0].id;
  }

  const id = newId('off');
  const offering = await offRepo.createOffering({
    id,
    courseId: data.courseId,
    semesterId: data.semesterId,
    teacherId: resolvedTeacherId,
    section: data.section.trim(),
    capacity,
    room: data.room,
    schedule: data.schedule,
    yearOfStudy: data.yearOfStudy || data.year_of_study,
  });

  // Notify teacher of assignment
  const teacherUserId = tRes.rows[0]?.user_id;
  if (teacherUserId) {
    const notifId = newId('ntf');
    await query(
      `INSERT INTO notifications (id, user_id, title, message, type, link)
       VALUES ($1, $2, 'New Teaching Assignment', 'You have been assigned to teach a course offering this semester.', 'assignment', $3)`,
      [notifId, teacherUserId, `/teacher/courses/${id}`]
    );
  }

  return await offRepo.getOfferingById(id);
}

export async function updateOffering(id, data, caller) {
  const existing = await offRepo.getOfferingById(id);
  if (!existing) throw new NotFoundError('Course offering');

  if (caller.roleId === 'dept_head' && existing.course?.department?.id !== caller.departmentId) {
    throw new ForbiddenError('You can only update offerings in your department.');
  }

  let resolvedTeacherId = data.teacherId;
  if (data.teacherId) {
    const tCheck = await query(`SELECT id FROM teachers WHERE id = $1 OR user_id = $1 LIMIT 1`, [data.teacherId]);
    if (tCheck.rows.length > 0) {
      resolvedTeacherId = tCheck.rows[0].id;
    }
  }

  // Teacher cannot change after grades submitted
  if (resolvedTeacherId && resolvedTeacherId !== existing.teacher_id) {
    if (['submitted', 'approved', 'published'].includes(existing.grade_status)) {
      throw new ConflictError('Cannot change the assigned teacher after final grades have been submitted.');
    }
  }

  // Capacity cannot be below enrolled count
  if (data.capacity) {
    const cap = parseInt(data.capacity, 10);
    if (cap < existing.enrolledCount) {
      throw new ValidationError(`Capacity (${cap}) cannot be set below current enrolled student count (${existing.enrolledCount}).`, {
        capacity: `Cannot be below ${existing.enrolledCount}.`,
      });
    }
  }

  await offRepo.updateOffering(id, {
    ...data,
    teacherId: resolvedTeacherId,
    yearOfStudy: data.yearOfStudy !== undefined ? data.yearOfStudy : data.year_of_study,
  });
  return await offRepo.getOfferingById(id);
}

export async function deleteOffering(id, caller) {
  const existing = await offRepo.getOfferingById(id);
  if (!existing) throw new NotFoundError('Course offering');

  if (existing.enrolledCount > 0) {
    throw new ConflictError('Cannot delete a course offering that has enrolled students. Withdraw or un-enroll them first.');
  }

  await offRepo.deleteOffering(id);
  return { ok: true };
}

export async function listEnrollments(offeringId) {
  return await offRepo.listEnrollments(offeringId);
}

export async function listEligibleStudents(offeringId, filters) {
  return await offRepo.listEligibleStudents(offeringId, filters);
}

export async function enrollStudents(offeringId, studentIds, caller) {
  const offering = await offRepo.getOfferingById(offeringId);
  if (!offering) throw new NotFoundError('Course offering');

  if (offering.semester?.status === 'closed') {
    throw new ConflictError('Cannot enroll students in a closed semester.');
  }

  if (['submitted', 'approved', 'published'].includes(offering.grade_status)) {
    throw new ConflictError('Cannot enroll students into a course offering whose grades have already been submitted.');
  }

  if (offering.enrolledCount + studentIds.length > offering.capacity) {
    throw new ConflictError(`Enrolling ${studentIds.length} students would exceed section capacity of ${offering.capacity} (currently ${offering.enrolledCount}).`);
  }

  const enrolled = await offRepo.enrollStudents(offeringId, studentIds);

  // Notify students
  for (const stuId of studentIds) {
    const sRes = await query(`SELECT user_id FROM students WHERE id = $1`, [stuId]);
    if (sRes.rows.length > 0) {
      const notifId = newId('ntf');
      await query(
        `INSERT INTO notifications (id, user_id, title, message, type, link)
         VALUES ($1, $2, 'Course Enrollment Confirmation', $3, 'enrollment', '/student/courses')`,
        [
          notifId,
          sRes.rows[0].user_id,
          `You have been enrolled in ${offering.course?.code || ''} (Section ${offering.section}).`,
        ]
      );
    }
  }

  return { enrolled };
}

export async function withdrawEnrollment(enrollmentId, reason, caller) {
  if (!reason || !String(reason).trim()) {
    throw new ValidationError('A reason is required when withdrawing an enrollment.', {
      reason: 'Please provide a reason for withdrawal.',
    });
  }

  const enrRes = await query(
    `SELECT ce.*, co.grade_status, co.id as offering_id, s.user_id as student_user_id
     FROM course_enrollments ce
     JOIN course_offerings co ON co.id = ce.offering_id
     JOIN students s ON s.id = ce.student_id
     WHERE ce.id = $1`,
    [enrollmentId]
  );
  if (enrRes.rows.length === 0) throw new NotFoundError('Enrollment');
  const enr = enrRes.rows[0];

  if (enr.grade_status === 'published') {
    throw new ConflictError('Cannot withdraw an enrollment after final grades have been published.');
  }

  const withdrawn = await offRepo.withdrawEnrollment(enrollmentId);

  // Notify student
  const notifId = newId('ntf');
  await query(
    `INSERT INTO notifications (id, user_id, title, message, type, link)
     VALUES ($1, $2, 'Course Enrollment Withdrawn', $3, 'withdrawal', '/student/courses')`,
    [
      notifId,
      enr.student_user_id,
      `Your course enrollment was withdrawn. Reason: ${reason}`,
    ]
  );

  return withdrawn;
}

export async function deleteEnrollment(enrollmentId, caller) {
  const hasScoresOrGrades = await offRepo.enrollmentHasScoresOrGrades(enrollmentId);
  if (hasScoresOrGrades) {
    throw new ConflictError('Cannot delete enrollment that has entered scores or final grades. Withdraw the enrollment instead.');
  }

  await offRepo.deleteEnrollment(enrollmentId);
  return { ok: true };
}
