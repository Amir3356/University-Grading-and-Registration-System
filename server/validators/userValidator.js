import { z } from 'zod';

export const createUserSchema = z.object({
  roleId: z.enum(['admin', 'dept_head', 'teacher', 'student'], {
    required_error: 'Role is required.',
  }),
  username: z.string().trim().min(3, 'Username must be at least 3 characters.').max(32, 'Username cannot exceed 32 characters.'),
  firstName: z.string().trim().min(1, 'First name is required.').max(80, 'First name is too long.'),
  lastName: z.string().trim().min(1, 'Last name is required.').max(80, 'Last name is too long.'),
  email: z.preprocess(
    (val) => {
      if (typeof val === 'string' && val.trim()) return val.trim().toLowerCase();
      return undefined;
    },
    z.string().email('Please enter a valid email address.').max(160, 'Email cannot exceed 160 characters.').optional()
  ),
  phone: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() ? val.trim() : null),
    z.string().max(30, 'Phone cannot exceed 30 characters.').optional().nullable()
  ),
  identifier: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() ? val.trim() : undefined),
    z.string().max(30, 'ID cannot exceed 30 characters.').optional()
  ),
  departmentId: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() ? val.trim() : undefined),
    z.string().optional().nullable()
  ),
  department: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() ? val.trim() : undefined),
    z.string().optional().nullable()
  ),
  programId: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() ? val.trim() : undefined),
    z.string().optional().nullable()
  ),
  programType: z.preprocess(
    (val) => (typeof val === 'string' ? val.trim().toLowerCase().replace('extensions', 'extension') : undefined),
    z.enum(['regular', 'extension', 'weekend']).optional()
  ),
  admissionYear: z.preprocess(
    (val) => (val !== undefined && val !== null && val !== '' ? Number(val) : undefined),
    z.number().int().min(2000).max(2100).optional()
  ),
  yearOfStudy: z.preprocess(
    (val) => (val !== undefined && val !== null && val !== '' ? Number(val) : undefined),
    z.number().int().min(1).max(7).optional()
  ),
  title: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() ? val.trim() : undefined),
    z.string().max(20).optional()
  ),
  specialization: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() ? val.trim() : null),
    z.string().max(120).optional().nullable()
  ),
  officeRoom: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() ? val.trim() : null),
    z.string().max(30).optional().nullable()
  ),
  password: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() ? val.trim() : undefined),
    z.string().optional().nullable()
  ),
});

export const updateUserSchema = z.object({
  username: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() ? val.trim() : undefined),
    z.string().min(3, 'Username must be at least 3 characters.').max(32, 'Username cannot exceed 32 characters.').optional()
  ),
  firstName: z.string().trim().min(1, 'First name is required.').max(80).optional(),
  lastName: z.string().trim().min(1, 'Last name is required.').max(80).optional(),
  email: z.preprocess(
    (val) => {
      if (typeof val === 'string' && val.trim()) return val.trim().toLowerCase();
      return undefined;
    },
    z.string().email('Please enter a valid email address.').max(160).optional()
  ),
  phone: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() ? val.trim() : null),
    z.string().max(30).optional().nullable()
  ),
  status: z.enum(['active', 'inactive']).optional(),
  roleId: z.enum(['admin', 'dept_head', 'teacher', 'student']).optional(),
  identifier: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() ? val.trim() : undefined),
    z.string().max(30).optional().nullable()
  ),
  departmentId: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() ? val.trim() : undefined),
    z.string().optional().nullable()
  ),
  department: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() ? val.trim() : undefined),
    z.string().optional().nullable()
  ),
  programId: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() ? val.trim() : undefined),
    z.string().optional().nullable()
  ),
  programType: z.preprocess(
    (val) => (typeof val === 'string' ? val.trim().toLowerCase().replace('extensions', 'extension') : undefined),
    z.enum(['regular', 'extension', 'weekend']).optional()
  ),
  admissionYear: z.preprocess(
    (val) => (val !== undefined && val !== null && val !== '' ? Number(val) : undefined),
    z.number().int().min(2000).max(2100).optional()
  ),
  yearOfStudy: z.preprocess(
    (val) => (val !== undefined && val !== null && val !== '' ? Number(val) : undefined),
    z.number().int().min(1).max(7).optional()
  ),
  title: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() ? val.trim() : undefined),
    z.string().max(20).optional()
  ),
  specialization: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() ? val.trim() : null),
    z.string().max(120).optional().nullable()
  ),
  officeRoom: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() ? val.trim() : null),
    z.string().max(30).optional().nullable()
  ),
  password: z.preprocess(
    (val) => (typeof val === 'string' && val.trim() ? val.trim() : undefined),
    z.string().optional().nullable()
  ),
});

export const toggleStatusSchema = z.object({
  status: z.enum(['active', 'inactive'], {
    required_error: 'Status is required.',
  }),
  reason: z.string().optional().nullable(),
});
