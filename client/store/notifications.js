import { api } from '@/api/client'
import { bumpVersion } from './db'

export async function listNotifications(params = {}) {
  return await api.get('/notifications', params)
}

export async function markNotificationRead(id) {
  const result = await api.patch(`/notifications/${id}/read`)
  bumpVersion()
  return result
}

export async function markAllNotificationsRead() {
  const result = await api.post('/notifications/read-all')
  bumpVersion()
  return result
}

export async function listAnnouncements(params = {}) {
  return await api.get('/announcements', params)
}

export async function createAnnouncement(data) {
  const result = await api.post('/announcements', data)
  bumpVersion()
  return result
}
