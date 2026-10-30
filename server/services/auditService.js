import * as auditRepo from '../repositories/auditRepository.js';
import { ForbiddenError, NotFoundError } from '../utils/errors.js';

export async function listAuditLogs(params, caller) {
  if (caller.roleId !== 'admin') {
    throw new ForbiddenError('Only System Administrators can access audit logs.');
  }
  return await auditRepo.listAuditLogs(params);
}

export async function getAuditSummary(params, caller) {
  if (caller.roleId !== 'admin') {
    throw new ForbiddenError('Only System Administrators can access audit summaries.');
  }
  return await auditRepo.getAuditSummary(params);
}

export async function getAuditLogById(id, caller) {
  if (caller.roleId !== 'admin') {
    throw new ForbiddenError('Only System Administrators can access audit logs.');
  }
  const log = await auditRepo.getAuditLogById(id);
  if (!log) {
    throw new NotFoundError('Audit log entry');
  }
  return log;
}
