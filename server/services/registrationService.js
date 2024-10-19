import * as regRepo from '../repositories/registrationRepository.js';
import { newId } from '../utils/idGenerator.js';
import { ConflictError, NotFoundError, ValidationError, ForbiddenError } from '../utils/errors.js';
import { logAudit } from '../middleware/audit.js';
import { query } from '../config/database.js';

export async function listPeriods(filters) {
  return await regRepo.listRegistrationPeriods(filters);
}

export async function getPeriodById(id) {
  const period = await regRepo.getRegistrationPeriodById(id);
  if (!period) throw new NotFoundError('Registration period');
  return period;
}

export async function createPeriod(data, user) {
  if (!data.semesterId) throw new ValidationError('Semester is required.', { semesterId: 'Required' });
  if (!data.startDate || !data.deadline) throw new ValidationError('Dates are required.');
  if (data.deadline < data.startDate) throw new ValidationError('Deadline cannot be before start date.');
  if (!Array.isArray(data.registrationTypeIds) || data.registrationTypeIds.length === 0) {
    throw new ValidationError('At least one registration type must be selected.');
  }

  const existing = await regRepo.findPeriodBySemester(data.semesterId);
  if (existing) throw new ConflictError('A registration period already exists for this semester.');

  const id = newId('per');
  const status = data.status || 'scheduled';
  let period = await regRepo.createRegistrationPeriod({
    id,
    semesterId: data.semesterId,
    startDate: data.startDate,
    deadline: data.deadline,
    status: status === 'open' ? 'scheduled' : status,
    registrationTypeIds: data.registrationTypeIds,
    createdBy: user.id,
  });
  // Only one period may be open at a time, same as the open/close toggle.
  if (status === 'open') period = await regRepo.openRegistrationPeriod(id);

  await logAudit(query, {
    userId: user.id,
    action: 'registration_period.created',
    entityType: 'registration_period',
    entityId: id,
    details: `Created registration period for semester ${data.semesterId}`,
  });

  return period;
}

export async function updatePeriod(id, data, user) {
  const existing = await regRepo.getRegistrationPeriodById(id);
  if (!existing) throw new NotFoundError('Registration period');

  if (data.startDate && data.deadline && data.deadline < data.startDate) {
    throw new ValidationError('Deadline cannot be before start date.');
  }
  if (Array.isArray(data.registrationTypeIds) && data.registrationTypeIds.length === 0) {
    throw new ValidationError('At least one registration type must be selected.');
  }

  let period = await regRepo.updateRegistrationPeriod(id, data);
  // Only one period may be open at a time, same as the open/close toggle.
  if (data.status === 'open' && existing.status !== 'open') {
    period = await regRepo.openRegistrationPeriod(id);
  }
  await logAudit(query, {
    userId: user.id,
    action: 'registration_period.updated',
    entityType: 'registration_period',
    entityId: id,
    details: `Updated registration period ${id}`,
  });
  return period;
}

export async function openPeriod(id, user) {
  const period = await regRepo.getRegistrationPeriodById(id);
  if (!period) throw new NotFoundError('Registration period');

  const opened = await regRepo.openRegistrationPeriod(id);
  await logAudit(query, {
    userId: user.id,
    action: 'registration_period.opened',
    entityType: 'registration_period',
    entityId: id,
    details: `Opened registration period for ${period.semester?.name}`,
  });
  return opened;
}

export async function closePeriod(id, user) {
  const period = await regRepo.getRegistrationPeriodById(id);
  if (!period) throw new NotFoundError('Registration period');

  const closed = await regRepo.closeRegistrationPeriod(id);
  await logAudit(query, {
    userId: user.id,
    action: 'registration_period.closed',
    entityType: 'registration_period',
    entityId: id,
    details: `Closed registration period for ${period.semester?.name}`,
  });
  return closed;
}

export async function deletePeriod(id, user) {
  const count = await regRepo.countRegistrationsInPeriod(id);
  if (count > 0) {
    throw new ConflictError('Cannot delete registration period that already has student registrations.');
  }
  await regRepo.deleteRegistrationPeriod(id);
  await logAudit(query, {
    userId: user.id,
    action: 'registration_period.deleted',
    entityType: 'registration_period',
    entityId: id,
    details: `Deleted registration period ${id}`,
  });
  return { ok: true };
}

export async function getSummary(semesterId) {
  return await regRepo.getRegistrationSummary(semesterId);
}

export async function listRegistrations(filters) {
  return await regRepo.listStudentRegistrations(filters);
}

export async function updateRegistrationType(id, registrationTypeId, user) {
  const reg = await regRepo.findRegistrationById(id);
  if (!reg) throw new NotFoundError('Registration record');

  const updated = await regRepo.updateRegistrationType(id, registrationTypeId);
  await logAudit(query, {
    userId: user.id,
    action: 'registration.type_changed',
    entityType: 'semester_registration',
    entityId: id,
    details: `Updated registration type to ${registrationTypeId}`,
  });
  return updated;
}

