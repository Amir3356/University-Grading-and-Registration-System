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
    `INSERT INTO university_settings (
       id, name, short_name, motto, address, email, phone, website, registrar_name, updated_by, updated_at
     ) VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9, now())
     ON CONFLICT (id) DO UPDATE SET
       name = COALESCE(EXCLUDED.name, university_settings.name),
       short_name = COALESCE(EXCLUDED.short_name, university_settings.short_name),
       motto = EXCLUDED.motto,
       address = EXCLUDED.address,
       email = COALESCE(EXCLUDED.email, university_settings.email),
       phone = EXCLUDED.phone,
       website = EXCLUDED.website,
       registrar_name = COALESCE(EXCLUDED.registrar_name, university_settings.registrar_name),
       updated_by = EXCLUDED.updated_by,
       updated_at = now()
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
      `INSERT INTO academic_policies (
         id, pass_mark, approval_workflow_enabled, repeat_policy, incomplete_policy,
         withdrawal_policy, probation_gpa, honors_gpa, require_weights_total_100, at_risk_margin, updated_by, updated_at
       ) VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
       ON CONFLICT (id) DO UPDATE SET
         pass_mark = COALESCE(EXCLUDED.pass_mark, academic_policies.pass_mark),
         approval_workflow_enabled = COALESCE(EXCLUDED.approval_workflow_enabled, academic_policies.approval_workflow_enabled),
         repeat_policy = COALESCE(EXCLUDED.repeat_policy, academic_policies.repeat_policy),
         incomplete_policy = COALESCE(EXCLUDED.incomplete_policy, academic_policies.incomplete_policy),
         withdrawal_policy = COALESCE(EXCLUDED.withdrawal_policy, academic_policies.withdrawal_policy),
         probation_gpa = COALESCE(EXCLUDED.probation_gpa, academic_policies.probation_gpa),
         honors_gpa = COALESCE(EXCLUDED.honors_gpa, academic_policies.honors_gpa),
         require_weights_total_100 = COALESCE(EXCLUDED.require_weights_total_100, academic_policies.require_weights_total_100),
         at_risk_margin = COALESCE(EXCLUDED.at_risk_margin, academic_policies.at_risk_margin),
         updated_by = $10,
         updated_at = now()
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

