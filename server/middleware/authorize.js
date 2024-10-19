import { AbilityBuilder, createMongoAbility, subject } from '@casl/ability';
import { ForbiddenError } from '../utils/errors.js';

/**
 * Re-export CASL subject helper for attribute-based permission checks
 */
export { subject };

/**
 * Define CASL abilities based on user role and identity attributes
 * @param {Object|null} user - Authenticated user payload from req.user
 * @returns {MongoAbility} CASL Ability instance
 */
export function defineAbilityFor(user) {
  const { can, cannot, build } = new AbilityBuilder(createMongoAbility);

  if (!user) {
    // Unauthenticated guest: can only view public lookups
    can('read', 'Lookup');
    return build();
  }

  // Base abilities for any authenticated user
  can('read', 'Lookup');
  can('read', 'UserProfile', { id: user.id });
  can('update', 'UserProfile', { id: user.id });
  can(['read', 'update'], 'Notification');

  switch (user.roleId) {
    case 'admin':
      // Superuser: can manage all entities and perform any action
      can('manage', 'all');
      break;

    case 'dept_head':
      // Department Head: department-scoped management
      can('read', 'Department', { id: user.departmentId });
      can('update', 'Department', { id: user.departmentId });
      can(['create', 'read', 'update'], 'Program');
      can(['create', 'read', 'update'], 'Course');
      can(['create', 'read', 'update'], 'CourseOffering');
      can(['create', 'read', 'update', 'delete'], 'User');
      can('read', 'Student');
      can('read', 'Teacher');
      can(['read', 'update'], 'Registration');
      can(['read', 'approve', 'reject'], 'GradeSubmission');
      can('read', 'Grade');
      can('read', 'Assessment');
      can(['read', 'update'], 'WithdrawalRequest');
      can('read', 'Report');
      can('read', 'Workspace');
      break;

    case 'teacher':
      // Teacher: classroom and assessment management
      can('read', 'Course');
      can('read', 'CourseOffering');
      can(['manage', 'create', 'read', 'update', 'delete'], 'Assessment');
      can(['manage', 'create', 'read', 'update'], 'Grade');
      can(['create', 'read'], 'GradeSubmission');
      can('read', 'Student');
      can('read', 'Workspace');
      break;

    case 'student':
      // Student: self-service registration and grade viewing
      can('read', 'Course');
      can('read', 'CourseOffering');
      can(['create', 'read'], 'Registration');
      can('read', 'Assessment');
      can('read', 'Grade');
      can('read', 'Transcript');
      can(['create', 'read'], 'WithdrawalRequest');
      can('read', 'Workspace');
      break;

    default:
      break;
  }

  return build();
}

/**
 * Middleware that ensures an Ability instance is attached to req.ability
 */
export function attachAbility(req, res, next) {
  if (!req.ability) {
    req.ability = defineAbilityFor(req.user);
  }
  next();
}

/**
 * CASL-based authorization middleware
 * @param {string} action - e.g. 'read', 'create', 'update', 'delete', 'manage', 'approve'
 * @param {string|Function} subjectTypeOrExtractor - Subject name or function receiving req and returning subject
 */
export function requireAbility(action, subjectTypeOrExtractor) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ForbiddenError('Authentication required.'));
    }

    const ability = req.ability || defineAbilityFor(req.user);
    req.ability = ability;

    const targetSubject = typeof subjectTypeOrExtractor === 'function'
      ? subjectTypeOrExtractor(req)
      : subjectTypeOrExtractor;

    if (!ability.can(action, targetSubject)) {
      const subjectName = typeof targetSubject === 'string'
        ? targetSubject
        : (targetSubject?.constructor?.name || 'resource');
      return next(new ForbiddenError(`You do not have permission to ${action} ${subjectName}.`));
    }

    next();
  };
}

/**
 * Programmatic check helper returning boolean
 * @param {Object} userOrReq - Express request or user object
 * @param {string} action
 * @param {string|Object} targetSubject
 * @returns {boolean}
 */
export function checkAbility(userOrReq, action, targetSubject) {
  const user = userOrReq?.user !== undefined ? userOrReq.user : userOrReq;
  const ability = userOrReq?.ability || defineAbilityFor(user);
  return ability.can(action, targetSubject);
}

/**
 * Programmatic assertion helper throwing ForbiddenError if permission check fails
 * @param {Object} userOrReq
 * @param {string} action
 * @param {string|Object} targetSubject
 * @param {string} [customMessage]
 */
export function assertAbility(userOrReq, action, targetSubject, customMessage) {
  if (!checkAbility(userOrReq, action, targetSubject)) {
    throw new ForbiddenError(customMessage || `Permission denied: cannot ${action} this resource.`);
  }
}

/**
 * Role-based access control middleware (backward-compatible)
 * @param  {...string} allowedRoles
 */
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

/**
 * Department scope enforcement for Department Heads
 */
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
