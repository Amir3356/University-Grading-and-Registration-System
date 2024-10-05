import { Router } from 'express';
import * as regCtrl from '../controllers/registrationController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRoles } from '../middleware/authorize.js';

export const periodRouter = Router();
export const semesterRegRouter = Router();
export const studentRegRouter = Router();

// Registration Periods (admin)
periodRouter.use(authenticate, requireRoles('admin'));
periodRouter.get('/', regCtrl.listPeriods);
periodRouter.post('/', regCtrl.createPeriod);
periodRouter.put('/:id', regCtrl.updatePeriod);
periodRouter.post('/:id/toggle', regCtrl.togglePeriod);
periodRouter.delete('/:id', regCtrl.deletePeriod);

// Semester Registrations (admin & dept head)
semesterRegRouter.use(authenticate, requireRoles('admin', 'dept_head'));
semesterRegRouter.get('/summary', regCtrl.getSummary);
semesterRegRouter.get('/', regCtrl.listRegistrations);
semesterRegRouter.post('/bulk-status', requireRoles('admin'), regCtrl.bulkUpdateStatus);
semesterRegRouter.post('/:id/status', requireRoles('admin'), regCtrl.updateRegistrationStatus);
semesterRegRouter.patch('/:id/type', requireRoles('admin'), regCtrl.updateType);
semesterRegRouter.delete('/:id', requireRoles('admin'), regCtrl.deleteRegistration);

// Student self-service
studentRegRouter.use(authenticate, requireRoles('student'));
studentRegRouter.get('/', regCtrl.getStudentRegistrations);
studentRegRouter.post('/', regCtrl.submitStudentRegistration);
studentRegRouter.post('/:id/cancel', regCtrl.cancelStudentRegistration);
