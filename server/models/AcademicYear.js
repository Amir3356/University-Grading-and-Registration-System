import { z } from 'zod';

export const AcademicYearSchema = z.object({
  id: z.string().max(32),
  name: z.string().max(9), // e.g. "2024-2025"
  start_date: z.string().or(z.date()),
  end_date: z.string().or(z.date()),
  is_current: z.boolean().default(false),
  created_at: z.date().optional(),
});

export class AcademicYear {
  static tableName = 'academic_years';
  static primaryKey = 'id';

  constructor(attributes = {}) {
    this.id = attributes.id;
    this.name = attributes.name;
    this.start_date = attributes.start_date;
    this.end_date = attributes.end_date;
    this.is_current = attributes.is_current ?? false;
    this.created_at = attributes.created_at;

    // Optional semesters
    this.semesters = attributes.semesters ?? [];
  }

  static fromRow(row) {
    if (!row) return null;
    return new AcademicYear(row);
  }

  toJSON() {
    return { ...this };
  }
}