export async function approveRegistration(id, user) {
  const reg = await regRepo.findRegistrationById(id);
  if (!reg) throw new NotFoundError('Registration record');
  if (reg.status !== 'pending') throw new ConflictError('Only pending registrations can be approved.');

  const approved = await regRepo.approveRegistration(id, user.id);

  // Notify student
  const notifId = newId('ntf');
  await query(
    `INSERT INTO notifications (id, user_id, title, message, type, link)
     VALUES ($1, $2, 'Semester Registration Approved', 'Your semester registration has been approved officially.', 'registration', '/student/registrations')`,
    [notifId, reg.student_user_id]
  );

  await logAudit(query, {
    userId: user.id,
    action: 'registration.approved',
    entityType: 'semester_registration',
    entityId: id,
    details: `Approved semester registration for student ${reg.student_number}`,
  });

  return approved;
}

export async function rejectRegistration(id, remarks, user) {
  if (!remarks || !String(remarks).trim()) {
    throw new ValidationError('Remarks are required when rejecting a registration.', {
      remarks: 'Please provide remarks explaining why the registration is rejected.',
    });
  }

  const reg = await regRepo.findRegistrationById(id);
  if (!reg) throw new NotFoundError('Registration record');
  if (reg.status !== 'pending') throw new ConflictError('Only pending registrations can be rejected.');

  const rejected = await regRepo.rejectRegistration(id, remarks.trim(), user.id);

  // Notify student
  const notifId = newId('ntf');
  await query(
    `INSERT INTO notifications (id, user_id, title, message, type, link)
     VALUES ($1, $2, 'Semester Registration Rejected', $3, 'registration', '/student/registrations')`,
    [notifId, reg.student_user_id, `Your semester registration was rejected: "${remarks}".`]
  );

  await logAudit(query, {
    userId: user.id,
    action: 'registration.rejected',
    entityType: 'semester_registration',
    entityId: id,
    details: `Rejected semester registration for student ${reg.student_number}: ${remarks}`,
    reason: remarks,
  });

  return rejected;
}

export async function bulkApproveRegistrations(ids, user) {
  let approved = 0;
  let skipped = 0;

  for (const id of ids) {
    const reg = await regRepo.findRegistrationById(id);
    if (reg && reg.status === 'pending') {
      await regRepo.approveRegistration(id, user.id);
      approved++;
    } else {
      skipped++;
    }
  }

  await logAudit(query, {
    userId: user.id,
    action: 'registration.bulk_approved',
    entityType: 'semester_registration',
    entityId: 'bulk',
    details: `Bulk approved ${approved} registration(s)`,
  });

  return { approved, skipped };
}

export async function deleteRegistration(id, user) {
  await regRepo.deleteRegistration(id);
  await logAudit(query, {
    userId: user.id,
    action: 'registration.deleted',
    entityType: 'semester_registration',
    entityId: id,
    details: `Deleted semester registration ${id}`,
  });
  return { ok: true };
}

// Student self-service
export async function getStudentCurrentPeriod(studentId) {
  return await regRepo.getCurrentPeriodForStudent(studentId);
}

export async function listStudentHistory(studentId) {
  return await regRepo.listStudentRegistrationHistory(studentId);
}

export async function submitStudentRegistration({ semesterId, registrationTypeId }, studentId, user) {
  const currentPeriod = await regRepo.getCurrentPeriodForStudent(studentId);
  if (!currentPeriod) {
    throw new ConflictError('No semester registration period is currently open.');
  }

  if (currentPeriod.semester_id !== semesterId) {
    throw new ConflictError('Registration is not currently open for the requested semester.');
  }

  if (user.academicStatus && user.academicStatus !== 'active') {
    throw new ConflictError('Only active students may submit semester registrations.');
  }

  const allowed = currentPeriod.allowed_types.some((t) => t.id === registrationTypeId);
  if (!allowed) {
    throw new ValidationError('Selected registration type is not allowed for this registration period.', {
      registrationTypeId: 'This registration type is not available.',
    });
  }

  if (currentPeriod.myRegistration) {
    throw new ConflictError(`You have already registered for ${currentPeriod.semester_name}.`);
  }

  const id = newId('reg');
  const reg = await regRepo.createStudentRegistration({
    id,
    studentId,
    semesterId,
    periodId: currentPeriod.id,
    registrationTypeId,
  });

  await logAudit(query, {
    userId: user.id,
    action: 'registration.submitted',
    entityType: 'semester_registration',
    entityId: id,
    details: `Student registered for ${currentPeriod.semester_name} (${registrationTypeId})`,
  });

  return reg;
}

export async function cancelStudentRegistration(id, studentId, user) {
  const cancelled = await regRepo.cancelStudentRegistration(id, studentId);
  if (!cancelled) {
    throw new ConflictError('Registration cannot be cancelled (not found or not pending).');
  }

  await logAudit(query, {
    userId: user.id,
    action: 'registration.cancelled',
    entityType: 'semester_registration',
    entityId: id,
    details: `Student cancelled pending registration`,
  });

  return cancelled;
}
