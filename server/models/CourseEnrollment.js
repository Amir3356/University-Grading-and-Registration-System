import { z } from 'zod';

export const CourseEnrollmentSchema = z.object({
  id: z.string().max(32),
  offering_id: z.string().max(32),
  student_id: z.string().max(32),
  status: z.enum(['pending', 'enrolled', 'completed', 'withdrawn']).default('enrolled'),
  is_repeat: z.boolean().default(false),
  enrolled_at: z.date().optional(),
  withdrawn_at: z.date().nullable().optional(),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
});

export class CourseEnrollment {
  static tableName = 'course_enrollments';
  static primaryKey = 'id';

  constructor(attributes = {}) {
    this.id = attributes.id;
    this.offering_id = attributes.offering_id;
    this.student_id = attributes.student_id;
    this.status = attributes.status ?? 'enrolled';
    this.is_repeat = attributes.is_repeat ?? false;
    this.enrolled_at = attributes.enrolled_at;
    this.withdrawn_at = attributes.withdrawn_at ?? null;
    this.created_at = attributes.created_at;
    this.updated_at = attributes.updated_at;

    // Optional joins
    this.student = attributes.student ?? null;
    this.offering = attributes.offering ?? null;
    this.final_grade = attributes.final_grade ?? null;
  }

  isActive() {
    return this.status === 'enrolled';
  }

  static fromRow(row) {
    if (!row) return null;
    return new CourseEnrollment(row);
  }

  toJSON() {
    return { ...this };
  }
}
