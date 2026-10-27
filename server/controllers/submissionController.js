import * as subService from '../services/submissionService.js';
import { sendSuccess } from '../utils/response.js';
import { broadcastEvent } from '../config/websocket.js';

export async function listSubmissions(req, res, next) {
  try {
    const result = await subService.listSubmissions(req.query, req.user);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function getSubmissionDetail(req, res, next) {
  try {
    const detail = await subService.getSubmissionDetail(req.params.id, req.user);
    sendSuccess(res, detail);
  } catch (err) {
    next(err);
  }
}

export async function approveSubmission(req, res, next) {
  try {
    const result = await subService.approveSubmission(req.params.id, req.body, req.user);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function rejectSubmission(req, res, next) {
  try {
    const result = await subService.rejectSubmission(req.params.id, req.body, req.user);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function publishSubmission(req, res, next) {
  try {
    const result = await subService.publishSubmission(req.params.id, req.user);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function submitGrades(req, res, next) {
  try {
    const { note } = req.body;
    const offeringId = req.params.id || req.body.offeringId;
    const result = await subService.submitGrades(offeringId, { note }, req.user);
    broadcastEvent('OFFERING_UPDATED', { id: offeringId, gradeStatus: 'submitted' });
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}
