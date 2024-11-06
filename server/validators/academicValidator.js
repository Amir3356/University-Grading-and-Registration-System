import { z } from 'zod';

export const createDepartmentSchema = z.object({
  code: z.string().trim().min(2, 'Department code must be 2-6 characters.').max(6, 'Code too long.'),
  name: z.string().trim().min(3, 'Department name is required.').max(120),
  description: z.string().trim().optional().nullable(),
  headTeacherId: z.string().trim().optional().nullable(),
});

export const updateDepartmentSchema = z.object({
  name: z.string().trim().min(3, 'Department name is required.').max(120).optional(),
  description: z.string().trim().optional().nullable(),
  headTeacherId: z.string().trim().optional().nullable(),
});

export const createProgramSchema = z.object({
  departmentId: z.string().trim().min(1, 'Department ID is required.'),
  code: z.string().trim().min(2, 'Program code is required.').max(20),
  name: z.string().trim().min(3, 'Program name is required.').max(160),
  durationYears: z.coerce.number().int().min(1).max(7).default(4),
  requiredCredits: z.coerce.number().int().min(1, 'Required credits must be positive.'),
});

export const createCourseSchema = z.object({
  code: z.string().trim().min(1, 'Course code is required.').max(10, 'Course code too long.'),
  title: z.string().trim().min(3, 'Course title is required.').max(160),
  departmentId: z.string().trim().optional(),
  creditHours: z.coerce.number().int().min(1, 'Credit hours must be between 1 and 6.').max(6),
  level: z.coerce.number().int().min(100).max(900).default(100),
  description: z.string().trim().optional().nullable(),
});

export const updateCourseSchema = z.object({
  title: z.string().trim().min(3).max(160).optional(),
  departmentId: z.string().trim().optional(),
  creditHours: z.coerce.number().int().min(1).max(6).optional(),
  level: z.coerce.number().int().min(100).max(900).optional(),
  description: z.string().trim().optional().nullable(),
  status: z.enum(['active', 'archived']).optional(),
});

export const createSemesterSchema = z.object({
  academicYearId: z.string().trim().min(1, 'Academic year is required.'),
  term: z.enum(['first', 'second', 'summer'], {
    required_error: 'Term is required (first, second, or summer).',
  }),
  name: z.string().trim().min(2, 'Semester name is required.').max(60),
  startDate: z.string().min(1, 'Start date is required.'),
  endDate: z.string().min(1, 'End date is required.'),
  gradeSubmissionDeadline: z.string().min(1, 'Grade submission deadline is required.'),
  withdrawalDeadline: z.string().optional().nullable(),
});
