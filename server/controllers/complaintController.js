import * as complaintService from '../services/complaintService.js';
import { broadcastEvent } from '../config/websocket.js';
import { sendCreated, sendPaginated, sendSuccess } from '../utils/response.js';

export async function listComplaints(req, res, next) {
  try {
    const result = await complaintService.listStudentComplaints(req.query, req.user);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function createComplaint(req, res, next) {
  try {
    const created = await complaintService.createStudentComplaint(req.body, req.user);
    broadcastEvent('COMPLAINT_CREATED', { id: created.id, studentId: req.user.studentId, courseId: created.courseId });
    return sendCreated(res, created);
  } catch (err) {
    next(err);
  }
}

export async function updateComplaint(req, res, next) {
  try {
    const updated = await complaintService.updateStudentComplaint(req.params.id, req.body, req.user);
    broadcastEvent('COMPLAINT_UPDATED', { id: updated.id, status: updated.status });
    return sendSuccess(res, updated);
  } catch (err) {
    next(err);
  }
}

export async function cancelComplaint(req, res, next) {
  try {
    const result = await complaintService.cancelStudentComplaint(req.params.id, req.user);
    broadcastEvent('COMPLAINT_UPDATED', { id: req.params.id, status: 'cancelled' });
    return sendSuccess(res, { success: true, message: 'Complaint cancelled successfully' });
  } catch (err) {
    next(err);
  }
}

export async function getComplaintById(req, res, next) {
  try {
    const item = await complaintService.getComplaintDetail(req.params.id, req.user);
    return sendSuccess(res, item);
  } catch (err) {
    next(err);
  }
}

export async function acceptComplaint(req, res, next) {
  try {
    const updated = await complaintService.acceptComplaint(req.params.id, req.body, req.user);
    broadcastEvent('COMPLAINT_UPDATED', { id: updated.id, status: updated.status });
    return sendSuccess(res, updated);
  } catch (err) {
    next(err);
  }
}

export async function respondComplaint(req, res, next) {
  try {
    const updated = await complaintService.respondComplaint(req.params.id, req.body, req.user);
    broadcastEvent('COMPLAINT_UPDATED', { id: updated.id, status: updated.status });
    return sendSuccess(res, updated);
  } catch (err) {
    next(err);
  }
}
