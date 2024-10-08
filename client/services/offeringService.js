import * as offeringsApi from '@/api/offerings';
import { bumpVersion } from '@/store/db';

/**
 * Frontend Course Offerings & Enrollment Service
 */

export async function listOfferings(params = {}) {
  return await offeringsApi.listOfferings(params);
}

export async function getOffering(id) {
  return await offeringsApi.getOffering(id);
}

export async function createOffering(data) {
  const result = await offeringsApi.createOffering(data);
  bumpVersion();
  return result;
}

export async function updateOffering(id, data) {
  const result = await offeringsApi.updateOffering(id, data);
  bumpVersion();
  return result;
}

export async function deleteOffering(id) {
  const result = await offeringsApi.deleteOffering(id);
  bumpVersion();
  return result;
}

export async function listOfferingEnrollments(offeringId) {
  return await offeringsApi.listOfferingEnrollments(offeringId);
}

export async function listEligibleStudents(offeringId, params = {}) {
  return await offeringsApi.listEligibleStudents(offeringId, params);
}

export async function enrollStudents(offeringId, studentIds) {
  const result = await offeringsApi.enrollStudents(offeringId, studentIds);
  bumpVersion();
  return result;
}

export async function withdrawEnrollment(enrollmentId, { reason } = {}) {
  const result = await offeringsApi.withdrawEnrollment(enrollmentId, { reason });
  bumpVersion();
  return result;
}

export async function removeEnrollment(enrollmentId) {
  const result = await offeringsApi.removeEnrollment(enrollmentId);
  bumpVersion();
  return result;
}
