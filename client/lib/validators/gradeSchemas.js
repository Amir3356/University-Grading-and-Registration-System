import { z } from 'zod';

export const assessmentFormSchema = z.object({
  name: z.string().trim().min(2, 'Assessment title is required.').max(80),
  type: z.enum(['assignment', 'quiz', 'midterm', 'final', 'practical', 'project'], {
    required_error: 'Please choose an assessment type.',
  }),
  maxMarks: z.coerce.number().min(1, 'Max marks must be at least 1.').max(1000),
  weight: z.coerce.number().min(0.5, 'Weight must be at least 0.5%.').max(100),
  dueDate: z.string().min(1, 'Due date is required.'),
  description: z.string().trim().optional().nullable(),
});

export const scoreInputSchema = z.object({
  marks: z.coerce.number().min(0, 'Score cannot be negative.').nullable().optional(),
  remarks: z.string().trim().optional().nullable(),
});
