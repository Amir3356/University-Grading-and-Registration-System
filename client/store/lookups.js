import { getLookupsApi } from '@/api/lookups';

/** Reference data needed by forms and filters across the app. */
export async function getLookups() {
  return await getLookupsApi();
}
