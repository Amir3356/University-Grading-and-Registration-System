import * as assessmentService from '../services/assessmentService.js';
import { sendSuccess, sendCreated } from '../utils/response.js';
import { broadcastEvent } from '../config/websocket.js';

export async function listAssessmentsPaginated(req, res, next) {
  try {
    const result = await assessmentService.listTeacherAssessments(req.query, req.user);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function listAssessments(req, res, next) {
  try {
    const assessments = await assessmentService.listAssessments(req.params.id, req.user);
    sendSuccess(res, assessments);
  } catch (err) {
    next(err);
  }
}

export async function createAssessment(req, res, next) {
  try {
    const assessment = await assessmentService.createAssessment(req.params.id, req.body, req.user);
    broadcastEvent('ASSESSMENT_CREATED', { offeringId: req.params.id, assessment });
    sendCreated(res, assessment);
  } catch (err) {
    next(err);
  }
}

export async function updateAssessment(req, res, next) {
  try {
    const assessment = await assessmentService.updateAssessment(req.params.id, req.body, req.user);
    broadcastEvent('ASSESSMENT_UPDATED', { offeringId: assessment.offeringId || assessment.offering_id || req.params.id, assessment });
    sendSuccess(res, assessment);
  } catch (err) {
    next(err);
  }
}

export async function deleteAssessment(req, res, next) {
  try {
    const result = await assessmentService.deleteAssessment(req.params.id, req.user);
    broadcastEvent('ASSESSMENT_DELETED', { offeringId: result.offeringId, id: req.params.id });
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function releaseAssessment(req, res, next) {
  try {
    const { isReleased } = req.body;
    const assessment = await assessmentService.releaseAssessment(req.params.id, isReleased !== false, req.user);
    broadcastEvent('ASSESSMENT_UPDATED', { offeringId: assessment.offeringId || assessment.offering_id, assessment });
    sendSuccess(res, assessment);
  } catch (err) {
    next(err);
  }
}

export async function applyTemplate(req, res, next) {
  try {
    const assessments = await assessmentService.applyTemplate(req.params.id);
    broadcastEvent('ASSESSMENT_CREATED', { offeringId: req.params.id, assessments });
    sendCreated(res, assessments);
  } catch (err) {
    next(err);
  }
}
