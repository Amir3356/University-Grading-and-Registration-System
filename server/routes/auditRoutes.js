import { Router } from 'express';
import * as auditCtrl from '../controllers/auditController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRoles } from '../middleware/authorize.js';

const router = Router();

// Only authenticated System Administrators can view the Audit Trail
router.use(authenticate, requireRoles('admin'));

router.get('/summary', auditCtrl.getAuditSummary);
router.get('/', auditCtrl.listAuditLogs);
router.get('/:id', auditCtrl.getAuditLog);

export default router;
