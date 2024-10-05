import * as wsService from '../services/workspaceService.js';

// Teacher Workspace
export async function getTeacherDashboard(req, res, next) {
  try {
    const dashboard = await wsService.getTeacherDashboard(req.user);
    res.status(200).json(dashboard);
  } catch (err) {
    next(err);
  }
}

export async function getTeacherOfferings(req, res, next) {
  try {
    const offerings = await wsService.getTeacherOfferings(req.query, req.user);
    res.status(200).json(offerings);
  } catch (err) {
    next(err);
  }
}

export async function getTeacherOfferingDetail(req, res, next) {
  try {
    const detail = await wsService.getTeacherOfferingDetail(req.params.id, req.user);
    res.status(200).json(detail);
  } catch (err) {
    next(err);
  }
}

export async function listTeacherStudents(req, res, next) {
  try {
    const result = await wsService.listTeacherStudents(req.query, req.user);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

// Student Workspace
export async function getStudentDashboard(req, res, next) {
  try {
    const dashboard = await wsService.getStudentDashboard(req.user);
    res.status(200).json(dashboard);
  } catch (err) {
    next(err);
  }
}

export async function listStudentCourses(req, res, next) {
  try {
    const courses = await wsService.listStudentCourses(req.query, req.user);
    res.status(200).json(courses);
  } catch (err) {
    next(err);
  }
}

export async function getStudentCourseDetail(req, res, next) {
  try {
    const detail = await wsService.getStudentCourseDetail(req.params.enrollmentId, req.user);
    res.status(200).json(detail);
  } catch (err) {
    next(err);
  }
}

export async function listStudentAssessments(req, res, next) {
  try {
    const assessments = await wsService.listStudentAssessments(req.query, req.user);
    res.status(200).json(assessments);
  } catch (err) {
    next(err);
  }
}

export async function getStudentGrades(req, res, next) {
  try {
    const grades = await wsService.getStudentGrades(req.query, req.user);
    res.status(200).json(grades);
  } catch (err) {
    next(err);
  }
}

export async function getStudentGradeReport(req, res, next) {
  try {
    const report = await wsService.getStudentGradeReport(req.query.semesterId, req.user);
    res.status(200).json(report);
  } catch (err) {
    next(err);
  }
}

export async function getStudentProgress(req, res, next) {
  try {
    const progress = await wsService.getStudentProgress(req.user);
    res.status(200).json(progress);
  } catch (err) {
    next(err);
  }
}

export async function getStudentTranscript(req, res, next) {
  try {
    const transcript = await wsService.getStudentTranscript(req.user);
    res.status(200).json(transcript);
  } catch (err) {
    next(err);
  }
}
