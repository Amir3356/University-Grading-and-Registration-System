import { z } from 'zod';

export const loginFormSchema = z.object({
  username: z.string().trim().min(1, 'Username is required.'),
  password: z.string().min(1, 'Password is required.'),
  role: z.string().optional().nullable(),
  identifier: z.string().optional().nullable(),
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
