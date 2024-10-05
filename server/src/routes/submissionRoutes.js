import { Router } from 'express';
import * as subCtrl from '../controllers/submissionController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRoles } from '../middleware/authorize.js';

const router = Router();

router.use(authenticate);

router.get('/', requireRoles('admin', 'dept_head'), subCtrl.listSubmissions);
router.get('/:id', requireRoles('admin', 'dept_head'), subCtrl.getSubmissionDetail);
router.post('/:id/approve', requireRoles('admin', 'dept_head'), subCtrl.approveSubmission);
router.post('/:id/reject', requireRoles('admin', 'dept_head'), subCtrl.rejectSubmission);
router.post('/:id/publish', requireRoles('admin'), subCtrl.publishSubmission);

export default router;
