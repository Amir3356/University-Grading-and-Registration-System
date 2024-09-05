import { newId, now, read, transaction } from './db'
import { audit, currentUser, forbidden, notFound, paginate, requireRole, required, validate } from './helpers'

export function listNotifications({ unreadOnly = false, page = 1, pageSize = 20 } = {}) {
  const user = currentUser()
  const items = read()
    .notifications.filter((n) => n.userId === user.id && (!unreadOnly || !n.isRead))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return { ...paginate(items, { page, pageSize }), unreadCount: read().notifications.filter((n) => n.userId === user.id && !n.isRead).length }
}

export function markNotificationRead(id) {
  const user = currentUser()
  const n = read().notifications.find((x) => x.id === id)
  if (!n) throw notFound('Notification')
  if (n.userId !== user.id) throw forbidden()
  transaction((tx) => tx.update('notifications', id, { isRead: true }))
  return { ok: true }
}

export function markAllNotificationsRead() {
  const user = currentUser()
  transaction((tx) => {
    for (const n of tx.table('notifications')) if (n.userId === user.id) n.isRead = true
  })
  return { ok: true }
}

export function listAnnouncements({ limit = 5 } = {}) {
  const user = currentUser()
  const items = read()
    .announcements.filter((a) => a.audience === 'all' || a.audience === user.roleId || user.roleId === 'admin')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return items.slice(0, limit)
}

export function createAnnouncement({ title, body, audience }) {
  const user = requireRole('admin')
  validate({
    title: () => required(title, 'Title'),
    body: () => required(body, 'Message'),
    audience: () => (['all', 'student', 'teacher'].includes(audience) ? null : 'Choose an audience.'),
  })
  return transaction((tx) => {
    const a = tx.insert('announcements', { id: newId('ann'), title: title.trim(), body: body.trim(), audience, authorId: user.id, createdAt: now() })
    for (const u of tx.table('users').filter((x) => x.status === 'active' && x.id !== user.id && (audience === 'all' || x.roleId === audience))) {
      tx.insert('notifications', { id: newId('ntf'), userId: u.id, title: a.title, message: a.body, type: 'announcement', link: null, isRead: false, createdAt: now() })
    }
    audit(tx, user, { action: 'announcement.created', entityType: 'announcement', entityId: a.id, details: `Posted announcement "${a.title}"` })
    return a
  })
}
