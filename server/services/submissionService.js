import * as subRepo from '../repositories/submissionRepository.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/errors.js';
import { logAudit } from '../utils/auditLogger.js';

export async function listSubmissions(params, caller) {
  const queryParams = { ...params };
  if (caller.roleId === 'dept_head') {
    queryParams.departmentId = caller.departmentId;
  }
  return await subRepo.listSubmissions(queryParams);
}

export async function getSubmissionDetail(id, caller) {
  const detail = await subRepo.getSubmissionDetail(id);
  if (!detail) throw new NotFoundError('Grade submission');

  if (caller.roleId === 'dept_head' && detail.offering.departmentId !== caller.departmentId) {
    throw new ForbiddenError('You can only review submissions for courses within your department.');
  }

  return detail;
}

export async function approveSubmission(id, { comment } = {}, caller) {
  const detail = await subRepo.getSubmissionDetail(id);
  if (!detail) throw new NotFoundError('Grade submission');

  if (caller.roleId === 'dept_head' && detail.offering.departmentId !== caller.departmentId) {
    throw new ForbiddenError('You can only approve submissions for courses within your department.');
  }

  const result = await subRepo.approveSubmission(id, comment, caller);

  await logAudit({
    actor: caller,
    action: 'approve',
    entityType: 'grade_submission',
    entityId: id,
    entityName: `${detail.offering?.course?.code || ''} ${detail.offering?.course?.title || ''}`.trim(),
    departmentId: detail.offering?.departmentId,
    description: `Approved grade submission for ${detail.offering?.course?.code || ''} ${detail.offering?.course?.title || ''}`,
    details: {
      before: { status: detail.status || 'submitted' },
      after: { status: 'approved', comment: comment || null },
      offeringId: detail.offering?.id,
      semester: detail.offering?.semester?.name,
      teacher: detail.teacher?.name,
      comment: comment || null,
    },
  });

  return result;
}

export async function rejectSubmission(id, { comment } = {}, caller) {
  if (!comment || !String(comment).trim()) {
    throw new ValidationError('A comment explaining the rejection reason is required.', {
      comment: 'Please provide a reason for rejecting the grades.',
    });
  }

  const detail = await subRepo.getSubmissionDetail(id);
  if (!detail) throw new NotFoundError('Grade submission');

  if (caller.roleId === 'dept_head' && detail.offering.departmentId !== caller.departmentId) {
    throw new ForbiddenError('You can only reject submissions for courses within your department.');
  }

  const result = await subRepo.rejectSubmission(id, comment.trim(), caller);

  await logAudit({
    actor: caller,
    action: 'reject',
    entityType: 'grade_submission',
    entityId: id,
    entityName: `${detail.offering?.course?.code || ''} ${detail.offering?.course?.title || ''}`.trim(),
    departmentId: detail.offering?.departmentId,
    description: `Rejected grade submission for ${detail.offering?.course?.code || ''} ${detail.offering?.course?.title || ''}`,
    details: {
      before: { status: detail.status || 'submitted' },
      after: { status: 'rejected', reason: comment.trim() },
      offeringId: detail.offering?.id,
      semester: detail.offering?.semester?.name,
      teacher: detail.teacher?.name,
      reason: comment.trim(),
    },
  });

  return result;
}

export async function publishSubmission(id, caller) {
  const detail = await subRepo.getSubmissionDetail(id);
  if (!detail) throw new NotFoundError('Grade submission');

  const result = await subRepo.publishSubmission(id, caller);

  await logAudit({
    actor: caller,
    action: 'other',
    entityType: 'grade_submission',
    entityId: id,
    entityName: `${detail.offering?.course?.code || ''} ${detail.offering?.course?.title || ''}`.trim(),
    departmentId: detail.offering?.departmentId,
    description: `Published approved grades to student records`,
    details: {
      before: { status: detail.status },
      after: { status: 'published' },
      offeringId: detail.offering?.id,
    },
  });

  return result;
}

export async function submitGrades(offeringId, { note } = {}, caller) {
  if (!offeringId) {
    throw new ValidationError('Offering ID is required to submit grades.');
  }
  const result = await subRepo.submitGradesForOffering(offeringId, { note }, caller);

  await logAudit({
    actor: caller,
    action: 'other',
    entityType: 'grade_submission',
    entityId: result?.id || offeringId,
    entityName: `Offering ${offeringId}`,
    departmentId: caller.departmentId,
    description: `Submitted grades for Department Head review`,
    details: {
      offeringId,
      note: note || null,
      status: 'submitted',
    },
  });

  return result;
}
