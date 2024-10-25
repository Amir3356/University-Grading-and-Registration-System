import * as deptRepo from '../repositories/departmentRepository.js';
import * as progRepo from '../repositories/programRepository.js';
import * as courseRepo from '../repositories/courseRepository.js';
import * as calRepo from '../repositories/calendarRepository.js';
import { newId } from '../utils/idGenerator.js';
import { ConflictError, NotFoundError, ValidationError, ForbiddenError } from '../utils/errors.js';
import { query } from '../config/database.js';

// ----------------- Departments -----------------

export async function listDepartments(search) {
  return await deptRepo.listDepartments(search);
}

export async function getDepartmentById(id) {
  const dept = await deptRepo.findById(id);
  if (!dept) throw new NotFoundError('Department');
  return dept;
}


export async function createDepartment(data, user) {
  if (!data.name?.trim()) throw new ValidationError('Department name is required.', { name: 'Name is required.' });
  let code = data.code?.trim().toUpperCase();
  if (!code) {
    code = data.name.trim().split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 6);
  }

  const existingCode = await deptRepo.findByCode(code);
  if (existingCode) throw new ValidationError('Department code is already in use.', { code: 'Code is already in use.' });

  const id = `dep_${code.toLowerCase()}`;
  const dept = await deptRepo.createDepartment({
    id,
    code,
    name: data.name.trim(),
    description: data.description,
    headTeacherId: data.headTeacherId,
  });

  return dept;
}

export async function updateDepartment(id, data, user) {
  const existing = await deptRepo.findById(id);
  if (!existing) throw new NotFoundError('Department');

  const dept = await deptRepo.updateDepartment(id, {
    code: data.code?.trim().toUpperCase(),
    name: data.name?.trim(),
    description: data.description,
    headTeacherId: data.headTeacherId,
  });

  return dept;
}

export async function deleteDepartment(id, user) {
  const existing = await deptRepo.findById(id);
  if (!existing) throw new NotFoundError('Department');

  const hasDeps = await deptRepo.hasDependencies(id);
  if (hasDeps) {
    throw new ConflictError('Cannot delete department with associated courses, teachers, or students.');
  }

  await deptRepo.deleteDepartment(id);
  return { ok: true };
}

// ----------------- Programs -----------------

export async function listPrograms({ departmentId } = {}) {
  return await progRepo.listPrograms({ departmentId });
}

export async function getProgramById(id, user = null) {
  const prog = await progRepo.findById(id);
  if (!prog) throw new NotFoundError('Program');
  if (user?.roleId === 'dept_head' && prog.department_id !== user.departmentId) {
    throw new ForbiddenError('You can only view programs in your department.');
  }
  return prog;
}


export async function createProgram(data, user) {
  if (!data.name?.trim()) throw new ValidationError('Program name is required.', { name: 'Name is required.' });
  if (!data.code?.trim()) throw new ValidationError('Program code is required.', { code: 'Code is required.' });
  if (!data.departmentId) throw new ValidationError('Department is required.', { departmentId: 'Department is required.' });

  const id = newId('prg');
  const prog = await progRepo.createProgram({
    id,
    departmentId: data.departmentId,
    code: data.code.trim().toUpperCase(),
    name: data.name.trim(),
    durationYears: data.durationYears || 4,
    requiredCredits: data.requiredCredits || 140,
  });

  return prog;
}

export async function updateProgram(id, data, user) {
  const prog = await progRepo.updateProgram(id, data);
  if (!prog) throw new NotFoundError('Program');

  return prog;
}

export async function deleteProgram(id, user) {
  const hasStudents = await progRepo.hasStudents(id);
  if (hasStudents) {
    throw new ConflictError('Cannot delete program with registered students.');
  }
  await progRepo.deleteProgram(id);
  return { ok: true };
}

export async function getProgramCurriculum(programId) {
  return await progRepo.getCurriculum(programId);
}

export async function updateProgramCurriculum(programId, coursesList, user) {
  await progRepo.updateCurriculum(programId, coursesList);
  return await progRepo.getCurriculum(programId);
}

// ----------------- Courses -----------------

export async function listCourses(filters, user) {
  if (user?.roleId === 'dept_head') {
    filters.departmentId = user.departmentId;
  }
  return await courseRepo.listCourses(filters);
}

export async function getCourseById(id) {
  const course = await courseRepo.findById(id);
  if (!course) throw new NotFoundError('Course');
  return course;
}


