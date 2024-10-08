import { Router } from 'express';
import * as notifCtrl from '../controllers/notificationController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRoles } from '../middleware/authorize.js';

export const notificationRouter = Router();
export const announcementRouter = Router();

// /notifications
notificationRouter.use(authenticate);
notificationRouter.get('/', notifCtrl.listNotifications);
notificationRouter.get('/unread-count', notifCtrl.getUnreadCount);
notificationRouter.patch('/:id/read', notifCtrl.markRead);
notificationRouter.post('/read-all', notifCtrl.markAllRead);

// /announcements
announcementRouter.use(authenticate);
announcementRouter.get('/', notifCtrl.listAnnouncements);
announcementRouter.post('/', requireRoles('admin'), notifCtrl.createAnnouncement);
