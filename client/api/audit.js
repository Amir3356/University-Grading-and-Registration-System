import client from './client';

export async function listAuditLogsApi(params = {}) {
  const res = await client.get('/audit', { params });
  return res.data;
}

export async function getAuditSummaryApi(params = {}) {
  const res = await client.get('/audit/summary', { params });
  return res.data;
}

export async function getAuditLogApi(id) {
  const res = await client.get(`/audit/${id}`);
  return res.data;
}
