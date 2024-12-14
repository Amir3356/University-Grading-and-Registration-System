import { api } from './client';

/**
 * Academic Structure API calls: Departments, Courses, Academic Calendar, Semesters
 */

// Departments
export async function listDepartments(params = {}) {
  return await api.get('/departments', params);
}

export async function createDepartment(data) {
  return await api.post('/departments', data);
}

export async function updateDepartment(id, data) {
  return await api.put(`/departments/${id}`, data);
}

export async function deleteDepartment(id) {
  return await api.delete(`/departments/${id}`);
}

// Courses
export async function listCourses(params = {}) {
  return await api.get('/courses', params);
}

export async function createCourse(data) {
  return await api.post('/courses', data);
}

export async function updateCourse(id, data) {
  return await api.put(`/courses/${id}`, data);
}

export async function deleteCourse(id) {
  return await api.delete(`/courses/${id}`);
}

// Academic Calendar & Years
export async function listAcademicCalendar() {
  return await api.get('/academic-calendar');
}

export async function createAcademicYear(data) {
  return await api.post('/academic-years', data);
}

export async function updateAcademicYear(id, data) {
  return await api.put(`/academic-years/${id}`, data);
}

// Semesters
export async function createSemester(data) {
  return await api.post('/semesters', data);
}

export async function updateSemester(id, data) {
  return await api.put(`/semesters/${id}`, data);
}

export async function setCurrentSemester(id) {
  return await api.post(`/semesters/${id}/activate`);
}

export async function deleteSemester(id) {
  return await api.delete(`/semesters/${id}`);
}

// Named exports for store consumers
export const listDepartmentsApi = listDepartments;
export const createDepartmentApi = createDepartment;
export const updateDepartmentApi = updateDepartment;
export const deleteDepartmentApi = deleteDepartment;
export const listCoursesApi = listCourses;
export const createCourseApi = createCourse;
export const updateCourseApi = updateCourse;
export const deleteCourseApi = deleteCourse;
export const listAcademicCalendarApi = listAcademicCalendar;
export const createAcademicYearApi = createAcademicYear;
export const updateAcademicYearApi = updateAcademicYear;
export const createSemesterApi = createSemester;
export const updateSemesterApi = updateSemester;
export const setCurrentSemesterApi = setCurrentSemester;
export const deleteSemesterApi = deleteSemester;
