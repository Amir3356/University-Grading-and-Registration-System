import { query, withTransaction } from '../config/database.js';
import { newId } from '../utils/idGenerator.js';
import { ConflictError, ValidationError } from '../utils/errors.js';

export async function listReasonCategories() {
  const res = await query(`SELECT * FROM withdrawal_reason_categories WHERE is_active = true ORDER BY label ASC`);
  return res.rows;
}

export async function listStudentWithdrawals(studentId) {
  const sql = `
    SELECT wr.id, wr.reference_no, wr.scope, wr.status, wr.submitted_at, wr.reason,
           wr.admin_notes, wr.decided_at,
           json_build_object('id', rc.id, 'label', rc.label) as reason_category,
           json_build_object('id', s.id, 'name', s.name, 'term', s.term) as semester,
           COALESCE(
             json_agg(
               json_build_object(
                 'office', wc.office,
                 'status', wc.status,
                 'clearedAt', wc.cleared_at,
                 'remarks', wc.remarks
               ) ORDER BY wc.office ASC
             ) FILTER (WHERE wc.office IS NOT NULL), '[]'
           ) as clearances
    FROM withdrawal_requests wr
    JOIN withdrawal_reason_categories rc ON rc.id = wr.reason_category_id
    LEFT JOIN semesters s ON s.id = wr.semester_id
    LEFT JOIN withdrawal_clearances wc ON wc.request_id = wr.id
    WHERE wr.student_id = $1
    GROUP BY wr.id, rc.id, s.id
    ORDER BY wr.submitted_at DESC
  `;
  const res = await query(sql, [studentId]);
  return res.rows;
}

export async function createWithdrawalRequest({
  studentId,
  scope,
  semesterId,
  enrollmentId,
  reasonCategoryId,
  reason,
  user,
}) {
  return await withTransaction(async (client) => {
    // Generate reference number
    const seqRes = await client.query(`SELECT nextval('withdrawal_ref_seq') as seq`);
    const seqNum = seqRes.rows[0].seq;
    const refNo = `WR-${String(seqNum).padStart(3, '0')}`;
    const id = newId('wr');

    const res = await client.query(
      `INSERT INTO withdrawal_requests (
         id, reference_no, student_id, scope, semester_id, enrollment_id,
         reason_category_id, reason, status, submitted_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', now())
       RETURNING *`,
      [
        id,
        refNo,
        studentId,
        scope,
        semesterId || null,
        enrollmentId || null,
        reasonCategoryId,
        reason,
      ]
    );
    const request = res.rows[0];

    // Clearances for semester and university scope
    const clearances = [];
    if (scope === 'semester' || scope === 'university') {
      const offices = ['department', 'library', 'housing', 'registrar'];
      for (const off of offices) {
        await client.query(
          `INSERT INTO withdrawal_clearances (request_id, office, status) VALUES ($1, $2, 'pending')`,
          [id, off]
        );
        clearances.push({ office: off, status: 'pending' });
      }
    }

    return {
      id: request.id,
      referenceNo: request.reference_no,
      status: request.status,
      submittedAt: request.submitted_at,
      clearances,
    };
  });
}

export async function cancelWithdrawalRequest(id, studentId, user) {
  return await withTransaction(async (client) => {
    const res = await client.query(
      `UPDATE withdrawal_requests
       SET status = 'cancelled', updated_at = now()
       WHERE id = $1 AND student_id = $2 AND status = 'pending'
       RETURNING *`,
      [id, studentId]
    );
    if (res.rows.length === 0) {
      throw new ConflictError('Withdrawal request cannot be cancelled (not found or not pending).');
    }

    return res.rows[0];
  });
}

