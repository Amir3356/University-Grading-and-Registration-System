import { query } from '../config/database.js';

export async function listAuditLogs({ search, action, entityType, userId, from, to, page = 1, pageSize = 10 } = {}) {
  const conditions = [];
  const params = [];

  if (search) {
    params.push(`%${search.trim()}%`);
    conditions.push(`(
      al.details ILIKE $${params.length}
      OR al.action ILIKE $${params.length}
      OR al.reason ILIKE $${params.length}
      OR u.first_name ILIKE $${params.length}
      OR u.last_name ILIKE $${params.length}
      OR u.username ILIKE $${params.length}
    )`);
  }

  if (action) {
    params.push(`${action}%`);
    conditions.push(`al.action ILIKE $${params.length}`);
  }

  if (entityType) {
    params.push(entityType);
    conditions.push(`al.entity_type = $${params.length}`);
  }

  if (userId) {
    params.push(userId);
    conditions.push(`al.user_id = $${params.length}`);
  }

  if (from) {
    params.push(from);
    conditions.push(`al.created_at >= $${params.length}`);
  }

  if (to) {
    params.push(to);
    conditions.push(`al.created_at <= $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countQuery = `
    SELECT count(*) as total
    FROM audit_logs al
    LEFT JOIN users u ON u.id = al.user_id
    ${whereClause}
  `;
  const countRes = await query(countQuery, params);
  const total = parseInt(countRes.rows[0]?.total || '0', 10);

  const limit = pageSize === 'all' ? total || 1 : Math.max(1, parseInt(pageSize, 10) || 10);
  const offset = pageSize === 'all' ? 0 : (Math.max(1, parseInt(page, 10) || 1) - 1) * limit;

  params.push(limit);
  const limitIdx = params.length;
  params.push(offset);
  const offsetIdx = params.length;

  const sql = `
    SELECT al.*,
           (u.first_name || ' ' || u.last_name) as user_name,
           u.role_id as user_role
    FROM audit_logs al
    LEFT JOIN users u ON u.id = al.user_id
    ${whereClause}
    ORDER BY al.created_at DESC
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `;

  const res = await query(sql, params);
  return { items: res.rows, total };
}

export async function listAuditActions() {
  const res = await query(`SELECT DISTINCT action FROM audit_logs ORDER BY action ASC`);
  const prefixes = new Set();
  for (const r of res.rows) {
    const parts = r.action.split('.');
    if (parts[0]) prefixes.add(parts[0]);
  }
  return Array.from(prefixes).sort();
}
