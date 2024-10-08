import { z } from 'zod';

/**
 * User schema defining the database entity attributes
 */
export const UserSchema = z.object({
  id: z.string().max(32),
  role_id: z.enum(['admin', 'dept_head', 'teacher', 'student']),
  username: z.string().min(3).max(32),
  first_name: z.string().min(1).max(80),
  last_name: z.string().min(1).max(80),
  email: z.string().email().max(160),
  phone: z.string().max(30).nullable().optional(),
  password_hash: z.string().max(255),
  must_change_password: z.boolean().default(true),
  status: z.enum(['active', 'inactive']).default('active'),
  deactivation_reason: z.string().nullable().optional(),
  last_login_at: z.date().nullable().optional(),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
});

/**
 * User Entity Model
 */
export class User {
  static tableName = 'users';
  static primaryKey = 'id';

  constructor(attributes = {}) {
    this.id = attributes.id;
    this.role_id = attributes.role_id;
    this.username = attributes.username;
    this.first_name = attributes.first_name;
    this.last_name = attributes.last_name;
    this.email = attributes.email;
    this.phone = attributes.phone ?? null;
    this.password_hash = attributes.password_hash;
    this.must_change_password = attributes.must_change_password ?? true;
    this.status = attributes.status ?? 'active';
    this.deactivation_reason = attributes.deactivation_reason ?? null;
    this.last_login_at = attributes.last_login_at ?? null;
    this.created_at = attributes.created_at;
    this.updated_at = attributes.updated_at;

    // Optional profile associations
    this.profile = attributes.profile ?? null;
    this.department = attributes.department ?? null;
  }

  get fullName() {
    return `${this.first_name} ${this.last_name}`.trim();
  }

  isActive() {
    return this.status === 'active';
  }

  hasRole(role) {
    return this.role_id === role;
  }

  static fromRow(row) {
    if (!row) return null;
    return new User(row);
  }

  /**
   * Sanitizes user representation for client consumption (strips sensitive password_hash)
   */
  toJSON() {
    const { password_hash, ...safeProps } = this;
    return {
      ...safeProps,
      fullName: this.fullName,
    };
  }
}
