import { z } from 'zod';

export const WithdrawalRequestSchema = z.object({
  id: z.string().max(32),
  reference_no: z.string().max(12),
  student_id: z.string().max(32),
  scope: z.enum(['course', 'semester', 'university']),
  semester_id: z.string().max(32).nullable().optional(),
  enrollment_id: z.string().max(32).nullable().optional(),
  reason_category_id: z.string().max(30),
  reason: z.string().min(1),
  status: z.enum(['pending', 'approved', 'rejected', 'cancelled']).default('pending'),
  submitted_at: z.date().optional(),
  decided_by: z.string().max(32).nullable().optional(),
  decided_at: z.date().nullable().optional(),
  admin_notes: z.string().nullable().optional(),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
});

export class WithdrawalRequest {
  static tableName = 'withdrawal_requests';
  static primaryKey = 'id';

  constructor(attributes = {}) {
    this.id = attributes.id;
    this.reference_no = attributes.reference_no;
    this.student_id = attributes.student_id;
    this.scope = attributes.scope;
    this.semester_id = attributes.semester_id ?? null;
    this.enrollment_id = attributes.enrollment_id ?? null;
    this.reason_category_id = attributes.reason_category_id;
    this.reason = attributes.reason;
    this.status = attributes.status ?? 'pending';
    this.submitted_at = attributes.submitted_at;
    this.decided_by = attributes.decided_by ?? null;
    this.decided_at = attributes.decided_at ?? null;
    this.admin_notes = attributes.admin_notes ?? null;
    this.created_at = attributes.created_at;
    this.updated_at = attributes.updated_at;

    // Optional joins
    this.student_name = attributes.student_name ?? null;
    this.student_number = attributes.student_number ?? null;
    this.course_code = attributes.course_code ?? null;
    this.course_title = attributes.course_title ?? null;
    this.semester_name = attributes.semester_name ?? null;
    this.clearances = attributes.clearances ?? [];
  }

  isPending() {
    return this.status === 'pending';
  }

  static fromRow(row) {
    if (!row) return null;
    return new WithdrawalRequest(row);
  }

  toJSON() {
    return { ...this };
  }
}
