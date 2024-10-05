import * as offeringService from '../services/offeringService.js';

export async function listOfferings(req, res, next) {
  try {
    const result = await offeringService.listOfferings(req.query, req.user);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getOffering(req, res, next) {
  try {
    const offering = await offeringService.getOfferingById(req.params.id, req.user);
    res.status(200).json(offering);
  } catch (err) {
    next(err);
  }
}

export async function createOffering(req, res, next) {
  try {
    const offering = await offeringService.createOffering(req.body, req.user);
    res.status(201).json(offering);
  } catch (err) {
    next(err);
  }
}

export async function updateOffering(req, res, next) {
  try {
    const offering = await offeringService.updateOffering(req.params.id, req.body, req.user);
    res.status(200).json(offering);
  } catch (err) {
    next(err);
  }
}

export async function deleteOffering(req, res, next) {
  try {
    const result = await offeringService.deleteOffering(req.params.id, req.user);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function assignTeacher(req, res, next) {
  try {
    const { teacherId } = req.body;
    const offering = await offeringService.updateOffering(req.params.id, { teacherId }, req.user);
    res.status(200).json(offering);
  } catch (err) {
    next(err);
  }
}

export async function listEnrollments(req, res, next) {
  try {
    const enrollments = await offeringService.listEnrollments(req.params.id);
    res.status(200).json(enrollments);
  } catch (err) {
    next(err);
  }
}

export async function listEligibleStudents(req, res, next) {
  try {
    const students = await offeringService.listEligibleStudents(req.params.id, req.query);
    res.status(200).json(students);
  } catch (err) {
    next(err);
  }
}

export async function enrollStudents(req, res, next) {
  try {
    const { studentIds, studentId } = req.body;
    const ids = studentIds || (studentId ? [studentId] : []);
    const result = await offeringService.enrollStudents(req.params.id, ids, req.user);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function deleteEnrollment(req, res, next) {
  try {
    const { enrollmentId } = req.params;
    const result = await offeringService.deleteEnrollment(enrollmentId, req.user);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function withdrawEnrollment(req, res, next) {
  try {
    const { enrollmentId } = req.params;
    const { reason } = req.body;
    const result = await offeringService.withdrawEnrollment(enrollmentId, reason, req.user);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
