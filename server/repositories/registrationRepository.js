import { query, withTransaction } from '../config/database.js';

export async function listRegistrationPeriods({ academicYearId, term, status, search, page = 1, pageSize = 10 } = {}) {
  const conditions = [];
  const params = [];

  if (academicYearId) {
    params.push(academicYearId);
    conditions.push(`s.academic_year_id = $${params.length}`);
  }

  if (term) {
    params.push(term);
    conditions.push(`s.term = $${params.length}`);
  }

  if (status) {
    params.push(status);
    conditions.push(`rp.status = $${params.length}`);
  }

  if (search) {
    params.push(`%${search.trim()}%`);
    conditions.push(`(s.name ILIKE $${params.length} OR ay.name ILIKE $${params.length})`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countQuery = `
    SELECT count(*) as total
    FROM registration_periods rp
    JOIN semesters s ON s.id = rp.semester_id
    JOIN academic_years ay ON ay.id = s.academic_year_id
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
    SELECT rp.id, rp.semester_id, rp.start_date, rp.deadline, rp.status, rp.created_at, rp.updated_at,
           json_build_object(
             'id', s.id,
             'name', s.name,
             'term', s.term,
             'academicYear', json_build_object('id', ay.id, 'name', ay.name)
           ) as semester,
           COALESCE(
             json_agg(DISTINCT jsonb_build_object('id', rt.id, 'label', rt.label))
             FILTER (WHERE rt.id IS NOT NULL), '[]'
           ) as registration_types,
           COUNT(DISTINCT sr.id) FILTER (WHERE sr.status = 'registered') as registered_count,
           COUNT(DISTINCT sr.id) FILTER (WHERE sr.status = 'pending') as pending_count
    FROM registration_periods rp
    JOIN semesters s ON s.id = rp.semester_id
    JOIN academic_years ay ON ay.id = s.academic_year_id
    LEFT JOIN registration_period_types rpt ON rpt.period_id = rp.id
    LEFT JOIN registration_types rt ON rt.id = rpt.registration_type_id
    LEFT JOIN semester_registrations sr ON sr.period_id = rp.id
    ${whereClause}
    GROUP BY rp.id, s.id, ay.id
    ORDER BY rp.start_date DESC
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `;

  const res = await query(sql, params);
  return { items: res.rows, total };
}

export async function getRegistrationPeriodById(id) {
  const sql = `
    SELECT rp.id, rp.semester_id, rp.start_date, rp.deadline, rp.status, rp.created_at, rp.updated_at,
           json_build_object(
             'id', s.id,
             'name', s.name,
             'term', s.term,
             'academicYear', json_build_object('id', ay.id, 'name', ay.name)
           ) as semester,
           COALESCE(
             json_agg(DISTINCT jsonb_build_object('id', rt.id, 'label', rt.label))
             FILTER (WHERE rt.id IS NOT NULL), '[]'
           ) as registration_types,
           COUNT(DISTINCT sr.id) FILTER (WHERE sr.status = 'registered') as registered_count,
           COUNT(DISTINCT sr.id) FILTER (WHERE sr.status = 'pending') as pending_count
    FROM registration_periods rp
    JOIN semesters s ON s.id = rp.semester_id
    JOIN academic_years ay ON ay.id = s.academic_year_id
    LEFT JOIN registration_period_types rpt ON rpt.period_id = rp.id
    LEFT JOIN registration_types rt ON rt.id = rpt.registration_type_id
    LEFT JOIN semester_registrations sr ON sr.period_id = rp.id
    WHERE rp.id = $1
    GROUP BY rp.id, s.id, ay.id
  `;
  const res = await query(sql, [id]);
  return res.rows[0] || null;
}

export async function findPeriodBySemester(semesterId) {
  const res = await query(`SELECT * FROM registration_periods WHERE semester_id = $1`, [semesterId]);
  return res.rows[0] || null;
}

export async function createRegistrationPeriod({ id, semesterId, startDate, deadline, status = 'scheduled', registrationTypeIds, createdBy }) {
  return await withTransaction(async (client) => {
    const res = await client.query(
      `INSERT INTO registration_periods (id, semester_id, start_date, deadline, status, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, semesterId, startDate, deadline, status, createdBy]
    );
    const period = res.rows[0];

    if (Array.isArray(registrationTypeIds)) {
      for (const tId of registrationTypeIds) {
        await client.query(
          `INSERT INTO registration_period_types (period_id, registration_type_id)
           VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [id, tId]
        );
      }
    }
    return period;
  });
}

