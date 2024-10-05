import * as userService from '../services/userService.js';
import * as userRepo from '../repositories/userRepository.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';

export async function listUsers(req, res, next) {
  try {
    const result = await userService.listUsers(req.query, req.user);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getUserDetail(req, res, next) {
  try {
    const result = await userService.getUserDetail(req.params.id, req.user);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function createUser(req, res, next) {
  try {
    const result = await userService.createUser(req.body, req.user);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function updateUser(req, res, next) {
  try {
    const result = await userService.updateUser(req.params.id, req.body, req.user);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function setUserStatus(req, res, next) {
  try {
    const result = await userService.setUserStatus(req.params.id, req.body, req.user);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(req, res, next) {
  try {
    const result = await userService.resetPassword(req.params.id, req.user);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function deleteUser(req, res, next) {
  try {
    const result = await userService.deleteUser(req.params.id, req.user);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function suggestEmail(req, res, next) {
  try {
    const result = await userService.suggestEmail(req.query.name);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function suggestIdentifier(req, res, next) {
  try {
    const { roleId, departmentId } = req.query;
    const result = await userService.suggestIdentifier(roleId, departmentId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function listStudents(req, res, next) {
  try {
    const query = { ...req.query };
    if (req.user.roleId === 'dept_head') {
      query.departmentId = req.user.departmentId;
    }
    const result = await userRepo.listStudents(query);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getStudentDetail(req, res, next) {
  try {
    const student = await userRepo.getStudentById(req.params.id);
    if (!student) throw new NotFoundError('Student');
    if (req.user.roleId === 'dept_head' && student.department_id !== req.user.departmentId) {
      throw new ForbiddenError('You can only view students in your department.');
    }
    res.status(200).json(student);
  } catch (err) {
    next(err);
  }
}

export async function listTeachers(req, res, next) {
  try {
    const query = { ...req.query };
    if (req.user.roleId === 'dept_head') {
      query.departmentId = req.user.departmentId;
    }
    const result = await userRepo.listTeachers(query);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getTeacherDetail(req, res, next) {
  try {
    const teacher = await userRepo.getTeacherById(req.params.id);
    if (!teacher) throw new NotFoundError('Teacher');
    if (req.user.roleId === 'dept_head' && teacher.department_id !== req.user.departmentId) {
      throw new ForbiddenError('You can only view teachers in your department.');
    }
    res.status(200).json(teacher);
  } catch (err) {
    next(err);
  }
}
