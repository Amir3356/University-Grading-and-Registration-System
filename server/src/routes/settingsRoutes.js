import { Router } from 'express';
import * as setCtrl from '../controllers/settingsController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRoles } from '../middleware/authorize.js';

export const settingsRouter = Router();
export const systemRouter = Router();

// /settings
settingsRouter.use(authenticate, requireRoles('admin'));
settingsRouter.get('/', setCtrl.getFullSettings);
settingsRouter.put('/university', setCtrl.updateUniversitySettings);

// /system
systemRouter.use(authenticate, requireRoles('admin'));
systemRouter.get('/backup', setCtrl.backupSystem);
systemRouter.post('/reset-demo-data', setCtrl.resetDemoData);
