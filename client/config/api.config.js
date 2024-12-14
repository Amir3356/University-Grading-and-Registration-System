/**
 * API configuration for the University Grading and Registration System client.
 */

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export const API_TIMEOUT = 30000; // 30 seconds

export const DEFAULT_HEADERS = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
};

export const ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    REFRESH: '/auth/refresh',
    LOGOUT: '/auth/logout',
  },
};
