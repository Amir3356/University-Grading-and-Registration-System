import * as auditRepo from '../repositories/auditRepository.js';

export async function listAuditLogs(params) {
  const page = parseInt(params.page, 10) || 1;
  const pageSize = parseInt(params.pageSize, 10) || 10;
  return await auditRepo.listAuditLogs({ ...params, page, pageSize });
}

export async function listAuditActions() {
  return await auditRepo.listAuditActions();
}
