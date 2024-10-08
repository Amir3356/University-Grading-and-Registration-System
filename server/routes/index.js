import { Router } from 'express';
import authRoutes from './authRoutes.js';
import lookupRoutes from './lookupRoutes.js';
import { userRouter, studentRouter, teacherRouter } from './userRoutes.js';
import {
  departmentRouter,
  programRouter,
  courseRouter,
  calendarRouter,
  yearRouter,
  semesterRouter,
} from './academicRoutes.js';
import {
  periodRouter,
  semesterRegRouter,
  studentRegRouter,
} from './registrationRoutes.js';
import offeringRoutes from './offeringRoutes.js';
import assessmentRoutes from './assessmentRoutes.js';
import submissionRoutes from './submissionRoutes.js';
import gradingRoutes from './gradingRoutes.js';
import {
  adminWithdrawalRouter,
  studentWithdrawalRouter,
} from './withdrawalRoutes.js';
import {
  teacherRouter as teacherWorkspaceRouter,
  studentWorkspaceRouter,
} from './workspaceRoutes.js';
import { reportRouter, studentReportRouter } from './reportRoutes.js';
import { notificationRouter, announcementRouter } from './notificationRoutes.js';
import { settingsRouter, systemRouter } from './settingsRoutes.js';

const apiRouter = Router();


// Authentication & Profile
apiRouter.use('/auth', authRoutes);

// Lookups (Reference data)
apiRouter.use('/lookups', lookupRoutes);

// Users, Students, Teachers
apiRouter.use('/users', userRouter);
apiRouter.use('/students', studentReportRouter);
apiRouter.use('/students', studentRouter);
apiRouter.use('/teachers', teacherRouter);

// Academic Structure
apiRouter.use('/departments', departmentRouter);
apiRouter.use('/programs', programRouter);
apiRouter.use('/courses', courseRouter);
apiRouter.use('/academic-calendar', calendarRouter);
apiRouter.use('/academic-years', yearRouter);
apiRouter.use('/semesters', semesterRouter);

// Registration
apiRouter.use('/registration-periods', periodRouter);
apiRouter.use('/semester-registrations', semesterRegRouter);
apiRouter.use('/student/registrations', studentRegRouter);

// Course Offerings, Assessments, Gradebook, Submissions
apiRouter.use('/offerings', offeringRoutes);
apiRouter.use('/assessments', assessmentRoutes);
apiRouter.use('/grade-submissions', submissionRoutes);
apiRouter.use('/grading', gradingRoutes);

// Withdrawals
apiRouter.use('/withdrawal-requests', adminWithdrawalRouter);
apiRouter.use('/student/withdrawal-requests', studentWithdrawalRouter);

// Dedicated Workspaces
apiRouter.use('/teacher', teacherWorkspaceRouter);
apiRouter.use('/student', studentWorkspaceRouter);

// Reports
apiRouter.use('/reports', reportRouter);

// Notifications & Announcements
apiRouter.use('/notifications', notificationRouter);
apiRouter.use('/announcements', announcementRouter);

// Settings & System
apiRouter.use('/settings', settingsRouter);
apiRouter.use('/system', systemRouter);


export default apiRouter;
