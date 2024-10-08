import { z } from 'zod';

export const FinalGradeSchema = z.object({
  id: z.string().max(32),
  enrollment_id: z.string().max(32),
  grade_scale_id: z.string().max(32),
  total_score: z.number().min(0).max(100).nullable().optional(),
  letter: z.string().max(3),
  grade_points: z.number().min(0).max(5).nullable().optional(),
  special_grade: z.enum(['W', 'I']).nullable().optional(),
  status: z.enum(['draft', 'submitted', 'approved', 'published']),
  is_stale: z.boolean().default(false),
  computed_at: z.date().optional(),
  submitted_at: z.date().nullable().optional(),
  approved_at: z.date().nullable().optional(),
  published_at: z.date().nullable().optional(),
  updated_at: z.date().optional(),
});

export const GradeScaleEntrySchema = z.object({
  id: z.string().max(32),
  scale_id: z.string().max(32),
  letter: z.string().max(3),
  min_score: z.number().min(0).max(100),
  max_score: z.number().min(0).max(100),
  grade_points: z.number().min(0).max(5),
});

export class FinalGrade {
  static tableName = 'final_grades';
  static primaryKey = 'id';

  constructor(attributes = {}) {
    this.id = attributes.id;
    this.enrollment_id = attributes.enrollment_id;
    this.grade_scale_id = attributes.grade_scale_id;
    this.total_score = attributes.total_score !== null && attributes.total_score !== undefined ? Number(attributes.total_score) : null;
    this.letter = attributes.letter;
    this.grade_points = attributes.grade_points !== null && attributes.grade_points !== undefined ? Number(attributes.grade_points) : null;
    this.special_grade = attributes.special_grade ?? null;
    this.status = attributes.status;
    this.is_stale = attributes.is_stale ?? false;
    this.computed_at = attributes.computed_at;
    this.submitted_at = attributes.submitted_at ?? null;
    this.approved_at = attributes.approved_at ?? null;
    this.published_at = attributes.published_at ?? null;
    this.updated_at = attributes.updated_at;
  }

  isPublished() {
    return this.status === 'published';
  }

  static fromRow(row) {
    if (!row) return null;
    return new FinalGrade(row);
  }

  toJSON() {
    return { ...this };
  }
}
