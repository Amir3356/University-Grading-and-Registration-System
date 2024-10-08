import { z } from 'zod';

export const createUserSchema = z.object({
  roleId: z.enum(['admin', 'dept_head', 'teacher', 'student'], {
    required_error: 'Role is required.',
  }),
  username: z.string().trim().min(3, 'Username must be at least 3 characters.').max(32, 'Username cannot exceed 32 characters.'),
  firstName: z.string().trim().min(1, 'First name is required.').max(80, 'First name is too long.'),
  lastName: z.string().trim().min(1, 'Last name is required.').max(80, 'Last name is too long.'),
  email: z.string().trim().email('Please enter a valid email address.').max(160, 'Email cannot exceed 160 characters.'),
  phone: z.string().trim().max(30, 'Phone cannot exceed 30 characters.').optional().nullable(),
  identifier: z.string().trim().min(1, 'Student / Employee ID is required.').max(30, 'ID cannot exceed 30 characters.'),
  departmentId: z.string().trim().min(1, 'Department is required.').optional().nullable(),
  programId: z.string().trim().optional().nullable(),
  programType: z.enum(['regular', 'extension', 'weekend']).optional(),
  admissionYear: z.coerce.number().int().min(2000).max(2100).optional(),
  yearOfStudy: z.coerce.number().int().min(1).max(7).optional(),
  title: z.string().trim().max(20).optional(),
  specialization: z.string().trim().max(120).optional().nullable(),
  officeRoom: z.string().trim().max(30).optional().nullable(),
  password: z.string().optional().nullable(),
});

export const updateUserSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required.').max(80).optional(),
  lastName: z.string().trim().min(1, 'Last name is required.').max(80).optional(),
  email: z.string().trim().email('Please enter a valid email address.').max(160).optional(),
  phone: z.string().trim().max(30).optional().nullable(),
  status: z.enum(['active', 'inactive']).optional(),
});

export const toggleStatusSchema = z.object({
  status: z.enum(['active', 'inactive'], {
    required_error: 'Status is required.',
  }),
  reason: z.string().optional().nullable(),
});
