import * as offeringService from '../services/offeringService.js';
import { sendSuccess, sendCreated } from '../utils/response.js';

export async function listOfferings(req, res, next) {
  try {
    const result = await offeringService.listOfferings(req.query, req.user);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function getOffering(req, res, next) {
  try {
    const offering = await offeringService.getOfferingById(req.params.id, req.user);
    sendSuccess(res, offering);
  } catch (err) {
    next(err);
  }
}

export async function createOffering(req, res, next) {
  try {
    const offering = await offeringService.createOffering(req.body, req.user);
    sendCreated(res, offering);
  } catch (err) {
    next(err);
  }
}

export async function updateOffering(req, res, next) {
  try {
    const offering = await offeringService.updateOffering(req.params.id, req.body, req.user);
    sendSuccess(res, offering);
  } catch (err) {
    next(err);
  }
}

export async function deleteOffering(req, res, next) {
  try {
    const result = await offeringService.deleteOffering(req.params.id, req.user);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function assignTeacher(req, res, next) {
  try {
    const { teacherId } = req.body;
    const offering = await offeringService.updateOffering(req.params.id, { teacherId }, req.user);
    sendSuccess(res, offering);
  } catch (err) {
    next(err);
  }
}

export async function listEnrollments(req, res, next) {
  try {
    const enrollments = await offeringService.listEnrollments(req.params.id);
    sendSuccess(res, enrollments);
  } catch (err) {
    next(err);
  }
}

export async function listEligibleStudents(req, res, next) {
  try {
    const students = await offeringService.listEligibleStudents(req.params.id, req.query);
    sendSuccess(res, students);
  } catch (err) {
    next(err);
  }
}

export async function enrollStudents(req, res, next) {
  try {
    const { studentIds, studentId } = req.body;
    const ids = studentIds || (studentId ? [studentId] : []);
    const result = await offeringService.enrollStudents(req.params.id, ids, req.user);
    sendCreated(res, result);
  } catch (err) {
    next(err);
  }
}

export async function deleteEnrollment(req, res, next) {
  try {
    const { enrollmentId } = req.params;
    const result = await offeringService.deleteEnrollment(enrollmentId, req.user);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function withdrawEnrollment(req, res, next) {
  try {
    const { enrollmentId } = req.params;
    const { reason } = req.body;
    const result = await offeringService.withdrawEnrollment(enrollmentId, reason, req.user);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}
