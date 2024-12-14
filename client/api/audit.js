import { api } from './client';

export async function listAuditLogsApi(params = {}) {
  return await api.get('/audit', params);
}
