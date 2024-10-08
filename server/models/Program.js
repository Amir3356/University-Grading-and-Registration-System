import { z } from 'zod';

export const ProgramSchema = z.object({
  id: z.string().max(32),
  department_id: z.string().max(32),
  code: z.string().min(2).max(20),
  name: z.string().min(2).max(160),
  duration_years: z.number().int().min(1).max(7).default(4),
  required_credits: z.number().int().positive(),
  status: z.enum(['active', 'archived']).default('active'),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
});

export class Program {
  static tableName = 'programs';
  static primaryKey = 'id';

  constructor(attributes = {}) {
    this.id = attributes.id;
    this.department_id = attributes.department_id;
    this.code = attributes.code;
    this.name = attributes.name;
    this.duration_years = attributes.duration_years ?? 4;
    this.required_credits = attributes.required_credits;
    this.status = attributes.status ?? 'active';
    this.created_at = attributes.created_at;
    this.updated_at = attributes.updated_at;

    // Optional joins
    this.department = attributes.department ?? null;
    this.department_name = attributes.department_name ?? null;
    this.courses = attributes.courses ?? [];
  }

  isActive() {
    return this.status === 'active';
  }

  static fromRow(row) {
    if (!row) return null;
    return new Program(row);
  }

  toJSON() {
    return { ...this };
  }
}
