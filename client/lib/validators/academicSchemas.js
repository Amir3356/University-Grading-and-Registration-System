import { z } from 'zod';

export const departmentFormSchema = z.object({
  code: z.string().trim().min(2, 'Code must be between 2 and 6 characters.').max(6),
  name: z.string().trim().min(3, 'Department name must be at least 3 characters.').max(120),
  description: z.string().trim().optional().nullable(),
  headTeacherId: z.string().trim().optional().nullable(),
});

export const courseFormSchema = z.object({
  code: z.string().trim().min(2, 'Course code is required.').max(10),
  title: z.string().trim().min(3, 'Course title is required.').max(160),
  departmentId: z.string().trim().min(1, 'Please select a department.'),
  creditHours: z.coerce.number().int().min(1, 'Credit hours must be 1 to 6.').max(6),
  level: z.coerce.number().int().min(100).max(900).default(100),
  description: z.string().trim().optional().nullable(),
});

export const semesterFormSchema = z.object({
  academicYearId: z.string().trim().min(1, 'Academic year is required.'),
  term: z.enum(['first', 'second', 'summer'], {
    required_error: 'Term is required.',
  }),
  name: z.string().trim().min(2, 'Semester name is required.').max(60),
  startDate: z.string().min(1, 'Start date is required.'),
  endDate: z.string().min(1, 'End date is required.'),
  gradeSubmissionDeadline: z.string().min(1, 'Grade submission deadline is required.'),
});
