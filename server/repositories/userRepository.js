import { query } from '../config/database.js';

export async function findById(id) {
  const res = await query(
    `SELECT u.*, r.name as role_name
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.id = $1`,
    [id]
  );
  return res.rows[0] || null;
}

export async function findByUsername(username) {
  const res = await query(
    `SELECT u.*, r.name as role_name
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE lower(u.username) = lower($1)`,
    [username]
  );
  return res.rows[0] || null;
}

export async function findByEmail(email) {
  const res = await query(
    `SELECT * FROM users WHERE lower(email) = lower($1)`,
    [email]
  );
  return res.rows[0] || null;
}

export async function findByIdentifierOrUsername(role, identifier) {
  const cleanId = String(identifier || '').trim();
  const lowerId = cleanId.toLowerCase();

  if (role === 'student') {
    const res = await query(
      `SELECT u.*
       FROM users u
       LEFT JOIN students s ON s.user_id = u.id
       WHERE u.role_id = 'student'
         AND (lower(u.username) = $1 OR lower(s.student_number) = $1 OR lower(u.email) = $1)`,
      [lowerId]
    );
    return res.rows[0] || null;
  }

  if (role === 'teacher') {
    const res = await query(
      `SELECT u.*
       FROM users u
       LEFT JOIN teachers t ON t.user_id = u.id
       WHERE u.role_id = 'teacher'
         AND (lower(u.username) = $1 OR lower(t.employee_number) = $1 OR lower(u.email) = $1)`,
      [lowerId]
    );
    return res.rows[0] || null;
  }

  if (role === 'dept_head') {
    const res = await query(
      `SELECT u.*
       FROM users u
       LEFT JOIN teachers t ON t.user_id = u.id
       LEFT JOIN departments d ON d.head_teacher_id = t.id OR d.id = t.department_id
       WHERE (u.role_id = 'dept_head' OR u.role_id = 'teacher')
         AND (
           lower(u.username) = $1
           OR lower(t.employee_number) = $1
           OR lower(d.code) = $1
           OR lower(d.id) = $1
           OR lower(u.email) = $1
           OR lower($1) IN ('dept_head', 'depthead', 'head')
         )
       ORDER BY CASE WHEN u.role_id = 'dept_head' THEN 1 WHEN d.head_teacher_id = t.id THEN 2 ELSE 3 END
       LIMIT 1`,
      [lowerId]
    );
    return res.rows[0] || null;
  }

  if (role === 'admin') {
    const res = await query(
      `SELECT u.*
       FROM users u
       WHERE u.role_id = 'admin'
         AND (
           lower(u.username) = $1
           OR lower(u.email) = $1
           OR ($1 IN ('admin', 'amir') AND u.id = 'usr_0001')
         )
       LIMIT 1`,
      [lowerId]
    );
    return res.rows[0] || null;
  }

  // If role is omitted or general login: search across ALL users by username, email, student ID, or teacher employee number
  const res = await query(
    `SELECT u.*
     FROM users u
     LEFT JOIN students s ON s.user_id = u.id
     LEFT JOIN teachers t ON t.user_id = u.id
     WHERE lower(u.username) = $1
        OR lower(u.email) = $1
        OR lower(s.student_number) = $1
        OR lower(t.employee_number) = $1
        OR ($1 IN ('admin', 'amir') AND u.id = 'usr_0001')
     ORDER BY CASE
       WHEN lower(u.username) = $1 THEN 1
       WHEN lower(u.email) = $1 THEN 2
       ELSE 3
     END
     LIMIT 1`,
    [lowerId]
  );
  return res.rows[0] || null;
}

export async function getUserProfile(userId, roleId) {
  if (roleId === 'teacher' || roleId === 'dept_head') {
    const res = await query(
      `SELECT t.id, t.employee_number, t.title, t.specialization, t.office_room,
              t.hire_date, t.department_id,
              json_build_object('id', d.id, 'code', d.code, 'name', d.name) as department
       FROM teachers t
       LEFT JOIN departments d ON d.id = t.department_id
       WHERE t.user_id = $1`,
      [userId]
    );
    return res.rows[0] || null;
  }

  if (roleId === 'student') {
    const res = await query(
      `SELECT s.id, s.student_number, s.department_id, s.program_id,
              s.program_type, s.admission_year, s.year_of_study, s.date_of_birth, s.academic_status,
              p.name as program,
              json_build_object('id', d.id, 'code', d.code, 'name', d.name) as department
       FROM students s
       LEFT JOIN departments d ON d.id = s.department_id
       LEFT JOIN programs p ON p.id = s.program_id
       WHERE s.user_id = $1`,
      [userId]
    );
    return res.rows[0] || null;
  }

  return null;
}

