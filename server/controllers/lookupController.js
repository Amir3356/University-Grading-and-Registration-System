import * as lookupService from '../services/lookupService.js';
import { sendSuccess } from '../utils/response.js';

export async function getLookups(req, res, next) {
  try {
    const lookups = await lookupService.getLookups(req.user);
    sendSuccess(res, lookups);
  } catch (err) {
    next(err);
  }
}

export async function getDepartments(req, res, next) {
  try {
    const depts = await lookupService.getDepartments();
    sendSuccess(res, depts);
  } catch (err) {
    next(err);
  }
}

export async function getSemesters(req, res, next) {
  try {
    const semesters = await lookupService.getSemesters();
    sendSuccess(res, semesters);
  } catch (err) {
    next(err);
  }
}

export async function getAcademicYears(req, res, next) {
  try {
    const years = await lookupService.getAcademicYears();
    sendSuccess(res, years);
  } catch (err) {
    next(err);
  }
}

export async function getPrograms(req, res, next) {
  try {
    const programs = await lookupService.getPrograms(req.query.departmentId);
    sendSuccess(res, programs);
  } catch (err) {
    next(err);
  }
}

export async function getTeachers(req, res, next) {
  try {
    const teachers = await lookupService.getTeachers(req.query.departmentId);
    sendSuccess(res, teachers);
  } catch (err) {
    next(err);
  }
}

export async function getWithdrawalReasons(req, res, next) {
  try {
    const reasons = await lookupService.getWithdrawalReasons();
    sendSuccess(res, reasons);
  } catch (err) {
    next(err);
  }
}
