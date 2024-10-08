import { z } from 'zod';

export const CourseOfferingSchema = z.object({
  id: z.string().max(32),
  course_id: z.string().max(32),
  semester_id: z.string().max(32),
  teacher_id: z.string().max(32),
  section: z.string().max(5),
  capacity: z.number().int().min(1).max(500),
  room: z.string().max(30).nullable().optional(),
  schedule: z.string().max(80).nullable().optional(),
  grade_status: z.enum(['not_started', 'draft', 'submitted', 'approved', 'rejected', 'published']).default('not_started'),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
});

export class CourseOffering {
  static tableName = 'course_offerings';
  static primaryKey = 'id';

  constructor(attributes = {}) {
    this.id = attributes.id;
    this.course_id = attributes.course_id;
    this.semester_id = attributes.semester_id;
    this.teacher_id = attributes.teacher_id;
    this.section = attributes.section;
    this.capacity = attributes.capacity;
    this.room = attributes.room ?? null;
    this.schedule = attributes.schedule ?? null;
    this.grade_status = attributes.grade_status ?? 'not_started';
    this.created_at = attributes.created_at;
    this.updated_at = attributes.updated_at;

    // Optional joins
    this.course = attributes.course ?? null;
    this.course_code = attributes.course_code ?? null;
    this.course_title = attributes.course_title ?? null;
    this.credit_hours = attributes.credit_hours ?? null;
    this.teacher_name = attributes.teacher_name ?? null;
    this.semester_name = attributes.semester_name ?? null;
    this.enrolled_count = attributes.enrolled_count ? Number(attributes.enrolled_count) : 0;
  }

  isEnrollable() {
    return this.enrolled_count < this.capacity;
  }

  static fromRow(row) {
    if (!row) return null;
    return new CourseOffering(row);
  }

  toJSON() {
    return { ...this };
  }
}
