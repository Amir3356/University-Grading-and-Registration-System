import * as asmRepo from '../repositories/assessmentRepository.js';
import { getOfferingById } from '../repositories/offeringRepository.js';
import { newId } from '../utils/idGenerator.js';
import { ConflictError, NotFoundError, ValidationError, ForbiddenError } from '../utils/errors.js';
import { query } from '../config/database.js';

export async function listAssessments(offeringId, caller) {
  const offering = await getOfferingById(offeringId);
  if (!offering) throw new NotFoundError('Course offering');

  if (caller.roleId === 'teacher' && offering.teacher_id !== caller.teacherId) {
    throw new ForbiddenError('You can only view assessments for offerings assigned to you.');
  }

  return await asmRepo.listAssessmentsByOffering(offeringId);
}

export async function createAssessment(offeringId, data, caller) {
  const offering = await getOfferingById(offeringId);
  if (!offering) throw new NotFoundError('Course offering');

  if (caller.roleId === 'teacher' && offering.teacher_id !== caller.teacherId) {
    throw new ForbiddenError('You can only create assessments for offerings assigned to you.');
  }

  if (['submitted', 'approved', 'published'].includes(offering.grade_status)) {
    throw new ConflictError('Cannot add assessments: final grades for this offering have already been submitted.');
  }

  const errors = {};
  if (!data.name?.trim()) errors.name = 'Assessment name is required.';
  if (!data.type) errors.type = 'Assessment type is required.';

  const maxMarks = parseFloat(data.maxMarks);
  if (Number.isNaN(maxMarks) || maxMarks < 1 || maxMarks > 1000) {
    errors.maxMarks = 'Max marks must be between 1 and 1000.';
  }

  const weight = parseFloat(data.weight);
  if (Number.isNaN(weight) || weight < 0.5 || weight > 100) {
    errors.weight = 'Weight must be between 0.5% and 100%.';
  }

  if (!data.dueDate) errors.dueDate = 'Due date is required.';

  if (Object.keys(errors).length > 0) throw new ValidationError('Invalid assessment data.', errors);

  // Check unique name within offering
  const existingList = await asmRepo.listAssessmentsByOffering(offeringId);
  if (existingList.some((a) => a.name.toLowerCase() === data.name.trim().toLowerCase())) {
    throw new ValidationError('An assessment with this name already exists in this course.', {
      name: 'Assessment name must be unique.',
    });
  }

  // Weight check
  const currentWeightSum = await asmRepo.sumWeights(offeringId);
  if (currentWeightSum + weight > 100.001) {
    const remaining = Math.max(0, 100 - currentWeightSum);
    throw new ValidationError(`Total weights cannot exceed 100%. Remaining weight available: ${remaining}%.`, {
      weight: `Remaining weight available is ${remaining}%.`,
    });
  }

  const id = newId('asm');
  const asm = await asmRepo.createAssessment({
    id,
    offeringId,
    name: data.name.trim(),
    type: data.type,
    maxMarks,
    weight,
    dueDate: data.dueDate,
    description: data.description,
  });

  return asm;
}

export async function updateAssessment(id, data, caller) {
  const existing = await asmRepo.findById(id);
  if (!existing) throw new NotFoundError('Assessment');

  const offering = await getOfferingById(existing.offering_id);
  if (['submitted', 'approved', 'published'].includes(offering.grade_status)) {
    throw new ConflictError('Cannot update assessments: final grades for this offering have already been submitted.');
  }

  if (data.maxMarks) {
    const maxMarks = parseFloat(data.maxMarks);
    const highestMark = await asmRepo.highestEnteredScore(id);
    if (maxMarks < highestMark) {
      throw new ValidationError(`Max marks cannot be lower than the highest mark already entered (${highestMark}).`, {
        maxMarks: `Cannot be lower than highest mark (${highestMark}).`,
      });
    }
  }

  if (data.weight) {
    const weight = parseFloat(data.weight);
    const otherWeightSum = await asmRepo.sumWeights(existing.offering_id, id);
    if (otherWeightSum + weight > 100.001) {
      const remaining = Math.max(0, 100 - otherWeightSum);
      throw new ValidationError(`Total weights cannot exceed 100%. Remaining weight available: ${remaining}%.`, {
        weight: `Remaining weight available is ${remaining}%.`,
      });
    }
  }

  const asm = await asmRepo.updateAssessment(id, data);
  return asm;
}

export async function deleteAssessment(id, caller) {
  const existing = await asmRepo.findById(id);
  if (!existing) throw new NotFoundError('Assessment');

  const offering = await getOfferingById(existing.offering_id);
  if (['submitted', 'approved', 'published'].includes(offering.grade_status)) {
    throw new ConflictError('Cannot delete assessments: final grades for this offering have already been submitted.');
  }

  const hasScores = await asmRepo.hasScores(id);
  if (hasScores) {
    throw new ConflictError('Cannot delete assessment with entered student scores. Clear the scores first.');
  }

  await asmRepo.deleteAssessment(id);
  return { ok: true };
}

export async function releaseAssessment(id, isReleased, caller) {
  const existing = await asmRepo.findById(id);
  if (!existing) throw new NotFoundError('Assessment');

  const updated = await asmRepo.setReleased(id, isReleased);

  if (isReleased) {
    // Notify all enrolled students
    const enrRes = await query(
      `SELECT s.user_id, c.code, c.title
       FROM course_enrollments ce
       JOIN students s ON s.id = ce.student_id
       JOIN course_offerings co ON co.id = ce.offering_id
       JOIN courses c ON c.id = co.course_id
       WHERE ce.offering_id = $1 AND ce.status != 'withdrawn'`,
      [existing.offering_id]
    );

    for (const e of enrRes.rows) {
      const notifId = newId('ntf');
      await query(
        `INSERT INTO notifications (id, user_id, title, message, type, link)
         VALUES ($1, $2, 'Marks Released', $3, 'marks_released', '/student/assessments')`,
        [
          notifId,
          e.user_id,
          `Marks for assessment "${existing.name}" in ${e.code} (${e.title}) have been released.`,
        ]
      );
    }
  }

  return updated;
}

export async function applyTemplate(offeringId, caller) {
  const offering = await getOfferingById(offeringId);
  if (!offering) throw new NotFoundError('Course offering');

  const count = await asmRepo.applyTemplate(offeringId, offering.course.department.id);
  return { applied: count };
}
