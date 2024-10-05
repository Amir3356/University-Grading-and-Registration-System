import * as auditService from '../services/auditService.js';

export async function listAuditLogs(req, res, next) {
  try {
    const result = await auditService.listAuditLogs(req.query);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function listAuditActions(req, res, next) {
  try {
    const actions = await auditService.listAuditActions();
    res.status(200).json(actions);
  } catch (err) {
    next(err);
  }
}
