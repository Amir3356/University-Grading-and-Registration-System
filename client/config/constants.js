/**
 * Application constants, storage keys, user roles, and domain statuses.
 */

// Browser cookie keys for authentication tokens
export const TOKEN_KEY = 'ugs_token';
export const REFRESH_TOKEN_KEY = 'ugs_refresh_token';

// Local storage cache keys for user identity & profile
export const USER_KEY = 'ugs_user';
export const PROFILE_KEY = 'ugs_profile';

export const COOKIE_KEYS = {
  TOKEN: TOKEN_KEY,
  REFRESH_TOKEN: REFRESH_TOKEN_KEY,
};

export const STORAGE_KEYS = {
  TOKEN: TOKEN_KEY,
  REFRESH_TOKEN: REFRESH_TOKEN_KEY,
  USER: USER_KEY,
  PROFILE: PROFILE_KEY,
};

// System User Roles
export const ROLES = {
  ADMIN: 'admin',
  DEPT_HEAD: 'dept_head',
  TEACHER: 'teacher',
  STUDENT: 'student',
};

export const ROLE_LABELS = {
  [ROLES.ADMIN]: 'Administrator',
  [ROLES.DEPT_HEAD]: 'Department Head',
  [ROLES.TEACHER]: 'Teacher',
  [ROLES.STUDENT]: 'Student',
};

// Domain Entity Statuses
export const ENROLLMENT_STATUS = {
  ENROLLED: 'enrolled',
  DROPPED: 'dropped',
  WITHDRAWN: 'withdrawn',
  COMPLETED: 'completed',
};

export const GRADE_SUBMISSION_STATUS = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

export const WITHDRAWAL_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

export const USER_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended',
};

export const NOTIFICATION_TYPE = {
  SYSTEM: 'system',
  GRADE: 'grade',
  REGISTRATION: 'registration',
  WITHDRAWAL: 'withdrawal',
  ACADEMIC: 'academic',
};

// Default pagination options
export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
