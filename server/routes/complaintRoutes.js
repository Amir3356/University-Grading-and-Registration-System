import { Router } from 'express';
import * as complaintCtrl from '../controllers/complaintController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRoles } from '../middleware/authorize.js';

export const studentComplaintRouter = Router();
export const adminComplaintRouter = Router();
export const teacherComplaintRouter = Router();

// Student routes
studentComplaintRouter.use(authenticate, requireRoles('student'));
studentComplaintRouter.get('/', complaintCtrl.listComplaints);
studentComplaintRouter.post('/', complaintCtrl.createComplaint);
studentComplaintRouter.get('/:id', complaintCtrl.getComplaintById);
studentComplaintRouter.patch('/:id', complaintCtrl.updateComplaint);
studentComplaintRouter.delete('/:id', complaintCtrl.cancelComplaint);
studentComplaintRouter.post('/:id/cancel', complaintCtrl.cancelComplaint);

// Admin & Department Head routes
adminComplaintRouter.use(authenticate, requireRoles('admin', 'dept_head'));
adminComplaintRouter.get('/', complaintCtrl.listComplaints);
adminComplaintRouter.get('/:id', complaintCtrl.getComplaintById);
adminComplaintRouter.post('/:id/accept', complaintCtrl.acceptComplaint);
adminComplaintRouter.post('/:id/respond', complaintCtrl.respondComplaint);

// Teacher routes
teacherComplaintRouter.use(authenticate, requireRoles('teacher', 'dept_head'));
teacherComplaintRouter.get('/', complaintCtrl.listComplaints);
teacherComplaintRouter.get('/:id', complaintCtrl.getComplaintById);
teacherComplaintRouter.post('/:id/accept', complaintCtrl.acceptComplaint);
teacherComplaintRouter.post('/:id/respond', complaintCtrl.respondComplaint);