export async function listUsers({ search, role, status, departmentId, programType, page = 1, pageSize = 10, sort, excludeSeed }) {
  const conditions = [];
  const params = [];

  if (excludeSeed === true || excludeSeed === 'true') {
    conditions.push(`(u.is_seed = false OR u.is_seed IS NULL)`);
  }

  if (search) {
    params.push(`%${search.trim()}%`);
    conditions.push(`(
      u.first_name ILIKE $${params.length}
      OR u.last_name ILIKE $${params.length}
      OR u.username ILIKE $${params.length}
      OR u.email ILIKE $${params.length}
      OR s.student_number ILIKE $${params.length}
      OR t.employee_number ILIKE $${params.length}
    )`);
  }

  if (role) {
    params.push(role);
    conditions.push(`u.role_id = $${params.length}`);
  }

  if (status) {
    params.push(status);
    conditions.push(`u.status = $${params.length}`);
  }

  if (departmentId) {
    params.push(departmentId);
    conditions.push(`(s.department_id = $${params.length} OR t.department_id = $${params.length})`);
  }

  if (programType) {
    params.push(programType);
    conditions.push(`s.program_type = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countQuery = `
    SELECT count(DISTINCT u.id) as total
    FROM users u
    LEFT JOIN students s ON s.user_id = u.id
    LEFT JOIN teachers t ON t.user_id = u.id
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
    SELECT u.id, u.role_id, u.username, u.first_name, u.last_name, u.email, u.phone,
           u.status, u.must_change_password, u.is_seed, u.last_login_at, u.created_at, u.updated_at,
           u.password_hash,
           r.name as role_name,
           s.id as student_profile_id, s.student_number, s.department_id as student_dept_id,
           s.program_id, s.program_type, s.admission_year, s.year_of_study, s.academic_status,
           t.id as teacher_profile_id, t.employee_number, t.department_id as teacher_dept_id,
           t.title, t.specialization, t.office_room,
           COALESCE(sd.name, td.name) as department_name,
           COALESCE(sd.id, td.id) as department_id,
           p.name as program_name
    FROM users u
    JOIN roles r ON r.id = u.role_id
    LEFT JOIN students s ON s.user_id = u.id
    LEFT JOIN departments sd ON sd.id = s.department_id
    LEFT JOIN programs p ON p.id = s.program_id
    LEFT JOIN teachers t ON t.user_id = u.id
    LEFT JOIN departments td ON td.id = t.department_id
    ${whereClause}
    ORDER BY u.created_at DESC
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `;

  const dataRes = await query(dataQuery, params);
  const formattedItems = dataRes.rows.map((row) => ({
    ...row,
    name: `${row.first_name || ''} ${row.last_name || ''}`.trim(),
    roleId: row.role_id,
    identifier: row.student_number || row.employee_number || '—',
    departmentName: row.department_name || '—',
    departmentId: row.department_id,
    passwordHash: row.password_hash,
    isSeed: Boolean(row.is_seed),
  }));

  return { items: formattedItems, total };
}

export async function listStudents({ search, departmentId, programId, programType, yearOfStudy, status, page = 1, pageSize = 10 }) {
  const conditions = [];
  const params = [];

  if (search) {
    params.push(`%${search.trim()}%`);
    conditions.push(`(
      u.first_name ILIKE $${params.length}
      OR u.last_name ILIKE $${params.length}
      OR s.student_number ILIKE $${params.length}
      OR u.email ILIKE $${params.length}
    )`);
  }

  if (departmentId) {
    params.push(departmentId);
    conditions.push(`s.department_id = $${params.length}`);
  }

  if (programId) {
    params.push(programId);
    conditions.push(`s.program_id = $${params.length}`);
  }

  if (programType) {
    params.push(programType);
    conditions.push(`s.program_type = $${params.length}`);
  }

  if (yearOfStudy) {
    params.push(parseInt(yearOfStudy, 10));
    conditions.push(`s.year_of_study = $${params.length}`);
  }

  if (status) {
    params.push(status);
    conditions.push(`s.academic_status = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countQuery = `
    SELECT count(*) as total
    FROM students s
    JOIN users u ON u.id = s.user_id
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
    SELECT s.id, s.student_number, s.department_id, s.program_id, s.program_type,
           s.admission_year, s.year_of_study, s.date_of_birth, s.academic_status,
           u.id as user_id, u.first_name, u.last_name, u.email, u.phone, u.status as user_status,
           (u.first_name || ' ' || u.last_name) as name,
           d.name as department_name, d.code as department_code,
           p.name as program_name, p.code as program_code
    FROM students s
    JOIN users u ON u.id = s.user_id
    LEFT JOIN departments d ON d.id = s.department_id
    LEFT JOIN programs p ON p.id = s.program_id
    ${whereClause}
    ORDER BY s.student_number ASC
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `;

  const dataRes = await query(dataQuery, params);
  return { items: dataRes.rows, total };
}

export async function listTeachers({ departmentId, currentSemesterId }) {
  const params = [];
  let deptCondition = '';
  if (departmentId) {
    params.push(departmentId);
    deptCondition = `WHERE t.department_id = $${params.length}`;
  }

  let semParam = '';
  if (currentSemesterId) {
    params.push(currentSemesterId);
    semParam = `AND co.semester_id = $${params.length}`;
  }

  const sql = `
    SELECT t.id, t.employee_number, t.department_id, t.title, t.specialization, t.office_room, t.hire_date,
           u.id as user_id, u.first_name, u.last_name, u.email, u.phone, u.status,
           (t.title || ' ' || u.first_name || ' ' || u.last_name) as name,
           d.name as department_name, d.code as department_code,
           COUNT(co.id) FILTER (WHERE 1=1 ${semParam}) as offering_count
    FROM teachers t
    JOIN users u ON u.id = t.user_id
    LEFT JOIN departments d ON d.id = t.department_id
    LEFT JOIN course_offerings co ON co.teacher_id = t.id
    ${deptCondition}
    GROUP BY t.id, u.id, d.id
    ORDER BY u.first_name ASC
  `;

  const res = await query(sql, params);
  return res.rows;
}

export async function createRefreshToken(userId, tokenHash, userAgent, ipAddress, expiresAt) {
  const id = `rt_${Date.now()}`;
  await query(
    `INSERT INTO refresh_tokens (id, user_id, token_hash, user_agent, ip_address, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, userId, tokenHash, userAgent, ipAddress, expiresAt]
  );
  return id;
}

export async function findRefreshToken(tokenHash) {
  const res = await query(
    `SELECT * FROM refresh_tokens WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now()`,
    [tokenHash]
  );
  return res.rows[0] || null;
}

export async function revokeRefreshToken(tokenHash) {
  await query(
    `UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1`,
    [tokenHash]
  );
}

export async function revokeAllUserRefreshTokens(userId) {
  await query(
    `UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId]
  );
}

export async function getStudentById(id) {
  const res = await query(
    `SELECT s.*, (u.first_name || ' ' || u.last_name) as name, u.email, u.phone, u.status as user_status,
            d.name as department_name, d.code as department_code,
            p.name as program_name, p.code as program_code
     FROM students s
     JOIN users u ON u.id = s.user_id
     LEFT JOIN departments d ON d.id = s.department_id
     LEFT JOIN programs p ON p.id = s.program_id
     WHERE s.id = $1`,
    [id]
  );
  return res.rows[0] || null;
}

export async function getTeacherById(id) {
  const res = await query(
    `SELECT t.*, (t.title || ' ' || u.first_name || ' ' || u.last_name) as name, u.email, u.phone, u.status,
            d.name as department_name, d.code as department_code
     FROM teachers t
     JOIN users u ON u.id = t.user_id
     LEFT JOIN departments d ON d.id = t.department_id
     WHERE t.id = $1`,
    [id]
  );
  return res.rows[0] || null;
}

export async function updateLastLogin(userId) {
  await query(`UPDATE users SET last_login_at = now() WHERE id = $1`, [userId]);
}


