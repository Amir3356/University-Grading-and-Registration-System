import { api } from './client';

/**
 * Notifications & Announcements API calls
 */

export async function listNotifications(params = {}) {
  return await api.get('/notifications', params);
}

export async function markNotificationRead(id) {
  return await api.patch(`/notifications/${id}/read`);
}

export async function markAllNotificationsRead() {
  return await api.patch('/notifications/read-all');
}

export async function listAnnouncements(params = {}) {
  return await api.get('/announcements', params);
}

export async function createAnnouncement(data) {
  return await api.post('/announcements', data);
}

// Backward-compatible named aliases
export const listNotificationsApi = listNotifications;
export const markNotificationReadApi = markNotificationRead;
export const markAllNotificationsReadApi = markAllNotificationsRead;
export const listAnnouncementsApi = listAnnouncements;
export const createAnnouncementApi = createAnnouncement;
