import { Router } from 'express';
import * as auditCtrl from '../controllers/auditController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRoles } from '../middleware/authorize.js';

const router = Router();

router.use(authenticate, requireRoles('admin'));
router.get('/', auditCtrl.listAuditLogs);
router.get('/actions', auditCtrl.listAuditActions);

export default router;
