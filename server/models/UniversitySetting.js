import { z } from 'zod';

export const UniversitySettingSchema = z.object({
  id: z.literal(1),
  name: z.string().min(1).max(160),
  short_name: z.string().min(1).max(20),
  motto: z.string().max(160).nullable().optional(),
  address: z.string().max(255).nullable().optional(),
  email: z.string().email().max(160),
  phone: z.string().max(30).nullable().optional(),
  website: z.string().max(160).nullable().optional(),
  registrar_name: z.string().min(1).max(120),
  updated_by: z.string().max(32).nullable().optional(),
  updated_at: z.date().optional(),
});

export const AcademicPolicySchema = z.object({
  id: z.literal(1),
  pass_mark: z.number().min(0).max(100).default(50),
  approval_workflow_enabled: z.boolean().default(true),
  repeat_policy: z.enum(['latest', 'highest', 'all']).default('latest'),
  incomplete_policy: z.enum(['exclude', 'as_fail']).default('exclude'),
  withdrawal_policy: z.enum(['exclude', 'as_fail']).default('exclude'),
  probation_gpa: z.number().min(0).max(4).default(2.0),
  honors_gpa: z.number().min(0).max(4).default(3.5),
  require_weights_total_100: z.boolean().default(true),
  at_risk_margin: z.number().default(10),
  updated_by: z.string().max(32).nullable().optional(),
  updated_at: z.date().optional(),
});

export class UniversitySetting {
  static tableName = 'university_settings';
  static primaryKey = 'id';

  constructor(attributes = {}) {
    this.id = 1;
    this.name = attributes.name;
    this.short_name = attributes.short_name;
    this.motto = attributes.motto ?? null;
    this.address = attributes.address ?? null;
    this.email = attributes.email;
    this.phone = attributes.phone ?? null;
    this.website = attributes.website ?? null;
    this.registrar_name = attributes.registrar_name;
    this.updated_by = attributes.updated_by ?? null;
    this.updated_at = attributes.updated_at;
  }

  static fromRow(row) {
    if (!row) return null;
    return new UniversitySetting(row);
  }

  toJSON() {
    return { ...this };
  }
}
