import { api } from '@/api/client'

export async function getTeacherDashboard() {
  return await api.get('/teacher/dashboard')
}

export async function listMyOfferings(params = {}) {
  return await api.get('/teacher/offerings', params)
}

export async function getMyOffering(offeringId) {
  return await api.get(`/teacher/offerings/${offeringId}`)
}

export async function listMyStudents(params = {}) {
  return await api.get('/teacher/students', params)
}

export async function getStudentPerformance(offeringId, enrollmentId) {
  return await api.get(`/students/${enrollmentId}/performance`)
}
