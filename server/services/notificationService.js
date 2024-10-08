import * as notifRepo from '../repositories/notificationRepository.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';

export async function listNotifications(params, caller) {
  const unreadOnly = params.unreadOnly === true || params.unreadOnly === 'true';
  const page = parseInt(params.page, 10) || 1;
  const pageSize = parseInt(params.pageSize, 10) || 10;
  return await notifRepo.listNotifications(caller.id, { unreadOnly, page, pageSize });
}

export async function getUnreadCount(caller) {
  return await notifRepo.getUnreadCount(caller.id);
}

export async function markRead(id, caller) {
  const updated = await notifRepo.markRead(id, caller.id);
  if (!updated) throw new NotFoundError('Notification');
  return { ok: true, id };
}

export async function markAllRead(caller) {
  await notifRepo.markAllRead(caller.id);
  return { ok: true };
}

export async function listAnnouncements(limit, caller) {
  const numLimit = parseInt(limit, 10) || 5;
  return await notifRepo.listAnnouncements(caller.roleId, numLimit);
}

export async function createAnnouncement(data, caller) {
  const { title, body, audience } = data;
  if (!title || !String(title).trim()) {
    throw new ValidationError('Announcement title is required.', { title: 'Title is required.' });
  }
  if (!body || !String(body).trim()) {
    throw new ValidationError('Announcement body is required.', { body: 'Body is required.' });
  }
  const validAudiences = ['all', 'student', 'teacher', 'dept_head', 'admin'];
  if (!audience || !validAudiences.includes(audience)) {
    throw new ValidationError('Audience must be one of all, student, teacher, dept_head, or admin.', {
      audience: 'Invalid audience.',
    });
  }

  return await notifRepo.createAnnouncement({
    title: title.trim(),
    body: body.trim(),
    audience,
    authorId: caller.id,
  });
}
