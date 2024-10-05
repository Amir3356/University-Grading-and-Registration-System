import { query } from '../config/database.js';

export async function listDepartments(search) {
  const params = [];
  let where = '';
  if (search) {
    params.push(`%${search.trim()}%`);
    where = `WHERE d.name ILIKE $1 OR d.code ILIKE $1`;
  }

  const sql = `
    SELECT d.id, d.code, d.name, d.description, d.head_teacher_id, d.created_at, d.updated_at,
           COUNT(DISTINCT c.id) as course_count,
           COUNT(DISTINCT t.id) as teacher_count,
           COUNT(DISTINCT s.id) as student_count,
           CASE WHEN ht.id IS NOT NULL THEN
             json_build_object(
               'id', ht.id,
               'name', (ht.title || ' ' || u.first_name || ' ' || u.last_name),
               'employeeNumber', ht.employee_number,
               'email', u.email
             )
           ELSE NULL END as head
    FROM departments d
    LEFT JOIN courses c ON c.department_id = d.id
    LEFT JOIN teachers t ON t.department_id = d.id
    LEFT JOIN students s ON s.department_id = d.id
    LEFT JOIN teachers ht ON ht.id = d.head_teacher_id
    LEFT JOIN users u ON u.id = ht.user_id
    ${where}
    GROUP BY d.id, ht.id, u.id
    ORDER BY d.name ASC
  `;
  const res = await query(sql, params);
  return res.rows;
}

export async function findById(id) {
  const res = await query(
    `SELECT d.*,
            CASE WHEN ht.id IS NOT NULL THEN
              json_build_object(
                'id', ht.id,
                'name', (ht.title || ' ' || u.first_name || ' ' || u.last_name),
                'employeeNumber', ht.employee_number,
                'email', u.email
              )
            ELSE NULL END as head
     FROM departments d
     LEFT JOIN teachers ht ON ht.id = d.head_teacher_id
     LEFT JOIN users u ON u.id = ht.user_id
     WHERE d.id = $1`,
    [id]
  );
  return res.rows[0] || null;
}

export async function findByCode(code) {
  const res = await query(`SELECT * FROM departments WHERE lower(code) = lower($1)`, [code]);
  return res.rows[0] || null;
}

export async function createDepartment({ id, code, name, description, headTeacherId }) {
  const res = await query(
    `INSERT INTO departments (id, code, name, description, head_teacher_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [id, code, name, description || null, headTeacherId || null]
  );
  return res.rows[0];
}

export async function updateDepartment(id, { code, name, description, headTeacherId }) {
  const res = await query(
    `UPDATE departments
     SET code = COALESCE($2, code),
         name = COALESCE($3, name),
         description = $4,
         head_teacher_id = $5,
         updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [id, code, name, description || null, headTeacherId || null]
  );
  return res.rows[0] || null;
}

export async function deleteDepartment(id) {
  await query(`DELETE FROM departments WHERE id = $1`, [id]);
}

export async function hasDependencies(id) {
  const res = await query(
    `SELECT
       (SELECT count(*) FROM courses WHERE department_id = $1) as course_count,
       (SELECT count(*) FROM teachers WHERE department_id = $1) as teacher_count,
       (SELECT count(*) FROM students WHERE department_id = $1) as student_count`,
    [id]
  );
  const row = res.rows[0];
  return (
    parseInt(row.course_count, 10) > 0 ||
    parseInt(row.teacher_count, 10) > 0 ||
    parseInt(row.student_count, 10) > 0
  );
}
