import * as regService from '../services/registrationService.js';
import { ForbiddenError, ValidationError } from '../utils/errors.js';
import { sendSuccess, sendCreated } from '../utils/response.js';
import { broadcastEvent } from '../config/websocket.js';

// Registration Periods
export async function listPeriods(req, res, next) {
  try {
    const result = await regService.listPeriods(req.query);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function createPeriod(req, res, next) {
  try {
    const period = await regService.createPeriod(req.body, req.user);
    broadcastEvent('PERIOD_CHANGED', { action: 'create', periodId: period.id });
    sendCreated(res, period);
  } catch (err) {
    next(err);
  }
}

export async function updatePeriod(req, res, next) {
  try {
    const period = await regService.updatePeriod(req.params.id, req.body, req.user);
    broadcastEvent('PERIOD_CHANGED', { action: 'update', periodId: period.id });
    sendSuccess(res, period);
  } catch (err) {
    next(err);
  }
}

export async function togglePeriod(req, res, next) {
  try {
    const { id } = req.params;
    const period = await regService.getPeriodById(id);
    let result;
    if (period.status === 'open') {
      result = await regService.closePeriod(id, req.user);
    } else {
      result = await regService.openPeriod(id, req.user);
    }
    broadcastEvent('PERIOD_CHANGED', { action: 'toggle', periodId: id, status: result.status });
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function deletePeriod(req, res, next) {
  try {
    const result = await regService.deletePeriod(req.params.id, req.user);
    broadcastEvent('PERIOD_CHANGED', { action: 'delete', periodId: req.params.id });
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

// Semester Registrations (Admin & Dept Head)
export async function listRegistrations(req, res, next) {
  try {
    const query = { ...req.query };
    if (req.user.roleId === 'dept_head') {
      query.departmentId = req.user.departmentId;
    }
    const result = await regService.listRegistrations(query);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function getSummary(req, res, next) {
  try {
    const summary = await regService.getSummary(req.query.semesterId);
    sendSuccess(res, summary);
  } catch (err) {
    next(err);
  }
}

export async function updateRegistrationStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status, remarks } = req.body;
    let result;
    if (status === 'approved') {
      result = await regService.approveRegistration(id, req.user);
    } else if (status === 'rejected') {
      result = await regService.rejectRegistration(id, remarks, req.user);
    } else {
      throw new ValidationError('Invalid status. Must be approved or rejected.');
    }
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function bulkUpdateStatus(req, res, next) {
  try {
    const { ids, status } = req.body;
    if (status === 'approved') {
      const result = await regService.bulkApproveRegistrations(ids, req.user);
      sendSuccess(res, result);
    } else {
      throw new ValidationError('Bulk operation only supports approval.');
    }
  } catch (err) {
    next(err);
  }
}

export async function updateType(req, res, next) {
  try {
    const result = await regService.updateRegistrationType(req.params.id, req.body.registrationTypeId, req.user);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function deleteRegistration(req, res, next) {
  try {
    const result = await regService.deleteRegistration(req.params.id, req.user);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

// Student self-service
export async function getStudentRegistrations(req, res, next) {
  try {
    if (!req.user.studentId) throw new ForbiddenError('Only students can access registration self-service.');
    const student = await regService.getStudentProfile(req.user.studentId);
    const currentPeriod = await regService.getStudentCurrentPeriod(req.user.studentId);
    const history = await regService.listStudentHistory(req.user.studentId);
    const upcomingPeriod = currentPeriod ? null : await regService.getUpcomingPeriod();
    sendSuccess(res, { currentPeriod, upcomingPeriod, history, student });
  } catch (err) {
    next(err);
  }
}

export async function submitStudentRegistration(req, res, next) {
  try {
    if (!req.user.studentId) throw new ForbiddenError('Only students can register for semesters.');
    const result = await regService.submitStudentRegistration(req.body, req.user.studentId, req.user);
    sendCreated(res, result);
  } catch (err) {
    next(err);
  }
}

export async function cancelStudentRegistration(req, res, next) {
  try {
    if (!req.user.studentId) throw new ForbiddenError('Only students can cancel their registration.');
    const result = await regService.cancelStudentRegistration(req.params.id, req.user.studentId, req.user);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}
