import * as complaintRepo from '../repositories/complaintRepository.js';
import { query } from '../config/database.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/errors.js';

async function resolveStudentId(caller) {
  if (caller.studentId) return caller.studentId;
  const res = await query('SELECT id FROM students WHERE user_id = $1', [caller.id]);
  return res.rows[0]?.id || null;
}

async function resolveTeacherId(caller) {
  if (caller.teacherId) return caller.teacherId;
  const res = await query('SELECT id FROM teachers WHERE user_id = $1', [caller.id]);
  return res.rows[0]?.id || null;
}

export async function listStudentComplaints(params, caller) {
  const studentId = await resolveStudentId(caller);
  if (!studentId && caller.roleId === 'student') {
    throw new ForbiddenError('Student profile not found.');
  }

  let teacherId = null;
  if (caller.roleId === 'teacher') {
    teacherId = await resolveTeacherId(caller);
  }

  return await complaintRepo.listComplaints({
    ...params,
    studentId: caller.roleId === 'student' ? studentId : params.studentId,
    teacherId: caller.roleId === 'teacher' ? teacherId : params.teacherId,
    departmentId: caller.roleId === 'dept_head' ? caller.departmentId : params.departmentId,
  });
}

export async function createStudentComplaint(data, caller) {
  const studentId = await resolveStudentId(caller);
  if (!studentId) {
    throw new ForbiddenError('Only registered students can submit academic complaints.');
  }

  const { courseId, category, priority, reason } = data;

  if (!category || !String(category).trim()) {
    throw new ValidationError('Complaint category is required.', {
      category: 'Please select a complaint category.',
    });
  }

  if (!reason || !String(reason).trim() || String(reason).trim().length < 5) {
    throw new ValidationError('Detailed reason for the complaint is required (at least 5 characters).', {
      reason: 'Please provide a clear explanation.',
    });
  }

  return await complaintRepo.createComplaint({
    studentId,
    courseId: courseId || null,
    category: category.trim(),
    priority: priority || 'Normal',
    reason: reason.trim(),
  });
}

export async function updateStudentComplaint(id, data, caller) {
  const studentId = await resolveStudentId(caller);
  const existing = await complaintRepo.getComplaintById(id);
  if (!existing) {
    throw new NotFoundError('Complaint');
  }

  if (caller.roleId === 'student' && existing.studentId !== studentId) {
    throw new ForbiddenError('You can only update your own complaints.');
  }

  if (existing.status !== 'pending') {
    throw new ValidationError('Only pending complaints can be updated.');
  }

  const { category, priority, reason } = data;
  return await complaintRepo.updateComplaint(id, caller.roleId === 'student' ? studentId : null, {
    category,
    priority,
    reason: reason ? String(reason).trim() : undefined,
  });
}

export async function cancelStudentComplaint(id, caller) {
  const studentId = await resolveStudentId(caller);
  const existing = await complaintRepo.getComplaintById(id);
  if (!existing) {
    throw new NotFoundError('Complaint');
  }

  if (caller.roleId === 'student' && existing.studentId !== studentId) {
    throw new ForbiddenError('You can only cancel your own complaints.');
  }

  if (existing.status !== 'pending') {
    throw new ValidationError('Only pending complaints can be cancelled.');
  }

  return await complaintRepo.deleteComplaint(id, caller.roleId === 'student' ? studentId : null);
}

export async function getComplaintDetail(id, caller) {
  const existing = await complaintRepo.getComplaintById(id);
  if (!existing) {
    throw new NotFoundError('Complaint');
  }

  const studentId = await resolveStudentId(caller);
  if (caller.roleId === 'student' && existing.studentId !== studentId) {
    throw new ForbiddenError('Access denied.');
  }

  return existing;
}

export async function acceptComplaint(id, data = {}, caller) {
  const existing = await complaintRepo.getComplaintById(id);
  if (!existing) {
    throw new NotFoundError('Complaint');
  }

  const responderName = caller.name || `${caller.firstName || ''} ${caller.lastName || ''}`.trim() || 'Instructor';
  const newStatus = data.status || 'in_review';
  const statusLabel = newStatus === 'resolved' ? 'Resolved' : 'Under Review';
  const responseText = data.response ? String(data.response).trim() : 'Complaint accepted and currently under review by instructor.';

  return await complaintRepo.resolveComplaint(id, {
    status: newStatus,
    statusLabel,
    response: responseText,
    respondedBy: responderName,
  });
}

export async function respondComplaint(id, data = {}, caller) {
  const existing = await complaintRepo.getComplaintById(id);
  if (!existing) {
    throw new NotFoundError('Complaint');
  }

  const responderName = caller.name || `${caller.firstName || ''} ${caller.lastName || ''}`.trim() || 'Instructor';
  const newStatus = data.status || 'resolved';
  const statusLabel = newStatus === 'resolved' ? 'Resolved' : newStatus === 'in_review' ? 'Under Review' : 'Dismissed';
  const responseText = data.response ? String(data.response).trim() : 'Complaint resolved by instructor.';

  return await complaintRepo.resolveComplaint(id, {
    status: newStatus,
    statusLabel,
    response: responseText,
    respondedBy: responderName,
  });
}
