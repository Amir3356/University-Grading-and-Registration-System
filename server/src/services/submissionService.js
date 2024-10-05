import * as subRepo from '../repositories/submissionRepository.js';
import { getOfferingById } from '../repositories/offeringRepository.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/errors.js';

export async function submitGrades(offeringId, { note } = {}, caller) {
  const offering = await getOfferingById(offeringId);
  if (!offering) throw new NotFoundError('Course offering');

  if (caller.roleId === 'teacher' && offering.teacher_id !== caller.teacherId) {
    throw new ForbiddenError('You can only submit grades for your own course offerings.');
  }

  return await subRepo.submitGrades(offeringId, note, caller);
}

export async function getOfferingSubmissions(offeringId, caller) {
  const offering = await getOfferingById(offeringId);
  if (!offering) throw new NotFoundError('Course offering');

  if (caller.roleId === 'teacher' && offering.teacher_id !== caller.teacherId) {
    throw new ForbiddenError('You can only view submission history for your own course offerings.');
  }

  if (caller.roleId === 'dept_head' && offering.department_id !== caller.departmentId) {
    throw new ForbiddenError('You can only view submissions for courses within your department.');
  }

  return await subRepo.getOfferingSubmissionHistory(offeringId);
}

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

  return await subRepo.approveSubmission(id, comment, caller);
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

  return await subRepo.rejectSubmission(id, comment.trim(), caller);
}

export async function publishSubmission(id, caller) {
  const detail = await subRepo.getSubmissionDetail(id);
  if (!detail) throw new NotFoundError('Grade submission');

  return await subRepo.publishSubmission(id, caller);
}
