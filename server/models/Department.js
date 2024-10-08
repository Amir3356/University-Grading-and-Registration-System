import { z } from 'zod';

export const DepartmentSchema = z.object({
  id: z.string().max(32),
  code: z.string().min(2).max(6),
  name: z.string().min(2).max(120),
  description: z.string().nullable().optional(),
  head_teacher_id: z.string().max(32).nullable().optional(),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
});

export class Department {
  static tableName = 'departments';
  static primaryKey = 'id';

  constructor(attributes = {}) {
    this.id = attributes.id;
    this.code = attributes.code;
    this.name = attributes.name;
    this.description = attributes.description ?? null;
    this.head_teacher_id = attributes.head_teacher_id ?? null;
    this.created_at = attributes.created_at;
    this.updated_at = attributes.updated_at;

    // Optional joins
    this.head_teacher = attributes.head_teacher ?? null;
    this.teacher_count = attributes.teacher_count ? Number(attributes.teacher_count) : undefined;
    this.student_count = attributes.student_count ? Number(attributes.student_count) : undefined;
    this.program_count = attributes.program_count ? Number(attributes.program_count) : undefined;
  }

  static fromRow(row) {
    if (!row) return null;
    return new Department(row);
  }

  toJSON() {
    return { ...this };
  }
}
