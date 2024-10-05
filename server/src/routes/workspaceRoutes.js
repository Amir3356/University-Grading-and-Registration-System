import { Router } from 'express';
import * as wsCtrl from '../controllers/workspaceController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRoles } from '../middleware/authorize.js';

export const teacherRouter = Router();
export const studentWorkspaceRouter = Router();

// Teacher Workspace
teacherRouter.use(authenticate, requireRoles('teacher', 'dept_head'));
teacherRouter.get('/dashboard', wsCtrl.getTeacherDashboard);
teacherRouter.get('/offerings', wsCtrl.getTeacherOfferings);
teacherRouter.get('/offerings/:id', wsCtrl.getTeacherOfferingDetail);
teacherRouter.get('/students', wsCtrl.listTeacherStudents);

// Student Workspace
studentWorkspaceRouter.use(authenticate, requireRoles('student'));
studentWorkspaceRouter.get('/dashboard', wsCtrl.getStudentDashboard);
studentWorkspaceRouter.get('/courses', wsCtrl.listStudentCourses);
studentWorkspaceRouter.get('/courses/:enrollmentId', wsCtrl.getStudentCourseDetail);
studentWorkspaceRouter.get('/assessments', wsCtrl.listStudentAssessments);
studentWorkspaceRouter.get('/grades', wsCtrl.getStudentGrades);
studentWorkspaceRouter.get('/grade-report', wsCtrl.getStudentGradeReport);
studentWorkspaceRouter.get('/progress', wsCtrl.getStudentProgress);
studentWorkspaceRouter.get('/transcript', wsCtrl.getStudentTranscript);
