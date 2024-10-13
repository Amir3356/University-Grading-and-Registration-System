import { z } from 'zod';

export const loginSchema = z.object({
  role: z.enum(['admin', 'dept_head', 'teacher', 'student'], {
    errorMap: () => ({ message: 'Please select a valid role.' }),
  }).optional().default('admin'),
  identifier: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
}).refine((data) => (data.identifier && data.identifier.trim()) || (data.username && data.username.trim()), {
  message: 'Username or identifier is required.',
  path: ['username'],
});

export const refreshSchema = z.object({
  refreshToken: z.string({
    required_error: 'Refresh token is required.',
  }).min(1, 'Refresh token is required.'),
});

export const updateProfileSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required.').max(80, 'First name is too long.'),
  lastName: z.string().trim().min(1, 'Last name is required.').max(80, 'Last name is too long.'),
  phone: z.string().trim().max(30, 'Phone number is too long.').optional().nullable(),
  email: z.string().trim().email('Invalid email address.').optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required.'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters long.'),
});
