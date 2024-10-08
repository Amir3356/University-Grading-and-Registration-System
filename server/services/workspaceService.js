import * as wsRepo from '../repositories/workspaceRepository.js';
import * as offRepo from '../repositories/offeringRepository.js';
import * as repRepo from '../repositories/reportRepository.js';
import { getAcademicPolicy } from '../repositories/gradebookRepository.js';
import { getAcademicStanding } from '../utils/gpaCalculator.js';
import { getCurrentSemester, getSemesterById } from '../repositories/calendarRepository.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/errors.js';

// ---------------- Teacher Workspace ----------------

export async function getTeacherDashboard(caller) {
  const teacherId = caller.teacherId;
  if (!teacherId) {
    throw new ForbiddenError('You do not have a teacher profile.');
  }
  return await wsRepo.getTeacherDashboard(teacherId, caller.id);
}

export async function getTeacherOfferings(params, caller) {
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
  return await wsRepo.getStudentDashboard(studentId, caller.id);
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

export async function getStudentGradeReport(semesterId, caller) {
  const studentId = caller.studentId;
  if (!studentId) {
    throw new ForbiddenError('You do not have a student profile.');
  }

  const transcript = await repRepo.getStudentTranscriptData(studentId);

  let targetSemesterId = semesterId;
  if (!targetSemesterId) {
    const cur = await getCurrentSemester();
    targetSemesterId = cur?.id || (transcript.semesters[transcript.semesters.length - 1]?.semesterId);
  }

  const semData = transcript.semesters.find((s) => s.semesterId === targetSemesterId);
  const semester = semData
    ? { id: semData.semesterId, name: semData.name, term: semData.term }
    : await getSemesterById(targetSemesterId);

  const policy = await getAcademicPolicy();
  const standing = getAcademicStanding(semData?.cgpa ?? transcript.cgpa, policy.honorsGpa, policy.probationGpa);

  const courses = (semData?.courses || []).map((c) => ({
    code: c.courseCode,
    title: c.courseTitle,
    creditHours: c.creditHours,
    totalScore: c.totalScore,
    letter: c.letter,
    gradePoints: c.gradePoints,
    result: c.letter === 'F' ? 'Fail' : c.letter === 'W' ? 'Withdrawn' : 'Pass',
  }));

  return {
    student: transcript.student,
    semester,
    courses,
    gpa: semData?.gpa || 0,
    cgpa: semData?.cgpa || transcript.cgpa,
    credits: semData?.credits || 0,
    standing,
  };
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
