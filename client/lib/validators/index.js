import { z } from 'zod';

/**
 * Validates a form data object against a Zod schema.
 * Returns { success, data, errors } where errors is a map of field names to error messages:
 * { [field]: 'Error message' }
 */
export function validateForm(schema, data) {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data, errors: {} };
  }

  const errors = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || 'general';
    if (!errors[key]) {
      errors[key] = issue.message;
    }
  }

  return { success: false, data: null, errors };
}

export { z };
export * from './authSchemas';
export * from './userSchemas';
export * from './academicSchemas';
export * from './gradeSchemas';
export * from './withdrawalSchemas';
