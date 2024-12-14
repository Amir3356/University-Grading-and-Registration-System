import { createAuditEntry } from '../repositories/auditRepository.js';
import * as deptRepo from '../repositories/departmentRepository.js';
import { query } from '../config/database.js';
import { broadcastEvent } from '../config/websocket.js';

/** In-memory cache for department metadata to avoid redundant DB queries */
const deptCache = new Map();

async function resolveDepartmentInfo(deptId) {
  if (!deptId) return { id: null, name: null, code: null };
  if (deptCache.has(deptId)) return deptCache.get(deptId);

  try {
    const dept = await deptRepo.findById(deptId);
    if (dept) {
      const info = { id: dept.id, name: dept.name, code: dept.code };
      deptCache.set(deptId, info);
      return info;
    }
  } catch (err) {
    console.warn('[AuditLogger] Could not resolve department info for', deptId, err.message);
  }
  return { id: deptId, name: null, code: null };
}

/**
 * Centrally records an immutable audit log entry.
 * Safely handles missing fields and prevents failures from breaking the calling transaction.
 */
export async function logAudit({
  req = null,
  actor = null,
  action,
  entityType,
  entityId = null,
  entityName = null,
  description = '',
  details = {},
  departmentId = null,
  departmentName = null,
  departmentCode = null,
  client = null,
} = {}) {
  try {
    const dbRunner = client ? client.query.bind(client) : query;

    // 1. Resolve Actor Details
    const user = actor || req?.user || {};
    const actorId = user.id || null;
    let actorRole = (user.roleId || user.role || '').toLowerCase();

    // Verify if actor is a Department Head
    if (actorRole !== 'dept_head' && actorId) {
      try {
        const uRole = await dbRunner(`SELECT role_id FROM users WHERE id = $1`, [actorId]);
        if (uRole.rows.length > 0 && uRole.rows[0].role_id === 'dept_head') {
          actorRole = 'dept_head';
        } else {
          const hCheck = await dbRunner(
            `SELECT d.id FROM departments d JOIN teachers t ON t.id = d.head_teacher_id WHERE t.user_id = $1 LIMIT 1`,
            [actorId]
          );
          if (hCheck.rows.length > 0) {
            actorRole = 'dept_head';
          }
        }
      } catch {}
    }

    // The audit trail strictly tracks Department Head activities
    if (actorRole !== 'dept_head') {
      return null;
    }

    let actorUsername = user.username || null;
    let actorName =
      user.name ||
      (user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : null) ||
      null;
    let actorEmail = user.email || null;

    // Ensure username, full name, and email are populated from users table if missing from actor object
    if (actorId && (!actorUsername || !actorName || !actorEmail)) {
      try {
        const uRes = await dbRunner(
          `SELECT username, first_name, last_name, email FROM users WHERE id = $1`,
          [actorId]
        );
        if (uRes.rows.length > 0) {
          const row = uRes.rows[0];
          if (!actorUsername) actorUsername = row.username;
          if (!actorName) {
            actorName = `${row.first_name || ''} ${row.last_name || ''}`.trim() || row.username;
          }
          if (!actorEmail) actorEmail = row.email;
        }
      } catch {}
    }

    // If still missing actorUsername, retrieve the username entered during Account Provision
    if (actorId && !actorUsername) {
      try {
        const pRes = await dbRunner(
          `SELECT details->'after'->>'username' as username,
                  details->'after'->>'name' as name
           FROM audit_logs
           WHERE entity_type = 'user' AND action = 'create' AND entity_id = $1
           LIMIT 1`,
          [actorId]
        );
        if (pRes.rows.length > 0 && pRes.rows[0].username) {
          actorUsername = pRes.rows[0].username;
          if (!actorName) actorName = pRes.rows[0].name;
        }
      } catch {}
    }

    if (!actorName) actorName = actorUsername || 'Department Head';

    // 2. Resolve Department Details from the department assigned during Account Provision
    let targetDeptId = null;

    if (actorId) {
      // Look up assigned department from teacher profile created in Account Provision
      try {
        const tRes = await dbRunner(
          `SELECT department_id FROM teachers WHERE user_id = $1 LIMIT 1`,
          [actorId]
        );
        if (tRes.rows.length > 0 && tRes.rows[0].department_id) {
          targetDeptId = tRes.rows[0].department_id;
        }
      } catch {}

      // If not found in teacher table, look up from department head assignment
      if (!targetDeptId) {
        try {
          const dRes = await dbRunner(
            `SELECT d.id FROM departments d JOIN teachers t ON t.id = d.head_teacher_id WHERE t.user_id = $1 LIMIT 1`,
            [actorId]
          );
          if (dRes.rows.length > 0) {
            targetDeptId = dRes.rows[0].id;
          }
        } catch {}
      }

      // If user was deleted, look up from Account Provision audit details
      if (!targetDeptId) {
        try {
          const pRes = await dbRunner(
            `SELECT details->'after'->>'departmentId' as dept_id
             FROM audit_logs
             WHERE entity_type = 'user' AND action = 'create' AND entity_id = $1
             LIMIT 1`,
            [actorId]
          );
          if (pRes.rows.length > 0 && pRes.rows[0].dept_id) {
            targetDeptId = pRes.rows[0].dept_id;
          }
        } catch {}
      }
    }

    // Fall back to actor session department or explicitly passed department
    targetDeptId = targetDeptId || user.departmentId || departmentId || null;

    let targetDeptName = departmentName;
    let targetDeptCode = departmentCode;

    if (targetDeptId) {
      const deptInfo = await resolveDepartmentInfo(targetDeptId);
      targetDeptName = targetDeptName || deptInfo.name;
      targetDeptCode = targetDeptCode || deptInfo.code;
    }

    // 3. Extract Client Network Trace
    let ipAddress = null;
    let userAgent = null;

    if (req) {
      ipAddress =
        req.ip ||
        req.headers?.['x-forwarded-for']?.split(',')?.[0]?.trim() ||
        req.socket?.remoteAddress ||
        null;
      userAgent = req.headers?.['user-agent'] || null;
    }

    // Normalize action
    const validActions = ['create', 'update', 'approve', 'reject', 'delete', 'other'];
    const normAction = validActions.includes(String(action).toLowerCase())
      ? String(action).toLowerCase()
      : 'other';

    // 4. Persist to audit_logs table
    const entry = await createAuditEntry(
      {
        actorId,
        actorUsername,
        actorName,
        actorRole: 'dept_head',
        actorEmail,
        departmentId: targetDeptId,
        departmentName: targetDeptName,
        departmentCode: targetDeptCode,
        action: normAction,
        entityType,
        entityId: entityId ? String(entityId) : null,
        entityName: entityName ? String(entityName) : null,
        description: description || '',
        details,
        ipAddress,
        userAgent,
      },
      client
    );

    // 5. Broadcast real-time WebSocket event so Admin Audit Trail updates instantly without page refresh or polling
    try {
      broadcastEvent('AUDIT_LOG_CREATED', {
        id: entry?.id,
        actorId,
        actorUsername,
        username: actorUsername,
        actorName,
        actorRole: 'dept_head',
        actorEmail,
        departmentId: targetDeptId,
        departmentName: targetDeptName,
        departmentCode: targetDeptCode,
        action: normAction,
        entityType,
        entityId: entityId ? String(entityId) : null,
        entityName: entityName ? String(entityName) : null,
        description: description || '',
        details,
        createdAt: entry?.created_at || new Date().toISOString(),
      });
    } catch (wsErr) {
      console.warn('[AuditLogger] WebSocket broadcast warning:', wsErr.message);
    }

    return entry;
  } catch (err) {
    console.error('[AuditLogger] Failed to write audit log:', err.message);
    return null;
  }
}
