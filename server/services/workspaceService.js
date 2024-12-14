import * as wsRepo from '../repositories/workspaceRepository.js';
import * as offRepo from '../repositories/offeringRepository.js';
import * as repRepo from '../repositories/reportRepository.js';
import { ForbiddenError, NotFoundError } from '../utils/errors.js';

// ---------------- Teacher Workspace ----------------

export async function getTeacherDashboard(caller) {
  const teacherId = caller.teacherId;
  if (!teacherId) {
    throw new ForbiddenError('You do not have a teacher profile.');
  }
  return await wsRepo.getTeacherDashboard(teacherId);
}

export async function getTeacherOfferings(params, caller) {
  if (caller.roleId === 'dept_head') {
    return await offRepo.listOfferings({
      ...params,
      departmentId: caller.departmentId,
    });
  }
  const teacherId = caller.teacherId;
  if (!teacherId) {
    throw new ForbiddenError('You do not have a teacher profile.');
  }
  return await offRepo.listOfferings({ ...params, teacherId });
}

export async function getTeacherOfferingDetail(offeringId, caller) {
  const detail = await wsRepo.getTeacherOfferingDetail(offeringId);
  if (!detail) throw new NotFoundError('Course offering');

  if (caller.roleId === 'teacher' && detail.offering.teacher_id !== caller.teacherId) {
    throw new ForbiddenError('You can only view details for your assigned offerings.');
  }

  if (caller.roleId === 'dept_head' && detail.offering.course?.department?.id && detail.offering.course.department.id !== caller.departmentId) {
    throw new ForbiddenError('You can only view details for offerings in your department.');
  }

  return detail;
}

export async function listTeacherStudents(params, caller) {
  const teacherId = caller.teacherId;
  if (!teacherId) {
    throw new ForbiddenError('You do not have a teacher profile.');
  }
  return await wsRepo.listTeacherStudents(teacherId, params);
}

// ---------------- Student Workspace ----------------

export async function getStudentDashboard(caller) {
  const studentId = caller.studentId;
  if (!studentId) {
    throw new ForbiddenError('You do not have a student profile.');
  }
  return await wsRepo.getStudentDashboard(studentId);
}

export async function listStudentCourses(params, caller) {
  const studentId = caller.studentId;
  if (!studentId) {
    throw new ForbiddenError('You do not have a student profile.');
  }
  return await wsRepo.listStudentCourses(studentId, params);
}

export async function getStudentCourseDetail(enrollmentId, caller) {
  const studentId = caller.studentId;
  if (!studentId) {
    throw new ForbiddenError('You do not have a student profile.');
  }
  const detail = await wsRepo.getStudentCourseDetail(studentId, enrollmentId);
  if (!detail) throw new NotFoundError('Course enrollment');
  return detail;
}

export async function listStudentAssessments(params, caller) {
  const studentId = caller.studentId;
  if (!studentId) {
    throw new ForbiddenError('You do not have a student profile.');
  }
  return await wsRepo.listStudentAssessments(studentId, params);
}

export async function getStudentGrades(params, caller) {
  const studentId = caller.studentId;
  if (!studentId) {
    throw new ForbiddenError('You do not have a student profile.');
  }
  return await wsRepo.getStudentGrades(studentId, params);
}

export async function getStudentProgress(caller) {
  const studentId = caller.studentId;
  if (!studentId) {
    throw new ForbiddenError('You do not have a student profile.');
  }
  const progress = await wsRepo.getStudentProgress(studentId);
  if (!progress) throw new NotFoundError('Student record');
  return progress;
}

export async function getStudentTranscript(caller) {
  const studentId = caller.studentId;
  if (!studentId) {
    throw new ForbiddenError('You do not have a student profile.');
  }
  return await repRepo.getStudentTranscriptData(studentId);
}
