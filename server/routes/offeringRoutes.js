import { Router } from 'express';
import * as offCtrl from '../controllers/offeringController.js';
import * as asmCtrl from '../controllers/assessmentController.js';
import * as gbCtrl from '../controllers/gradebookController.js';
import * as subCtrl from '../controllers/submissionController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRoles } from '../middleware/authorize.js';
import { validateRequest } from '../middleware/validate.js';
import {
  createOfferingSchema,
  updateOfferingSchema,
  enrollStudentsSchema,
} from '../validators/offeringValidator.js';
import {
  createAssessmentSchema,
  saveScoresSchema,
  submitGradesSchema,
} from '../validators/gradeValidator.js';

const router = Router();

router.use(authenticate);

// Offerings CRUD
router.get('/', requireRoles('admin', 'dept_head'), offCtrl.listOfferings);
router.post('/', requireRoles('admin', 'dept_head'), validateRequest(createOfferingSchema), offCtrl.createOffering);
router.get('/:id', requireRoles('admin', 'dept_head', 'teacher'), offCtrl.getOffering);
router.put('/:id', requireRoles('admin', 'dept_head'), validateRequest(updateOfferingSchema), offCtrl.updateOffering);
router.delete('/:id', requireRoles('admin', 'dept_head'), offCtrl.deleteOffering);
router.post('/:id/assign-teacher', requireRoles('admin', 'dept_head'), offCtrl.assignTeacher);

// Enrollments
router.get('/:id/enrollments', requireRoles('admin', 'dept_head', 'teacher'), offCtrl.listEnrollments);
router.get('/:id/eligible-students', requireRoles('admin', 'dept_head'), offCtrl.listEligibleStudents);
router.post('/:id/enrollments', requireRoles('admin', 'dept_head'), validateRequest(enrollStudentsSchema), offCtrl.enrollStudents);
router.delete('/:id/enrollments/:enrollmentId', requireRoles('admin', 'dept_head'), offCtrl.deleteEnrollment);
router.post('/:id/enrollments/:enrollmentId/withdraw', requireRoles('admin', 'dept_head'), offCtrl.withdrawEnrollment);

// Nested Assessments
router.get('/:id/assessments', requireRoles('admin', 'dept_head', 'teacher'), asmCtrl.listAssessments);
router.post('/:id/assessments', requireRoles('admin', 'teacher'), validateRequest(createAssessmentSchema), asmCtrl.createAssessment);
router.post('/:id/assessments/template', requireRoles('admin', 'teacher'), asmCtrl.applyTemplate);

// Nested Gradebook & Scores
router.get('/:id/gradebook', requireRoles('admin', 'dept_head', 'teacher'), gbCtrl.getGradebook);
router.patch('/:id/scores', requireRoles('admin', 'teacher'), validateRequest(saveScoresSchema), gbCtrl.saveScores);
router.post('/:id/scores/clear', requireRoles('admin', 'teacher'), gbCtrl.clearScores);
router.get('/:id/grade-history', requireRoles('admin', 'dept_head', 'teacher'), gbCtrl.getGradeHistory);
router.get('/:id/gradebook/export', requireRoles('admin', 'dept_head', 'teacher'), gbCtrl.exportGradebook);
router.post('/:id/gradebook/import', requireRoles('admin', 'teacher'), gbCtrl.importScores);
router.get('/:id/performance', requireRoles('admin', 'dept_head', 'teacher'), gbCtrl.getOfferingPerformance);

// Nested Grade Submissions
router.post('/:id/grade-submissions', requireRoles('admin', 'teacher'), validateRequest(submitGradesSchema), subCtrl.submitGrades);
router.get('/:id/grade-submissions', requireRoles('admin', 'dept_head', 'teacher'), subCtrl.getOfferingSubmissions);

export default router;
