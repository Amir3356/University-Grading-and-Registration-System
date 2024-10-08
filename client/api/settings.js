import { api } from './client';

/**
 * University Settings & Academic Policies API calls
 */

export async function getUniversitySettings() {
  return await api.get('/settings/university');
}

export async function updateUniversitySettings(data) {
  return await api.put('/settings/university', data);
}

export async function getAcademicPolicies() {
  return await api.get('/settings/policies');
}

export async function updateAcademicPolicies(data) {
  return await api.put('/settings/policies', data);
}

export async function resetDemoData() {
  return await api.post('/system/reset-demo-data');
}

export async function getSettings() {
  return await api.get('/settings');
}

// Backward-compatible named aliases
export const getUniversitySettingsApi = getUniversitySettings;
export const updateUniversitySettingsApi = updateUniversitySettings;
export const getAcademicPoliciesApi = getAcademicPolicies;
export const updateAcademicPoliciesApi = updateAcademicPolicies;
export const resetDemoDataApi = resetDemoData;
export const getSettingsApi = getSettings;
