import { Router } from 'express';
import * as setCtrl from '../controllers/settingsController.js';
import { authenticate, optionalAuthenticate } from '../middleware/auth.js';
import { requireRoles } from '../middleware/authorize.js';

const router = Router();

router.get('/config', optionalAuthenticate, setCtrl.getGradingConfig);
router.put('/scale', authenticate, requireRoles('admin'), setCtrl.updateGradeScale);
router.put('/policy', authenticate, requireRoles('admin'), setCtrl.updateAcademicPolicy);

export default router;
