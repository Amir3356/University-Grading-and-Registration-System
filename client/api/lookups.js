import { api } from './client';

/**
 * Reference data needed across forms and filters
 */
export async function getLookups() {
  return await api.get('/lookups');
}

export const getLookupsApi = getLookups;
