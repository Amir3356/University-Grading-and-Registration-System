import { query } from '../config/database.js';

export async function listCourses({ search, departmentId, status } = {}) {
  const conditions = [];
  const params = [];

  if (search) {
    params.push(`%${search.trim()}%`);
    conditions.push(`(c.code ILIKE $${params.length} OR c.title ILIKE $${params.length})`);
  }

  if (departmentId) {
    params.push(departmentId);
    conditions.push(`c.department_id = $${params.length}`);
  }

  if (status) {
    params.push(status);
    conditions.push(`c.status = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `
    SELECT c.*, d.name as department_name, d.code as department_code,
           COUNT(co.id) as offering_count
    FROM courses c
    JOIN departments d ON d.id = c.department_id
    LEFT JOIN course_offerings co ON co.course_id = c.id
    ${whereClause}
    GROUP BY c.id, d.id
    ORDER BY c.code ASC
  `;

  const res = await query(sql, params);
  return res.rows;
}

export async function findById(id) {
  const res = await query(
    `SELECT c.*, d.name as department_name, d.code as department_code
     FROM courses c
     JOIN departments d ON d.id = c.department_id
     WHERE c.id = $1`,
    [id]
  );
  return res.rows[0] || null;
}

export async function findByCode(code) {
  const res = await query(`SELECT * FROM courses WHERE lower(code) = lower($1)`, [code]);
  return res.rows[0] || null;
}

export async function createCourse({ id, code, title, departmentId, creditHours, level, description }) {
  const res = await query(
    `INSERT INTO courses (id, code, title, department_id, credit_hours, level, description, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
     RETURNING *`,
    [id, code, title, departmentId, creditHours, level || 100, description || null]
  );
  return res.rows[0];
}

export async function updateCourse(id, { code, title, departmentId, creditHours, level, description, status }) {
  const res = await query(
    `UPDATE courses
     SET code = COALESCE($2, code),
         title = COALESCE($3, title),
         department_id = COALESCE($4, department_id),
         credit_hours = COALESCE($5, credit_hours),
         level = COALESCE($6, level),
         description = $7,
         status = COALESCE($8, status),
         updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [id, code, title, departmentId, creditHours, level, description || null, status]
  );
  return res.rows[0] || null;
}

export async function deleteCourse(id) {
  await query(`DELETE FROM courses WHERE id = $1`, [id]);
}

export async function hasPublishedGrades(id) {
  const sql = `
    SELECT count(*) as count
    FROM final_grades fg
    JOIN course_enrollments ce ON ce.id = fg.enrollment_id
    JOIN course_offerings co ON co.id = ce.offering_id
    WHERE co.course_id = $1 AND fg.status = 'published'
  `;
  const res = await query(sql, [id]);
  return parseInt(res.rows[0]?.count || '0', 10) > 0;
}

export async function hasOfferings(id) {
  const res = await query(`SELECT count(*) as count FROM course_offerings WHERE course_id = $1`, [id]);
  return parseInt(res.rows[0]?.count || '0', 10) > 0;
}