export async function listAdminWithdrawals({ status, scope, departmentId, semesterId, programType, search, page = 1, pageSize = 10 } = {}) {
  const conditions = [];
  const params = [];

  if (status) {
    params.push(status);
    conditions.push(`wr.status = $${params.length}`);
  }

  if (scope) {
    params.push(scope);
    conditions.push(`wr.scope = $${params.length}`);
  }

  if (departmentId) {
    params.push(departmentId);
    conditions.push(`s.department_id = $${params.length}`);
  }

  if (semesterId) {
    params.push(semesterId);
    conditions.push(`wr.semester_id = $${params.length}`);
  }

  if (programType) {
    params.push(programType);
    conditions.push(`s.program_type = $${params.length}`);
  }

  if (search) {
    params.push(`%${search.trim()}%`);
    conditions.push(`(
      u.first_name ILIKE $${params.length}
      OR u.last_name ILIKE $${params.length}
      OR s.student_number ILIKE $${params.length}
      OR wr.reference_no ILIKE $${params.length}
    )`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countQuery = `
    SELECT count(DISTINCT wr.id) as total
    FROM withdrawal_requests wr
    JOIN students s ON s.id = wr.student_id
    JOIN users u ON u.id = s.user_id
    ${whereClause}
  `;
  const countRes = await query(countQuery, params);
  const total = parseInt(countRes.rows[0]?.total || '0', 10);

  const limit = pageSize === 'all' ? total || 1 : Math.max(1, parseInt(pageSize, 10) || 10);
  const offset = pageSize === 'all' ? 0 : (Math.max(1, parseInt(page, 10) || 1) - 1) * limit;

  params.push(limit);
  const limitIdx = params.length;
  params.push(offset);
  const offsetIdx = params.length;

  const sql = `
    SELECT wr.id, wr.reference_no, wr.scope, wr.status, wr.submitted_at, wr.reason,
           wr.admin_notes, wr.decided_by, wr.decided_at,
           json_build_object(
             'id', s.id,
             'studentNumber', s.student_number,
             'name', (u.first_name || ' ' || u.last_name),
             'programType', s.program_type,
             'department', json_build_object('id', d.id, 'code', d.code, 'name', d.name)
           ) as student,
           json_build_object(
             'id', sem.id,
             'name', sem.name,
             'academicYear', json_build_object('id', ay.id, 'name', ay.name)
           ) as semester,
           json_build_object('id', rc.id, 'label', rc.label) as reason_category,
           COALESCE(
             json_agg(
               json_build_object(
                 'office', wc.office,
                 'status', wc.status,
                 'clearedAt', wc.cleared_at,
                 'remarks', wc.remarks
               ) ORDER BY wc.office ASC
             ) FILTER (WHERE wc.office IS NOT NULL), '[]'
           ) as clearances
    FROM withdrawal_requests wr
    JOIN students s ON s.id = wr.student_id
    JOIN users u ON u.id = s.user_id
    JOIN departments d ON d.id = s.department_id
    JOIN withdrawal_reason_categories rc ON rc.id = wr.reason_category_id
    LEFT JOIN semesters sem ON sem.id = wr.semester_id
    LEFT JOIN academic_years ay ON ay.id = sem.academic_year_id
    LEFT JOIN withdrawal_clearances wc ON wc.request_id = wr.id
    ${whereClause}
    GROUP BY wr.id, s.id, u.id, d.id, rc.id, sem.id, ay.id
    ORDER BY wr.submitted_at DESC
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `;

  const res = await query(sql, params);
  return { items: res.rows, total };
}

export async function getWithdrawalsSummary() {
  const countsRes = await query(`
    SELECT
      count(*) as total,
      count(*) FILTER (WHERE status = 'pending') as pending,
      count(*) FILTER (WHERE status = 'approved') as approved,
      count(*) FILTER (WHERE status = 'rejected') as rejected,
      count(*) FILTER (WHERE scope = 'course') as course_scope,
      count(*) FILTER (WHERE scope = 'semester') as semester_scope,
      count(*) FILTER (WHERE scope = 'university') as university_scope
    FROM withdrawal_requests
  `);
  const c = countsRes.rows[0];
  return {
    total: parseInt(c.total, 10),
    pending: parseInt(c.pending, 10),
    approved: parseInt(c.approved, 10),
    rejected: parseInt(c.rejected, 10),
    byScope: {
      course: parseInt(c.course_scope, 10),
      semester: parseInt(c.semester_scope, 10),
      university: parseInt(c.university_scope, 10),
    },
  };
}

export async function getWithdrawalById(id) {
  const sql = `
    SELECT wr.id, wr.reference_no, wr.scope, wr.status, wr.submitted_at, wr.reason,
           wr.admin_notes, wr.decided_by, wr.decided_at,
           json_build_object(
             'id', s.id,
             'studentNumber', s.student_number,
             'name', (u.first_name || ' ' || u.last_name),
             'programType', s.program_type,
             'department', json_build_object('id', d.id, 'code', d.code, 'name', d.name)
           ) as student,
           json_build_object(
             'id', sem.id,
             'name', sem.name,
             'academicYear', json_build_object('id', ay.id, 'name', ay.name)
           ) as semester,
           json_build_object('id', rc.id, 'label', rc.label) as reason_category,
           COALESCE(
             json_agg(
               json_build_object(
                 'office', wc.office,
                 'status', wc.status,
                 'clearedAt', wc.cleared_at,
                 'remarks', wc.remarks
               ) ORDER BY wc.office ASC
             ) FILTER (WHERE wc.office IS NOT NULL), '[]'
           ) as clearances
    FROM withdrawal_requests wr
    JOIN students s ON s.id = wr.student_id
    JOIN users u ON u.id = s.user_id
    JOIN departments d ON d.id = s.department_id
    JOIN withdrawal_reason_categories rc ON rc.id = wr.reason_category_id
    LEFT JOIN semesters sem ON sem.id = wr.semester_id
    LEFT JOIN academic_years ay ON ay.id = sem.academic_year_id
    LEFT JOIN withdrawal_clearances wc ON wc.request_id = wr.id
    WHERE wr.id = $1
    GROUP BY wr.id, s.id, u.id, d.id, rc.id, sem.id, ay.id
  `;
  const res = await query(sql, [id]);
  return res.rows[0] || null;
}

export async function updateClearance(requestId, office, status, remarks, user) {
  const res = await query(
    `UPDATE withdrawal_clearances
     SET status = $3::varchar,
         remarks = $4,
         cleared_by = $5,
         cleared_at = CASE WHEN $3::varchar = 'approved' THEN now() ELSE NULL END
     WHERE request_id = $1 AND office = $2
     RETURNING *`,
    [requestId, office, status, remarks || null, user.id]
  );
  return res.rows[0] || null;
}

export async function approveWithdrawal(id, adminNotes, user) {
  return await withTransaction(async (client) => {
    const wrRes = await client.query(`SELECT * FROM withdrawal_requests WHERE id = $1`, [id]);
    if (wrRes.rows.length === 0) throw new ConflictError('Withdrawal request not found.');
    const wr = wrRes.rows[0];

    if (wr.status !== 'pending') {
      throw new ConflictError(`Cannot approve request with status ${wr.status}.`);
    }

    // Auto-approve all institutional clearances upon registrar approval
    await client.query(
      `UPDATE withdrawal_clearances
       SET status = 'approved',
           cleared_by = $2,
           cleared_at = COALESCE(cleared_at, now()),
           remarks = COALESCE(remarks, 'Approved by Registrar')
       WHERE request_id = $1 AND status != 'approved'`,
      [id, user.id]
    );

    // Update request
    await client.query(
      `UPDATE withdrawal_requests
       SET status = 'approved', decided_by = $2, decided_at = now(), admin_notes = $3, updated_at = now()
       WHERE id = $1`,
      [id, user.id, adminNotes || 'Approved by registrar']
    );

    // Apply side effects
    if (wr.scope === 'course' && wr.enrollment_id) {
      await client.query(
        `UPDATE course_enrollments SET status = 'withdrawn', withdrawn_at = now(), updated_at = now() WHERE id = $1`,
        [wr.enrollment_id]
      );
      await client.query(
        `UPDATE final_grades SET letter = 'W', grade_points = NULL, special_grade = 'W', updated_at = now() WHERE enrollment_id = $1`,
        [wr.enrollment_id]
      );
    } else if (wr.scope === 'semester' && wr.semester_id) {
      // Withdraw all enrollments in semester
      const enrRes = await client.query(
        `SELECT ce.id
         FROM course_enrollments ce
         JOIN course_offerings co ON co.id = ce.offering_id
         WHERE ce.student_id = $1 AND co.semester_id = $2`,
        [wr.student_id, wr.semester_id]
      );
      for (const e of enrRes.rows) {
        await client.query(
          `UPDATE course_enrollments SET status = 'withdrawn', withdrawn_at = now(), updated_at = now() WHERE id = $1`,
          [e.id]
        );
        await client.query(
          `UPDATE final_grades SET letter = 'W', grade_points = NULL, special_grade = 'W', updated_at = now() WHERE enrollment_id = $1`,
          [e.id]
        );
      }
      // Cancel semester registration
      await client.query(
        `UPDATE semester_registrations SET status = 'cancelled', updated_at = now() WHERE student_id = $1 AND semester_id = $2`,
        [wr.student_id, wr.semester_id]
      );
    } else if (wr.scope === 'university') {
      // Withdraw all enrollments in active/upcoming semesters
      const enrRes = await client.query(
        `SELECT ce.id
         FROM course_enrollments ce
         JOIN course_offerings co ON co.id = ce.offering_id
         JOIN semesters sem ON sem.id = co.semester_id
         WHERE ce.student_id = $1 AND sem.status != 'closed'`,
        [wr.student_id]
      );
      for (const e of enrRes.rows) {
        await client.query(
          `UPDATE course_enrollments SET status = 'withdrawn', withdrawn_at = now(), updated_at = now() WHERE id = $1`,
          [e.id]
        );
        await client.query(
          `UPDATE final_grades SET letter = 'W', grade_points = NULL, special_grade = 'W', updated_at = now() WHERE enrollment_id = $1`,
          [e.id]
        );
      }
      // Set student academic status to withdrawn
      await client.query(
        `UPDATE students SET academic_status = 'withdrawn', updated_at = now() WHERE id = $1`,
        [wr.student_id]
      );
    }

    // Notify student
    const stuRes = await client.query(`SELECT user_id FROM students WHERE id = $1`, [wr.student_id]);
    if (stuRes.rows.length > 0) {
      const notifId = newId('ntf');
      await client.query(
        `INSERT INTO notifications (id, user_id, title, message, type, link)
         VALUES ($1, $2, 'Withdrawal Request Approved', $3, 'withdrawal', '/student/withdrawals')`,
        [
          notifId,
          stuRes.rows[0].user_id,
          `Your ${wr.scope} withdrawal request (${wr.reference_no}) has been approved by the Registrar Office.`,
        ]
      );
    }

    return { ok: true, status: 'approved' };
  });
}

export async function rejectWithdrawal(id, adminNotes, user) {
  if (!adminNotes || String(adminNotes).trim() === '') {
    throw new ValidationError('Decision remarks / admin notes are required when rejecting.', {
      adminNotes: 'Please provide decision remarks explaining the rejection.',
    });
  }

  return await withTransaction(async (client) => {
    const wrRes = await client.query(`SELECT * FROM withdrawal_requests WHERE id = $1`, [id]);
    if (wrRes.rows.length === 0) throw new ConflictError('Withdrawal request not found.');
    const wr = wrRes.rows[0];

    if (wr.status !== 'pending') {
      throw new ConflictError(`Cannot reject request with status ${wr.status}.`);
    }

    await client.query(
      `UPDATE withdrawal_requests
       SET status = 'rejected', decided_by = $2, decided_at = now(), admin_notes = $3, updated_at = now()
       WHERE id = $1`,
      [id, user.id, adminNotes.trim()]
    );

    // Notify student
    const stuRes = await client.query(`SELECT user_id FROM students WHERE id = $1`, [wr.student_id]);
    if (stuRes.rows.length > 0) {
      const notifId = newId('ntf');
      await client.query(
        `INSERT INTO notifications (id, user_id, title, message, type, link)
         VALUES ($1, $2, 'Withdrawal Request Rejected', $3, 'withdrawal', '/student/withdrawals')`,
        [
          notifId,
          stuRes.rows[0].user_id,
          `Your ${wr.scope} withdrawal request (${wr.reference_no}) was reviewed and rejected: "${adminNotes}".`,
        ]
      );
    }

    return { ok: true, status: 'rejected' };
  });
}
