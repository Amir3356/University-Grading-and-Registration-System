import * as regService from '../services/registrationService.js';
import { ForbiddenError, ValidationError } from '../utils/errors.js';

// Registration Periods
export async function listPeriods(req, res, next) {
  try {
    const result = await regService.listPeriods(req.query);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function createPeriod(req, res, next) {
  try {
    const period = await regService.createPeriod(req.body, req.user);
    res.status(201).json(period);
  } catch (err) {
    next(err);
  }
}

export async function updatePeriod(req, res, next) {
  try {
    const period = await regService.updatePeriod(req.params.id, req.body, req.user);
    res.status(200).json(period);
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
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function deletePeriod(req, res, next) {
  try {
    const result = await regService.deletePeriod(req.params.id, req.user);
    res.status(200).json(result);
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
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getSummary(req, res, next) {
  try {
    const summary = await regService.getSummary(req.query.semesterId);
    res.status(200).json(summary);
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
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function bulkUpdateStatus(req, res, next) {
  try {
    const { ids, status } = req.body;
    if (status === 'approved') {
      const result = await regService.bulkApproveRegistrations(ids, req.user);
      res.status(200).json(result);
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
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function deleteRegistration(req, res, next) {
  try {
    const result = await regService.deleteRegistration(req.params.id, req.user);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

// Student self-service
export async function getStudentRegistrations(req, res, next) {
  try {
    if (!req.user.studentId) throw new ForbiddenError('Only students can access registration self-service.');
    const currentPeriod = await regService.getStudentCurrentPeriod(req.user.studentId);
    const history = await regService.listStudentHistory(req.user.studentId);
    res.status(200).json({ currentPeriod, history });
  } catch (err) {
    next(err);
  }
}

export async function submitStudentRegistration(req, res, next) {
  try {
    if (!req.user.studentId) throw new ForbiddenError('Only students can register for semesters.');
    const result = await regService.submitStudentRegistration(req.body, req.user.studentId, req.user);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function cancelStudentRegistration(req, res, next) {
  try {
    if (!req.user.studentId) throw new ForbiddenError('Only students can cancel their registration.');
    const result = await regService.cancelStudentRegistration(req.params.id, req.user.studentId, req.user);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
