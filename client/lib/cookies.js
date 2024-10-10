import Cookies from 'js-cookie';

/**
 * Browser cookie helper utilities for authentication tokens and session state.
 */

const DEFAULT_COOKIE_OPTIONS = {
  path: '/',
  sameSite: 'Lax',
  secure: typeof window !== 'undefined' && window.location.protocol === 'https:',
};

/**
 * Retrieve a cookie value by key
 * @param {string} key
 * @returns {string|undefined}
 */
export function getCookie(key) {
  return Cookies.get(key);
}

/**
 * Set a cookie with standard options
 * @param {string} key
 * @param {string} value
 * @param {Object} [options]
 */
export function setCookie(key, value, options = {}) {
  Cookies.set(key, value, {
    ...DEFAULT_COOKIE_OPTIONS,
    ...options,
  });
}

/**
 * Remove a cookie by key
 * @param {string} key
 * @param {Object} [options]
 */
export function removeCookie(key, options = {}) {
  Cookies.remove(key, {
    ...DEFAULT_COOKIE_OPTIONS,
    ...options,
  });
}

export { Cookies };
export default Cookies;
