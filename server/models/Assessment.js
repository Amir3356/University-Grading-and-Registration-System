import { z } from 'zod';

export const AssessmentSchema = z.object({
  id: z.string().max(32),
  offering_id: z.string().max(32),
  name: z.string().min(1).max(80),
  type: z.enum(['assignment', 'quiz', 'midterm', 'final', 'practical', 'project']),
  max_marks: z.number().min(1).max(1000),
  weight: z.number().min(0.5).max(100),
  due_date: z.string().or(z.date()),
  description: z.string().nullable().optional(),
  is_released: z.boolean().default(false),
  released_at: z.date().nullable().optional(),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
});

export const AssessmentScoreSchema = z.object({
  id: z.string().max(32),
  assessment_id: z.string().max(32),
  enrollment_id: z.string().max(32),
  marks: z.number().min(0),
  remarks: z.string().nullable().optional(),
  updated_by: z.string().max(32),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
});

export class Assessment {
  static tableName = 'assessments';
  static primaryKey = 'id';

  constructor(attributes = {}) {
    this.id = attributes.id;
    this.offering_id = attributes.offering_id;
    this.name = attributes.name;
    this.type = attributes.type;
    this.max_marks = Number(attributes.max_marks);
    this.weight = Number(attributes.weight);
    this.due_date = attributes.due_date;
    this.description = attributes.description ?? null;
    this.is_released = attributes.is_released ?? false;
    this.released_at = attributes.released_at ?? null;
    this.created_at = attributes.created_at;
    this.updated_at = attributes.updated_at;
  }

  static fromRow(row) {
    if (!row) return null;
    return new Assessment(row);
  }

  toJSON() {
    return { ...this };
  }
}
