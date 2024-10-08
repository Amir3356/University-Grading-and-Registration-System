import { query, withTransaction } from '../config/database.js';
import { newId } from '../utils/idGenerator.js';
import { logAudit } from '../middleware/audit.js';
import { computeEnrollmentScore, roundTo2 } from '../utils/gpaCalculator.js';
import { getOfferingById } from './offeringRepository.js';

export async function getActiveGradeScale() {
  const scaleRes = await query(`SELECT * FROM grade_scales WHERE is_active = true LIMIT 1`);
  if (scaleRes.rows.length === 0) return { id: 'gsc_0001', name: 'Standard Scale', entries: [] };
  const scale = scaleRes.rows[0];

  const entriesRes = await query(
    `SELECT * FROM grade_scale_entries WHERE scale_id = $1 ORDER BY min_score DESC`,
    [scale.id]
  );
  return {
    ...scale,
    entries: entriesRes.rows.map((e) => ({
      letter: e.letter,
      minScore: parseFloat(e.min_score),
      maxScore: parseFloat(e.max_score),
      min: parseFloat(e.min_score),
      max: parseFloat(e.max_score),
      gradePoints: parseFloat(e.grade_points),
      points: parseFloat(e.grade_points),
    })),
  };
}

export async function getAcademicPolicy() {
  const res = await query(`SELECT * FROM academic_policies WHERE id = 1`);
  if (res.rows.length === 0) {
    return {
      passMark: 50,
      approvalWorkflowEnabled: true,
      repeatPolicy: 'latest',
      incompletePolicy: 'exclude',
      withdrawalPolicy: 'exclude',
      probationGpa: 2.0,
      honorsGpa: 3.5,
      requireWeightsTotal100: true,
      atRiskMargin: 10,
    };
  }
  const row = res.rows[0];
  return {
    passMark: parseFloat(row.pass_mark),
    approvalWorkflowEnabled: row.approval_workflow_enabled,
    repeatPolicy: row.repeat_policy,
    incompletePolicy: row.incomplete_policy,
    withdrawalPolicy: row.withdrawal_policy,
    probationGpa: parseFloat(row.probation_gpa),
    honorsGpa: parseFloat(row.honors_gpa),
    requireWeightsTotal100: row.require_weights_total_100,
    atRiskMargin: parseFloat(row.at_risk_margin),
  };
}

