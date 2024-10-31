import * as userService from '../services/userService.js';
import { sendSuccess, sendCreated } from '../utils/response.js';
import { broadcastEvent } from '../config/websocket.js';

export async function listUsers(req, res, next) {
  try {
    const result = await userService.listUsers(req.query, req.user);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function getUserDetail(req, res, next) {
  try {
    const result = await userService.getUserDetail(req.params.id, req.user);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function createUser(req, res, next) {
  try {
    const result = await userService.createUser(req.body, req.user);
    broadcastEvent('USER_UPDATED', { userId: result?.user?.id });
    sendCreated(res, result);
  } catch (err) {
    next(err);
  }
}

export async function updateUser(req, res, next) {
  try {
    const result = await userService.updateUser(req.params.id, req.body, req.user);
    broadcastEvent('USER_UPDATED', { userId: req.params.id });
    broadcastEvent('STUDENT_UPDATED', { userId: req.params.id });
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function setUserStatus(req, res, next) {
  try {
    const result = await userService.setUserStatus(req.params.id, req.body, req.user);
    broadcastEvent('USER_UPDATED', { userId: req.params.id, status: req.body?.status });
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(req, res, next) {
  try {
    const result = await userService.resetPassword(req.params.id, req.user);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function deleteUser(req, res, next) {
  try {
    const result = await userService.deleteUser(req.params.id, req.user);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function suggestEmail(req, res, next) {
  try {
    const result = await userService.suggestEmail(req.query.name);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function suggestIdentifier(req, res, next) {
  try {
    const { roleId, departmentId } = req.query;
    const result = await userService.suggestIdentifier(roleId, departmentId);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function listStudents(req, res, next) {
  try {
    const result = await userService.listStudents(req.query, req.user);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function getStudentDetail(req, res, next) {
  try {
    const student = await userService.getStudentDetail(req.params.id, req.user);
    sendSuccess(res, student);
  } catch (err) {
    next(err);
  }
}

export async function listTeachers(req, res, next) {
  try {
    const result = await userService.listTeachers(req.query, req.user);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function getTeacherDetail(req, res, next) {
  try {
    const teacher = await userService.getTeacherDetail(req.params.id, req.user);
    sendSuccess(res, teacher);
  } catch (err) {
    next(err);
  }
}
