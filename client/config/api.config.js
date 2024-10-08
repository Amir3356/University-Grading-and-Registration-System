/**
 * API configuration for the University Grading and Registration System client.
 * Centralizes base URLs, request timeouts, default headers, and endpoint routes.
 */

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export const API_TIMEOUT = 30000; // 30 seconds

export const DEFAULT_HEADERS = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
};

/**
 * Categorized API endpoint paths
 */
export const ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    REFRESH: '/auth/refresh',
    LOGOUT: '/auth/logout',
    ME: '/auth/me',
    PROFILE: '/auth/profile',
    PASSWORD: '/auth/password',
  },
  USERS: '/users',
  ACADEMICS: {
    DEPARTMENTS: '/academics/departments',
    PROGRAMS: '/academics/programs',
    YEARS: '/academics/academic-years',
    SEMESTERS: '/academics/semesters',
  },
  COURSES: '/courses',
  OFFERINGS: '/offerings',
  REGISTRATIONS: {
    BASE: '/registrations',
    PERIODS: '/registrations/periods',
    ACTIVE: '/registrations/active',
  },
  ASSESSMENTS: '/assessments',
  GRADES: {
    BASE: '/grades',
    STUDENT: '/grades/student',
    GPA: '/grades/gpa',
  },
  SUBMISSIONS: '/submissions',
  WITHDRAWALS: '/withdrawals',
  NOTIFICATIONS: {
    BASE: '/notifications',
    UNREAD_COUNT: '/notifications/unread-count',
    MARK_ALL_READ: '/notifications/read-all',
  },
  REPORTS: {
    BASE: '/reports',
    ENROLLMENT: '/reports/enrollment',
    PERFORMANCE: '/reports/performance',
    TRANSCRIPT: '/reports/transcript',
  },
  SETTINGS: '/settings',
  LOOKUPS: '/lookups',
};

export const API_CONFIG = {
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: DEFAULT_HEADERS,
  endpoints: ENDPOINTS,
};

export default API_CONFIG;
