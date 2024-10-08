import { z } from 'zod';

export const createOfferingSchema = z.object({
  courseId: z.string().trim().min(1, 'Course is required.'),
  semesterId: z.string().trim().min(1, 'Semester is required.'),
  teacherId: z.string().trim().min(1, 'Teacher is required.'),
  section: z.string().trim().min(1, 'Section is required.').max(5),
  capacity: z.coerce.number().int().min(1, 'Capacity must be at least 1.').max(500, 'Capacity cannot exceed 500.'),
  room: z.string().trim().max(30).optional().nullable(),
  schedule: z.string().trim().max(80).optional().nullable(),
});

export const updateOfferingSchema = z.object({
  teacherId: z.string().trim().optional(),
  section: z.string().trim().max(5).optional(),
  capacity: z.coerce.number().int().min(1).max(500).optional(),
  room: z.string().trim().max(30).optional().nullable(),
  schedule: z.string().trim().max(80).optional().nullable(),
});

export const enrollStudentsSchema = z.object({
  studentIds: z.union([
    z.string().min(1, 'At least one student is required.'),
    z.array(z.string()).min(1, 'At least one student is required.'),
  ]),
});
