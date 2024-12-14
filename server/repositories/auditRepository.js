import { query } from '../config/database.js';
import { newId } from '../utils/idGenerator.js';

/**
 * Creates an immutable audit log record.
 */
export async function createAuditEntry(data, client = null) {
  const runner = client ? client.query.bind(client) : query;
  const id = newId('aud');

  const sql = `
    INSERT INTO audit_logs (
      id, actor_id, actor_username, actor_name, actor_role, actor_email,
      department_id, department_name, department_code,
      action, entity_type, entity_id, entity_name,
      description, details, ip_address, user_agent, created_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6,
      $7, $8, $9,
      $10, $11, $12, $13,
      $14, $15, $16, $17, NOW()
    )
    RETURNING *;
  `;

  const values = [
    id,
    data.actorId ?? null,
    data.actorUsername ?? null,
    data.actorName ?? 'System',
    data.actorRole ?? 'system',
    data.actorEmail ?? null,
    data.departmentId ?? null,
    data.departmentName ?? null,
    data.departmentCode ?? null,
    data.action,
    data.entityType,
    data.entityId ?? null,
    data.entityName ?? null,
    data.description,
    JSON.stringify(data.details ?? {}),
    data.ipAddress ?? null,
    data.userAgent ?? null,
  ];

  const res = await runner(sql, values);
  return res.rows[0];
}

/**
 * Lists audit logs with advanced filtering, full-text search, and pagination.
 */
export async function listAuditLogs({
  page = 1,
  pageSize = 20,
  departmentId,
  action,
  entityType,
  actorRole,
  actorId,
  search,
  startDate,
  endDate,
} = {}) {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const size = pageSize === 'all' ? 1000 : Math.max(1, parseInt(pageSize, 10) || 20);
  const offset = (p - 1) * size;

  const conditions = ["al.actor_role = 'dept_head'"];
  const params = [];
  let paramIdx = 1;

  if (departmentId && departmentId !== 'all') {
    conditions.push(`al.department_id = $${paramIdx++}`);
    params.push(departmentId);
  }

  if (action && action !== 'all') {
    conditions.push(`al.action = $${paramIdx++}`);
    params.push(action);
  }

  if (entityType && entityType !== 'all') {
    conditions.push(`al.entity_type = $${paramIdx++}`);
    params.push(entityType);
  }

  if (actorRole && actorRole !== 'all') {
    conditions.push(`al.actor_role = $${paramIdx++}`);
    params.push(actorRole);
  }

  if (actorId) {
    conditions.push(`al.actor_id = $${paramIdx++}`);
    params.push(actorId);
  }

  if (startDate) {
    conditions.push(`al.created_at >= $${paramIdx++}`);
    params.push(new Date(startDate).toISOString());
  }

  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    conditions.push(`al.created_at <= $${paramIdx++}`);
    params.push(end.toISOString());
  }

  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    conditions.push(`(
      al.actor_username ILIKE $${paramIdx} OR
      al.actor_name ILIKE $${paramIdx} OR
      al.actor_email ILIKE $${paramIdx} OR
      al.entity_name ILIKE $${paramIdx} OR
      al.entity_id ILIKE $${paramIdx} OR
      al.description ILIKE $${paramIdx} OR
      al.department_name ILIKE $${paramIdx} OR
      al.department_code ILIKE $${paramIdx}
    )`);
    params.push(term);
    paramIdx++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countSql = `SELECT COUNT(*) as total FROM audit_logs al ${whereClause}`;
  const countRes = await query(countSql, params);
  const total = parseInt(countRes.rows[0]?.total || '0', 10);

  const dataSql = `
    SELECT
      al.id,
      al.actor_id as "actorId",
      al.actor_name as "actorName",
      COALESCE(al.actor_username, u.username, prov.username) as "username",
      COALESCE(al.actor_username, u.username, prov.username) as "actorUsername",
      al.actor_role as "actorRole",
      al.actor_email as "actorEmail",
      COALESCE(dept_assigned.id, al.department_id) as "departmentId",
      COALESCE(dept_assigned.name, al.department_name, '—') as "departmentName",
      COALESCE(dept_assigned.code, al.department_code) as "departmentCode",
      al.action,
      al.entity_type as "entityType",
      al.entity_id as "entityId",
      al.entity_name as "entityName",
      al.description,
      al.details,
      al.ip_address as "ipAddress",
      al.user_agent as "userAgent",
      al.created_at as "createdAt"
    FROM audit_logs al
    LEFT JOIN users u ON u.id = al.actor_id
    LEFT JOIN LATERAL (
      SELECT details->'after'->>'username' as username,
             details->'after'->>'departmentId' as department_id
      FROM audit_logs
      WHERE entity_type = 'user' AND action = 'create' AND entity_id = al.actor_id
      LIMIT 1
    ) prov ON true
    LEFT JOIN teachers t ON t.user_id = al.actor_id
    LEFT JOIN departments dept_assigned ON dept_assigned.id = COALESCE(t.department_id, prov.department_id, al.department_id)
    ${whereClause}
    ORDER BY al.created_at DESC
    LIMIT $${paramIdx++} OFFSET $${paramIdx}
  `;

  const dataRes = await query(dataSql, [...params, size, offset]);

  return {
    items: dataRes.rows,
    total,
    page: p,
    pageSize: size,
    pageCount: Math.max(1, Math.ceil(total / size)),
  };
}

