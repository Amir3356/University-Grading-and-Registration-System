import { z } from 'zod';

export const withdrawalFormSchema = z.object({
  scope: z.enum(['course', 'semester', 'university'], {
    required_error: 'Please select a withdrawal scope.',
  }),
  semesterId: z.string().optional().nullable(),
  reasonCategory: z.string().min(1, 'Reason category is required.'),
  reason: z.string().trim().min(5, 'Please provide an explanation of at least 5 characters.'),
  acknowledged: z.boolean().refine((val) => val === true, {
    message: 'You must acknowledge the terms before submitting.',
  }),
});
