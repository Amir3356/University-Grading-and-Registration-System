import * as wrRepo from '../repositories/withdrawalRepository.js';
import { query } from '../config/database.js';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors.js';
import { logAudit } from '../utils/auditLogger.js';

export async function listReasonCategories() {
  return await wrRepo.listReasonCategories();
}

export async function listStudentWithdrawals(caller) {
  if (!caller.studentId) throw new ForbiddenError('Only students can access their withdrawal requests.');
  return await wrRepo.listStudentWithdrawals(caller.studentId);
}

export async function createStudentWithdrawalRequest(data, caller) {
  if (!caller.studentId) throw new ForbiddenError('Only students can submit withdrawal requests.');

  const { scope, semesterId, enrollmentId, reasonCategoryId, reason, acknowledged } = data;

  const validScopes = ['course', 'semester', 'university'];
  if (!validScopes.includes(scope)) {
    throw new ValidationError('Invalid withdrawal scope. Must be course, semester, or university.', {
      scope: 'Invalid withdrawal scope.',
    });
  }

  if (scope === 'course' && !enrollmentId) {
    throw new ValidationError('Enrollment ID is required for course withdrawal.', {
      enrollmentId: 'Enrollment is required.',
    });
  }

  if (!acknowledged) {
    throw new ValidationError('You must acknowledge the withdrawal terms and consequences.', {
      acknowledged: 'Acknowledgment is required.',
    });
  }

  if (!reasonCategoryId) {
    throw new ValidationError('Reason category is required.', {
      reasonCategoryId: 'Please select a reason category.',
    });
  }

  if (!reason || !String(reason).trim()) {
    throw new ValidationError('Detailed explanation reason is required.', {
      reason: 'Please provide a detailed reason.',
    });
  }

  // If course scope, verify enrollment belongs to student and course grades are not published
  if (scope === 'course') {
    const enrRes = await query(
      `SELECT ce.id, co.grade_status, co.semester_id
       FROM course_enrollments ce
       JOIN course_offerings co ON co.id = ce.offering_id
       WHERE ce.id = $1 AND ce.student_id = $2`,
      [enrollmentId, caller.studentId]
    );

    if (enrRes.rows.length === 0) {
      throw new NotFoundError('Course enrollment');
    }

    if (enrRes.rows[0].grade_status === 'published') {
      throw new ConflictError('Cannot request course withdrawal: final grades for this course have already been published.');
    }
  }

  // Check if a pending withdrawal request already exists for this scope and semester
  const pendingCheck = await query(
    `SELECT id FROM withdrawal_requests
     WHERE student_id = $1 AND scope = $2 AND status = 'pending'
       AND ($3::text IS NULL OR semester_id = $3 OR scope = 'university')`,
    [caller.studentId, scope, semesterId || null]
  );

  if (pendingCheck.rows.length > 0) {
    throw new ConflictError(`A pending ${scope} withdrawal request already exists.`);
  }

  return await wrRepo.createWithdrawalRequest({
    studentId: caller.studentId,
    scope,
    semesterId,
    enrollmentId,
    reasonCategoryId,
    reason: reason.trim(),
  });
}

export async function cancelStudentWithdrawalRequest(id, caller) {
  if (!caller.studentId) throw new ForbiddenError('Only students can cancel their withdrawal requests.');
  return await wrRepo.cancelWithdrawalRequest(id, caller.studentId);
}

export async function listAdminWithdrawals(params, caller) {
  const queryParams = { ...params };
  if (caller.roleId === 'dept_head') {
    queryParams.departmentId = caller.departmentId;
  }
  return await wrRepo.listAdminWithdrawals(queryParams);
}

export async function getWithdrawalsSummary() {
  return await wrRepo.getWithdrawalsSummary();
}

export async function getWithdrawalById(id, caller) {
  const wr = await wrRepo.getWithdrawalById(id);
  if (!wr) throw new NotFoundError('Withdrawal request');

  if (caller.roleId === 'dept_head' && wr.student?.department?.id !== caller.departmentId) {
    throw new ForbiddenError('You can only view withdrawal requests for students in your department.');
  }

  return wr;
}

export async function updateClearance(id, office, { status, remarks } = {}, caller) {
  const wr = await wrRepo.getWithdrawalById(id);
  if (!wr) throw new NotFoundError('Withdrawal request');

  if (caller.roleId === 'dept_head') {
    if (office !== 'department') {
      throw new ForbiddenError('Department heads can only sign off on the department clearance.');
    }
    if (wr.student?.department?.id !== caller.departmentId) {
      throw new ForbiddenError('You can only sign off on clearance for students in your department.');
    }
  }

  const validStatuses = ['pending', 'approved', 'rejected'];
  if (!validStatuses.includes(status)) {
    throw new ValidationError('Invalid clearance status. Must be approved or rejected.', {
      status: 'Invalid status.',
    });
  }

  const res = await wrRepo.updateClearance(id, office, status, remarks, caller);
  if (!res) throw new NotFoundError('Clearance record');

  await logAudit({
    actor: caller,
    action: status === 'approved' ? 'approve' : status === 'rejected' ? 'reject' : 'update',
    entityType: 'withdrawal',
    entityId: id,
    entityName: `${wr.student?.name || 'Student'} (${office} clearance)`,
    departmentId: wr.student?.department?.id || caller.departmentId,
    description: `${status === 'approved' ? 'Approved' : status === 'rejected' ? 'Rejected' : 'Updated'} ${office} clearance for ${wr.student?.name || 'student'}`,
    details: {
      requestId: id,
      office,
      status,
      remarks: remarks || null,
      studentId: wr.student?.id,
    },
  });

  return res;
}

export async function approveWithdrawal(id, { adminNotes } = {}, caller) {
  const res = await wrRepo.approveWithdrawal(id, adminNotes, caller);

  await logAudit({
    actor: caller,
    action: 'approve',
    entityType: 'withdrawal',
    entityId: id,
    entityName: `Withdrawal ${id}`,
    departmentId: caller?.departmentId,
    description: `Approved student withdrawal request ${id}`,
    details: { requestId: id, adminNotes: adminNotes || null },
  });

  return res;
}

export async function rejectWithdrawal(id, { adminNotes } = {}, caller) {
  if (!adminNotes || !String(adminNotes).trim()) {
    throw new ValidationError('Decision remarks / admin notes are required when rejecting.', {
      adminNotes: 'Please provide remarks explaining the rejection.',
    });
  }
  const res = await wrRepo.rejectWithdrawal(id, adminNotes.trim(), caller);

  await logAudit({
    actor: caller,
    action: 'reject',
    entityType: 'withdrawal',
    entityId: id,
    entityName: `Withdrawal ${id}`,
    departmentId: caller?.departmentId,
    description: `Rejected student withdrawal request ${id}`,
    details: { requestId: id, adminNotes: adminNotes.trim() },
  });

  return res;
}
