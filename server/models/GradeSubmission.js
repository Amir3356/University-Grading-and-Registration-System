import { z } from 'zod';

export const GradeSubmissionSchema = z.object({
  id: z.string().max(32),
  offering_id: z.string().max(32),
  submitted_by: z.string().max(32),
  submitted_at: z.date().optional(),
  note: z.string().nullable().optional(),
  student_count: z.number().int().min(0),
  status: z.enum(['pending', 'approved', 'published', 'rejected']).default('pending'),
});

export const GradeSubmissionReviewSchema = z.object({
  id: z.string().max(32),
  submission_id: z.string().max(32),
  stage: z.enum(['department', 'registrar']),
  decision: z.enum(['approved', 'rejected', 'published']),
  reviewer_id: z.string().max(32),
  comment: z.string().nullable().optional(),
  reviewed_at: z.date().optional(),
});

export class GradeSubmission {
  static tableName = 'grade_submissions';
  static primaryKey = 'id';

  constructor(attributes = {}) {
    this.id = attributes.id;
    this.offering_id = attributes.offering_id;
    this.submitted_by = attributes.submitted_by;
    this.submitted_at = attributes.submitted_at;
    this.note = attributes.note ?? null;
    this.student_count = attributes.student_count;
    this.status = attributes.status ?? 'pending';

    // Optional joins
    this.offering = attributes.offering ?? null;
    this.course_code = attributes.course_code ?? null;
    this.course_title = attributes.course_title ?? null;
    this.instructor_name = attributes.instructor_name ?? null;
    this.reviews = attributes.reviews ?? [];
  }

  isPending() {
    return this.status === 'pending';
  }

  static fromRow(row) {
    if (!row) return null;
    return new GradeSubmission(row);
  }

  toJSON() {
    return { ...this };
  }
}