export async function updateRegistrationPeriod(id, { startDate, deadline, status, registrationTypeIds }) {
  return await withTransaction(async (client) => {
    const res = await client.query(
      `UPDATE registration_periods
       SET start_date = COALESCE($2, start_date),
           deadline = COALESCE($3, deadline),
           status = COALESCE($4, status),
           updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [id, startDate, deadline, status]
    );
    const period = res.rows[0];

    if (Array.isArray(registrationTypeIds)) {
      await client.query(`DELETE FROM registration_period_types WHERE period_id = $1`, [id]);
      for (const tId of registrationTypeIds) {
        await client.query(
          `INSERT INTO registration_period_types (period_id, registration_type_id)
           VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [id, tId]
        );
      }
    }
    return period;
  });
}

export async function openRegistrationPeriod(id) {
  return await withTransaction(async (client) => {
    // Close other open periods
    await client.query(`UPDATE registration_periods SET status = 'closed' WHERE status = 'open' AND id != $1`, [id]);
    const res = await client.query(
      `UPDATE registration_periods SET status = 'open', updated_at = now() WHERE id = $1 RETURNING *`,
      [id]
    );
    return res.rows[0] || null;
  });
}

export async function closeRegistrationPeriod(id) {
  const res = await query(
    `UPDATE registration_periods SET status = 'closed', updated_at = now() WHERE id = $1 RETURNING *`,
    [id]
  );
  return res.rows[0] || null;
}

export async function deleteRegistrationPeriod(id) {
  await query(`DELETE FROM registration_periods WHERE id = $1`, [id]);
}

export async function countRegistrationsInPeriod(periodId) {
  const res = await query(`SELECT count(*) as count FROM semester_registrations WHERE period_id = $1`, [periodId]);
  return parseInt(res.rows[0]?.count || '0', 10);
}

export async function getRegistrationSummary(semesterId) {
  const semsRes = await query(`SELECT count(*) as total_semesters FROM semesters`);
  const openRes = await query(`SELECT count(*) as open_periods FROM registration_periods WHERE status = 'open'`);

  // Target semester
  let semId = semesterId;
  if (!semId) {
    const currRes = await query(`SELECT id FROM semesters WHERE is_current = true LIMIT 1`);
    semId = currRes.rows[0]?.id;
  }

  const countsRes = await query(
    `SELECT
       COUNT(DISTINCT s.id) FILTER (WHERE s.academic_status = 'active') as active_students,
       COUNT(DISTINCT sr.id) FILTER (WHERE sr.status = 'registered') as registered,
       COUNT(DISTINCT sr.id) FILTER (WHERE sr.status = 'pending') as pending
     FROM students s
     LEFT JOIN semester_registrations sr ON sr.student_id = s.id AND sr.semester_id = $1`,
    [semId]
  );

  const activeStudents = parseInt(countsRes.rows[0]?.active_students || '0', 10);
  const registered = parseInt(countsRes.rows[0]?.registered || '0', 10);
  const pending = parseInt(countsRes.rows[0]?.pending || '0', 10);
  const notRegistered = Math.max(0, activeStudents - (registered + pending));

  const byTypeRes = await query(
    `SELECT sr.registration_type_id as type_id, count(sr.id) as count
     FROM semester_registrations sr
     WHERE sr.semester_id = $1 AND sr.status = 'registered'
     GROUP BY sr.registration_type_id`,
    [semId]
  );

  return {
    totalSemesters: parseInt(semsRes.rows[0]?.total_semesters || '0', 10),
    openPeriods: parseInt(openRes.rows[0]?.open_periods || '0', 10),
    registered,
    pending,
    notRegistered,
    byType: byTypeRes.rows.map((r) => ({ typeId: r.type_id, count: parseInt(r.count, 10) })),
  };
}

