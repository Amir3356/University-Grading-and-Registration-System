import { z } from 'zod';

export const AuditLogSchema = z.object({
  id: z.string().max(32),
  user_id: z.string().max(32).nullable().optional(),
  action: z.string().max(60),
  entity_type: z.string().max(40),
  entity_id: z.string().max(32),
  offering_id: z.string().max(32).nullable().optional(),
  details: z.string(),
  reason: z.string().nullable().optional(),
  before: z.record(z.any()).nullable().optional(),
  after: z.record(z.any()).nullable().optional(),
  ip_address: z.string().max(45).nullable().optional(),
  created_at: z.date().optional(),
});

export class AuditLog {
  static tableName = 'audit_logs';
  static primaryKey = 'id';

  constructor(attributes = {}) {
    this.id = attributes.id;
    this.user_id = attributes.user_id ?? null;
    this.action = attributes.action;
    this.entity_type = attributes.entity_type;
    this.entity_id = attributes.entity_id;
    this.offering_id = attributes.offering_id ?? null;
    this.details = attributes.details;
    this.reason = attributes.reason ?? null;
    this.before = attributes.before ?? null;
    this.after = attributes.after ?? null;
    this.ip_address = attributes.ip_address ?? null;
    this.created_at = attributes.created_at;

    // Optional joins
    this.user_name = attributes.user_name ?? null;
    this.user_email = attributes.user_email ?? null;
    this.user_role = attributes.user_role ?? null;
  }

  static fromRow(row) {
    if (!row) return null;
    return new AuditLog(row);
  }

  toJSON() {
    return { ...this };
  }
}