export async function getGradebookData(offeringId) {
  const offering = await getOfferingById(offeringId);
  if (!offering) return null;

  // Assessments
  const asmRes = await query(
    `SELECT * FROM assessments WHERE offering_id = $1 ORDER BY due_date ASC, name ASC`,
    [offeringId]
  );
  const assessments = asmRes.rows.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    maxMarks: parseFloat(a.max_marks),
    weight: parseFloat(a.weight),
    dueDate: a.due_date,
    isReleased: a.is_released,
    description: a.description,
  }));

  // Enrollments
  const enrRes = await query(
    `SELECT ce.id as enrollment_id, ce.status, ce.is_repeat,
            s.id as student_id, s.student_number,
            (u.first_name || ' ' || u.last_name) as student_name,
            u.email as student_email
     FROM course_enrollments ce
     JOIN students s ON s.id = ce.student_id
     JOIN users u ON u.id = s.user_id
     WHERE ce.offering_id = $1
     ORDER BY s.student_number ASC`,
    [offeringId]
  );

  // Scores
  const scoresRes = await query(
    `SELECT scr.assessment_id, scr.enrollment_id, scr.marks
     FROM assessment_scores scr
     JOIN assessments a ON a.id = scr.assessment_id
     WHERE a.offering_id = $1`,
    [offeringId]
  );

  const scoreMap = {}; // enrollmentId -> { asmId -> marks }
  for (const s of scoresRes.rows) {
    if (!scoreMap[s.enrollment_id]) scoreMap[s.enrollment_id] = {};
    scoreMap[s.enrollment_id][s.assessment_id] = parseFloat(s.marks);
  }

  // Final grades
  const fgRes = await query(
    `SELECT fg.*
     FROM final_grades fg
     JOIN course_enrollments ce ON ce.id = fg.enrollment_id
     WHERE ce.offering_id = $1`,
    [offeringId]
  );
  const fgMap = {};
  for (const f of fgRes.rows) {
    fgMap[f.enrollment_id] = {
      id: f.id,
      totalScore: f.total_score !== null ? parseFloat(f.total_score) : null,
      letter: f.letter,
      gradePoints: f.grade_points !== null ? parseFloat(f.grade_points) : null,
      specialGrade: f.special_grade,
      status: f.status,
      isStale: f.is_stale,
      publishedAt: f.published_at,
    };
  }

  const scale = await getActiveGradeScale();
  const policy = await getAcademicPolicy();

  // Compute student rows
  const rows = [];
  let completeCount = 0;
  const letterCounts = {};
  for (const e of scale.entries) {
    letterCounts[e.letter] = 0;
  }

  let totalScoreSum = 0;
  let totalRunningSum = 0;
  let studentScoredCount = 0;
  let highest = null;
  let lowest = null;
  let passedCount = 0;
  let failedCount = 0;

  for (const enr of enrRes.rows) {
    const studentScores = scoreMap[enr.enrollment_id] || {};
    const existingFg = fgMap[enr.enrollment_id];

    let calcResult;
    if (enr.status === 'withdrawn') {
      calcResult = {
        weightedTotal: null,
        runningPercent: null,
        complete: false,
        enteredCount: 0,
        letter: 'W',
        gradePoints: null,
        passed: null,
      };
    } else {
      calcResult = computeEnrollmentScore(assessments, studentScores, scale.entries, policy.passMark);
    }

    if (calcResult.complete) completeCount++;

    if (calcResult.weightedTotal !== null) {
      studentScoredCount++;
      totalScoreSum += calcResult.weightedTotal;
      totalRunningSum += calcResult.runningPercent;

      if (highest === null || calcResult.weightedTotal > highest) highest = calcResult.weightedTotal;
      if (lowest === null || calcResult.weightedTotal < lowest) lowest = calcResult.weightedTotal;

      if (calcResult.passed === true) passedCount++;
      if (calcResult.passed === false) failedCount++;

      if (calcResult.letter && letterCounts[calcResult.letter] !== undefined) {
        letterCounts[calcResult.letter]++;
      }
    }

    rows.push({
      enrollmentId: enr.enrollment_id,
      enrollment: {
        status: enr.status,
        isRepeat: enr.is_repeat,
      },
      student: {
        id: enr.student_id,
        studentNumber: enr.student_number,
        name: enr.student_name,
        email: enr.student_email,
      },
      marks: studentScores,
      total: calcResult.weightedTotal,
      runningPercent: calcResult.runningPercent,
      complete: calcResult.complete,
      enteredCount: calcResult.enteredCount,
      letter: existingFg?.letter || calcResult.letter,
      gradePoints: existingFg?.gradePoints || calcResult.gradePoints,
      passed: calcResult.passed,
      finalGrade: existingFg || null,
    });
  }

  // Assessment averages
  const assessmentAverages = assessments.map((a) => {
    let sum = 0;
    let count = 0;
    for (const enr of enrRes.rows) {
      if (enr.status !== 'withdrawn') {
        const mark = scoreMap[enr.enrollment_id]?.[a.id];
        if (mark !== undefined && mark !== null) {
          sum += mark;
          count++;
        }
      }
    }
    const avg = count > 0 ? roundTo2(sum / count) : 0;
    const avgPercent = a.maxMarks > 0 ? roundTo2((avg / a.maxMarks) * 100) : 0;
    const activeStudentCount = enrRes.rows.filter((e) => e.status !== 'withdrawn').length;
    return {
      assessmentId: a.id,
      name: a.name,
      maxMarks: a.maxMarks,
      average: avg,
      averagePercent: avgPercent,
      entered: count,
      expected: activeStudentCount,
    };
  });

  const activeStudentCount = enrRes.rows.filter((e) => e.status !== 'withdrawn').length;
  const missingMarks = (activeStudentCount * assessments.length) - scoresRes.rows.length;

  const average = studentScoredCount > 0 ? roundTo2(totalScoreSum / studentScoredCount) : null;
  const runningAverage = studentScoredCount > 0 ? roundTo2(totalRunningSum / studentScoredCount) : null;
  const passRate = studentScoredCount > 0 ? roundTo2((passedCount / studentScoredCount) * 100) : null;

  const distribution = Object.entries(letterCounts).map(([letter, count]) => ({
    letter,
    count,
  }));

  // Latest submission
  const subRes = await query(
    `SELECT gs.*,
            COALESCE(
              json_agg(
                json_build_object(
                  'stage', gsr.stage,
                  'decision', gsr.decision,
                  'comment', gsr.comment,
                  'reviewedAt', gsr.reviewed_at,
                  'reviewerName', (u.first_name || ' ' || u.last_name)
                ) ORDER BY gsr.reviewed_at DESC
              ) FILTER (WHERE gsr.id IS NOT NULL), '[]'
            ) as reviews
     FROM grade_submissions gs
     LEFT JOIN grade_submission_reviews gsr ON gsr.submission_id = gs.id
     LEFT JOIN users u ON u.id = gsr.reviewer_id
     WHERE gs.offering_id = $1
     GROUP BY gs.id
     ORDER BY gs.submitted_at DESC
     LIMIT 1`,
    [offeringId]
  );
  const latestSubmission = subRes.rows[0] || null;

  const locked = ['submitted', 'approved', 'published'].includes(offering.grade_status);
  const requiresReason = latestSubmission?.status === 'rejected';

  return {
    offering,
    assessments,
    rows,
    weightTotal: offering.weightTotal,
    weightsValid: offering.weightsValid,
    passMark: policy.passMark,
    scale: scale.entries,
    stats: {
      studentCount: enrRes.rows.length,
      completeCount,
      average,
      runningAverage,
      highest,
      lowest,
      passRate,
      passed: passedCount,
      failed: failedCount,
      distribution,
      assessmentAverages,
      missingMarks: Math.max(0, missingMarks),
    },
    locked,
    latestSubmission,
    requiresReason,
    approvalWorkflowEnabled: policy.approvalWorkflowEnabled,
  };
}

