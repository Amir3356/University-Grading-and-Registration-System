import { z } from 'zod';

export const CourseSchema = z.object({
  id: z.string().max(32),
  code: z.string().min(2).max(10),
  title: z.string().min(2).max(160),
  department_id: z.string().max(32),
  credit_hours: z.number().int().min(1).max(6),
  level: z.number().int().min(100).max(900).default(100),
  description: z.string().nullable().optional(),
  status: z.enum(['active', 'archived']).default('active'),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
});

export class Course {
  static tableName = 'courses';
  static primaryKey = 'id';

  constructor(attributes = {}) {
    this.id = attributes.id;
    this.code = attributes.code;
    this.title = attributes.title;
    this.department_id = attributes.department_id;
    this.credit_hours = attributes.credit_hours;
    this.level = attributes.level ?? 100;
    this.description = attributes.description ?? null;
    this.status = attributes.status ?? 'active';
    this.created_at = attributes.created_at;
    this.updated_at = attributes.updated_at;

    // Optional joins
    this.department = attributes.department ?? null;
    this.department_name = attributes.department_name ?? null;
    this.department_code = attributes.department_code ?? null;
    this.prerequisites = attributes.prerequisites ?? [];
  }

  isActive() {
    return this.status === 'active';
  }

  static fromRow(row) {
    if (!row) return null;
    return new Course(row);
  }

  toJSON() {
    return { ...this };
  }
}
