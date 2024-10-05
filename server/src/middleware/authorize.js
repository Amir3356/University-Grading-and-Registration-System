import { ForbiddenError } from '../utils/errors.js';

export function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ForbiddenError('Authentication required.'));
    }
    if (!allowedRoles.includes(req.user.roleId)) {
      return next(new ForbiddenError('You do not have permission to access this resource.'));
    }
    next();
  };
}

export function enforceDeptScope(req, res, next) {
  if (req.user && req.user.roleId === 'dept_head') {
    // If request has departmentId in query or body, it MUST match the dept head's department
    if (req.query.departmentId && req.query.departmentId !== req.user.departmentId) {
      return next(new ForbiddenError('You can only access data in your own department.'));
    }
    if (req.body && req.body.departmentId && req.body.departmentId !== req.user.departmentId) {
      return next(new ForbiddenError('You can only access data in your own department.'));
    }
    // Automatically force departmentId
    req.query.departmentId = req.user.departmentId;
    if (req.body) {
      req.body.departmentId = req.user.departmentId;
    }
  }
  next();
}
