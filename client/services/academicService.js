import * as academicsApi from '@/api/academics';
import { validateForm, departmentFormSchema, courseFormSchema, semesterFormSchema } from '@/lib/validators';
import { bumpVersion } from '@/store/db';

/**
 * Frontend Academic Structure Service
 * Manages departments, programs, courses, academic calendars, and active semesters.
 */

export async function listDepartments(params = {}) {
  return await academicsApi.listDepartments(params);
}

export async function getDepartment(id) {
  return await academicsApi.getDepartment(id);
}

export async function createDepartment(data) {
  const validation = validateForm(departmentFormSchema, data);
  if (!validation.success) {
    const err = new Error('Please correct the highlighted fields.');
    err.fieldErrors = validation.errors;
    throw err;
  }
  const result = await academicsApi.createDepartment(validation.data);
  bumpVersion();
  return result;
}

export async function updateDepartment(id, data) {
  const result = await academicsApi.updateDepartment(id, data);
  bumpVersion();
  return result;
}

export async function deleteDepartment(id) {
  const result = await academicsApi.deleteDepartment(id);
  bumpVersion();
  return result;
}

export async function listCourses(params = {}) {
  return await academicsApi.listCourses(params);
}

export async function getCourse(id) {
  return await academicsApi.getCourse(id);
}

export async function createCourse(data) {
  const validation = validateForm(courseFormSchema, data);
  if (!validation.success) {
    const err = new Error('Please correct the highlighted fields.');
    err.fieldErrors = validation.errors;
    throw err;
  }
  const result = await academicsApi.createCourse(validation.data);
  bumpVersion();
  return result;
}

export async function updateCourse(id, data) {
  const result = await academicsApi.updateCourse(id, data);
  bumpVersion();
  return result;
}

export async function deleteCourse(id) {
  const result = await academicsApi.deleteCourse(id);
  bumpVersion();
  return result;
}

export async function listAcademicCalendar() {
  return await academicsApi.listAcademicCalendar();
}

export async function listAcademicYears() {
  return await academicsApi.listAcademicYears();
}

export async function createAcademicYear(data) {
  const result = await academicsApi.createAcademicYear(data);
  bumpVersion();
  return result;
}

export async function updateAcademicYear(id, data) {
  const result = await academicsApi.updateAcademicYear(id, data);
  bumpVersion();
  return result;
}

export async function listSemesters(params = {}) {
  return await academicsApi.listSemesters(params);
}

export async function createSemester(data) {
  const validation = validateForm(semesterFormSchema, data);
  if (!validation.success) {
    const err = new Error('Please correct the highlighted fields.');
    err.fieldErrors = validation.errors;
    throw err;
  }
  const result = await academicsApi.createSemester(validation.data);
  bumpVersion();
  return result;
}

export async function updateSemester(id, data) {
  const result = await academicsApi.updateSemester(id, data);
  bumpVersion();
  return result;
}

export async function setCurrentSemester(id) {
  const result = await academicsApi.setCurrentSemester(id);
  bumpVersion();
  return result;
}

export async function deleteSemester(id) {
  const result = await academicsApi.deleteSemester(id);
  bumpVersion();
  return result;
}
