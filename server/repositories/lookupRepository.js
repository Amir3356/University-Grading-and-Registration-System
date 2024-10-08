import { query } from '../config/database.js';

/**
 * Lookup Repository - Handles Database Operations for Reference/Lookup Data
 */

export async function getDepartmentsLookup() {
  const r = await query(`
    SELECT d.id, d.code, d.name,
           (u.first_name || ' ' || u.last_name) as head_name
    FROM departments d
    LEFT JOIN teachers ht ON ht.id = d.head_teacher_id
    LEFT JOIN users u ON u.id = ht.user_id
    ORDER BY d.name ASC
  `);
  return r.rows;
}

export async function getSemestersLookup() {
  const r = await query(`
    SELECT s.id, s.name, s.is_current, s.status,
           json_build_object('id', ay.id, 'name', ay.name) as academic_year
    FROM semesters s
    JOIN academic_years ay ON ay.id = s.academic_year_id
    ORDER BY s.sort_order DESC
  `);
  return r.rows;
}

export async function getAcademicYearsLookup() {
  const r = await query(`
    SELECT id, name, is_current 
    FROM academic_years 
    ORDER BY start_date DESC
  `);
  return r.rows;
}

export async function getProgramsLookup(departmentId = null) {
  let sql = `SELECT id, code, name, department_id, program_type FROM programs WHERE status = 'active'`;
  const params = [];
  if (departmentId) {
    params.push(departmentId);
    sql += ` AND department_id = $1`;
  }
  sql += ` ORDER BY name ASC`;
  const r = await query(sql, params);
  return r.rows;
}

export async function getTeachersLookup(departmentId = null) {
  let sql = `
    SELECT t.id, (u.first_name || ' ' || u.last_name) as name,
           t.employee_number, t.department_id, u.email
    FROM teachers t
    JOIN users u ON u.id = t.user_id
    WHERE u.status = 'active'
  `;
  const params = [];
  if (departmentId) {
    params.push(departmentId);
    sql += ` AND t.department_id = $1`;
  }
  sql += ` ORDER BY u.last_name ASC, u.first_name ASC`;
  const r = await query(sql, params);
  return r.rows;
}