/**
 * Returns KPI summary metrics for the audit trail dashboard.
 */
export async function getAuditSummary({ departmentId, startDate, endDate } = {}) {
  const conditions = ["actor_role = 'dept_head'"];
  const params = [];
  let paramIdx = 1;

  if (departmentId && departmentId !== 'all') {
    conditions.push(`department_id = $${paramIdx++}`);
    params.push(departmentId);
  }

  if (startDate) {
    conditions.push(`created_at >= $${paramIdx++}`);
    params.push(new Date(startDate).toISOString());
  }

  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    conditions.push(`created_at <= $${paramIdx++}`);
    params.push(end.toISOString());
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `
    SELECT
      COUNT(*) as "totalEvents",
      COUNT(*) FILTER (WHERE actor_role = 'dept_head') as "deptHeadEvents",
      COUNT(*) FILTER (WHERE action = 'approve') as "approvals",
      COUNT(*) FILTER (WHERE action = 'reject') as "rejections",
      COUNT(*) FILTER (WHERE action = 'create') as "creations",
      COUNT(*) FILTER (WHERE action = 'update') as "updates",
      COUNT(*) FILTER (WHERE action = 'delete') as "deletions",
      COUNT(*) FILTER (WHERE action = 'other') as "others"
    FROM audit_logs
    ${whereClause};
  `;

  const res = await query(sql, params);
  const row = res.rows[0] || {};

  return {
    totalEvents: parseInt(row.totalEvents || '0', 10),
    deptHeadEvents: parseInt(row.deptHeadEvents || '0', 10),
    approvals: parseInt(row.approvals || '0', 10),
    rejections: parseInt(row.rejections || '0', 10),
    creations: parseInt(row.creations || '0', 10),
    updates: parseInt(row.updates || '0', 10),
    deletions: parseInt(row.deletions || '0', 10),
    others: parseInt(row.others || '0', 10),
  };
}

/**
 * Fetches single audit log entry by ID.
 */
export async function getAuditLogById(id) {
  const sql = `
    SELECT
      al.id,
      al.actor_id as "actorId",
      al.actor_name as "actorName",
      COALESCE(al.actor_username, u.username, prov.username) as "username",
      COALESCE(al.actor_username, u.username, prov.username) as "actorUsername",
      al.actor_role as "actorRole",
      al.actor_email as "actorEmail",
      COALESCE(dept_assigned.id, al.department_id) as "departmentId",
      COALESCE(dept_assigned.name, al.department_name, '—') as "departmentName",
      COALESCE(dept_assigned.code, al.department_code) as "departmentCode",
      al.action,
      al.entity_type as "entityType",
      al.entity_id as "entityId",
      al.entity_name as "entityName",
      al.description,
      al.details,
      al.ip_address as "ipAddress",
      al.user_agent as "userAgent",
      al.created_at as "createdAt"
    FROM audit_logs al
    LEFT JOIN users u ON u.id = al.actor_id
    LEFT JOIN LATERAL (
      SELECT details->'after'->>'username' as username,
             details->'after'->>'departmentId' as department_id
      FROM audit_logs
      WHERE entity_type = 'user' AND action = 'create' AND entity_id = al.actor_id
      LIMIT 1
    ) prov ON true
    LEFT JOIN teachers t ON t.user_id = al.actor_id
    LEFT JOIN departments dept_assigned ON dept_assigned.id = COALESCE(t.department_id, prov.department_id, al.department_id)
    WHERE al.id = $1
  `;
  const res = await query(sql, [id]);
  return res.rows[0] || null;
}