export async function createCourse(data, user) {
  if (user?.roleId === 'dept_head') {
    data.departmentId = user.departmentId;
  }

  const errors = {};
  if (!data.code?.trim()) errors.code = 'Course code is required.';
  else if (!/^[A-Z]{2,6}\d{3}[A-Z]?$/i.test(data.code.trim())) {
    errors.code = 'Course code must match format like CS101 or SWE301.';
  }
  if (!data.title?.trim()) errors.title = 'Course title is required.';
  if (!data.departmentId) errors.departmentId = 'Department is required.';
  const creditHours = parseInt(data.creditHours, 10);
  if (Number.isNaN(creditHours) || creditHours < 1 || creditHours > 6) {
    errors.creditHours = 'Credit hours must be between 1 and 6.';
  }

  if (Object.keys(errors).length > 0) throw new ValidationError('Invalid course input.', errors);

  const existing = await courseRepo.findByCode(data.code.trim());
  if (existing) throw new ValidationError('Course code already exists.', { code: 'Course code already exists.' });

  const id = `crs_${data.code.trim().toLowerCase()}`;
  const course = await courseRepo.createCourse({
    id,
    code: data.code.trim().toUpperCase(),
    title: data.title.trim(),
    departmentId: data.departmentId,
    creditHours,
    level: data.level || 100,
    description: data.description,
  });

  return course;
}

export async function updateCourse(id, data, user) {
  const existing = await courseRepo.findById(id);
  if (!existing) throw new NotFoundError('Course');

  if (user?.roleId === 'dept_head' && existing.department_id !== user.departmentId) {
    throw new ForbiddenError('You can only edit courses in your department.');
  }

  // If credit hours changed, check if published grades exist
  if (data.creditHours && parseInt(data.creditHours, 10) !== existing.credit_hours) {
    const hasPub = await courseRepo.hasPublishedGrades(id);
    if (hasPub) {
      throw new ConflictError('Cannot change credit hours after grades have been published for this course.');
    }
  }

  const course = await courseRepo.updateCourse(id, {
    code: data.code?.trim().toUpperCase(),
    title: data.title?.trim(),
    departmentId: data.departmentId,
    creditHours: data.creditHours ? parseInt(data.creditHours, 10) : undefined,
    level: data.level ? parseInt(data.level, 10) : undefined,
    description: data.description,
    status: data.status,
  });

  return course;
}

export async function deleteCourse(id, user) {
  const existing = await courseRepo.findById(id);
  if (!existing) throw new NotFoundError('Course');

  if (user?.roleId === 'dept_head' && existing.department_id !== user.departmentId) {
    throw new ForbiddenError('You can only delete courses in your department.');
  }

  const hasOff = await courseRepo.hasOfferings(id);
  if (hasOff) {
    throw new ConflictError('Cannot delete a course that was ever offered. Archive it instead.');
  }

  await courseRepo.deleteCourse(id);
  return { ok: true };
}

// ----------------- Calendar -----------------

export async function listAcademicCalendar() {
  return await calRepo.listAcademicCalendar();
}

export async function createAcademicYear(data, user) {
  if (!data.name?.trim()) throw new ValidationError('Academic year name is required.', { name: 'Name is required.' });
  if (!data.startDate || !data.endDate) throw new ValidationError('Dates are required.');
  if (data.endDate <= data.startDate) throw new ValidationError('End date must be after start date.');

  const id = `ay_${data.name.trim().replace('/', '_')}`;
  const year = await calRepo.createAcademicYear({
    id,
    name: data.name.trim(),
    startDate: data.startDate,
    endDate: data.endDate,
  });

  return year;
}

export async function updateAcademicYear(id, data, user) {
  const year = await calRepo.updateAcademicYear(id, data);
  if (!year) throw new NotFoundError('Academic year');

  return year;
}

export async function createSemester(data, user) {
  if (!data.academicYearId) throw new ValidationError('Academic year is required.', { academicYearId: 'Required' });
  if (!data.term) throw new ValidationError('Term is required.', { term: 'Required' });
  if (!data.startDate || !data.endDate) throw new ValidationError('Dates are required.');

  const id = `sem_${Date.now()}`;
  const termLabels = { first: 'First Semester', second: 'Second Semester', summer: 'Summer Semester' };
  const year = await calRepo.getAcademicYearById(data.academicYearId);
  const yearPrefix = year?.name?.split('/')[0] || new Date(data.startDate).getFullYear();
  const name = data.name || `${yearPrefix} ${termLabels[data.term] || data.term}`;

  const sem = await calRepo.createSemester({
    id,
    academicYearId: data.academicYearId,
    term: data.term,
    name,
    startDate: data.startDate,
    endDate: data.endDate,
    gradeSubmissionDeadline: data.gradeSubmissionDeadline || data.endDate,
    withdrawalDeadline: data.withdrawalDeadline || null,
  });

  return sem;
}

export async function updateSemester(id, data, user) {
  const sem = await calRepo.updateSemester(id, data);
  if (!sem) throw new NotFoundError('Semester');

  return sem;
}

export async function setCurrentSemester(id, user) {
  const target = await calRepo.setCurrentSemester(id);
  if (!target) throw new NotFoundError('Semester');

  return target;
}

export async function deleteSemester(id, user) {
  const sem = await calRepo.getSemesterById(id);
  if (!sem) throw new NotFoundError('Semester');
  if (sem.is_current) throw new ConflictError('Cannot delete the current active semester.');

  const hasOff = await calRepo.hasOfferings(id);
  if (hasOff) throw new ConflictError('Cannot delete semester that has course offerings assigned.');

  await calRepo.deleteSemester(id);
  return { ok: true };
}
