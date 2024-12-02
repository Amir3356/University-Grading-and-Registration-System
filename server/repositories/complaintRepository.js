import crypto from 'crypto';
import { query } from '../config/database.js';

export async function listComplaints({
  studentId,
  teacherId,
  courseId,
  departmentId,
  category,
  status,
  search,
  cursor,
  limit: limitParam,
  pageSize,
  page = 1,
} = {}) {
  const conditions = [];
  const params = [];

  if (studentId) {
    params.push(studentId);
    conditions.push(`c.student_id = $${params.length}`);
  }

  if (teacherId) {
    params.push(teacherId);
    conditions.push(`(
      c.course_id IN (
        SELECT co.course_id FROM course_offerings co WHERE co.teacher_id = $${params.length}
      )
      OR c.course_id IS NULL
    )`);
  }

  if (courseId && courseId !== 'all') {
    params.push(courseId);
    conditions.push(`(c.course_id = $${params.length} OR crs.code = $${params.length})`);
  }

  if (departmentId) {
    params.push(departmentId);
    conditions.push(`s.department_id = $${params.length}`);
  }

  if (category && category !== 'all') {
    params.push(category);
    conditions.push(`c.category = $${params.length}`);
  }

  if (status && status !== 'all') {
    params.push(status);
    conditions.push(`c.status = $${params.length}`);
  }

  if (search && search.trim()) {
    params.push(`%${search.trim().toLowerCase()}%`);
    conditions.push(`(
      LOWER(c.id) LIKE $${params.length}
      OR LOWER(COALESCE(c.reference_no, '')) LIKE $${params.length}
      OR LOWER(c.reason) LIKE $${params.length}
      OR LOWER(COALESCE(crs.code, '')) LIKE $${params.length}
      OR LOWER(COALESCE(crs.title, '')) LIKE $${params.length}
      OR LOWER(c.category) LIKE $${params.length}
    )`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Count total matching records
  const countSql = `
    SELECT count(c.id) as total
    FROM complaints c
    JOIN students s ON s.id = c.student_id
    JOIN users u ON u.id = s.user_id
    LEFT JOIN courses crs ON crs.id = c.course_id
    ${whereClause}
  `;
  const countRes = await query(countSql, params);
  const total = parseInt(countRes.rows[0]?.total || '0', 10);

  // 3 real data rows per page as default
  const parsedLimit = pageSize === 'all' ? total || 1 : Math.max(1, parseInt(limitParam || pageSize, 10) || 3);
  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const totalPages = Math.ceil(total / parsedLimit) || 1;

  const queryParams = [...params];
  let cteClause = '';
  let cursorJoin = '';
  let cursorCondition = '';

  if (cursor) {
    queryParams.push(cursor);
    const cursorIdx = queryParams.length;
    cteClause = `
      WITH cur AS (
        SELECT c.id, c.submitted_at as cur_sort
        FROM complaints c
        WHERE c.id = $${cursorIdx}
        LIMIT 1
      )
    `;
    cursorJoin = `CROSS JOIN cur`;
    cursorCondition = `AND (c.submitted_at, c.id) < (cur.cur_sort, cur.id)`;
  }

  // If using cursor pagination, query limit + 1 to detect hasMore
  // If fallback offset requested (no cursor, but page > 1), use offset
  let limitClause = '';
  if (!cursor && parsedPage > 1 && !limitParam) {
    const offset = (parsedPage - 1) * parsedLimit;
    queryParams.push(parsedLimit);
    const limitIdx = queryParams.length;
    queryParams.push(offset);
    const offsetIdx = queryParams.length;
    limitClause = `LIMIT $${limitIdx} OFFSET $${offsetIdx}`;
  } else {
    queryParams.push(parsedLimit + 1);
    const limitIdx = queryParams.length;
    limitClause = `LIMIT $${limitIdx}`;
  }

  const fullWhereClause = whereClause
    ? `${whereClause} ${cursorCondition}`
    : cursorCondition
    ? `WHERE 1=1 ${cursorCondition}`
    : '';

  const dataSql = `
    ${cteClause}
    SELECT
      c.id,
      c.reference_no as "referenceNo",
      c.student_id as "studentId",
      s.student_number as "studentNumber",
      (u.first_name || ' ' || u.last_name) as "studentName",
      d.name as "departmentName",
      c.course_id as "courseId",
      COALESCE(crs.code, 'General') as "courseCode",
      COALESCE(crs.title, 'General Academic') as "courseName",
      c.category,
      c.priority,
      c.reason,
      c.reason as "title",
      c.reason as "description",
      c.status,
      c.status_label as "statusLabel",
      c.response,
      c.responded_by as "respondedBy",
      c.responded_at as "respondedAt",
      c.submitted_at as "submittedAt",
      c.updated_at as "updatedAt"
    FROM complaints c
    JOIN students s ON s.id = c.student_id
    JOIN users u ON u.id = s.user_id
    JOIN departments d ON d.id = s.department_id
    LEFT JOIN courses crs ON crs.id = c.course_id
    ${cursorJoin}
    ${fullWhereClause}
    ORDER BY c.submitted_at DESC, c.id DESC
    ${limitClause}
  `;

  const dataRes = await query(dataSql, queryParams);
  const hasMore = dataRes.rows.length > parsedLimit;
  const returnedRows = hasMore ? dataRes.rows.slice(0, parsedLimit) : dataRes.rows;
  const nextCursor = hasMore ? returnedRows[returnedRows.length - 1].id : null;

  return {
    items: returnedRows,
    total,
    nextCursor,
    prevCursor: cursor || null,
    hasMore: Boolean(nextCursor),
    hasPrev: Boolean(cursor),
    limit: parsedLimit,
    page: parsedPage,
    totalPages,
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages,
    },
  };
}

export async function getComplaintById(id) {
  const sql = `
    SELECT
      c.id,
      c.reference_no as "referenceNo",
      c.student_id as "studentId",
      s.student_number as "studentNumber",
      (u.first_name || ' ' || u.last_name) as "studentName",
      d.name as "departmentName",
      c.course_id as "courseId",
      COALESCE(crs.code, 'General') as "courseCode",
      COALESCE(crs.title, 'General Academic') as "courseName",
      c.category,
      c.priority,
      c.reason,
      c.status,
      c.status_label as "statusLabel",
      c.response,
      c.responded_by as "respondedBy",
      c.responded_at as "respondedAt",
      c.submitted_at as "submittedAt",
      c.updated_at as "updatedAt"
    FROM complaints c
    JOIN students s ON s.id = c.student_id
    JOIN users u ON u.id = s.user_id
    JOIN departments d ON d.id = s.department_id
    LEFT JOIN courses crs ON crs.id = c.course_id
    WHERE c.id = $1 OR c.reference_no = $1
    LIMIT 1
  `;
  const res = await query(sql, [id]);
  return res.rows[0] || null;
}

export async function createComplaint({
  studentId,
  courseId,
  category,
  priority = 'Normal',
  reason,
}) {
  const id = `cmp_${crypto.randomBytes(6).toString('hex')}`;
  const countRes = await query(`SELECT count(*) FROM complaints`);
  const num = parseInt(countRes.rows[0].count, 10) + 1;
  const referenceNo = `CMP-${new Date().getFullYear()}-${String(num).padStart(3, '0')}`;

  const statusLabel = 'Pending';
  const status = 'pending';

  const sql = `
    INSERT INTO complaints (
      id, reference_no, student_id, course_id, category, priority, reason,
      status, status_label, submitted_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), now())
    RETURNING *
  `;
  await query(sql, [
    id,
    referenceNo,
    studentId,
    courseId || null,
    category,
    priority,
    reason,
    status,
    statusLabel,
  ]);

  return await getComplaintById(id);
}

export async function updateComplaint(id, studentId, { category, priority, reason }) {
  const sets = ['updated_at = now()'];
  const params = [id];

  if (category !== undefined) {
    params.push(category);
    sets.push(`category = $${params.length}`);
  }
  if (priority !== undefined) {
    params.push(priority);
    sets.push(`priority = $${params.length}`);
  }
  if (reason !== undefined) {
    params.push(reason);
    sets.push(`reason = $${params.length}`);
  }

  let extraWhere = '';
  if (studentId) {
    params.push(studentId);
    extraWhere = ` AND student_id = $${params.length}`;
  }

  const sql = `
    UPDATE complaints
    SET ${sets.join(', ')}
    WHERE id = $1 ${extraWhere}
    RETURNING *
  `;
  const res = await query(sql, params);
  if (res.rows.length === 0) return null;
  return await getComplaintById(id);
}

export async function deleteComplaint(id, studentId) {
  const params = [id];
  let extraWhere = '';
  if (studentId) {
    params.push(studentId);
    extraWhere = ` AND student_id = $${params.length}`;
  }

  const sql = `DELETE FROM complaints WHERE id = $1 ${extraWhere} RETURNING id`;
  const res = await query(sql, params);
  return res.rows.length > 0;
}

export async function resolveComplaint(id, { status = 'resolved', statusLabel = 'Resolved', response, respondedBy } = {}) {
  const sql = `
    UPDATE complaints
    SET status = $2,
        status_label = $3,
        response = $4,
        responded_by = $5,
        responded_at = now(),
        updated_at = now()
    WHERE id = $1
    RETURNING *
  `;
  const res = await query(sql, [id, status, statusLabel, response || null, respondedBy || null]);
  if (res.rows.length === 0) return null;
  return await getComplaintById(id);
}
