import { query, withTransaction } from '../config/database.js';
import { newId } from '../utils/idGenerator.js';
import { ConflictError, ValidationError, NotFoundError, ForbiddenError } from '../utils/errors.js';

export async function listSubmissions({ status, semesterId, departmentId, search, page = 1, pageSize = 10 } = {}) {
  const conditions = [];
  const params = [];

  if (status) {
    params.push(status);
    conditions.push(`gs.status = $${params.length}`);
  }

  if (semesterId) {
    params.push(semesterId);
    conditions.push(`co.semester_id = $${params.length}`);
  }

  if (departmentId) {
    params.push(departmentId);
    conditions.push(`c.department_id = $${params.length}`);
  }

  if (search) {
    params.push(`%${search.trim()}%`);
    conditions.push(`(
      c.code ILIKE $${params.length}
      OR c.title ILIKE $${params.length}
      OR u.first_name ILIKE $${params.length}
      OR u.last_name ILIKE $${params.length}
      OR t.employee_number ILIKE $${params.length}
    )`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countQuery = `
    SELECT count(DISTINCT co.id) as total
    FROM grade_submissions gs
    JOIN course_offerings co ON co.id = gs.offering_id
    JOIN courses c ON c.id = co.course_id
    JOIN teachers t ON t.id = co.teacher_id
    JOIN users u ON u.id = t.user_id
    ${whereClause}
  `;
  const countRes = await query(countQuery, params);
  const total = parseInt(countRes.rows[0]?.total || '0', 10);

  // Pending count for stat
  const pendingRes = await query(
    `SELECT count(DISTINCT co.id) as pending_count
     FROM grade_submissions gs
     JOIN course_offerings co ON co.id = gs.offering_id
     JOIN courses c ON c.id = co.course_id
     ${departmentId ? 'WHERE c.department_id = $1 AND gs.status = \'pending\'' : 'WHERE gs.status = \'pending\''}`,
    departmentId ? [departmentId] : []
  );
  const pendingCount = parseInt(pendingRes.rows[0]?.pending_count || '0', 10);

  const limit = pageSize === 'all' ? total || 1 : Math.max(1, parseInt(pageSize, 10) || 10);
  const offset = pageSize === 'all' ? 0 : (Math.max(1, parseInt(page, 10) || 1) - 1) * limit;

  params.push(limit);
  const limitIdx = params.length;
  params.push(offset);
  const offsetIdx = params.length;

  const sql = `
    WITH latest_subs AS (
      SELECT DISTINCT ON (co.id)
             gs.id, gs.student_count, gs.submitted_at, gs.status, gs.note,
             co.grade_status as offering_status,
             co.id as offering_id,
             json_build_object(
               'id', co.id,
               'section', co.section,
               'course', json_build_object('id', c.id, 'code', c.code, 'title', c.title),
               'semester', json_build_object('id', sem.id, 'name', sem.name)
             ) as offering,
             json_build_object(
               'id', t.id,
               'name', (u.first_name || ' ' || u.last_name),
               'employeeNumber', t.employee_number
             ) as teacher,
             (
               SELECT json_build_object(
                 'stage', gsr.stage,
                 'decision', gsr.decision,
                 'reviewerName', (ru.first_name || ' ' || ru.last_name),
                 'reviewedAt', gsr.reviewed_at,
                 'comment', gsr.comment
               )
               FROM grade_submission_reviews gsr
               JOIN users ru ON ru.id = gsr.reviewer_id
               WHERE gsr.submission_id = gs.id
               ORDER BY gsr.reviewed_at DESC
               LIMIT 1
             ) as last_review
      FROM grade_submissions gs
      JOIN course_offerings co ON co.id = gs.offering_id
      JOIN courses c ON c.id = co.course_id
      JOIN semesters sem ON sem.id = co.semester_id
      JOIN teachers t ON t.id = co.teacher_id
      JOIN users u ON u.id = t.user_id
      ${whereClause}
      ORDER BY co.id, gs.submitted_at DESC
    )
    SELECT * FROM latest_subs
    ORDER BY submitted_at DESC
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `;

  const res = await query(sql, params);
  return { items: res.rows, total, pendingCount };
}

export async function getSubmissionDetail(id) {
  const subRes = await query(
    `SELECT gs.*,
            (su.first_name || ' ' || su.last_name) as submitter_name,
            co.id as offering_id,
            COALESCE(
              json_agg(
                json_build_object(
                  'id', gsr.id,
                  'stage', gsr.stage,
                  'decision', gsr.decision,
                  'comment', gsr.comment,
                  'reviewedAt', gsr.reviewed_at,
                  'reviewerName', (ru.first_name || ' ' || ru.last_name)
                ) ORDER BY gsr.reviewed_at DESC
              ) FILTER (WHERE gsr.id IS NOT NULL), '[]'
            ) as reviews
     FROM grade_submissions gs
     JOIN users su ON su.id = gs.submitted_by
     JOIN course_offerings co ON co.id = gs.offering_id
     LEFT JOIN grade_submission_reviews gsr ON gsr.submission_id = gs.id
     LEFT JOIN users ru ON ru.id = gsr.reviewer_id
     WHERE gs.id = $1
     GROUP BY gs.id, su.id, co.id`,
    [id]
  );

  if (subRes.rows.length === 0) return null;
  const sub = subRes.rows[0];

  // Load full gradebook data for offering
  const { getGradebookData, getGradeHistory } = await import('./gradebookRepository.js');
  const gradebook = await getGradebookData(sub.offering_id);
  const history = await getGradeHistory(sub.offering_id);

  return {
    submission: {
      id: sub.id,
      offeringId: sub.offering_id,
      submittedBy: sub.submitted_by,
      submitterName: sub.submitter_name,
      submittedAt: sub.submitted_at,
      note: sub.note,
      studentCount: sub.student_count,
      status: sub.status,
      reviews: sub.reviews,
    },
    offering: gradebook.offering,
    assessments: gradebook.assessments,
    rows: gradebook.rows,
    weightTotal: gradebook.weightTotal,
    weightsValid: gradebook.weightsValid,
    passMark: gradebook.passMark,
    scale: gradebook.scale,
    stats: gradebook.stats,
    history,
  };
}

export async function approveSubmission(submissionId, comment, user) {
  return await withTransaction(async (client) => {
    const subRes = await client.query(`SELECT * FROM grade_submissions WHERE id = $1`, [submissionId]);
    if (subRes.rows.length === 0) throw new ConflictError('Grade submission not found.');
    let sub = subRes.rows[0];

    // If the submission is not pending (e.g. an earlier submission before the teacher resubmitted),
    // check if there is an active pending submission for this offering!
    if (sub.status !== 'pending') {
      const activePendingRes = await client.query(
        `SELECT * FROM grade_submissions WHERE offering_id = $1 AND status = 'pending' ORDER BY submitted_at DESC LIMIT 1`,
        [sub.offering_id]
      );
      if (activePendingRes.rows.length > 0) {
        sub = activePendingRes.rows[0];
        submissionId = sub.id;
      } else {
        const activeApprovedRes = await client.query(
          `SELECT * FROM grade_submissions WHERE offering_id = $1 AND status = 'approved' ORDER BY submitted_at DESC LIMIT 1`,
          [sub.offering_id]
        );
        if (activeApprovedRes.rows.length > 0 || sub.status === 'approved') {
          return { ok: true, status: 'approved', offeringId: sub.offering_id };
        } else if (sub.status === 'rejected') {
          // Department head is re-approving a submission that was previously rejected
        } else {
          throw new ConflictError(`Cannot approve submission with status ${sub.status}.`);
        }
      }
    }

    const reviewId = newId('rev');
    await client.query(
      `INSERT INTO grade_submission_reviews (id, submission_id, stage, decision, reviewer_id, comment, reviewed_at)
       VALUES ($1, $2, 'department', 'approved', $3, $4, now())`,
      [reviewId, submissionId, user.id, comment || null]
    );

    await client.query(
      `UPDATE grade_submissions SET status = 'approved' WHERE id = $1`,
      [submissionId]
    );

    await client.query(
      `UPDATE course_offerings SET grade_status = 'approved', updated_at = now() WHERE id = $1`,
      [sub.offering_id]
    );

    await client.query(
      `UPDATE final_grades fg
       SET status = 'approved', approved_at = now(), updated_at = now()
       FROM course_enrollments ce
       WHERE ce.id = fg.enrollment_id AND ce.offering_id = $1`,
      [sub.offering_id]
    );

    // Notify teacher
    const notifId = newId('ntf');
    await client.query(
      `INSERT INTO notifications (id, user_id, title, message, type, link)
       VALUES ($1, $2, 'Grades Approved by Department', 'Your submitted grades have been approved by the department head and forwarded for registrar publication.', 'grade_approved', $3)`,
      [notifId, sub.submitted_by, `/teacher/courses/${sub.offering_id}`]
    );

    return { ok: true, status: 'approved', offeringId: sub.offering_id };
  });
}

export async function rejectSubmission(submissionId, comment, user) {
  if (!comment || String(comment).trim() === '') {
    throw new ValidationError('A comment explaining the rejection reason is required.', {
      comment: 'Please provide a reason for rejecting the grades.',
    });
  }

  return await withTransaction(async (client) => {
    const subRes = await client.query(`SELECT * FROM grade_submissions WHERE id = $1`, [submissionId]);
    if (subRes.rows.length === 0) throw new ConflictError('Grade submission not found.');
    const sub = subRes.rows[0];

    const stage = user.roleId === 'dept_head' ? 'department' : 'registrar';

    const reviewId = newId('rev');
    await client.query(
      `INSERT INTO grade_submission_reviews (id, submission_id, stage, decision, reviewer_id, comment, reviewed_at)
       VALUES ($1, $2, $3, 'rejected', $4, $5, now())`,
      [reviewId, submissionId, stage, user.id, comment.trim()]
    );

    await client.query(
      `UPDATE grade_submissions SET status = 'rejected' WHERE id = $1`,
      [submissionId]
    );

    await client.query(
      `UPDATE course_offerings SET grade_status = 'rejected', updated_at = now() WHERE id = $1`,
      [sub.offering_id]
    );

    await client.query(
      `UPDATE final_grades fg
       SET status = 'draft', updated_at = now()
       FROM course_enrollments ce
       WHERE ce.id = fg.enrollment_id AND ce.offering_id = $1`,
      [sub.offering_id]
    );

    // Notify teacher
    const notifId = newId('ntf');
    await client.query(
      `INSERT INTO notifications (id, user_id, title, message, type, link)
       VALUES ($1, $2, 'Grades Returned for Correction', $3, 'grade_rejected', $4)`,
      [
        notifId,
        sub.submitted_by,
        `Your grades submission was returned: "${comment}". Please revise and resubmit.`,
        `/teacher/entermark/${sub.offering_id}`,
      ]
    );

    return { ok: true, status: 'rejected', offeringId: sub.offering_id };
  });
}

export async function publishSubmission(submissionId, user) {
  return await withTransaction(async (client) => {
    const subRes = await client.query(`SELECT * FROM grade_submissions WHERE id = $1`, [submissionId]);
    if (subRes.rows.length === 0) throw new ConflictError('Grade submission not found.');
    const sub = subRes.rows[0];

    if (sub.status !== 'approved') {
      throw new ConflictError('Grades can only be published after department approval (status must be approved).');
    }

    const reviewId = newId('rev');
    await client.query(
      `INSERT INTO grade_submission_reviews (id, submission_id, stage, decision, reviewer_id, comment, reviewed_at)
       VALUES ($1, $2, 'registrar', 'published', $3, 'Officially published by registrar', now())`,
      [reviewId, submissionId, user.id]
    );

    await client.query(
      `UPDATE grade_submissions SET status = 'published' WHERE id = $1`,
      [submissionId]
    );

    await client.query(
      `UPDATE course_offerings SET grade_status = 'published', updated_at = now() WHERE id = $1`,
      [sub.offering_id]
    );

    await client.query(
      `UPDATE final_grades fg
       SET status = 'published', published_at = now(), updated_at = now()
       FROM course_enrollments ce
       WHERE ce.id = fg.enrollment_id AND ce.offering_id = $1`,
      [sub.offering_id]
    );

    // Notify all enrolled students
    const enrRes = await client.query(
      `SELECT s.user_id, c.code, c.title
       FROM course_enrollments ce
       JOIN students s ON s.id = ce.student_id
       JOIN course_offerings co ON co.id = ce.offering_id
       JOIN courses c ON c.id = co.course_id
       WHERE ce.offering_id = $1`,
      [sub.offering_id]
    );

    for (const e of enrRes.rows) {
      const notifId = newId('ntf');
      await client.query(
        `INSERT INTO notifications (id, user_id, title, message, type, link)
         VALUES ($1, $2, $3, $4, 'grade_published', '/student/grades')`,
        [
          notifId,
          e.user_id,
          `Grades Published for ${e.code}`,
          `Official grades for ${e.code} (${e.title}) have been published and are now available on your grade sheet.`,
        ]
      );
    }

    // Notify teacher
    const notifId = newId('ntf');
    await client.query(
      `INSERT INTO notifications (id, user_id, title, message, type, link)
       VALUES ($1, $2, 'Grades Published Officially', 'Your submitted grades have been officially published by the registrar.', 'grade_published', $3)`,
      [notifId, sub.submitted_by, `/teacher/courses/${sub.offering_id}`]
    );

    return { ok: true, status: 'published' };
  });
}

export async function submitGradesForOffering(offeringId, { note } = {}, user) {
  return await withTransaction(async (client) => {
    // 1. Verify offering
    const offRes = await client.query(
      `SELECT co.*, c.code, c.title, c.department_id,
              d.head_teacher_id,
              COALESCE(ht.user_id, u_dh.id) as head_user_id
       FROM course_offerings co
       JOIN courses c ON c.id = co.course_id
       LEFT JOIN departments d ON d.id = c.department_id
       LEFT JOIN teachers ht ON ht.id = d.head_teacher_id
       LEFT JOIN (
         SELECT t.department_id, u.id
         FROM teachers t
         JOIN users u ON u.id = t.user_id
         WHERE u.role_id = 'dept_head'
       ) u_dh ON u_dh.department_id = c.department_id
       WHERE co.id = $1`,
      [offeringId]
    );
    if (offRes.rows.length === 0) throw new NotFoundError('Course offering');
    const offering = offRes.rows[0];

    // If teacher, check assigned
    if (user.roleId === 'teacher' && offering.teacher_id !== user.teacherId) {
      throw new ForbiddenError('You can only submit grades for your assigned offerings.');
    }

    if (['submitted', 'published'].includes(offering.grade_status)) {
      throw new ConflictError(`Grades for this course offering have already been ${offering.grade_status}.`);
    }

    const targetDeptId =
      offering.department_id ||
      offering.teacher?.departmentId ||
      offering.teacher?.department?.id ||
      offering.course?.department?.id ||
      offering.departmentId ||
      null;
    const rawYos =
      offering.yearOfStudy ??
      offering.year_of_study ??
      (offering.course?.level ? (offering.course.level >= 100 ? Math.floor(offering.course.level / 100) : offering.course.level) : null);
    const targetYearOfStudy = rawYos !== null && rawYos !== undefined ? parseInt(rawYos, 10) : null;

    // 2. Fetch student enrollments matching department and year of study
    const enrRes = await client.query(
      `SELECT ce.id, ce.student_id
       FROM course_enrollments ce
       JOIN students s ON s.id = ce.student_id
       WHERE ce.offering_id = $1
         AND ce.status != 'withdrawn'
         AND ($2::varchar IS NULL OR s.department_id = $2)
         AND ($3::smallint IS NULL OR s.year_of_study = $3)`,
      [offeringId, targetDeptId, targetYearOfStudy]
    );
    const studentCount = enrRes.rows.length;

    // 3. Get active grade scale
    const scaleRes = await client.query(
      `SELECT id FROM grade_scales WHERE is_active = true LIMIT 1`
    );
    const scaleId = scaleRes.rows[0]?.id || 'gsc_default';

    // 4. Compute / sync final_grades
    const { getGradebookData } = await import('./gradebookRepository.js');
    const gradebook = await getGradebookData(offeringId);

    for (const r of gradebook.rows) {
      if (r.enrollment?.status === 'withdrawn') continue;
      const fgId = newId('grd');
      await client.query(
        `INSERT INTO final_grades (
           id, enrollment_id, grade_scale_id, total_score, letter, grade_points,
           status, is_stale, computed_at, submitted_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, 'submitted', false, now(), now(), now())
         ON CONFLICT (enrollment_id) DO UPDATE SET
           grade_scale_id = EXCLUDED.grade_scale_id,
           total_score = EXCLUDED.total_score,
           letter = EXCLUDED.letter,
           grade_points = EXCLUDED.grade_points,
           status = 'submitted',
           is_stale = false,
           submitted_at = now(),
           updated_at = now()`,
        [
          fgId,
          r.enrollmentId,
          scaleId,
          r.total != null ? r.total : (r.runningPercent != null ? r.runningPercent : 0),
          r.letter || 'F',
          r.points != null ? r.points : 0,
        ]
      );
    }

    // 5. Create grade_submissions record (retire any previous pending or approved record to avoid unique index collisions)
    await client.query(
      `UPDATE grade_submissions SET status = 'rejected' WHERE offering_id = $1 AND status IN ('pending', 'approved')`,
      [offeringId]
    );

    const subId = newId('sub');
    await client.query(
      `INSERT INTO grade_submissions (id, offering_id, submitted_by, submitted_at, note, student_count, status)
       VALUES ($1, $2, $3, now(), $4, $5, 'pending')`,
      [subId, offeringId, user.id, note || null, studentCount]
    );

    // 6. Update offering status
    await client.query(
      `UPDATE course_offerings SET grade_status = 'submitted', updated_at = now() WHERE id = $1`,
      [offeringId]
    );

    // 7. Notify department head if present
    if (offering.head_user_id) {
      const notifId = newId('ntf');
      await client.query(
        `INSERT INTO notifications (id, user_id, title, message, type, link)
         VALUES ($1, $2, 'New Grade Submission Pending Approval', $3, 'approval_required', $4)`,
        [
          notifId,
          offering.head_user_id,
          `Final grades for ${offering.code} (${offering.title}) have been submitted and are waiting for your approval.`,
          `/dept-head/approvals`,
        ]
      );
    }

    return { ok: true, id: subId, status: 'submitted' };
  });
}
