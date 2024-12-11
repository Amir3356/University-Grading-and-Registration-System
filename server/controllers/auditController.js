import * as auditService from '../services/auditService.js';
import { sendSuccess } from '../utils/response.js';

export async function listAuditLogs(req, res, next) {
  try {
    const result = await auditService.listAuditLogs(req.query, req.user);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function getAuditSummary(req, res, next) {
  try {
    const result = await auditService.getAuditSummary(req.query, req.user);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function getAuditLog(req, res, next) {
  try {
    const result = await auditService.getAuditLogById(req.params.id, req.user);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}
