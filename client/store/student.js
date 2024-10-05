import { api } from '@/api/client'

export async function getStudentDashboard() {
  return await api.get('/student/dashboard')
}

export async function listMyCourses(params = {}) {
  return await api.get('/student/courses', params)
}

export async function getMyCourse(enrollmentId) {
  return await api.get(`/student/courses/${enrollmentId}`)
}

export async function listMyAssessments(params = {}) {
  return await api.get('/student/assessments', params)
}

export async function getMyGrades(params = {}) {
  return await api.get('/student/grades', params)
}

export async function getMyProgress() {
  return await api.get('/student/progress')
}

export async function getMyTranscript() {
  return await api.get('/student/transcript')
}

export async function getGradeReport(semesterId) {
  return await api.get('/student/grade-report', { semesterId })
}
