import { AppError } from '../utils/errors.js';

export function errorHandler(err, req, res, next) {
  // If headers already sent, delegate to Express default
  if (res.headersSent) {
    return next(err);
  }

  // Handle known AppError
  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: {
        kind: err.kind,
        message: err.message,
        fieldErrors: err.fieldErrors || null,
      },
    });
  }

  // Handle direct Zod validation errors
  if (err?.name === 'ZodError' && Array.isArray(err?.issues)) {
    const fieldErrors = {};
    for (const issue of err.issues) {
      const key = issue.path.join('.') || 'general';
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return res.status(422).json({
      error: {
        kind: 'validation',
        message: 'Please correct the highlighted fields.',
        fieldErrors,
      },
    });
  }

  // Handle Postgres error codes if leaked
  if (err.code === '23505') {
    // Unique violation
    return res.status(409).json({
      error: {
        kind: 'conflict',
        message: 'A record with this information already exists.',
        fieldErrors: null,
      },
    });
  }

  if (err.code === '23503') {
    // Foreign key violation
    return res.status(409).json({
      error: {
        kind: 'conflict',
        message: 'Operation cannot be completed because related records depend on this item.',
        fieldErrors: null,
      },
    });
  }

  // Catch-all server error
  console.error('Unhandled Server Error:', err);
  return res.status(500).json({
    error: {
      kind: 'server_error',
      message: err.message || 'Internal server error occurred.',
      fieldErrors: null,
    },
  });
}
