import { Router } from 'express';
import * as repCtrl from '../controllers/reportController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRoles } from '../middleware/authorize.js';

export const reportRouter = Router();
export const studentReportRouter = Router();

// /reports
reportRouter.use(authenticate);
reportRouter.get('/admin-dashboard', requireRoles('admin'), repCtrl.getAdminDashboard);
reportRouter.get('/dept-dashboard', requireRoles('dept_head'), repCtrl.getDeptDashboard);
reportRouter.get('/missing-grades', requireRoles('admin', 'dept_head'), repCtrl.getMissingGradesReport);
reportRouter.get('/departments', requireRoles('admin'), repCtrl.getDepartmentReport);
reportRouter.get('/course-results', requireRoles('admin', 'dept_head'), repCtrl.getCourseResultsReport);
reportRouter.get('/grade-distribution', requireRoles('admin', 'dept_head'), repCtrl.getGradeDistributionReport);
reportRouter.get('/gpa', requireRoles('admin', 'dept_head'), repCtrl.getGpaReport);
reportRouter.get('/registrations', requireRoles('admin'), repCtrl.getRegistrationsReport);

// Student transcript and performance under /students/:id/...
studentReportRouter.use(authenticate);
studentReportRouter.get('/:id/transcript', requireRoles('admin', 'dept_head', 'student'), repCtrl.getStudentTranscript);
studentReportRouter.get('/:id/performance', requireRoles('admin', 'dept_head'), repCtrl.getStudentPerformance);
