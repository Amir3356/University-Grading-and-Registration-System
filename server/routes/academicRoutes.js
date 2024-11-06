import { Router } from 'express';
import * as academicCtrl from '../controllers/academicController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRoles } from '../middleware/authorize.js';
import { validateRequest } from '../middleware/validate.js';
import {
  createDepartmentSchema,
  updateDepartmentSchema,
  createProgramSchema,
  createCourseSchema,
  updateCourseSchema,
  createSemesterSchema,
} from '../validators/academicValidator.js';

export const departmentRouter = Router();
export const programRouter = Router();
export const courseRouter = Router();
export const calendarRouter = Router();
export const yearRouter = Router();
export const semesterRouter = Router();

// Departments
departmentRouter.use(authenticate);
departmentRouter.get('/', academicCtrl.listDepartments);
departmentRouter.get('/:id', academicCtrl.getDepartment);
departmentRouter.post('/', requireRoles('admin'), validateRequest(createDepartmentSchema), academicCtrl.createDepartment);
departmentRouter.put('/:id', requireRoles('admin'), validateRequest(updateDepartmentSchema), academicCtrl.updateDepartment);
departmentRouter.delete('/:id', requireRoles('admin'), academicCtrl.deleteDepartment);

// Programs
programRouter.use(authenticate);
programRouter.get('/', academicCtrl.listPrograms);
programRouter.get('/:id', academicCtrl.getProgram);
programRouter.post('/', requireRoles('admin'), validateRequest(createProgramSchema), academicCtrl.createProgram);
programRouter.put('/:id', requireRoles('admin'), academicCtrl.updateProgram);
programRouter.delete('/:id', requireRoles('admin'), academicCtrl.deleteProgram);
programRouter.get('/:id/curriculum', academicCtrl.getProgramCurriculum);
programRouter.put('/:id/curriculum', requireRoles('admin'), academicCtrl.updateProgramCurriculum);

// Courses
courseRouter.use(authenticate);
courseRouter.get('/', academicCtrl.listCourses);
courseRouter.get('/:id', academicCtrl.getCourse);
courseRouter.post('/', requireRoles('admin', 'dept_head'), validateRequest(createCourseSchema), academicCtrl.createCourse);
courseRouter.put('/:id', requireRoles('admin', 'dept_head'), validateRequest(updateCourseSchema), academicCtrl.updateCourse);
courseRouter.delete('/:id', requireRoles('admin', 'dept_head'), academicCtrl.deleteCourse);

// Calendar
calendarRouter.use(authenticate);
calendarRouter.get('/', academicCtrl.listAcademicCalendar);

// Academic Years
yearRouter.use(authenticate);
yearRouter.post('/', requireRoles('admin'), academicCtrl.createAcademicYear);
yearRouter.put('/:id', requireRoles('admin'), academicCtrl.updateAcademicYear);

// Semesters
semesterRouter.use(authenticate);
semesterRouter.post('/', requireRoles('admin'), validateRequest(createSemesterSchema), academicCtrl.createSemester);
semesterRouter.put('/:id', requireRoles('admin'), academicCtrl.updateSemester);
semesterRouter.post('/:id/activate', requireRoles('admin'), academicCtrl.activateSemester);
semesterRouter.delete('/:id', requireRoles('admin'), academicCtrl.deleteSemester);
