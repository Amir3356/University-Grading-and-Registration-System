import * as repService from '../services/reportService.js';

export async function getAdminDashboard(req, res, next) {
  try {
    const dashboard = await repService.getAdminDashboard();
    res.status(200).json(dashboard);
  } catch (err) {
    next(err);
  }
}

export async function getDeptDashboard(req, res, next) {
  try {
    const dashboard = await repService.getDeptDashboard(req.user);
    res.status(200).json(dashboard);
  } catch (err) {
    next(err);
  }
}

export async function getMissingGradesReport(req, res, next) {
  try {
    const report = await repService.getMissingGradesReport(req.query, req.user);
    res.status(200).json(report);
  } catch (err) {
    next(err);
  }
}

export async function getDepartmentReport(req, res, next) {
  try {
    const report = await repService.getDepartmentReport(req.query);
    res.status(200).json(report);
  } catch (err) {
    next(err);
  }
}

export async function getCourseResultsReport(req, res, next) {
  try {
    const report = await repService.getCourseResultsReport(req.query, req.user);
    res.status(200).json(report);
  } catch (err) {
    next(err);
  }
}

export async function getGradeDistributionReport(req, res, next) {
  try {
    const report = await repService.getGradeDistributionReport(req.query, req.user);
    res.status(200).json(report);
  } catch (err) {
    next(err);
  }
}

export async function getGpaReport(req, res, next) {
  try {
    const report = await repService.getGpaReport(req.query, req.user);
    res.status(200).json(report);
  } catch (err) {
    next(err);
  }
}

export async function getRegistrationsReport(req, res, next) {
  try {
    const report = await repService.getRegistrationsReport(req.query);
    res.status(200).json(report);
  } catch (err) {
    next(err);
  }
}

export async function getStudentTranscript(req, res, next) {
  try {
    const transcript = await repService.getStudentTranscript(req.params.id, req.user);
    res.status(200).json(transcript);
  } catch (err) {
    next(err);
  }
}

export async function getStudentPerformance(req, res, next) {
  try {
    const perf = await repService.getStudentPerformance(req.params.id, req.user);
    res.status(200).json(perf);
  } catch (err) {
    next(err);
  }
}
