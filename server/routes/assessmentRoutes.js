import { Router } from 'express';
import * as asmCtrl from '../controllers/assessmentController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRoles } from '../middleware/authorize.js';

const router = Router();

router.use(authenticate, requireRoles('admin', 'dept_head', 'teacher'));
router.get('/', asmCtrl.listAssessmentsPaginated);
router.put('/:id', asmCtrl.updateAssessment);
router.delete('/:id', asmCtrl.deleteAssessment);
router.post('/:id/release', asmCtrl.releaseAssessment);

export default router;
