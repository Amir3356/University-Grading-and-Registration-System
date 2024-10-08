import { query, withTransaction } from '../config/database.js';

export async function listPrograms({ departmentId } = {}) {
  const params = [];
  let where = '';
  if (departmentId) {
    params.push(departmentId);
    where = `WHERE p.department_id = $1`;
  }

  const sql = `
    SELECT p.*, d.name as department_name, d.code as department_code,
           COUNT(s.id) as student_count
    FROM programs p
    JOIN departments d ON d.id = p.department_id
    LEFT JOIN students s ON s.program_id = p.id
    ${where}
    GROUP BY p.id, d.id
    ORDER BY p.name ASC
  `;
  const res = await query(sql, params);
  return res.rows;
}

export async function findById(id) {
  const res = await query(
    `SELECT p.*, d.name as department_name, d.code as department_code
     FROM programs p
     JOIN departments d ON d.id = p.department_id
     WHERE p.id = $1`,
    [id]
  );
  return res.rows[0] || null;
}

export async function findByCode(code) {
  const res = await query(`SELECT * FROM programs WHERE lower(code) = lower($1)`, [code]);
  return res.rows[0] || null;
}

export async function createProgram({ id, departmentId, code, name, durationYears, requiredCredits }) {
  const res = await query(
    `INSERT INTO programs (id, department_id, code, name, duration_years, required_credits)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [id, departmentId, code, name, durationYears || 4, requiredCredits]
  );
  return res.rows[0];
}

export async function updateProgram(id, { departmentId, code, name, durationYears, requiredCredits, status }) {
  const res = await query(
    `UPDATE programs
     SET department_id = COALESCE($2, department_id),
         code = COALESCE($3, code),
         name = COALESCE($4, name),
         duration_years = COALESCE($5, duration_years),
         required_credits = COALESCE($6, required_credits),
         status = COALESCE($7, status),
         updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [id, departmentId, code, name, durationYears, requiredCredits, status]
  );
  return res.rows[0] || null;
}

export async function deleteProgram(id) {
  await query(`DELETE FROM programs WHERE id = $1`, [id]);
}

export async function hasStudents(id) {
  const res = await query(`SELECT count(*) as count FROM students WHERE program_id = $1`, [id]);
  return parseInt(res.rows[0]?.count || '0', 10) > 0;
}

export async function getCurriculum(programId) {
  const sql = `
    SELECT pc.course_id, pc.year_of_study, pc.term, pc.is_required,
           c.code as course_code, c.title as course_title, c.credit_hours, c.level, c.description,
           d.name as department_name
    FROM program_courses pc
    JOIN courses c ON c.id = pc.course_id
    JOIN departments d ON d.id = c.department_id
    WHERE pc.program_id = $1
    ORDER BY pc.year_of_study ASC, pc.term ASC, c.code ASC
  `;
  const res = await query(sql, [programId]);
  return res.rows;
}

export async function updateCurriculum(programId, items) {
  return await withTransaction(async (client) => {
    await client.query(`DELETE FROM program_courses WHERE program_id = $1`, [programId]);
    for (const item of items) {
      await client.query(
        `INSERT INTO program_courses (program_id, course_id, year_of_study, term, is_required)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          programId,
          item.courseId,
          item.yearOfStudy || null,
          item.term || null,
          item.isRequired ?? true,
        ]
      );
    }
  });
}
