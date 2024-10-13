import { z } from 'zod';

export const createUserFormSchema = z.object({
  roleId: z.enum(['admin', 'dept_head', 'teacher', 'student'], {
    required_error: 'Role is required.',
  }),
  username: z.string().trim().min(3, 'Username must be at least 3 characters.').max(32, 'Username cannot exceed 32 characters.'),
  firstName: z.string().trim().min(1, 'First name is required.').max(80),
  lastName: z.string().trim().min(1, 'Last name is required.').max(80),
  email: z.string().trim().email('Please enter a valid email address.').optional().or(z.literal('')),
  phone: z.string().trim().max(30).optional().nullable(),
  identifier: z.string().trim().max(30).optional().nullable(),
  departmentId: z.string().trim().optional().nullable(),
  department: z.string().trim().optional().nullable(),
  program: z.string().optional().nullable(),
  programType: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim().toLowerCase().replace('extensions', 'extension') : v),
    z.enum(['Regular', 'Weekend', 'Extensions', 'regular', 'weekend', 'extension']).optional()
  ),
  admissionYear: z.coerce.number().int().min(2000).max(2100).optional(),
  title: z.string().trim().optional(),
  specialization: z.string().trim().optional().nullable(),
  officeRoom: z.string().trim().optional().nullable(),
  password: z.string().optional().nullable(),
});

export const editUserFormSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required.').max(80),
  lastName: z.string().trim().min(1, 'Last name is required.').max(80),
  email: z.string().trim().email('Please enter a valid email address.'),
  phone: z.string().trim().max(30).optional().nullable(),
  status: z.enum(['active', 'inactive']).optional(),
});
