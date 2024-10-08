import * as assessmentService from '../services/assessmentService.js';
import { sendSuccess, sendCreated } from '../utils/response.js';

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
    sendCreated(res, assessment);
  } catch (err) {
    next(err);
  }
}

export async function updateAssessment(req, res, next) {
  try {
    const assessment = await assessmentService.updateAssessment(req.params.id, req.body, req.user);
    sendSuccess(res, assessment);
  } catch (err) {
    next(err);
  }
}

export async function deleteAssessment(req, res, next) {
  try {
    const result = await assessmentService.deleteAssessment(req.params.id, req.user);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function releaseAssessment(req, res, next) {
  try {
    const { isReleased } = req.body;
    const assessment = await assessmentService.releaseAssessment(req.params.id, isReleased !== false, req.user);
    sendSuccess(res, assessment);
  } catch (err) {
    next(err);
  }
}

export async function applyTemplate(req, res, next) {
  try {
    const assessments = await assessmentService.applyTemplate(req.params.id, req.user);
    sendCreated(res, assessments);
  } catch (err) {
    next(err);
  }
}
