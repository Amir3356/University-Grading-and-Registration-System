import {
  listDepartmentsApi,
  createDepartmentApi,
  updateDepartmentApi,
  deleteDepartmentApi,
  listCoursesApi,
  createCourseApi,
  updateCourseApi,
  deleteCourseApi,
  listAcademicCalendarApi,
  createAcademicYearApi,
  updateAcademicYearApi,
  createSemesterApi,
  updateSemesterApi,
  setCurrentSemesterApi,
  deleteSemesterApi,
} from '@/api/academics';
import {
  listOfferingsApi,
  getOfferingApi,
  createOfferingApi,
  updateOfferingApi,
  deleteOfferingApi,
  listOfferingEnrollmentsApi,
  listEligibleStudentsApi,
  enrollStudentsApi,
  withdrawEnrollmentApi,
  removeEnrollmentApi,
} from '@/api/offerings';
import { listTeachersApi } from '@/api/users';
import { bumpVersion } from './db';

export async function listDepartments(params = {}) {
  return await listDepartmentsApi(params);
}

export async function createDepartment(data) {
  const result = await createDepartmentApi(data);
  bumpVersion();
  return result;
}

export async function updateDepartment(id, data) {
  const result = await updateDepartmentApi(id, data);
  bumpVersion();
  return result;
}

export async function deleteDepartment(id) {
  const result = await deleteDepartmentApi(id);
  bumpVersion();
  return result;
}

export async function listCourses(params = {}) {
  return await listCoursesApi(params);
}

export async function createCourse(data) {
  const result = await createCourseApi(data);
  bumpVersion();
  return result;
}

export async function updateCourse(id, data) {
  const result = await updateCourseApi(id, data);
  bumpVersion();
  return result;
}

export async function deleteCourse(id) {
  const result = await deleteCourseApi(id);
  bumpVersion();
  return result;
}

export async function listAcademicCalendar() {
  return await listAcademicCalendarApi();
}

export async function createAcademicYear(data) {
  const result = await createAcademicYearApi(data);
  bumpVersion();
  return result;
}

export async function updateAcademicYear(id, data) {
  const result = await updateAcademicYearApi(id, data);
  bumpVersion();
  return result;
}

export async function createSemester(data) {
  const result = await createSemesterApi(data);
  bumpVersion();
  return result;
}

export async function updateSemester(id, data) {
  const result = await updateSemesterApi(id, data);
  bumpVersion();
  return result;
}

export async function setCurrentSemester(id) {
  const result = await setCurrentSemesterApi(id);
  bumpVersion();
  return result;
}

export async function deleteSemester(id) {
  const result = await deleteSemesterApi(id);
  bumpVersion();
  return result;
}

export async function listOfferings(params = {}) {
  return await listOfferingsApi(params);
}

export async function getOfferingAdmin(id) {
  return await getOfferingApi(id);
}

export async function createOffering(data) {
  const result = await createOfferingApi(data);
  bumpVersion();
  return result;
}

export async function updateOffering(id, data) {
  const result = await updateOfferingApi(id, data);
  bumpVersion();
  return result;
}

export async function deleteOffering(id) {
  const result = await deleteOfferingApi(id);
  bumpVersion();
  return result;
}

export async function listOfferingEnrollments(offeringId) {
  return await listOfferingEnrollmentsApi(offeringId);
}

export async function listEligibleStudents(offeringId, params = {}) {
  return await listEligibleStudentsApi(offeringId, params);
}

export async function enrollStudents(offeringId, studentIds) {
  const result = await enrollStudentsApi(offeringId, studentIds);
  bumpVersion();
  return result;
}

export async function withdrawEnrollment(enrollmentId, { reason } = {}) {
  const result = await withdrawEnrollmentApi(enrollmentId, { reason });
  bumpVersion();
  return result;
}

export async function removeEnrollment(enrollmentId) {
  const result = await removeEnrollmentApi(enrollmentId);
  bumpVersion();
  return result;
}

export async function listTeachers(params = {}) {
  return await listTeachersApi(params);
}
