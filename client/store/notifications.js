import {
  listNotificationsApi,
  markNotificationReadApi,
  markAllNotificationsReadApi,
  listAnnouncementsApi,
  createAnnouncementApi,
} from '@/api/notifications';
import { bumpVersion } from './db';

export async function listNotifications(params = {}) {
  return await listNotificationsApi(params);
}

export async function markNotificationRead(id) {
  const result = await markNotificationReadApi(id);
  bumpVersion();
  return result;
}

export async function markAllNotificationsRead() {
  const result = await markAllNotificationsReadApi();
  bumpVersion();
  return result;
}

export async function listAnnouncements(params = {}) {
  return await listAnnouncementsApi(params);
}

export async function createAnnouncement(data) {
  const result = await createAnnouncementApi(data);
  bumpVersion();
  return result;
}
