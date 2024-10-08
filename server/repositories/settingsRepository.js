import { query, withTransaction } from '../config/database.js';
import { newId } from '../utils/idGenerator.js';
import { getActiveGradeScale, getAcademicPolicy } from './gradebookRepository.js';

export async function getUniversitySettings() {
  const res = await query(`SELECT * FROM university_settings WHERE id = 1`);
  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  return {
    id: row.id,
    name: row.name,
    shortName: row.short_name,
    motto: row.motto,
    address: row.address,
    email: row.email,
    phone: row.phone,
    website: row.website,
    registrarName: row.registrar_name,
    updatedAt: row.updated_at,
  };
}

export async function updateUniversitySettings({ name, shortName, motto, address, email, phone, website, registrarName, userId }) {
  const res = await query(
    `UPDATE university_settings
     SET name = COALESCE($1, name),
         short_name = COALESCE($2, short_name),
         motto = $3,
         address = $4,
         email = COALESCE($5, email),
         phone = $6,
         website = $7,
         registrar_name = COALESCE($8, registrar_name),
         updated_by = $9,
         updated_at = now()
     WHERE id = 1
     RETURNING *`,
    [name, shortName, motto || null, address || null, email, phone || null, website || null, registrarName, userId]
  );
  return res.rows[0];
}

export async function getFullSettings() {
  const university = await getUniversitySettings();
  const policy = await getAcademicPolicy();
  const excRes = await query(`SELECT course_id FROM policy_excluded_courses`);
  policy.excludedCourseIds = excRes.rows.map((r) => r.course_id);

  return {
    university,
    policy,
    updatedAt: university?.updatedAt || new Date(),
  };
}

export async function getGradingConfig() {
  const scale = await getActiveGradeScale();
  const policy = await getAcademicPolicy();
  const excRes = await query(`SELECT course_id FROM policy_excluded_courses`);
  policy.excludedCourseIds = excRes.rows.map((r) => r.course_id);

  const coursesRes = await query(`SELECT id, code, title FROM courses ORDER BY code ASC`);

  return {
    scale,
    policy,
    courses: coursesRes.rows,
  };
}

export async function saveNewScaleVersion({ entries, userId }) {
  return await withTransaction(async (client) => {
    // Unset active on previous scale
    await client.query(`UPDATE grade_scales SET is_active = false WHERE is_active = true`);

    const scaleId = newId('gsc');
    await client.query(
      `INSERT INTO grade_scales (id, name, is_active, effective_from, created_by)
       VALUES ($1, 'Standard Undergraduate Scale', true, now(), $2)`,
      [scaleId, userId]
    );

    for (const e of entries) {
      const entryId = `${scaleId}_${e.letter}`;
      await client.query(
        `INSERT INTO grade_scale_entries (id, scale_id, letter, min_score, max_score, grade_points)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          entryId,
          scaleId,
          e.letter,
          e.min ?? e.minScore,
          e.max ?? e.maxScore,
          e.points ?? e.gradePoints,
        ]
      );
    }

    return await getActiveGradeScale();
  });
}

export async function updateAcademicPolicy({
  passMark,
  approvalWorkflowEnabled,
  repeatPolicy,
  incompletePolicy,
  withdrawalPolicy,
  probationGpa,
  honorsGpa,
  requireWeightsTotal100,
  atRiskMargin,
  excludedCourseIds,
  userId,
}) {
  return await withTransaction(async (client) => {
    const res = await client.query(
      `UPDATE academic_policies
       SET pass_mark = COALESCE($1, pass_mark),
           approval_workflow_enabled = COALESCE($2, approval_workflow_enabled),
           repeat_policy = COALESCE($3, repeat_policy),
           incomplete_policy = COALESCE($4, incomplete_policy),
           withdrawal_policy = COALESCE($5, withdrawal_policy),
           probation_gpa = COALESCE($6, probation_gpa),
           honors_gpa = COALESCE($7, honors_gpa),
           require_weights_total_100 = COALESCE($8, require_weights_total_100),
           at_risk_margin = COALESCE($9, at_risk_margin),
           updated_by = $10,
           updated_at = now()
       WHERE id = 1
       RETURNING *`,
      [
        passMark,
        approvalWorkflowEnabled,
        repeatPolicy,
        incompletePolicy,
        withdrawalPolicy,
        probationGpa,
        honorsGpa,
        requireWeightsTotal100,
        atRiskMargin,
        userId,
      ]
    );

    if (Array.isArray(excludedCourseIds)) {
      await client.query(`DELETE FROM policy_excluded_courses`);
      for (const cid of excludedCourseIds) {
        await client.query(
          `INSERT INTO policy_excluded_courses (course_id) VALUES ($1) ON CONFLICT DO NOTHING`,
          [cid]
        );
      }
    }

    const policy = await getAcademicPolicy();
    const excRes = await client.query(`SELECT course_id FROM policy_excluded_courses`);
    policy.excludedCourseIds = excRes.rows.map((r) => r.course_id);
    return policy;
  });
}

export async function getBackupData() {
  const uni = await query(`SELECT * FROM university_settings WHERE id = 1`);
  const pol = await query(`SELECT * FROM academic_policies WHERE id = 1`);
  const sc = await query(`SELECT * FROM grade_scales WHERE is_active = true`);
  const depts = await query(`SELECT * FROM departments`);
  const progs = await query(`SELECT * FROM programs`);
  const courses = await query(`SELECT * FROM courses`);
  const sems = await query(`SELECT * FROM semesters`);

  return {
    timestamp: new Date().toISOString(),
    university: uni.rows[0],
    policy: pol.rows[0],
    activeScale: sc.rows[0],
    departments: depts.rows,
    programs: progs.rows,
    courses: courses.rows,
    semesters: sems.rows,
  };
}