export async function saveScoreChanges(offeringId, changes, reason, user) {
  return await withTransaction(async (client) => {
    let created = 0;
    let updated = 0;
    let cleared = 0;

    for (const change of changes) {
      const { enrollmentId, assessmentId, marks } = change;

      // Read existing
      const existingRes = await client.query(
        `SELECT * FROM assessment_scores WHERE assessment_id = $1 AND enrollment_id = $2`,
        [assessmentId, enrollmentId]
      );
      const existing = existingRes.rows[0] || null;

      if (marks === null || marks === undefined || marks === '') {
        if (existing) {
          await client.query(`DELETE FROM assessment_scores WHERE id = $1`, [existing.id]);
          cleared++;
          await logAudit(client, {
            userId: user.id,
            action: 'score.deleted',
            entityType: 'assessment_score',
            entityId: existing.id,
            offeringId,
            details: `Cleared marks for enrollment ${enrollmentId}`,
            reason,
            before: { marks: existing.marks },
            after: null,
          });
        }
      } else {
        const numericMarks = parseFloat(marks);
        if (existing) {
          await client.query(
            `UPDATE assessment_scores SET marks = $2, updated_by = $3, updated_at = now() WHERE id = $1`,
            [existing.id, numericMarks, user.id]
          );
          updated++;
          await logAudit(client, {
            userId: user.id,
            action: 'score.updated',
            entityType: 'assessment_score',
            entityId: existing.id,
            offeringId,
            details: `Updated marks from ${existing.marks} to ${numericMarks}`,
            reason,
            before: { marks: existing.marks },
            after: { marks: numericMarks },
          });
        } else {
          const id = newId('scr');
          await client.query(
            `INSERT INTO assessment_scores (id, assessment_id, enrollment_id, marks, updated_by)
             VALUES ($1, $2, $3, $4, $5)`,
            [id, assessmentId, enrollmentId, numericMarks, user.id]
          );
          created++;
          await logAudit(client, {
            userId: user.id,
            action: 'score.created',
            entityType: 'assessment_score',
            entityId: id,
            offeringId,
            details: `Entered marks: ${numericMarks}`,
            reason,
            before: null,
            after: { marks: numericMarks },
          });
        }
      }
    }

    // Move offering to 'draft' if 'not_started'
    await client.query(
      `UPDATE course_offerings
       SET grade_status = 'draft', updated_at = now()
       WHERE id = $1 AND grade_status = 'not_started'`,
      [offeringId]
    );

    // Mark draft final grades stale
    await client.query(
      `UPDATE final_grades fg
       SET is_stale = true, updated_at = now()
       FROM course_enrollments ce
       WHERE ce.id = fg.enrollment_id AND ce.offering_id = $1 AND fg.status = 'draft'`,
      [offeringId]
    );

    return { created, updated, cleared };
  });
}

export async function getGradeHistory(offeringId) {
  const sql = `
    SELECT al.created_at, al.action, al.details, al.reason, al.before, al.after,
           (u.first_name || ' ' || u.last_name) as user_name
    FROM audit_logs al
    LEFT JOIN users u ON u.id = al.user_id
    WHERE al.offering_id = $1
       OR (al.entity_type = 'course_offering' AND al.entity_id = $1)
    ORDER BY al.created_at DESC
  `;
  const res = await query(sql, [offeringId]);
  return res.rows;
}

export async function getActiveEnrollmentIds(offeringId) {
  const res = await query(
    `SELECT id FROM course_enrollments WHERE offering_id = $1 AND status != 'withdrawn'`,
    [offeringId]
  );
  return res.rows;
}

