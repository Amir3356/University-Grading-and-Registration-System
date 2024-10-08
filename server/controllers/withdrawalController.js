import * as wrService from '../services/withdrawalService.js';
import { sendSuccess, sendCreated } from '../utils/response.js';

// Student
export async function listStudentWithdrawals(req, res, next) {
  try {
    const list = await wrService.listStudentWithdrawals(req.user);
    sendSuccess(res, list);
  } catch (err) {
    next(err);
  }
}

export async function createStudentWithdrawal(req, res, next) {
  try {
    const result = await wrService.createStudentWithdrawalRequest(req.body, req.user);
    sendCreated(res, result);
  } catch (err) {
    next(err);
  }
}

export async function cancelStudentWithdrawal(req, res, next) {
  try {
    const result = await wrService.cancelStudentWithdrawalRequest(req.params.id, req.user);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

// Admin & Dept Head
export async function listAdminWithdrawals(req, res, next) {
  try {
    const result = await wrService.listAdminWithdrawals(req.query, req.user);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function getWithdrawalsSummary(req, res, next) {
  try {
    const summary = await wrService.getWithdrawalsSummary();
    sendSuccess(res, summary);
  } catch (err) {
    next(err);
  }
}

export async function getWithdrawalById(req, res, next) {
  try {
    const detail = await wrService.getWithdrawalById(req.params.id, req.user);
    sendSuccess(res, detail);
  } catch (err) {
    next(err);
  }
}

export async function updateClearance(req, res, next) {
  try {
    const { id, office } = req.params;
    const result = await wrService.updateClearance(id, office, req.body, req.user);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function approveWithdrawal(req, res, next) {
  try {
    const result = await wrService.approveWithdrawal(req.params.id, req.body, req.user);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function rejectWithdrawal(req, res, next) {
  try {
    const result = await wrService.rejectWithdrawal(req.params.id, req.body, req.user);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}
