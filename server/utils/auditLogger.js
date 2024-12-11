import { createAuditEntry } from '../repositories/auditRepository.js';
import * as deptRepo from '../repositories/departmentRepository.js';

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
  description,
  details = {},
  departmentId = null,
  departmentName = null,
  departmentCode = null,
  client = null,
}) {
  try {
    // 1. Resolve Actor Details
    const user = actor || req?.user || {};
    const actorId = user.id || null;
    const actorUsername = user.username || null;
    const actorName =
      user.name ||
      (user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : null) ||
      user.username ||
      'System';
    const actorRole = (user.roleId || user.role || 'system').toLowerCase();
    const actorEmail = user.email || null;

    // The audit trail strictly tracks Department Head activities.
    // Teacher, student, and other non-department head audit tracking is excluded.
    if (actorRole !== 'dept_head') {
      return null;
    }

    // 2. Resolve Department Details
    let targetDeptId = departmentId || user.departmentId || null;
    let targetDeptName = departmentName;
    let targetDeptCode = departmentCode;

    if (targetDeptId && (!targetDeptName || !targetDeptCode)) {
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

    // 4. Persist to audit_logs table
    await createAuditEntry(
      {
        actorId,
        actorUsername,
        actorName,
        actorRole,
        actorEmail,
        departmentId: targetDeptId,
        departmentName: targetDeptName,
        departmentCode: targetDeptCode,
        action,
        entityType,
        entityId: entityId ? String(entityId) : null,
        entityName: entityName ? String(entityName) : null,
        description,
        details,
        ipAddress,
        userAgent,
      },
      client
    );
  } catch (err) {
    console.error('[AuditLogger] Failed to write audit log:', err.message, {
      action,
      entityType,
      entityId,
      description,
    });
  }
}
