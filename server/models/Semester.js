import { z } from 'zod';

export const SemesterSchema = z.object({
  id: z.string().max(32),
  academic_year_id: z.string().max(32),
  term: z.enum(['first', 'second', 'summer']),
  name: z.string().max(60),
  sort_order: z.number().int(),
  start_date: z.string().or(z.date()),
  end_date: z.string().or(z.date()),
  grade_submission_deadline: z.string().or(z.date()),
  withdrawal_deadline: z.string().or(z.date()).nullable().optional(),
  is_current: z.boolean().default(false),
  status: z.enum(['upcoming', 'active', 'closed']),
  created_at: z.date().optional(),
});

export class Semester {
  static tableName = 'semesters';
  static primaryKey = 'id';

  constructor(attributes = {}) {
    this.id = attributes.id;
    this.academic_year_id = attributes.academic_year_id;
    this.term = attributes.term;
    this.name = attributes.name;
    this.sort_order = attributes.sort_order;
    this.start_date = attributes.start_date;
    this.end_date = attributes.end_date;
    this.grade_submission_deadline = attributes.grade_submission_deadline;
    this.withdrawal_deadline = attributes.withdrawal_deadline ?? null;
    this.is_current = attributes.is_current ?? false;
    this.status = attributes.status;
    this.created_at = attributes.created_at;

    // Optional joins
    this.academic_year = attributes.academic_year ?? null;
  }

  isActive() {
    return this.status === 'active';
  }

  static fromRow(row) {
    if (!row) return null;
    return new Semester(row);
  }

  toJSON() {
    return { ...this };
  }
}
