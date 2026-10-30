import { query, withTransaction } from '../config/database.js';
import { newId } from '../utils/idGenerator.js';

function encodeCursor(val, id) {
  if (!id) return null;
  return Buffer.from(JSON.stringify({ v: val, id })).toString('base64url');
}

function decodeCursor(cursorStr) {
  if (!cursorStr || typeof cursorStr !== 'string') return null;
  try {
    const raw = Buffer.from(cursorStr, 'base64url').toString('utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.id) return parsed;
  } catch {
    return null;
  }
  return null;
}

const sortConfig = {
  name: { expr: 'a.name', cast: 'text', getVal: (r) => r.name },
  type: { expr: 'a.type', cast: 'text', getVal: (r) => r.type },
  weight: { expr: 'a.weight', cast: 'numeric', getVal: (r) => parseFloat(r.weight || '0') },
  maxmarks: { expr: 'a.max_marks', cast: 'numeric', getVal: (r) => parseFloat(r.max_marks || '0') },
  maxMarks: { expr: 'a.max_marks', cast: 'numeric', getVal: (r) => parseFloat(r.max_marks || '0') },
  duedate: { expr: 'a.due_date', cast: 'date', getVal: (r) => r.due_date_text || r.dueDate || r.due_date },
  dueDate: { expr: 'a.due_date', cast: 'date', getVal: (r) => r.due_date_text || r.dueDate || r.due_date },
  course: { expr: 'c.code', cast: 'text', getVal: (r) => r.course_code || r.course?.code },
  yearofstudy: { expr: 'COALESCE(co.year_of_study, CASE WHEN c.level >= 100 THEN CAST(c.level / 100 AS smallint) ELSE CAST(c.level AS smallint) END)', cast: 'numeric', getVal: (r) => Number(r.year_of_study_calc) },
  yearOfStudy: { expr: 'COALESCE(co.year_of_study, CASE WHEN c.level >= 100 THEN CAST(c.level / 100 AS smallint) ELSE CAST(c.level AS smallint) END)', cast: 'numeric', getVal: (r) => Number(r.year_of_study_calc) },
  createdat: { expr: 'a.created_at', cast: 'timestamptz', getVal: (r) => r.created_at_text || r.created_at },
  createdAt: { expr: 'a.created_at', cast: 'timestamptz', getVal: (r) => r.created_at_text || r.created_at },
};

export async function listAssessmentsPaginated({
  teacherId,
  departmentId,
  offeringId,
  courseId,
  yearOfStudy,
  search,
  sortBy,
  sortDir = 'asc',
  cursor,
  direction = 'next',
  after,
  before,
  pageSize = 4,
} = {}) {
  const conditions = [];
  const params = [];

  if (teacherId) {
    params.push(teacherId);
    conditions.push(`co.teacher_id = $${params.length}`);
  }

  if (departmentId) {
    params.push(departmentId);
    conditions.push(`(c.department_id = $${params.length} OR t.department_id = $${params.length})`);
  }

  if (offeringId && offeringId !== 'all') {
    params.push(offeringId);
    conditions.push(`a.offering_id = $${params.length}`);
  }

  if (courseId && courseId !== 'all') {
    params.push(courseId);
    conditions.push(`(co.course_id = $${params.length} OR c.id = $${params.length} OR c.code = $${params.length})`);
  }

  if (yearOfStudy && yearOfStudy !== 'all') {
    params.push(parseInt(yearOfStudy, 10));
    conditions.push(`COALESCE(co.year_of_study, CASE WHEN c.level >= 100 THEN CAST(c.level / 100 AS smallint) ELSE CAST(c.level AS smallint) END) = $${params.length}`);
  }

  if (search && search.trim()) {
    params.push(`%${search.trim()}%`);
    conditions.push(`(a.name ILIKE $${params.length} OR a.type ILIKE $${params.length} OR c.code ILIKE $${params.length} OR c.title ILIKE $${params.length})`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countSql = `
    SELECT COUNT(DISTINCT a.id) as total
    FROM assessments a
    JOIN course_offerings co ON co.id = a.offering_id
    JOIN courses c ON c.id = co.course_id
    LEFT JOIN teachers t ON t.id = co.teacher_id
    ${whereClause}
  `;
  const countRes = await query(countSql, params);
  const total = parseInt(countRes.rows[0]?.total || '0', 10);

  const isAll = pageSize === 'all';
  const limit = isAll ? null : Math.max(1, parseInt(pageSize, 10) || 10);

  // Determine cursor navigation
  let activeCursor = cursor || null;
  let navDirection = direction === 'prev' ? 'prev' : 'next';

  if (after) {
    activeCursor = after;
    navDirection = 'next';
  } else if (before) {
    activeCursor = before;
    navDirection = 'prev';
  }

  const decoded = decodeCursor(activeCursor);
  const selectedSortKey = sortBy && sortConfig[sortBy] ? sortBy : 'dueDate';
  const sortInfo = sortConfig[selectedSortKey];
  const sortExpr = sortInfo.expr;
  const cast = sortInfo.cast;
  const isDesc = String(sortDir).toLowerCase() === 'desc';
  const primaryDirection = isDesc ? 'DESC' : 'ASC';

  const queryConditions = [...conditions];
  const queryParams = [...params];
  let orderClause;

  if (!isAll && decoded) {
    const op = navDirection === 'next' ? (isDesc ? '<' : '>') : (isDesc ? '>' : '<');
    if (navDirection === 'next') {
      orderClause = `ORDER BY ${sortExpr} ${primaryDirection}, a.id ${primaryDirection}`;
    } else {
      // navDirection === 'prev'
      const reverseDir = isDesc ? 'ASC' : 'DESC';
      orderClause = `ORDER BY ${sortExpr} ${reverseDir}, a.id ${reverseDir}`;
    }

    queryParams.push(decoded.v);
    const valIdx = queryParams.length;
    queryParams.push(decoded.id);
    const idIdx = queryParams.length;

    queryConditions.push(`(${sortExpr} ${op} $${valIdx}::${cast} OR (${sortExpr} = $${valIdx}::${cast} AND a.id ${op} $${idIdx}))`);
  } else {
    orderClause = `ORDER BY ${sortExpr} ${primaryDirection}, a.id ${primaryDirection}`;
  }

  // Keyset cursor limit (no SQL OFFSET)
  let limitClause = '';
  if (!isAll) {
    queryParams.push(limit + 1);
    const limitIdx = queryParams.length;
    limitClause = `LIMIT $${limitIdx}`;
  }

  const finalWhere = queryConditions.length > 0 ? `WHERE ${queryConditions.join(' AND ')}` : '';

  const dataSql = `
    SELECT a.*,
           to_char(a.due_date, 'YYYY-MM-DD') as due_date_text,
           to_char(a.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as created_at_text,
           c.code as course_code,
           COALESCE(co.year_of_study, CASE WHEN c.level >= 100 THEN c.level / 100 ELSE c.level END) as year_of_study_calc,
           COUNT(scr.id) as score_count,
           json_build_object(
             'id', co.id,
             'courseId', co.course_id,
             'semesterId', co.semester_id,
             'teacherId', co.teacher_id,
             'section', co.section,
             'gradeStatus', co.grade_status,
             'yearOfStudy', COALESCE(co.year_of_study, CASE WHEN c.level >= 100 THEN c.level / 100 ELSE c.level END),
             'course', json_build_object(
               'id', c.id,
               'code', c.code,
               'title', c.title,
               'creditHours', c.credit_hours,
               'level', c.level
             )
           ) as offering,
           json_build_object(
             'id', c.id,
             'code', c.code,
             'title', c.title,
             'creditHours', c.credit_hours,
             'level', c.level
           ) as course
    FROM assessments a
    JOIN course_offerings co ON co.id = a.offering_id
    JOIN courses c ON c.id = co.course_id
    LEFT JOIN teachers t ON t.id = co.teacher_id
    LEFT JOIN assessment_scores scr ON scr.assessment_id = a.id
    ${finalWhere}
    GROUP BY a.id, co.id, c.id
    ${orderClause}
    ${limitClause}
  `;

  const dataRes = await query(dataSql, queryParams);
  const rows = dataRes.rows;

  const hasExtra = limit !== null && rows.length > limit;
  let pageRows = hasExtra ? rows.slice(0, limit) : rows;

  if (decoded && navDirection === 'prev') {
    pageRows.reverse();
  }

  let hasNextPage = false;
  let hasPrevPage = false;

  if (isAll) {
    hasNextPage = false;
    hasPrevPage = false;
  } else if (!decoded) {
    hasPrevPage = false;
    hasNextPage = hasExtra;
  } else if (navDirection === 'next') {
    hasPrevPage = true;
    hasNextPage = hasExtra;
  } else if (navDirection === 'prev') {
    hasNextPage = true;
    hasPrevPage = hasExtra;
  }

  const items = pageRows.map((row) => ({
    ...row,
    dueDate: row.due_date,
    dueDateText: row.due_date_text,
    isReleased: row.is_released,
    offeringId: row.offering_id,
    maxMarks: parseFloat(row.max_marks),
    weight: parseFloat(row.weight),
    scoreCount: parseInt(row.score_count || '0', 10),
  }));

  let startCursor = null;
  let endCursor = null;
  if (items.length > 0) {
    const first = items[0];
    const last = items[items.length - 1];
    startCursor = encodeCursor(sortInfo.getVal(first), first.id);
    endCursor = encodeCursor(sortInfo.getVal(last), last.id);
  }

  const nextCursor = hasNextPage ? endCursor : null;
  const prevCursor = hasPrevPage ? startCursor : null;

  return {
    items,
    pageInfo: {
      hasNextPage,
      hasPrevPage,
      startCursor,
      endCursor,
      nextCursor,
      prevCursor,
    },
    total,
    pageSize: isAll ? 'all' : limit,
    sortBy: selectedSortKey,
    sortDir: isDesc ? 'desc' : 'asc',
  };
}

export async function listAssessmentsByOffering(offeringId) {
  const sql = `
    SELECT a.*,
           COUNT(scr.id) as score_count
    FROM assessments a
    LEFT JOIN assessment_scores scr ON scr.assessment_id = a.id
    WHERE a.offering_id = $1
    GROUP BY a.id
    ORDER BY a.due_date ASC, a.name ASC
  `;
  const res = await query(sql, [offeringId]);
  return res.rows.map((row) => ({
    ...row,
    dueDate: row.due_date,
    isReleased: row.is_released,
    offeringId: row.offering_id,
    maxMarks: parseFloat(row.max_marks),
    weight: parseFloat(row.weight),
    scoreCount: parseInt(row.score_count || '0', 10),
  }));
}

export async function findById(id) {
  const res = await query(`SELECT * FROM assessments WHERE id = $1`, [id]);
  const row = res.rows[0];
  if (!row) return null;
  return {
    ...row,
    dueDate: row.due_date,
    isReleased: row.is_released,
    offeringId: row.offering_id,
    maxMarks: parseFloat(row.max_marks),
    weight: parseFloat(row.weight),
  };
}

export async function createAssessment({ id, offeringId, name, type, maxMarks, weight, dueDate, description }) {
  const res = await query(
    `INSERT INTO assessments (id, offering_id, name, type, max_marks, weight, due_date, description, is_released)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false)
     RETURNING *`,
    [id, offeringId, name, type, maxMarks, weight, dueDate, description || null]
  );
  const row = res.rows[0];
  return {
    ...row,
    dueDate: row.due_date,
    isReleased: row.is_released,
    offeringId: row.offering_id,
    maxMarks: parseFloat(row.max_marks),
    weight: parseFloat(row.weight),
  };
}

export async function updateAssessment(id, { name, type, maxMarks, weight, dueDate, description }) {
  const res = await query(
    `UPDATE assessments
     SET name = COALESCE($2::text, name),
         type = COALESCE($3::text, type),
         max_marks = COALESCE($4::numeric, max_marks),
         weight = COALESCE($5::numeric, weight),
         due_date = COALESCE($6::date, due_date),
         description = CASE WHEN $7::text IS NULL THEN description ELSE NULLIF($7::text, '__CLEAR__') END,
         updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [
      id,
      name ?? null,
      type ?? null,
      maxMarks != null ? maxMarks : null,
      weight != null ? weight : null,
      dueDate ?? null,
      description !== undefined ? (description || '__CLEAR__') : null,
    ]
  );
  const row = res.rows[0];
  if (!row) return null;
  return {
    ...row,
    dueDate: row.due_date,
    isReleased: row.is_released,
    offeringId: row.offering_id,
    maxMarks: parseFloat(row.max_marks),
    weight: parseFloat(row.weight),
  };
}

export async function deleteAssessment(id) {
  await query(`DELETE FROM assessments WHERE id = $1`, [id]);
}

export async function setReleased(id, isReleased) {
  const res = await query(
    `UPDATE assessments
     SET is_released = $2,
         released_at = CASE WHEN $2 = true THEN now() ELSE NULL END,
         updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [id, isReleased]
  );
  const row = res.rows[0];
  if (!row) return null;
  return {
    ...row,
    dueDate: row.due_date,
    isReleased: row.is_released,
    offeringId: row.offering_id,
    maxMarks: parseFloat(row.max_marks),
    weight: parseFloat(row.weight),
  };
}

export async function hasScores(assessmentId) {
  const res = await query(`SELECT count(*) as count FROM assessment_scores WHERE assessment_id = $1`, [assessmentId]);
  return parseInt(res.rows[0]?.count || '0', 10) > 0;
}

export async function highestEnteredScore(assessmentId) {
  const res = await query(`SELECT MAX(marks) as max_mark FROM assessment_scores WHERE assessment_id = $1`, [assessmentId]);
  return res.rows[0]?.max_mark !== null ? parseFloat(res.rows[0].max_mark) : 0;
}

export async function sumWeights(offeringId, excludeId = null) {
  const params = [offeringId];
  let excludeClause = '';
  if (excludeId) {
    params.push(excludeId);
    excludeClause = `AND id != $2`;
  }
  const res = await query(
    `SELECT COALESCE(SUM(weight), 0) as total_weight FROM assessments WHERE offering_id = $1 ${excludeClause}`,
    params
  );
  return parseFloat(res.rows[0]?.total_weight || '0');
}

export async function applyTemplate(offeringId, departmentId) {
  return await withTransaction(async (client) => {
    const tplRes = await client.query(
      `SELECT * FROM department_assessment_templates WHERE department_id = $1 ORDER BY sort_order ASC`,
      [departmentId]
    );
    if (tplRes.rows.length === 0) return 0;

    let created = 0;
    for (const t of tplRes.rows) {
      const id = newId('asm');
      await client.query(
        `INSERT INTO assessments (id, offering_id, name, type, max_marks, weight, due_date, is_released)
         VALUES ($1, $2, $3, $4, $5, $6, CURRENT_DATE + interval '30 days', false)
         ON CONFLICT (offering_id, lower(name)) DO NOTHING`,
        [id, offeringId, t.name, t.type, t.max_marks, t.weight]
      );
      created++;
    }
    return created;
  });
}
