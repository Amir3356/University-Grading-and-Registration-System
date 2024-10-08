import { z } from 'zod';

export const createWithdrawalSchema = z.object({
  scope: z.enum(['course', 'semester', 'university'], {
    required_error: 'Withdrawal scope is required (course, semester, or university).',
  }),
  semesterId: z.string().optional().nullable(),
  enrollmentId: z.string().optional().nullable(),
  reasonCategoryId: z.string().min(1, 'Reason category is required.'),
  reason: z.string().trim().min(5, 'Please provide a detailed reason (at least 5 characters).'),
  acknowledged: z.boolean().optional(),
});

export const decideWithdrawalSchema = z.object({
  adminNotes: z.string().trim().optional().nullable(),
});

export const updateClearanceSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected'], {
    required_error: 'Status is required.',
  }),
  remarks: z.string().trim().optional().nullable(),
});
