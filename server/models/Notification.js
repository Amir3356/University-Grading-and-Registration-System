import { z } from 'zod';

export const NotificationSchema = z.object({
  id: z.string().max(32),
  user_id: z.string().max(32),
  title: z.string().min(1).max(160),
  message: z.string().min(1),
  type: z.enum([
    'system', 'announcement', 'assignment', 'enrollment', 'marks_released',
    'grade_published', 'grade_approved', 'grade_rejected', 'grade_attention',
    'approval_required', 'registration', 'withdrawal',
  ]),
  link: z.string().max(255).nullable().optional(),
  is_read: z.boolean().default(false),
  read_at: z.date().nullable().optional(),
  created_at: z.date().optional(),
});

export const AnnouncementSchema = z.object({
  id: z.string().max(32),
  title: z.string().min(1).max(160),
  body: z.string().min(1),
  audience: z.enum(['all', 'student', 'teacher', 'dept_head']),
  author_id: z.string().max(32),
  created_at: z.date().optional(),
});

export class Notification {
  static tableName = 'notifications';
  static primaryKey = 'id';

  constructor(attributes = {}) {
    this.id = attributes.id;
    this.user_id = attributes.user_id;
    this.title = attributes.title;
    this.message = attributes.message;
    this.type = attributes.type;
    this.link = attributes.link ?? null;
    this.is_read = attributes.is_read ?? false;
    this.read_at = attributes.read_at ?? null;
    this.created_at = attributes.created_at;
  }

  static fromRow(row) {
    if (!row) return null;
    return new Notification(row);
  }

  toJSON() {
    return { ...this };
  }
}
