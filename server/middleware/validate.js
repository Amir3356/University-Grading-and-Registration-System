import { ZodError } from 'zod';
import { ValidationError } from '../utils/errors.js';

/**
 * Express middleware for request validation using Zod.
 * Can validate body, query, and params.
 * Formats errors into a unified fieldErrors object: { [field]: message }
 */
export function validateRequest(schema) {
  return async (req, res, next) => {
    try {
      if (schema.body || schema.query || schema.params) {
        if (schema.body) {
          req.body = await schema.body.parseAsync(req.body);
        }
        if (schema.query) {
          req.query = await schema.query.parseAsync(req.query);
        }
        if (schema.params) {
          req.params = await schema.params.parseAsync(req.params);
        }
      } else {
        req.body = await schema.parseAsync(req.body);
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const fieldErrors = {};
        for (const issue of err.issues) {
          const path = issue.path.join('.');
          const key = path || 'general';
          if (!fieldErrors[key]) {
            fieldErrors[key] = issue.message;
          }
        }
        return next(
          new ValidationError('Please correct the highlighted fields.', fieldErrors)
        );
      }
      next(err);
    }
  };
}
