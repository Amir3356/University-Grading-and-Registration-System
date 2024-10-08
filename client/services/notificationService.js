import * as notificationsApi from '@/api/notifications';
import { bumpVersion } from '@/store/db';

/**
 * Frontend Notifications & Announcements Service
 */

export async function listNotifications(params = {}) {
  return await notificationsApi.listNotifications(params);
}

export async function markNotificationRead(id) {
  const result = await notificationsApi.markNotificationRead(id);
  bumpVersion();
  return result;
}

export async function markAllNotificationsRead() {
  const result = await notificationsApi.markAllNotificationsRead();
  bumpVersion();
  return result;
}

export async function listAnnouncements(params = {}) {
  return await notificationsApi.listAnnouncements(params);
}

export async function createAnnouncement(data) {
  const result = await notificationsApi.createAnnouncement(data);
  bumpVersion();
  return result;
}

export function countUnreadNotifications(notifications = []) {
  return notifications.filter((n) => !n.isRead).length;
}
