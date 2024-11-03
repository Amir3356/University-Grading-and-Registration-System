import * as regRepo from '../repositories/registrationRepository.js';
import { newId } from '../utils/idGenerator.js';
import { ConflictError, NotFoundError, ValidationError, ForbiddenError } from '../utils/errors.js';
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
  return period;
}

export async function openPeriod(id, user) {
  const period = await regRepo.getRegistrationPeriodById(id);
  if (!period) throw new NotFoundError('Registration period');

  const opened = await regRepo.openRegistrationPeriod(id);
  return opened;
}

export async function closePeriod(id, user) {
  const period = await regRepo.getRegistrationPeriodById(id);
  if (!period) throw new NotFoundError('Registration period');

  const closed = await regRepo.closeRegistrationPeriod(id);
  return closed;
}

export async function deletePeriod(id, user) {
  const count = await regRepo.countRegistrationsInPeriod(id);
  if (count > 0) {
    throw new ConflictError('Cannot delete registration period that already has student registrations.');
  }
  await regRepo.deleteRegistrationPeriod(id);
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

  return { approved, skipped };
}

export async function deleteRegistration(id, user) {
  await regRepo.deleteRegistration(id);
  return { ok: true };
}

// Student self-service
export async function getStudentProfile(studentId) {
  return await regRepo.getStudentProfile(studentId);
}

export async function getStudentCurrentPeriod(studentId) {
  return await regRepo.getCurrentPeriodForStudent(studentId);
}

export async function getUpcomingPeriod() {
  return await regRepo.getUpcomingPeriod();
}

export async function listStudentHistory(studentId) {
  return await regRepo.listStudentRegistrationHistory(studentId);
}

function isPeriodPastDeadline(deadline) {
  if (!deadline) return false;
  const d = new Date(deadline);
  if (Number.isNaN(d.getTime())) return false;
  // If midnight local/UTC, extend to 23:59:59.999 of the deadline day
  if (d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0) {
    d.setHours(23, 59, 59, 999);
  }
  return Date.now() > d.getTime();
}

export async function submitStudentRegistration({ semesterId, registrationTypeId, cafeStatus = 'cafe' }, studentId, user) {
  const currentPeriod = await regRepo.getCurrentPeriodForStudent(studentId);
  if (!currentPeriod) {
    throw new ConflictError('Semester registration is not open right now.');
  }

  // Strict backend deadline validation
  if (isPeriodPastDeadline(currentPeriod.deadline)) {
    throw new ConflictError('The registration deadline has passed. Semester registration is now closed.');
  }

  if (currentPeriod.semester_id !== semesterId) {
    throw new ConflictError('Registration is not currently open for the requested semester.');
  }

  if (user.academicStatus && user.academicStatus !== 'active') {
    throw new ConflictError('Only active students may submit semester registrations.');
  }

  // Lock registration type strictly to the student's assigned program_type (RBAC)
  const studentProgramType = (currentPeriod.studentProgramType || user.programType || 'regular').toLowerCase();
  const effectiveType = studentProgramType;

  const allowed = Array.isArray(currentPeriod.allowed_types) && currentPeriod.allowed_types.some((t) => (t.id || '').toLowerCase() === effectiveType);
  if (!allowed) {
    const typeLabel = effectiveType.charAt(0).toUpperCase() + effectiveType.slice(1);
    throw new ForbiddenError(
      `Registration for ${typeLabel} students is not open for this registration period.`
    );
  }

  const normalizedCafeStatus = (cafeStatus || 'cafe').toLowerCase() === 'non-cafe' || (cafeStatus || 'cafe').toLowerCase() === 'non_cafe'
    ? 'non_cafe'
    : 'cafe';

  const existing = currentPeriod.myRegistration;
  if (existing?.status === 'cancelled') {
    return await regRepo.resubmitStudentRegistration({
      id: existing.id,
      periodId: currentPeriod.id,
      registrationTypeId: effectiveType,
      cafeStatus: normalizedCafeStatus,
    });
  }
  if (existing) {
    throw new ConflictError(`You have already registered for ${currentPeriod.semester_name}.`);
  }

  const id = newId('reg');
  const reg = await regRepo.createStudentRegistration({
    id,
    studentId,
    semesterId,
    periodId: currentPeriod.id,
    registrationTypeId: effectiveType,
    cafeStatus: normalizedCafeStatus,
  });

  return reg;
}

export async function cancelStudentRegistration(id, studentId, user) {
  const reg = await regRepo.findRegistrationById(id);
  if (!reg || reg.student_id !== studentId) {
    throw new ConflictError('Registration cannot be cancelled (not found).');
  }
  if (reg.period_id) {
    const period = await regRepo.getRegistrationPeriodById(reg.period_id);
    if (period && isPeriodPastDeadline(period.deadline)) {
      throw new ConflictError('The registration deadline has passed. Registration can no longer be cancelled.');
    }
  }

  const cancelled = await regRepo.cancelStudentRegistration(id, studentId);
  if (!cancelled) {
    throw new ConflictError('Registration cannot be cancelled (not found or not pending).');
  }

  return cancelled;
}

export async function updateStudentRegistration(id, studentId, data, user) {
  const reg = await regRepo.findRegistrationById(id);
  if (!reg || reg.student_id !== studentId) {
    throw new ConflictError('Registration cannot be updated (not found).');
  }
  if (reg.period_id) {
    const period = await regRepo.getRegistrationPeriodById(reg.period_id);
    if (period && isPeriodPastDeadline(period.deadline)) {
      throw new ConflictError('The registration deadline has passed. Registration can no longer be edited.');
    }
  }

  const normalizedCafeStatus = (data?.cafeStatus || 'cafe').toLowerCase() === 'non-cafe' || (data?.cafeStatus || 'cafe').toLowerCase() === 'non_cafe'
    ? 'non_cafe'
    : 'cafe';

  const updated = await regRepo.updateStudentRegistration(id, studentId, { cafeStatus: normalizedCafeStatus });
  if (!updated) {
    throw new ConflictError('Registration cannot be updated (not found or not pending).');
  }

  return updated;
}

export async function deleteStudentRegistration(id, studentId, user) {
  const reg = await regRepo.findRegistrationById(id);
  if (!reg || reg.student_id !== studentId) {
    throw new ConflictError('Registration cannot be deleted (not found).');
  }
  if (reg.period_id) {
    const period = await regRepo.getRegistrationPeriodById(reg.period_id);
    if (period && isPeriodPastDeadline(period.deadline)) {
      throw new ConflictError('The registration deadline has passed. Registration can no longer be deleted.');
    }
  }

  const deleted = await regRepo.deleteStudentRegistration(id, studentId);
  if (!deleted) {
    throw new ConflictError('Registration cannot be deleted (not found or not pending).');
  }

  return deleted;
}

