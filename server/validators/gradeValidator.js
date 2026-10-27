import { z } from 'zod';

export const createAssessmentSchema = z.object({
  name: z.string().trim().min(2, 'Assessment name is required.').max(80),
  type: z.enum(['assignment', 'quiz', 'midterm', 'final', 'practical', 'project'], {
    required_error: 'Valid assessment type is required.',
  }),
  maxMarks: z.coerce.number().min(1, 'Max marks must be at least 1.').max(1000, 'Max marks cannot exceed 1000.'),
  weight: z.coerce.number().min(0.5, 'Weight must be at least 0.5%.').max(100, 'Weight cannot exceed 100%.'),
  dueDate: z.string().optional().default(() => new Date().toISOString().slice(0, 10)),
  description: z.string().trim().optional().nullable(),
});

export const updateAssessmentSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  type: z.enum(['assignment', 'quiz', 'midterm', 'final', 'practical', 'project']).optional(),
  maxMarks: z.coerce.number().min(1).max(1000).optional(),
  weight: z.coerce.number().min(0.5).max(100).optional(),
  dueDate: z.string().optional(),
  description: z.string().trim().optional().nullable(),
});

export const saveScoresSchema = z.object({
  changes: z.array(
    z.object({
      enrollmentId: z.string().optional().nullable(),
      studentId: z.string().optional().nullable(),
      assessmentId: z.string().min(1, 'Assessment ID is required.'),
      marks: z.coerce.number().min(0, 'Marks cannot be negative.').nullable().optional(),
      remarks: z.string().optional().nullable(),
    }).refine((data) => data.enrollmentId || data.studentId, {
      message: 'Either enrollmentId or studentId is required.',
    })
  ).min(1, 'At least one score change is required.'),
  reason: z.string().optional().nullable(),
});

export const reviewGradesSchema = z.object({
  comment: z.string().trim().optional().nullable(),
});
