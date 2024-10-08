import { Router } from 'express';
import * as userCtrl from '../controllers/userController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRoles } from '../middleware/authorize.js';
import { validateRequest } from '../middleware/validate.js';
import {
  createUserSchema,
  updateUserSchema,
  toggleStatusSchema,
} from '../validators/userValidator.js';

export const userRouter = Router();
export const studentRouter = Router();
export const teacherRouter = Router();

// /users
userRouter.use(authenticate);
userRouter.get('/suggest-email', requireRoles('admin', 'dept_head'), userCtrl.suggestEmail);
userRouter.get('/suggest-identifier', requireRoles('admin', 'dept_head'), userCtrl.suggestIdentifier);
userRouter.get('/', requireRoles('admin', 'dept_head'), userCtrl.listUsers);
userRouter.post('/', requireRoles('admin', 'dept_head'), validateRequest(createUserSchema), userCtrl.createUser);
userRouter.get('/:id', requireRoles('admin', 'dept_head'), userCtrl.getUserDetail);
userRouter.put('/:id', requireRoles('admin', 'dept_head'), validateRequest(updateUserSchema), userCtrl.updateUser);
userRouter.delete('/:id', requireRoles('admin'), userCtrl.deleteUser);
userRouter.post('/:id/reset-password', requireRoles('admin'), userCtrl.resetPassword);
userRouter.post('/:id/toggle-status', requireRoles('admin'), validateRequest(toggleStatusSchema), userCtrl.setUserStatus);

// /students
studentRouter.use(authenticate);
studentRouter.get('/', requireRoles('admin', 'dept_head'), userCtrl.listStudents);
studentRouter.get('/:id', requireRoles('admin', 'dept_head'), userCtrl.getStudentDetail);

// /teachers
teacherRouter.use(authenticate);
teacherRouter.get('/', requireRoles('admin', 'dept_head'), userCtrl.listTeachers);
teacherRouter.get('/:id', requireRoles('admin', 'dept_head'), userCtrl.getTeacherDetail);
