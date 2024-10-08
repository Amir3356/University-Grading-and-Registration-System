import { query, withTransaction } from '../config/database.js';
import { newId } from '../utils/idGenerator.js';
import { logAudit } from '../middleware/audit.js';
import { getOfferingById, updateOfferingGradeStatus } from './offeringRepository.js';
import { getActiveGradeScale, getAcademicPolicy } from './gradebookRepository.js';
import { computeEnrollmentScore } from '../utils/gpaCalculator.js';
import { ConflictError, ValidationError } from '../utils/errors.js';

export async function submitGrades(offeringId, note, user) {
  return await withTransaction(async (client) => {
    const offering = await getOfferingById(offeringId);
    if (!offering) throw new ConflictError('Course offering not found.');

    if (['submitted', 'approved', 'published'].includes(offering.grade_status)) {
      throw new ConflictError('Grades for this offering are already submitted or locked.');
    }

    if (!offering.weightsValid) {
      throw new ConflictError(`Assessment weights must total exactly 100% (currently ${offering.weightTotal}%).`);
    }

    if (offering.enrolledCount === 0) {
      throw new ConflictError('Cannot submit grades for an offering with no active enrolled students.');
    }

    if (offering.missingMarks > 0) {
      throw new ConflictError(`Cannot submit grades: there are ${offering.missingMarks} missing mark(s) across students.`);
    }

    const policy = await getAcademicPolicy();
    const scale = await getActiveGradeScale();

    // Fetch assessments
    const asmRes = await client.query(
      `SELECT * FROM assessments WHERE offering_id = $1 ORDER BY due_date ASC`,
      [offeringId]
    );
    const assessments = asmRes.rows.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      maxMarks: parseFloat(a.max_marks),
      weight: parseFloat(a.weight),
    }));

    // Fetch enrollments and scores
    const enrRes = await client.query(
      `SELECT id, status, is_repeat, student_id FROM course_enrollments WHERE offering_id = $1`,
      [offeringId]
    );

    const scoresRes = await client.query(
      `SELECT scr.assessment_id, scr.enrollment_id, scr.marks
       FROM assessment_scores scr
       JOIN assessments a ON a.id = scr.assessment_id
       WHERE a.offering_id = $1`,
      [offeringId]
    );

    const scoreMap = {};
    for (const s of scoresRes.rows) {
      if (!scoreMap[s.enrollment_id]) scoreMap[s.enrollment_id] = {};
      scoreMap[s.enrollment_id][s.assessment_id] = parseFloat(s.marks);
    }

    const publishImmediately = !policy.approvalWorkflowEnabled;
    const initialStatus = publishImmediately ? 'published' : 'submitted';

    // Create grade_submissions row
    const subId = newId('gar');
    await client.query(
      `INSERT INTO grade_submissions (id, offering_id, submitted_by, note, student_count, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        subId,
        offeringId,
        user.id,
        note || null,
        offering.enrolledCount,
        publishImmediately ? 'published' : 'pending',
      ]
    );

    // Save final grades for every enrollment
    for (const enr of enrRes.rows) {
      const fgId = newId('fgr');
      if (enr.status === 'withdrawn') {
        await client.query(
          `INSERT INTO final_grades (
             id, enrollment_id, grade_scale_id, total_score, letter, grade_points,
             special_grade, status, is_stale, computed_at, submitted_at, approved_at, published_at
           ) VALUES ($1, $2, $3, NULL, 'W', NULL, 'W', $4, false, now(), now(), $5, $6)
           ON CONFLICT (enrollment_id)
           DO UPDATE SET
             letter = 'W', grade_points = NULL, special_grade = 'W',
             status = EXCLUDED.status, submitted_at = now(),
             approved_at = EXCLUDED.approved_at, published_at = EXCLUDED.published_at,
             updated_at = now()`,
          [
            fgId,
            enr.id,
            scale.id,
            initialStatus,
            publishImmediately ? new Date() : null,
            publishImmediately ? new Date() : null,
          ]
        );
      } else {
        const studentScores = scoreMap[enr.id] || {};
        const scoreCalc = computeEnrollmentScore(assessments, studentScores, scale.entries, policy.passMark);

        await client.query(
          `INSERT INTO final_grades (
             id, enrollment_id, grade_scale_id, total_score, letter, grade_points,
             special_grade, status, is_stale, computed_at, submitted_at, approved_at, published_at
           ) VALUES ($1, $2, $3, $4, $5, $6, NULL, $7, false, now(), now(), $8, $9)
           ON CONFLICT (enrollment_id)
           DO UPDATE SET
             total_score = EXCLUDED.total_score,
             letter = EXCLUDED.letter,
             grade_points = EXCLUDED.grade_points,
             status = EXCLUDED.status,
             is_stale = false,
             submitted_at = now(),
             approved_at = EXCLUDED.approved_at,
             published_at = EXCLUDED.published_at,
             updated_at = now()`,
          [
            fgId,
            enr.id,
            scale.id,
            scoreCalc.weightedTotal,
            scoreCalc.letter || 'F',
            scoreCalc.gradePoints || 0,
            initialStatus,
            publishImmediately ? new Date() : null,
            publishImmediately ? new Date() : null,
          ]
        );
      }
    }

    // Update offering grade status
    await client.query(
      `UPDATE course_offerings SET grade_status = $2, updated_at = now() WHERE id = $1`,
      [offeringId, initialStatus]
    );

    // Audit log
    await logAudit(client, {
      userId: user.id,
      action: publishImmediately ? 'grades.published' : 'grades.submitted',
      entityType: 'course_offering',
      entityId: offeringId,
      offeringId,
      details: publishImmediately ? 'Published final grades directly' : 'Submitted final grades for approval',
      reason: note || null,
      before: { gradeStatus: offering.grade_status },
      after: { gradeStatus: initialStatus },
    });

    // Notify department head if workflow enabled
    if (!publishImmediately) {
      const deptRes = await client.query(
        `SELECT d.head_teacher_id, ht.user_id as head_user_id
         FROM courses c
         JOIN departments d ON d.id = c.department_id
         LEFT JOIN teachers ht ON ht.id = d.head_teacher_id
         WHERE c.id = $1`,
        [offering.course_id]
      );
      const headUserId = deptRes.rows[0]?.head_user_id;
      if (headUserId) {
        const notifId = newId('ntf');
        await client.query(
          `INSERT INTO notifications (id, user_id, title, message, type, link)
           VALUES ($1, $2, $3, $4, 'approval_required', $5)`,
          [
            notifId,
            headUserId,
            'Grades Submitted for Review',
            `Teacher has submitted grades for course ${offering.course?.code || ''} (Section ${offering.section}) for your department review.`,
            `/dept-head/approvals/${subId}`,
          ]
        );
      }
    }

    return {
      status: initialStatus,
      submissionId: subId,
    };
  });
}

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
    SELECT count(*) as total
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
    `SELECT count(*) as pending_count
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
    SELECT gs.id, gs.student_count, gs.submitted_at, gs.status, gs.note,
           co.grade_status as offering_status,
           json_build_object(
             'id', co.id,
             'section', co.section,
             'course', json_build_object('id', c.id, 'code', c.code, 'title', c.title),
             'semester', json_build_object('id', sem.id, 'name', sem.name)
           ) as offering,
           json_build_object(
             'id', t.id,
             'name', (t.title || ' ' || u.first_name || ' ' || u.last_name),
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
    ORDER BY gs.submitted_at DESC
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
    const sub = subRes.rows[0];

    if (sub.status !== 'pending') {
      throw new ConflictError(`Cannot approve submission with status ${sub.status}.`);
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

    await logAudit(client, {
      userId: user.id,
      action: 'grades.approved',
      entityType: 'course_offering',
      entityId: sub.offering_id,
      offeringId: sub.offering_id,
      details: 'Department head approved submitted grades',
      reason: comment || null,
    });

    // Notify teacher
    const notifId = newId('ntf');
    await client.query(
      `INSERT INTO notifications (id, user_id, title, message, type, link)
       VALUES ($1, $2, 'Grades Approved by Department', 'Your submitted grades have been approved by the department head and forwarded for registrar publication.', 'grade_approved', $3)`,
      [notifId, sub.submitted_by, `/teacher/courses/${sub.offering_id}`]
    );

    return { ok: true, status: 'approved' };
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

    await logAudit(client, {
      userId: user.id,
      action: 'grades.rejected',
      entityType: 'course_offering',
      entityId: sub.offering_id,
      offeringId: sub.offering_id,
      details: `Grades returned/rejected at ${stage} stage: ${comment}`,
      reason: comment,
    });

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

    return { ok: true, status: 'rejected' };
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

    await logAudit(client, {
      userId: user.id,
      action: 'grades.published',
      entityType: 'course_offering',
      entityId: sub.offering_id,
      offeringId: sub.offering_id,
      details: 'Registrar published official final grades',
    });

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

export async function getOfferingSubmissionHistory(offeringId) {
  const sql = `
    SELECT gs.*,
           (u.first_name || ' ' || u.last_name) as submitted_by_name,
           COALESCE(
             json_agg(
               json_build_object(
                 'stage', gsr.stage,
                 'decision', gsr.decision,
                 'comment', gsr.comment,
                 'reviewedAt', gsr.reviewed_at,
                 'reviewerName', (ru.first_name || ' ' || ru.last_name)
               ) ORDER BY gsr.reviewed_at DESC
             ) FILTER (WHERE gsr.id IS NOT NULL), '[]'
           ) as reviews
    FROM grade_submissions gs
    JOIN users u ON u.id = gs.submitted_by
    LEFT JOIN grade_submission_reviews gsr ON gsr.submission_id = gs.id
    LEFT JOIN users ru ON ru.id = gsr.reviewer_id
    WHERE gs.offering_id = $1
    GROUP BY gs.id, u.id
    ORDER BY gs.submitted_at DESC
  `;
  const res = await query(sql, [offeringId]);
  return res.rows;
}
