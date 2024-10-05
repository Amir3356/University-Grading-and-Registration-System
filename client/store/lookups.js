import { api } from '@/api/client'

/** Reference data needed by forms and filters across the app. */
export async function getLookups() {
  return await api.get('/lookups')
}
