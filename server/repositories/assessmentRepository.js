import { query, withTransaction } from '../config/database.js';
import { newId } from '../utils/idGenerator.js';

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
    maxMarks: parseFloat(row.max_marks),
    weight: parseFloat(row.weight),
    scoreCount: parseInt(row.score_count || '0', 10),
  }));
}

export async function findById(id) {
  const res = await query(`SELECT * FROM assessments WHERE id = $1`, [id]);
  return res.rows[0] || null;
}

export async function createAssessment({ id, offeringId, name, type, maxMarks, weight, dueDate, description }) {
  const res = await query(
    `INSERT INTO assessments (id, offering_id, name, type, max_marks, weight, due_date, description, is_released)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false)
     RETURNING *`,
    [id, offeringId, name, type, maxMarks, weight, dueDate, description || null]
  );
  return res.rows[0];
}

export async function updateAssessment(id, { name, type, maxMarks, weight, dueDate, description }) {
  const res = await query(
    `UPDATE assessments
     SET name = COALESCE($2, name),
         type = COALESCE($3, type),
         max_marks = COALESCE($4, max_marks),
         weight = COALESCE($5, weight),
         due_date = COALESCE($6, due_date),
         description = $7,
         updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [id, name, type, maxMarks, weight, dueDate, description || null]
  );
  return res.rows[0] || null;
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
  return res.rows[0] || null;
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
