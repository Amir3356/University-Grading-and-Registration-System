import { query, withTransaction } from '../config/database.js';
import { newId } from '../utils/idGenerator.js';

export async function listNotifications(userId, { unreadOnly = false, page = 1, pageSize = 10 } = {}) {
  const conditions = [`user_id = $1`];
  const params = [userId];

  if (unreadOnly) {
    conditions.push(`is_read = false`);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const countQuery = `SELECT count(*) as total FROM notifications ${whereClause}`;
  const countRes = await query(countQuery, params);
  const total = parseInt(countRes.rows[0]?.total || '0', 10);

  const unreadRes = await query(`SELECT count(*) as count FROM notifications WHERE user_id = $1 AND is_read = false`, [userId]);
  const unreadCount = parseInt(unreadRes.rows[0]?.count || '0', 10);

  const limit = pageSize === 'all' ? total || 1 : Math.max(1, parseInt(pageSize, 10) || 10);
  const offset = pageSize === 'all' ? 0 : (Math.max(1, parseInt(page, 10) || 1) - 1) * limit;

  params.push(limit);
  const limitIdx = params.length;
  params.push(offset);
  const offsetIdx = params.length;

  const sql = `
    SELECT *
    FROM notifications
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `;
  const res = await query(sql, params);

  return { items: res.rows, total, unreadCount };
}

export async function getUnreadCount(userId) {
  const res = await query(`SELECT count(*) as count FROM notifications WHERE user_id = $1 AND is_read = false`, [userId]);
  return parseInt(res.rows[0]?.count || '0', 10);
}

export async function markRead(id, userId) {
  const res = await query(
    `UPDATE notifications
     SET is_read = true, read_at = now()
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [id, userId]
  );
  return res.rows[0] || null;
}

export async function markAllRead(userId) {
  await query(
    `UPDATE notifications
     SET is_read = true, read_at = now()
     WHERE user_id = $1 AND is_read = false`,
    [userId]
  );
  return { ok: true };
}

export async function listAnnouncements(userRole, limit = 5) {
  const params = [parseInt(limit, 10) || 5];
  let where = '';
  if (userRole !== 'admin') {
    params.push(userRole);
    where = `WHERE audience = 'all' OR audience = $2`;
  }

  const sql = `
    SELECT a.*,
           (u.first_name || ' ' || u.last_name) as author_name
    FROM announcements a
    JOIN users u ON u.id = a.author_id
    ${where}
    ORDER BY a.created_at DESC
    LIMIT $1
  `;
  const res = await query(sql, params);
  return res.rows;
}

export async function createAnnouncement({ title, body, audience, authorId }) {
  return await withTransaction(async (client) => {
    const id = newId('ann');
    const res = await client.query(
      `INSERT INTO announcements (id, title, body, audience, author_id, created_at)
       VALUES ($1, $2, $3, $4, $5, now())
       RETURNING *`,
      [id, title, body, audience, authorId]
    );
    const ann = res.rows[0];

    // Create notifications for audience users
    let roleFilter = '';
    if (audience !== 'all') {
      roleFilter = `AND role_id = '${audience}'`;
    }
    const usersRes = await client.query(
      `SELECT id FROM users WHERE status = 'active' ${roleFilter}`
    );

    for (const u of usersRes.rows) {
      const nId = newId('ntf');
      await client.query(
        `INSERT INTO notifications (id, user_id, title, message, type)
         VALUES ($1, $2, $3, $4, 'announcement')`,
        [nId, u.id, `Announcement: ${title}`, body]
      );
    }

    return ann;
  });
}
