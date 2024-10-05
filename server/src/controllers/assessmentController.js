import * as assessmentService from '../services/assessmentService.js';

export async function listAssessments(req, res, next) {
  try {
    const assessments = await assessmentService.listAssessments(req.params.id, req.user);
    res.status(200).json(assessments);
  } catch (err) {
    next(err);
  }
}

export async function createAssessment(req, res, next) {
  try {
    const assessment = await assessmentService.createAssessment(req.params.id, req.body, req.user);
    res.status(201).json(assessment);
  } catch (err) {
    next(err);
  }
}

export async function updateAssessment(req, res, next) {
  try {
    const assessment = await assessmentService.updateAssessment(req.params.id, req.body, req.user);
    res.status(200).json(assessment);
  } catch (err) {
    next(err);
  }
}

export async function deleteAssessment(req, res, next) {
  try {
    const result = await assessmentService.deleteAssessment(req.params.id, req.user);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function releaseAssessment(req, res, next) {
  try {
    const { isReleased } = req.body;
    const assessment = await assessmentService.releaseAssessment(req.params.id, isReleased !== false, req.user);
    res.status(200).json(assessment);
  } catch (err) {
    next(err);
  }
}

export async function applyTemplate(req, res, next) {
  try {
    const assessments = await assessmentService.applyTemplate(req.params.id, req.user);
    res.status(201).json(assessments);
  } catch (err) {
    next(err);
  }
}
