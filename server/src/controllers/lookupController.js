import * as lookupService from '../services/lookupService.js';
import { query } from '../config/database.js';
import { listReasonCategories } from '../repositories/withdrawalRepository.js';

export async function getLookups(req, res, next) {
  try {
    const lookups = await lookupService.getLookups(req.user);
    res.status(200).json(lookups);
  } catch (err) {
    next(err);
  }
}

export async function getDepartments(req, res, next) {
  try {
    const r = await query(`
      SELECT d.id, d.code, d.name,
             (u.first_name || ' ' || u.last_name) as head_name
      FROM departments d
      LEFT JOIN teachers ht ON ht.id = d.head_teacher_id
      LEFT JOIN users u ON u.id = ht.user_id
      ORDER BY d.name ASC
    `);
    res.status(200).json(r.rows);
  } catch (err) {
    next(err);
  }
}

export async function getSemesters(req, res, next) {
  try {
    const r = await query(`
      SELECT s.id, s.name, s.is_current, s.status,
             json_build_object('id', ay.id, 'name', ay.name) as academic_year
      FROM semesters s
      JOIN academic_years ay ON ay.id = s.academic_year_id
      ORDER BY s.sort_order DESC
    `);
    res.status(200).json(r.rows);
  } catch (err) {
    next(err);
  }
}

export async function getAcademicYears(req, res, next) {
  try {
    const r = await query(`SELECT id, name, is_current FROM academic_years ORDER BY start_date DESC`);
    res.status(200).json(r.rows);
  } catch (err) {
    next(err);
  }
}

export async function getPrograms(req, res, next) {
  try {
    const { departmentId } = req.query;
    let sql = `SELECT id, code, name, department_id, program_type FROM programs WHERE status = 'active'`;
    const params = [];
    if (departmentId) {
      params.push(departmentId);
      sql += ` AND department_id = $1`;
    }
    sql += ` ORDER BY name ASC`;
    const r = await query(sql, params);
    res.status(200).json(r.rows);
  } catch (err) {
    next(err);
  }
}

export async function getTeachers(req, res, next) {
  try {
    const { departmentId } = req.query;
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
    res.status(200).json(r.rows);
  } catch (err) {
    next(err);
  }
}

export async function getWithdrawalReasons(req, res, next) {
  try {
    const reasons = await listReasonCategories();
    res.status(200).json(reasons);
  } catch (err) {
    next(err);
  }
}
