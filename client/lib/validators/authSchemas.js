import { z } from 'zod';

export const loginFormSchema = z.object({
  role: z.enum(['admin', 'dept_head', 'teacher', 'student'], {
    errorMap: () => ({ message: 'Please select a role.' }),
  }).optional().default('admin'),
  identifier: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
}).refine((data) => (data.identifier && data.identifier.trim()) || (data.username && data.username.trim()), {
  message: 'Username or identifier is required.',
  path: ['username'],
});

export const profileFormSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required.').max(80),
  lastName: z.string().trim().min(1, 'Last name is required.').max(80),
  email: z.string().trim().email('Please enter a valid email address.').min(1, 'Email is required.'),
  phone: z.string().trim().max(30, 'Phone is too long.').optional().nullable(),
});

export const passwordChangeFormSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required.'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters.'),
  confirmPassword: z.string().min(1, 'Please confirm your new password.'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match.',
  path: ['confirmPassword'],
});
