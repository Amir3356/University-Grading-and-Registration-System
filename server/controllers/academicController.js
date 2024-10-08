import * as academicService from '../services/academicService.js';
import { sendSuccess, sendCreated } from '../utils/response.js';

// Departments
export async function listDepartments(req, res, next) {
  try {
    const result = await academicService.listDepartments(req.query.search);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function getDepartment(req, res, next) {
  try {
    const dept = await academicService.getDepartmentById(req.params.id);
    sendSuccess(res, dept);
  } catch (err) {
    next(err);
  }
}

export async function createDepartment(req, res, next) {
  try {
    const dept = await academicService.createDepartment(req.body, req.user);
    sendCreated(res, dept);
  } catch (err) {
    next(err);
  }
}

export async function updateDepartment(req, res, next) {
  try {
    const dept = await academicService.updateDepartment(req.params.id, req.body, req.user);
    sendSuccess(res, dept);
  } catch (err) {
    next(err);
  }
}

export async function deleteDepartment(req, res, next) {
  try {
    const result = await academicService.deleteDepartment(req.params.id, req.user);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

// Programs
export async function listPrograms(req, res, next) {
  try {
    const query = { ...req.query };
    if (req.user.roleId === 'dept_head') {
      query.departmentId = req.user.departmentId;
    }
    const result = await academicService.listPrograms(query);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function getProgram(req, res, next) {
  try {
    const prog = await academicService.getProgramById(req.params.id, req.user);
    sendSuccess(res, prog);
  } catch (err) {
    next(err);
  }
}

export async function createProgram(req, res, next) {
  try {
    const prog = await academicService.createProgram(req.body, req.user);
    sendCreated(res, prog);
  } catch (err) {
    next(err);
  }
}

export async function updateProgram(req, res, next) {
  try {
    const prog = await academicService.updateProgram(req.params.id, req.body, req.user);
    sendSuccess(res, prog);
  } catch (err) {
    next(err);
  }
}

export async function deleteProgram(req, res, next) {
  try {
    const result = await academicService.deleteProgram(req.params.id, req.user);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function getProgramCurriculum(req, res, next) {
  try {
    const items = await academicService.getProgramCurriculum(req.params.id);
    sendSuccess(res, items);
  } catch (err) {
    next(err);
  }
}

export async function updateProgramCurriculum(req, res, next) {
  try {
    const items = await academicService.updateProgramCurriculum(req.params.id, req.body.courses || req.body, req.user);
    sendSuccess(res, items);
  } catch (err) {
    next(err);
  }
}

// Courses
export async function listCourses(req, res, next) {
  try {
    const query = { ...req.query };
    if (req.user.roleId === 'dept_head') {
      query.departmentId = req.user.departmentId;
    }
    const result = await academicService.listCourses(query, req.user);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function getCourse(req, res, next) {
  try {
    const course = await academicService.getCourseById(req.params.id);
    sendSuccess(res, course);
  } catch (err) {
    next(err);
  }
}

export async function createCourse(req, res, next) {
  try {
    const course = await academicService.createCourse(req.body, req.user);
    sendCreated(res, course);
  } catch (err) {
    next(err);
  }
}

export async function updateCourse(req, res, next) {
  try {
    const course = await academicService.updateCourse(req.params.id, req.body, req.user);
    sendSuccess(res, course);
  } catch (err) {
    next(err);
  }
}

export async function deleteCourse(req, res, next) {
  try {
    const result = await academicService.deleteCourse(req.params.id, req.user);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

// Calendar & Semesters
export async function listAcademicCalendar(req, res, next) {
  try {
    const result = await academicService.listAcademicCalendar();
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function createAcademicYear(req, res, next) {
  try {
    const ay = await academicService.createAcademicYear(req.body, req.user);
    sendCreated(res, ay);
  } catch (err) {
    next(err);
  }
}

export async function updateAcademicYear(req, res, next) {
  try {
    const ay = await academicService.updateAcademicYear(req.params.id, req.body, req.user);
    sendSuccess(res, ay);
  } catch (err) {
    next(err);
  }
}

export async function createSemester(req, res, next) {
  try {
    const sem = await academicService.createSemester(req.body, req.user);
    sendCreated(res, sem);
  } catch (err) {
    next(err);
  }
}

export async function updateSemester(req, res, next) {
  try {
    const sem = await academicService.updateSemester(req.params.id, req.body, req.user);
    sendSuccess(res, sem);
  } catch (err) {
    next(err);
  }
}

export async function activateSemester(req, res, next) {
  try {
    const sem = await academicService.setCurrentSemester(req.params.id, req.user);
    sendSuccess(res, sem);
  } catch (err) {
    next(err);
  }
}

export async function deleteSemester(req, res, next) {
  try {
    const result = await academicService.deleteSemester(req.params.id, req.user);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}
