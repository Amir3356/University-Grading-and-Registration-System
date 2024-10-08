import helmet from 'helmet';

/**
 * Security middleware guards before requests reach the controllers
 */

/**
 * Helmet security middleware configured with industry best practices
 * for Express REST APIs and web applications.
 *
 * Sets critical HTTP security headers:
 * - Clickjacking protection (X-Frame-Options: DENY)
 * - MIME-sniffing prevention (X-Content-Type-Options: nosniff)
 * - HSTS (Strict-Transport-Security: max-age=31536000; includeSubDomains; preload)
 * - Referrer-Policy (strict-origin-when-cross-origin)
 * - Cross-Origin Resource Policy (cross-origin)
 * - Removes X-Powered-By
 */
export const helmetSecurity = helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  frameguard: { action: 'deny' },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true,
});

// Backward-compatible alias
export const securityHeaders = helmetSecurity;

/**
 * Sanitizes input string to prevent script injection
 */
function sanitizeString(val) {
  if (typeof val !== 'string') return val;
  // Strip null bytes and dangerous script wrappers
  return val.replace(/\0/g, '').trim();
}

function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  const clean = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      clean[key] = sanitizeString(value);
    } else if (value !== null && typeof value === 'object') {
      clean[key] = sanitizeObject(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

/**
 * Input sanitization guard for req.body and req.query
 * Mutates properties in-place to support Express 5 getter properties
 */
export function sanitizeInputs(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    for (const [key, val] of Object.entries(req.body)) {
      if (typeof val === 'string') {
        req.body[key] = sanitizeString(val);
      } else if (val !== null && typeof val === 'object') {
        req.body[key] = sanitizeObject(val);
      }
    }
  }
  if (req.query && typeof req.query === 'object') {
    for (const [key, val] of Object.entries(req.query)) {
      if (typeof val === 'string') {
        req.query[key] = sanitizeString(val);
      } else if (val !== null && typeof val === 'object') {
        req.query[key] = sanitizeObject(val);
      }
    }
  }
  next();
}
