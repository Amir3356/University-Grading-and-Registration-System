import { api } from '@/api/client'
import { bumpVersion } from './db'

export async function listDepartments(params = {}) {
  return await api.get('/departments', params)
}

export async function createDepartment(data) {
  const result = await api.post('/departments', data)
  bumpVersion()
  return result
}

export async function updateDepartment(id, data) {
  const result = await api.put(`/departments/${id}`, data)
  bumpVersion()
  return result
}

export async function deleteDepartment(id) {
  const result = await api.delete(`/departments/${id}`)
  bumpVersion()
  return result
}

export async function listCourses(params = {}) {
  return await api.get('/courses', params)
}

export async function createCourse(data) {
  const result = await api.post('/courses', data)
  bumpVersion()
  return result
}

export async function updateCourse(id, data) {
  const result = await api.put(`/courses/${id}`, data)
  bumpVersion()
  return result
}

export async function deleteCourse(id) {
  const result = await api.delete(`/courses/${id}`)
  bumpVersion()
  return result
}

export async function listAcademicCalendar() {
  return await api.get('/academic-calendar')
}

export async function createAcademicYear(data) {
  const result = await api.post('/academic-years', data)
  bumpVersion()
  return result
}

export async function updateAcademicYear(id, data) {
  const result = await api.put(`/academic-years/${id}`, data)
  bumpVersion()
  return result
}

export async function createSemester(data) {
  const result = await api.post('/semesters', data)
  bumpVersion()
  return result
}

export async function updateSemester(id, data) {
  const result = await api.put(`/semesters/${id}`, data)
  bumpVersion()
  return result
}

export async function setCurrentSemester(id) {
  const result = await api.post(`/semesters/${id}/activate`)
  bumpVersion()
  return result
}

export async function deleteSemester(id) {
  const result = await api.delete(`/semesters/${id}`)
  bumpVersion()
  return result
}

export async function listOfferings(params = {}) {
  return await api.get('/offerings', params)
}

export async function getOfferingAdmin(id) {
  return await api.get(`/offerings/${id}`)
}

export async function createOffering(data) {
  const result = await api.post('/offerings', data)
  bumpVersion()
  return result
}

export async function updateOffering(id, data) {
  const result = await api.put(`/offerings/${id}`, data)
  bumpVersion()
  return result
}

export async function deleteOffering(id) {
  const result = await api.delete(`/offerings/${id}`)
  bumpVersion()
  return result
}

export async function listOfferingEnrollments(offeringId) {
  return await api.get(`/offerings/${offeringId}/enrollments`)
}

export async function listEligibleStudents(offeringId, params = {}) {
  return await api.get(`/offerings/${offeringId}/eligible-students`, params)
}

export async function enrollStudents(offeringId, studentIds) {
  const ids = Array.isArray(studentIds) ? studentIds : [studentIds]
  const result = await api.post(`/offerings/${offeringId}/enrollments`, { studentIds: ids })
  bumpVersion()
  return result
}

export async function withdrawEnrollment(enrollmentId, { reason } = {}) {
  const result = await api.post(`/offerings/any/enrollments/${enrollmentId}/withdraw`, { reason })
  bumpVersion()
  return result
}

export async function removeEnrollment(enrollmentId) {
  const result = await api.delete(`/offerings/any/enrollments/${enrollmentId}`)
  bumpVersion()
  return result
}

export async function listTeachers(params = {}) {
  return await api.get('/teachers', params)
}
