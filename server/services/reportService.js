import * as repRepo from '../repositories/reportRepository.js';
import { getStudentById } from '../repositories/userRepository.js';
import { ForbiddenError, NotFoundError } from '../utils/errors.js';

export async function getAdminDashboard() {
  return await repRepo.getAdminDashboard();
}

export async function getDeptDashboard(caller) {
  if (!caller.departmentId) {
    throw new ForbiddenError('You are not associated with any department.');
  }
  return await repRepo.getDeptDashboard(caller.departmentId);
}

export async function getMissingGradesReport(params, caller) {
  const queryParams = { ...params };
  if (caller.roleId === 'dept_head') {
    if (queryParams.departmentId && queryParams.departmentId !== caller.departmentId) {
      throw new ForbiddenError('You can only access missing grades for your own department.');
    }
    queryParams.departmentId = caller.departmentId;
  }
  return await repRepo.getMissingGradesReport(queryParams);
}

export async function getDepartmentReport(params) {
  return await repRepo.getDepartmentReport(params);
}

export async function getCourseResultsReport(params, caller) {
  const queryParams = { ...params };
  if (caller.roleId === 'dept_head') {
    if (queryParams.departmentId && queryParams.departmentId !== caller.departmentId) {
      throw new ForbiddenError('You can only access course results for your own department.');
    }
    queryParams.departmentId = caller.departmentId;
  }
  return await repRepo.getCourseResultsReport(queryParams);
}

export async function getGradeDistributionReport(params, caller) {
  const queryParams = { ...params };
  if (caller.roleId === 'dept_head') {
    if (queryParams.departmentId && queryParams.departmentId !== caller.departmentId) {
      throw new ForbiddenError('You can only access grade distribution for your own department.');
    }
    queryParams.departmentId = caller.departmentId;
  }
  return await repRepo.getGradeDistributionReport(queryParams);
}

export async function getGpaReport(params, caller) {
  const queryParams = { ...params };
  if (caller.roleId === 'dept_head') {
    if (queryParams.departmentId && queryParams.departmentId !== caller.departmentId) {
      throw new ForbiddenError('You can only access GPA reports for your own department.');
    }
    queryParams.departmentId = caller.departmentId;
  }
  return await repRepo.getGpaReport(queryParams);
}

export async function getRegistrationsReport(params) {
  return await repRepo.getRegistrationsReport(params);
}

export async function getStudentTranscript(studentId, caller) {
  const student = await getStudentById(studentId);
  if (!student) throw new NotFoundError('Student');

  if (caller.roleId === 'student' && caller.studentId !== studentId) {
    throw new ForbiddenError('You can only access your own transcript.');
  }

  if (caller.roleId === 'dept_head' && student.department_id !== caller.departmentId) {
    throw new ForbiddenError('You can only access transcripts for students in your department.');
  }

  return await repRepo.getStudentTranscriptData(studentId);
}

export async function getStudentPerformance(studentId, caller) {
  const student = await getStudentById(studentId);
  if (!student) throw new NotFoundError('Student');

  if (caller.roleId === 'dept_head' && student.department_id !== caller.departmentId) {
    throw new ForbiddenError('You can only access performance data for students in your department.');
  }

  return await repRepo.getStudentPerformanceReport(studentId);
}
