import { query, withTransaction } from '../config/database.js';

export async function listAcademicCalendar() {
  const yearsRes = await query(`SELECT * FROM academic_years ORDER BY start_date DESC`);
  const semsRes = await query(`
    SELECT s.*,
           COUNT(co.id) as offering_count
    FROM semesters s
    LEFT JOIN course_offerings co ON co.semester_id = s.id
    GROUP BY s.id
    ORDER BY s.sort_order ASC
  `);

  const semsByYear = {};
  for (const s of semsRes.rows) {
    if (!semsByYear[s.academic_year_id]) {
      semsByYear[s.academic_year_id] = [];
    }
    semsByYear[s.academic_year_id].push(s);
  }

  return yearsRes.rows.map((y) => ({
    ...y,
    semesters: semsByYear[y.id] || [],
  }));
}

export async function getAcademicYearById(id) {
  const res = await query(`SELECT * FROM academic_years WHERE id = $1`, [id]);
  return res.rows[0] || null;
}

export async function createAcademicYear({ id, name, startDate, endDate }) {
  const res = await query(
    `INSERT INTO academic_years (id, name, start_date, end_date, is_current)
     VALUES ($1, $2, $3, $4, false)
     RETURNING *`,
    [id, name, startDate, endDate]
  );
  return res.rows[0];
}

export async function updateAcademicYear(id, { startDate, endDate }) {
  const res = await query(
    `UPDATE academic_years
     SET start_date = COALESCE($2, start_date),
         end_date = COALESCE($3, end_date)
     WHERE id = $1
     RETURNING *`,
    [id, startDate, endDate]
  );
  return res.rows[0] || null;
}

export async function getSemesterById(id) {
  const res = await query(
    `SELECT s.*,
            json_build_object('id', ay.id, 'name', ay.name, 'startDate', ay.start_date, 'endDate', ay.end_date) as academic_year
     FROM semesters s
     JOIN academic_years ay ON ay.id = s.academic_year_id
     WHERE s.id = $1`,
    [id]
  );
  return res.rows[0] || null;
}

export async function getCurrentSemester() {
  const res = await query(
    `SELECT s.*,
            json_build_object('id', ay.id, 'name', ay.name, 'startDate', ay.start_date, 'endDate', ay.end_date) as academic_year
     FROM semesters s
     JOIN academic_years ay ON ay.id = s.academic_year_id
     WHERE s.is_current = true
     LIMIT 1`
  );
  return res.rows[0] || null;
}

export async function createSemester({
  id,
  academicYearId,
  term,
  name,
  startDate,
  endDate,
  gradeSubmissionDeadline,
  withdrawalDeadline,
}) {
  const maxOrderRes = await query(`SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order FROM semesters`);
  const sortOrder = maxOrderRes.rows[0].next_order;

  const res = await query(
    `INSERT INTO semesters (
       id, academic_year_id, term, name, sort_order, start_date, end_date,
       grade_submission_deadline, withdrawal_deadline, is_current, status
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, 'upcoming')
     RETURNING *`,
    [
      id,
      academicYearId,
      term,
      name,
      sortOrder,
      startDate,
      endDate,
      gradeSubmissionDeadline,
      withdrawalDeadline || null,
    ]
  );
  return res.rows[0];
}

export async function updateSemester(id, {
  startDate,
  endDate,
  gradeSubmissionDeadline,
  withdrawalDeadline,
  status,
}) {
  const res = await query(
    `UPDATE semesters
     SET start_date = COALESCE($2, start_date),
         end_date = COALESCE($3, end_date),
         grade_submission_deadline = COALESCE($4, grade_submission_deadline),
         withdrawal_deadline = $5,
         status = COALESCE($6, status)
     WHERE id = $1
     RETURNING *`,
    [id, startDate, endDate, gradeSubmissionDeadline, withdrawalDeadline || null, status]
  );
  return res.rows[0] || null;
}

export async function setCurrentSemester(semesterId) {
  return await withTransaction(async (client) => {
    const semRes = await client.query(`SELECT * FROM semesters WHERE id = $1`, [semesterId]);
    if (semRes.rows.length === 0) return null;
    const target = semRes.rows[0];

    // Unset current on all academic years and semesters
    await client.query(`UPDATE academic_years SET is_current = false`);
    await client.query(`UPDATE semesters SET is_current = false`);

    // Set current on target year and semester
    await client.query(`UPDATE academic_years SET is_current = true WHERE id = $1`, [target.academic_year_id]);
    await client.query(
      `UPDATE semesters
       SET is_current = true, status = 'active'
       WHERE id = $1`,
      [semesterId]
    );

    // Close earlier semesters, mark later ones upcoming
    await client.query(
      `UPDATE semesters
       SET status = 'closed'
       WHERE sort_order < $1 AND status != 'closed'`,
      [target.sort_order]
    );
    await client.query(
      `UPDATE semesters
       SET status = 'upcoming'
       WHERE sort_order > $1`,
      [target.sort_order]
    );

    return target;
  });
}

export async function deleteSemester(id) {
  await query(`DELETE FROM semesters WHERE id = $1`, [id]);
}

export async function hasOfferings(semesterId) {
  const res = await query(`SELECT count(*) as count FROM course_offerings WHERE semester_id = $1`, [semesterId]);
  return parseInt(res.rows[0]?.count || '0', 10) > 0;
}
