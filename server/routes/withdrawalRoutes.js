import { Router } from 'express';
import * as wrCtrl from '../controllers/withdrawalController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRoles } from '../middleware/authorize.js';
import { validateRequest } from '../middleware/validate.js';
import {
  createWithdrawalSchema,
  decideWithdrawalSchema,
  updateClearanceSchema,
} from '../validators/withdrawalValidator.js';

export const adminWithdrawalRouter = Router();
export const studentWithdrawalRouter = Router();

// Student self-service
studentWithdrawalRouter.use(authenticate, requireRoles('student'));
studentWithdrawalRouter.get('/', wrCtrl.listStudentWithdrawals);
studentWithdrawalRouter.post('/', validateRequest(createWithdrawalSchema), wrCtrl.createStudentWithdrawal);
studentWithdrawalRouter.post('/:id/cancel', wrCtrl.cancelStudentWithdrawal);

// Admin & Dept Head management
adminWithdrawalRouter.use(authenticate);
adminWithdrawalRouter.get('/summary', requireRoles('admin'), wrCtrl.getWithdrawalsSummary);
adminWithdrawalRouter.get('/', requireRoles('admin', 'dept_head'), wrCtrl.listAdminWithdrawals);
adminWithdrawalRouter.get('/:id', requireRoles('admin', 'dept_head'), wrCtrl.getWithdrawalById);
adminWithdrawalRouter.patch('/:id/clearances/:office', requireRoles('admin', 'dept_head'), validateRequest(updateClearanceSchema), wrCtrl.updateClearance);
adminWithdrawalRouter.post('/:id/approve', requireRoles('admin'), validateRequest(decideWithdrawalSchema), wrCtrl.approveWithdrawal);
adminWithdrawalRouter.post('/:id/reject', requireRoles('admin'), validateRequest(decideWithdrawalSchema), wrCtrl.rejectWithdrawal);
