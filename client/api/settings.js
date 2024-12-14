import { api } from './client';

/**
 * University Settings & System API calls
 */

export async function getSettings() {
  return await api.get('/settings');
}

export async function updateUniversitySettings(data) {
  return await api.put('/settings/university', data);
}

export async function resetDemoData() {
  return await api.post('/system/reset-demo-data');
}

// Named aliases
export const getSettingsApi = getSettings;
export const updateUniversitySettingsApi = updateUniversitySettings;
export const resetDemoDataApi = resetDemoData;
