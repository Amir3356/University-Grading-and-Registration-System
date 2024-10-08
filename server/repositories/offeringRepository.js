import { query, withTransaction } from '../config/database.js';
import { newId } from '../utils/idGenerator.js';

export async function listOfferings({ semesterId, departmentId, teacherId, gradeStatus, search, page = 1, pageSize = 10 } = {}) {
  const conditions = [];
  const params = [];

  if (semesterId) {
    params.push(semesterId);
    conditions.push(`co.semester_id = $${params.length}`);
  }

  if (departmentId) {
    params.push(departmentId);
    conditions.push(`c.department_id = $${params.length}`);
  }

  if (teacherId) {
    params.push(teacherId);
    conditions.push(`co.teacher_id = $${params.length}`);
  }

  if (gradeStatus) {
    params.push(gradeStatus);
    conditions.push(`co.grade_status = $${params.length}`);
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
    FROM course_offerings co
    JOIN courses c ON c.id = co.course_id
    JOIN teachers t ON t.id = co.teacher_id
    JOIN users u ON u.id = t.user_id
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

  const dataQuery = `
    SELECT co.id, co.course_id, co.semester_id, co.teacher_id, co.section,
           co.capacity, co.room, co.schedule, co.grade_status, co.created_at, co.updated_at,
           json_build_object(
             'id', c.id, 'code', c.code, 'title', c.title, 'creditHours', c.credit_hours, 'level', c.level,
             'department', json_build_object('id', d.id, 'code', d.code, 'name', d.name)
           ) as course,
           json_build_object(
             'id', sem.id, 'name', sem.name, 'term', sem.term, 'isCurrent', sem.is_current,
             'gradeSubmissionDeadline', sem.grade_submission_deadline,
             'academicYear', json_build_object('id', ay.id, 'name', ay.name)
           ) as semester,
           json_build_object(
             'id', t.id, 'name', (t.title || ' ' || u.first_name || ' ' || u.last_name),
             'employeeNumber', t.employee_number,
             'user', json_build_object('email', u.email, 'firstName', u.first_name, 'lastName', u.last_name)
           ) as teacher,
           COUNT(DISTINCT ce.id) FILTER (WHERE ce.status != 'withdrawn') as enrolled_count,
           COUNT(DISTINCT ce.id) FILTER (WHERE ce.status = 'withdrawn') as withdrawn_count,
           COUNT(DISTINCT a.id) as assessment_count,
           COALESCE(SUM(DISTINCT a.weight), 0) as weight_total,
           (CURRENT_DATE > sem.grade_submission_deadline AND co.grade_status IN ('not_started', 'draft', 'rejected')) as overdue
    FROM course_offerings co
    JOIN courses c ON c.id = co.course_id
    JOIN departments d ON d.id = c.department_id
    JOIN semesters sem ON sem.id = co.semester_id
    JOIN academic_years ay ON ay.id = sem.academic_year_id
    JOIN teachers t ON t.id = co.teacher_id
    JOIN users u ON u.id = t.user_id
    LEFT JOIN course_enrollments ce ON ce.offering_id = co.id
    LEFT JOIN assessments a ON a.offering_id = co.id
    ${whereClause}
    GROUP BY co.id, c.id, d.id, sem.id, ay.id, t.id, u.id
    ORDER BY sem.sort_order DESC, c.code ASC, co.section ASC
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `;

  const dataRes = await query(dataQuery, params);

  // Compute missing marks and completeCount for offerings
  const enriched = await Promise.all(
    dataRes.rows.map(async (row) => {
      const statsRes = await query(
        `SELECT
           COUNT(ce.id) as total_students,
           COUNT(ce.id) FILTER (
             WHERE (SELECT count(*) FROM assessments a WHERE a.offering_id = $1) > 0
             AND (SELECT count(*) FROM assessment_scores scr
                  JOIN assessments a ON a.id = scr.assessment_id
                  WHERE a.offering_id = $1 AND scr.enrollment_id = ce.id) = (SELECT count(*) FROM assessments a WHERE a.offering_id = $1)
           ) as complete_count,
           ((COUNT(ce.id) * (SELECT count(*) FROM assessments a WHERE a.offering_id = $1)) -
            (SELECT count(*) FROM assessment_scores scr
             JOIN assessments a ON a.id = scr.assessment_id
             JOIN course_enrollments e ON e.id = scr.enrollment_id
             WHERE a.offering_id = $1 AND e.status != 'withdrawn')) as missing_marks
         FROM course_enrollments ce
         WHERE ce.offering_id = $1 AND ce.status != 'withdrawn'`,
        [row.id]
      );
      const st = statsRes.rows[0];
      const weightTotal = parseFloat(row.weight_total || '0');
      return {
        ...row,
        enrolledCount: parseInt(row.enrolled_count || '0', 10),
        withdrawnCount: parseInt(row.withdrawn_count || '0', 10),
        assessmentCount: parseInt(row.assessment_count || '0', 10),
        weightTotal,
        weightsValid: Math.abs(weightTotal - 100) < 0.01,
        completeCount: parseInt(st?.complete_count || '0', 10),
        missingMarks: Math.max(0, parseInt(st?.missing_marks || '0', 10)),
      };
    })
  );

  return { items: enriched, total };
}

export async function getOfferingById(id) {
  const sql = `
    SELECT co.id, co.course_id, co.semester_id, co.teacher_id, co.section,
           co.capacity, co.room, co.schedule, co.grade_status, co.created_at, co.updated_at,
           json_build_object(
             'id', c.id, 'code', c.code, 'title', c.title, 'creditHours', c.credit_hours, 'level', c.level,
             'department', json_build_object('id', d.id, 'code', d.code, 'name', d.name)
           ) as course,
           json_build_object(
             'id', sem.id, 'name', sem.name, 'term', sem.term, 'isCurrent', sem.is_current,
             'gradeSubmissionDeadline', sem.grade_submission_deadline,
             'academicYear', json_build_object('id', ay.id, 'name', ay.name)
           ) as semester,
           json_build_object(
             'id', t.id, 'name', (t.title || ' ' || u.first_name || ' ' || u.last_name),
             'employeeNumber', t.employee_number,
             'user', json_build_object('email', u.email, 'firstName', u.first_name, 'lastName', u.last_name)
           ) as teacher,
           COUNT(DISTINCT ce.id) FILTER (WHERE ce.status != 'withdrawn') as enrolled_count,
           COUNT(DISTINCT ce.id) FILTER (WHERE ce.status = 'withdrawn') as withdrawn_count,
           COUNT(DISTINCT a.id) as assessment_count,
           COALESCE(SUM(DISTINCT a.weight), 0) as weight_total,
           (CURRENT_DATE > sem.grade_submission_deadline AND co.grade_status IN ('not_started', 'draft', 'rejected')) as overdue
    FROM course_offerings co
    JOIN courses c ON c.id = co.course_id
    JOIN departments d ON d.id = c.department_id
    JOIN semesters sem ON sem.id = co.semester_id
    JOIN academic_years ay ON ay.id = sem.academic_year_id
    JOIN teachers t ON t.id = co.teacher_id
    JOIN users u ON u.id = t.user_id
    LEFT JOIN course_enrollments ce ON ce.offering_id = co.id
    LEFT JOIN assessments a ON a.offering_id = co.id
    WHERE co.id = $1
    GROUP BY co.id, c.id, d.id, sem.id, ay.id, t.id, u.id
  `;
  const res = await query(sql, [id]);
  if (res.rows.length === 0) return null;
  const row = res.rows[0];

  const statsRes = await query(
    `SELECT
       COUNT(ce.id) FILTER (
         WHERE (SELECT count(*) FROM assessments a WHERE a.offering_id = $1) > 0
         AND (SELECT count(*) FROM assessment_scores scr
              JOIN assessments a ON a.id = scr.assessment_id
              WHERE a.offering_id = $1 AND scr.enrollment_id = ce.id) = (SELECT count(*) FROM assessments a WHERE a.offering_id = $1)
       ) as complete_count,
       ((COUNT(ce.id) * (SELECT count(*) FROM assessments a WHERE a.offering_id = $1)) -
        (SELECT count(*) FROM assessment_scores scr
         JOIN assessments a ON a.id = scr.assessment_id
         JOIN course_enrollments e ON e.id = scr.enrollment_id
         WHERE a.offering_id = $1 AND e.status != 'withdrawn')) as missing_marks
     FROM course_enrollments ce
     WHERE ce.offering_id = $1 AND ce.status != 'withdrawn'`,
    [id]
  );
  const st = statsRes.rows[0];
  const weightTotal = parseFloat(row.weight_total || '0');

  return {
    ...row,
    enrolledCount: parseInt(row.enrolled_count || '0', 10),
    withdrawnCount: parseInt(row.withdrawn_count || '0', 10),
    assessmentCount: parseInt(row.assessment_count || '0', 10),
    weightTotal,
    weightsValid: Math.abs(weightTotal - 100) < 0.01,
    completeCount: parseInt(st?.complete_count || '0', 10),
    missingMarks: Math.max(0, parseInt(st?.missing_marks || '0', 10)),
  };
}

export async function createOffering({ id, courseId, semesterId, teacherId, section, capacity, room, schedule }) {
  const res = await query(
    `INSERT INTO course_offerings (
       id, course_id, semester_id, teacher_id, section, capacity, room, schedule, grade_status
     ) VALUES ($1, $2, $3, $4, UPPER($5), $6, $7, $8, 'not_started')
     RETURNING *`,
    [id, courseId, semesterId, teacherId, section, capacity, room || null, schedule || null]
  );
  return res.rows[0];
}

export async function updateOffering(id, { teacherId, section, capacity, room, schedule }) {
  const res = await query(
    `UPDATE course_offerings
     SET teacher_id = COALESCE($2, teacher_id),
         section = COALESCE(UPPER($3), section),
         capacity = COALESCE($4, capacity),
         room = $5,
         schedule = $6,
         updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [id, teacherId, section, capacity, room || null, schedule || null]
  );
  return res.rows[0] || null;
}

export async function updateOfferingGradeStatus(id, gradeStatus, client = null) {
  const runner = client || { query };
  const res = await runner.query(
    `UPDATE course_offerings SET grade_status = $2, updated_at = now() WHERE id = $1 RETURNING *`,
    [id, gradeStatus]
  );
  return res.rows[0] || null;
}

export async function deleteOffering(id) {
  await query(`DELETE FROM course_offerings WHERE id = $1`, [id]);
}

export async function listEnrollments(offeringId) {
  const sql = `
    SELECT ce.id, ce.status, ce.is_repeat, ce.enrolled_at, ce.withdrawn_at,
           json_build_object(
             'id', s.id, 'studentNumber', s.student_number,
             'name', (u.first_name || ' ' || u.last_name),
             'email', u.email,
             'department', d.name,
             'program', p.name
           ) as student,
           (EXISTS(SELECT 1 FROM assessment_scores scr WHERE scr.enrollment_id = ce.id)) as has_scores
    FROM course_enrollments ce
    JOIN students s ON s.id = ce.student_id
    JOIN users u ON u.id = s.user_id
    JOIN departments d ON d.id = s.department_id
    JOIN programs p ON p.id = s.program_id
    WHERE ce.offering_id = $1
    ORDER BY s.student_number ASC
  `;
  const res = await query(sql, [offeringId]);
  return res.rows;
}

export async function listEligibleStudents(offeringId, { search, departmentId } = {}) {
  const conditions = [
    `s.academic_status = 'active'`,
    `NOT EXISTS (SELECT 1 FROM course_enrollments ce WHERE ce.offering_id = $1 AND ce.student_id = s.id AND ce.status != 'withdrawn')`,
  ];
  const params = [offeringId];

  if (departmentId) {
    params.push(departmentId);
    conditions.push(`s.department_id = $${params.length}`);
  }

  if (search) {
    params.push(`%${search.trim()}%`);
    conditions.push(`(
      u.first_name ILIKE $${params.length}
      OR u.last_name ILIKE $${params.length}
      OR s.student_number ILIKE $${params.length}
    )`);
  }

  const sql = `
    SELECT s.id, s.student_number,
           (u.first_name || ' ' || u.last_name) as name,
           u.email,
           d.name as department_name,
           p.name as program_name,
           s.year_of_study
    FROM students s
    JOIN users u ON u.id = s.user_id
    JOIN departments d ON d.id = s.department_id
    JOIN programs p ON p.id = s.program_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY s.student_number ASC
    LIMIT 200
  `;
  const res = await query(sql, params);
  return res.rows;
}

export async function enrollStudents(offeringId, studentIds) {
  return await withTransaction(async (client) => {
    // Check course offering courseId
    const offRes = await client.query(`SELECT course_id FROM course_offerings WHERE id = $1`, [offeringId]);
    const courseId = offRes.rows[0]?.course_id;

    let enrolledCount = 0;
    for (const stuId of studentIds) {
      // Check if repeat
      const repeatRes = await client.query(
        `SELECT 1 FROM course_enrollments ce
         JOIN course_offerings co ON co.id = ce.offering_id
         WHERE ce.student_id = $1 AND co.course_id = $2
         LIMIT 1`,
        [stuId, courseId]
      );
      const isRepeat = repeatRes.rows.length > 0;
      const enrId = newId('enr');

      await client.query(
        `INSERT INTO course_enrollments (id, offering_id, student_id, status, is_repeat, enrolled_at)
         VALUES ($1, $2, $3, 'enrolled', $4, now())
         ON CONFLICT (offering_id, student_id)
         DO UPDATE SET status = 'enrolled', withdrawn_at = NULL, updated_at = now()`,
        [enrId, offeringId, stuId, isRepeat]
      );
      enrolledCount++;
    }
    return enrolledCount;
  });
}

export async function withdrawEnrollment(enrollmentId) {
  return await withTransaction(async (client) => {
    const res = await client.query(
      `UPDATE course_enrollments
       SET status = 'withdrawn', withdrawn_at = now(), updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [enrollmentId]
    );
    const enr = res.rows[0];

    // Create or update final_grades to 'W' with no points
    const scaleRes = await client.query(`SELECT id FROM grade_scales WHERE is_active = true LIMIT 1`);
    const scaleId = scaleRes.rows[0]?.id || 'gsc_0001';
    const fgId = newId('fgr');

    await client.query(
      `INSERT INTO final_grades (
         id, enrollment_id, grade_scale_id, total_score, letter, grade_points,
         special_grade, status, computed_at
       ) VALUES ($1, $2, $3, NULL, 'W', NULL, 'W', 'draft', now())
       ON CONFLICT (enrollment_id)
       DO UPDATE SET letter = 'W', grade_points = NULL, special_grade = 'W', updated_at = now()`,
      [fgId, enrollmentId, scaleId]
    );

    return enr;
  });
}

export async function deleteEnrollment(enrollmentId) {
  await query(`DELETE FROM course_enrollments WHERE id = $1`, [enrollmentId]);
}

export async function enrollmentHasScoresOrGrades(enrollmentId) {
  const res = await query(
    `SELECT
       (SELECT count(*) FROM assessment_scores WHERE enrollment_id = $1) as score_count,
       (SELECT count(*) FROM final_grades WHERE enrollment_id = $1 AND status != 'draft') as grade_count`,
    [enrollmentId]
  );
  return (
    parseInt(res.rows[0]?.score_count || '0', 10) > 0 ||
    parseInt(res.rows[0]?.grade_count || '0', 10) > 0
  );
}