export async function listStudentRegistrations({ semesterId, departmentId, programId, registrationTypeId, status, search, page = 1, pageSize = 10 }) {
  let semId = semesterId;
  if (!semId) {
    const currRes = await query(`SELECT id FROM semesters WHERE is_current = true LIMIT 1`);
    semId = currRes.rows[0]?.id;
  }

  const conditions = [`s.academic_status = 'active'`];
  const params = [semId];

  if (departmentId) {
    params.push(departmentId);
    conditions.push(`s.department_id = $${params.length}`);
  }

  if (programId) {
    params.push(programId);
    conditions.push(`s.program_id = $${params.length}`);
  }

  if (registrationTypeId) {
    params.push(registrationTypeId);
    conditions.push(`sr.registration_type_id = $${params.length}`);
  }

  if (status) {
    if (status === 'not_registered') {
      conditions.push(`(sr.id IS NULL OR sr.status = 'cancelled')`);
    } else {
      params.push(status);
      conditions.push(`sr.status = $${params.length}`);
    }
  }

  if (search) {
    params.push(`%${search.trim()}%`);
    conditions.push(`(
      u.first_name ILIKE $${params.length}
      OR u.last_name ILIKE $${params.length}
      OR s.student_number ILIKE $${params.length}
    )`);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const countSql = `
    SELECT count(*) as total
    FROM students s
    JOIN users u ON u.id = s.user_id
    LEFT JOIN semester_registrations sr ON sr.student_id = s.id AND sr.semester_id = $1
    ${whereClause}
  `;
  const countRes = await query(countSql, params);
  const total = parseInt(countRes.rows[0]?.total || '0', 10);

  const limit = pageSize === 'all' ? total || 1 : Math.max(1, parseInt(pageSize, 10) || 10);
  const offset = pageSize === 'all' ? 0 : (Math.max(1, parseInt(page, 10) || 1) - 1) * limit;

  params.push(limit);
  const limitIdx = params.length;
  params.push(offset);
  const offsetIdx = params.length;

  const dataSql = `
    SELECT s.id as student_id, s.student_number,
           (u.first_name || ' ' || u.last_name) as name,
           s.program_type, s.year_of_study,
           json_build_object('id', d.id, 'name', d.name) as department,
           p.name as program,
           CASE WHEN sr.id IS NOT NULL THEN
             json_build_object(
               'id', sr.id,
               'registrationTypeId', sr.registration_type_id,
               'status', sr.status,
               'submittedAt', sr.submitted_at,
               'reviewedAt', sr.reviewed_at,
               'remarks', sr.remarks
             )
           ELSE NULL END as registration,
           COALESCE(sr.status, 'not_registered') as status
    FROM students s
    JOIN users u ON u.id = s.user_id
    JOIN departments d ON d.id = s.department_id
    JOIN programs p ON p.id = s.program_id
    LEFT JOIN semester_registrations sr ON sr.student_id = s.id AND sr.semester_id = $1
    ${whereClause}
    ORDER BY s.student_number ASC
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `;

  const dataRes = await query(dataSql, params);
  return { items: dataRes.rows, total };
}

export async function findRegistrationById(id) {
  const res = await query(
    `SELECT sr.*, s.student_number, s.user_id as student_user_id
     FROM semester_registrations sr
     JOIN students s ON s.id = sr.student_id
     WHERE sr.id = $1`,
    [id]
  );
  return res.rows[0] || null;
}

export async function updateRegistrationType(id, registrationTypeId) {
  const res = await query(
    `UPDATE semester_registrations
     SET registration_type_id = $2, updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [id, registrationTypeId]
  );
  return res.rows[0] || null;
}

export async function approveRegistration(id, reviewerId) {
  const res = await query(
    `UPDATE semester_registrations
     SET status = 'registered', reviewed_by = $2, reviewed_at = now(), updated_at = now()
     WHERE id = $1 AND status = 'pending'
     RETURNING *`,
    [id, reviewerId]
  );
  return res.rows[0] || null;
}

export async function rejectRegistration(id, remarks, reviewerId) {
  const res = await query(
    `UPDATE semester_registrations
     SET status = 'rejected', remarks = $2, reviewed_by = $3, reviewed_at = now(), updated_at = now()
     WHERE id = $1 AND status = 'pending'
     RETURNING *`,
    [id, remarks, reviewerId]
  );
  return res.rows[0] || null;
}

export async function deleteRegistration(id) {
  await query(`DELETE FROM semester_registrations WHERE id = $1`, [id]);
}

export async function getCurrentPeriodForStudent(studentId) {
  const periodRes = await query(`
    SELECT rp.*,
           s.name as semester_name, s.term,
           ay.name as academic_year_name,
           json_agg(DISTINCT jsonb_build_object('id', rt.id, 'label', rt.label)) as allowed_types
    FROM registration_periods rp
    JOIN semesters s ON s.id = rp.semester_id
    JOIN academic_years ay ON ay.id = s.academic_year_id
    JOIN registration_period_types rpt ON rpt.period_id = rp.id
    JOIN registration_types rt ON rt.id = rpt.registration_type_id
    WHERE rp.status = 'open' AND rp.start_date <= CURRENT_DATE AND rp.deadline >= CURRENT_DATE
    GROUP BY rp.id, s.id, ay.id
    LIMIT 1
  `);

  if (periodRes.rows.length === 0) return null;
  const p = periodRes.rows[0];

  const regRes = await query(
    `SELECT sr.*, rt.label as registration_type_label
     FROM semester_registrations sr
     JOIN registration_types rt ON rt.id = sr.registration_type_id
     WHERE sr.student_id = $1 AND sr.semester_id = $2`,
    [studentId, p.semester_id]
  );

  const deadlineDate = new Date(p.deadline);
  const today = new Date();
  const diffTime = deadlineDate.getTime() - today.getTime();
  const daysLeft = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

  return {
    ...p,
    daysLeft,
    myRegistration: regRes.rows[0] || null,
  };
}

export async function listStudentRegistrationHistory(studentId) {
  const res = await query(
    `SELECT sr.*,
            s.name as semester_name, s.term,
            ay.name as academic_year_name,
            rt.label as type_label
     FROM semester_registrations sr
     JOIN semesters s ON s.id = sr.semester_id
     JOIN academic_years ay ON ay.id = s.academic_year_id
     JOIN registration_types rt ON rt.id = sr.registration_type_id
     WHERE sr.student_id = $1
     ORDER BY s.sort_order DESC`,
    [studentId]
  );
  return res.rows;
}

export async function createStudentRegistration({ id, studentId, semesterId, periodId, registrationTypeId }) {
  const res = await query(
    `INSERT INTO semester_registrations (
       id, student_id, semester_id, period_id, registration_type_id, status, submitted_at
     ) VALUES ($1, $2, $3, $4, $5, 'pending', now())
     RETURNING *`,
    [id, studentId, semesterId, periodId, registrationTypeId]
  );
  return res.rows[0];
}

export async function cancelStudentRegistration(id, studentId) {
  const res = await query(
    `UPDATE semester_registrations
     SET status = 'cancelled', updated_at = now()
     WHERE id = $1 AND student_id = $2 AND status = 'pending'
     RETURNING *`,
    [id, studentId]
  );
  return res.rows[0] || null;
}
