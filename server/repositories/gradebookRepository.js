import { query, withTransaction } from '../config/database.js';
import { newId } from '../utils/idGenerator.js';
import { computeEnrollmentScore, roundTo2 } from '../utils/gpaCalculator.js';
import { getOfferingById } from './offeringRepository.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';

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

  const courseDeptId =
    offering.course?.department?.id ||
    offering.course?.departmentId ||
    offering.departmentId ||
    null;

  const teacherDeptId =
    offering.teacher?.departmentId ||
    offering.teacher?.department?.id ||
    null;

  const rawYos =
    offering.yearOfStudy ??
    offering.year_of_study ??
    offering.course?.yearOfStudy ??
    (offering.course?.level ? (offering.course.level >= 100 ? Math.floor(offering.course.level / 100) : offering.course.level) : null);
  const targetYearOfStudy = rawYos !== null && rawYos !== undefined ? parseInt(rawYos, 10) : null;

  // Auto-enroll eligible active students whose department and year of study match the assigned offering
  if ((courseDeptId || teacherDeptId) && targetYearOfStudy) {
    await query(
      `DELETE FROM course_enrollments ce
       USING students s
       WHERE ce.student_id = s.id
         AND ce.offering_id = $1::varchar
         AND s.year_of_study != $2::smallint
         AND NOT EXISTS (SELECT 1 FROM final_grades fg WHERE fg.enrollment_id = ce.id AND fg.status = 'published')`,
      [offeringId, targetYearOfStudy]
    );

    await query(
      `INSERT INTO course_enrollments (id, offering_id, student_id, status, is_repeat, enrolled_at)
       SELECT 'enr_' || substr(md5(random()::text || clock_timestamp()::text || s.id), 1, 16),
              $1::varchar, s.id, 'enrolled', false, now()
       FROM students s
       WHERE (s.department_id = COALESCE($2::varchar, $4::varchar) OR s.department_id = COALESCE($4::varchar, $2::varchar))
         AND s.year_of_study = $3::smallint
         AND (s.academic_status IS NULL OR s.academic_status = 'active' OR s.academic_status = 'enrolled')
         AND NOT EXISTS (
           SELECT 1 FROM course_enrollments ce WHERE ce.offering_id = $1::varchar AND ce.student_id = s.id
         )`,
      [offeringId, courseDeptId, targetYearOfStudy, teacherDeptId]
    );
  }

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

  // Enrollments: Strictly display only students matching assigned course's/teacher's department and year of study
  const enrRes = await query(
    `SELECT ce.id as enrollment_id, ce.status, ce.is_repeat,
            s.id as student_id, s.student_number,
            (u.first_name || ' ' || u.last_name) as student_name,
            u.email as student_email,
            s.department_id, s.year_of_study
     FROM course_enrollments ce
     JOIN students s ON s.id = ce.student_id
     JOIN users u ON u.id = s.user_id
     WHERE ce.offering_id = $1
       AND (
         ($2::varchar IS NULL AND $4::varchar IS NULL)
         OR s.department_id = $2::varchar
         OR s.department_id = $4::varchar
       )
       AND ($3::smallint IS NULL OR s.year_of_study = $3::smallint)
     ORDER BY s.student_number ASC`,
    [offeringId, courseDeptId, targetYearOfStudy, teacherDeptId]
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
        departmentId: enr.department_id,
        yearOfStudy: enr.year_of_study,
      },
      marks: studentScores,
      total: calcResult.weightedTotal,
      runningPercent: calcResult.runningPercent,
      complete: calcResult.complete,
      enteredCount: calcResult.enteredCount,
      letter: enr.status === 'withdrawn' ? 'W' : (existingFg?.specialGrade || calcResult.letter || existingFg?.letter || null),
      gradePoints: enr.status === 'withdrawn' ? null : (existingFg?.specialGrade ? (existingFg?.gradePoints ?? null) : (calcResult.gradePoints !== null && calcResult.gradePoints !== undefined ? calcResult.gradePoints : (existingFg?.gradePoints ?? null))),
      points: enr.status === 'withdrawn' ? null : (existingFg?.specialGrade ? (existingFg?.gradePoints ?? null) : (calcResult.gradePoints !== null && calcResult.gradePoints !== undefined ? calcResult.gradePoints : (existingFg?.gradePoints ?? null))),
      passed: enr.status === 'withdrawn' ? null : (calcResult.passed !== null && calcResult.passed !== undefined ? calcResult.passed : ((existingFg?.specialGrade || calcResult.letter || existingFg?.letter) ? (existingFg?.specialGrade || calcResult.letter || existingFg?.letter) !== 'F' : false)),
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

  const locked = offering.grade_status === 'submitted';
  const requiresReason = latestSubmission?.status === 'rejected' || ['approved', 'published'].includes(offering.grade_status);

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

export async function findOrCreateEnrollment(offeringId, studentId) {
  const off = await getOfferingById(offeringId);
  const targetDept =
    off?.teacher?.departmentId ||
    off?.teacher?.department?.id ||
    off?.course?.department?.id ||
    off?.departmentId ||
    null;
  const rawYos =
    off?.yearOfStudy ??
    off?.year_of_study ??
    (off?.course?.level ? (off.course.level >= 100 ? Math.floor(off.course.level / 100) : off.course.level) : null);
  const targetYear = rawYos !== null && rawYos !== undefined ? parseInt(rawYos, 10) : null;

  const stuRes = await query(`SELECT department_id, year_of_study FROM students WHERE id = $1`, [studentId]);
  if (stuRes.rows.length === 0) {
    throw new NotFoundError('Student');
  }
  const stu = stuRes.rows[0];

  if (targetDept && stu.department_id !== targetDept) {
    throw new ValidationError('Student department does not match the assigned course department.');
  }
  if (targetYear && Number(stu.year_of_study) !== Number(targetYear)) {
    throw new ValidationError('Student year of study does not match the assigned course year of study.');
  }

  const existing = await query(
    `SELECT id, status, is_repeat FROM course_enrollments WHERE offering_id = $1 AND student_id = $2`,
    [offeringId, studentId]
  );
  if (existing.rows.length > 0) {
    return existing.rows[0];
  }
  const enrId = newId('enr');
  const inserted = await query(
    `INSERT INTO course_enrollments (id, offering_id, student_id, status, is_repeat, enrolled_at)
     VALUES ($1, $2, $3, 'enrolled', false, now())
     RETURNING id, status, is_repeat`,
    [enrId, offeringId, studentId]
  );
  return inserted.rows[0];
}

export async function saveScoreChanges(offeringId, changes, reason, user) {
  return await withTransaction(async (client) => {
    let created = 0;
    let updated = 0;
    let cleared = 0;

    for (const change of changes) {
      let { enrollmentId, studentId, assessmentId, marks } = change;

      if (!enrollmentId && studentId) {
        const enr = await findOrCreateEnrollment(offeringId, studentId);
        enrollmentId = enr.id;
      }

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
        }
      } else {
        const numericMarks = parseFloat(marks);
        if (existing) {
          await client.query(
            `UPDATE assessment_scores SET marks = $2, updated_by = $3, updated_at = now() WHERE id = $1`,
            [existing.id, numericMarks, user.id]
          );
          updated++;
        } else {
          const id = newId('scr');
          await client.query(
            `INSERT INTO assessment_scores (id, assessment_id, enrollment_id, marks, updated_by)
             VALUES ($1, $2, $3, $4, $5)`,
            [id, assessmentId, enrollmentId, numericMarks, user.id]
          );
          created++;
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

    // Mark final grades stale whenever marks change
    await client.query(
      `UPDATE final_grades fg
       SET is_stale = true, updated_at = now()
       FROM course_enrollments ce
       WHERE ce.id = fg.enrollment_id AND ce.offering_id = $1`,
      [offeringId]
    );

    // Auto-release assessments where marks have been saved so students can see their marks
    const modifiedAssessmentIds = [...new Set(changes.map((c) => c.assessmentId).filter(Boolean))];
    if (modifiedAssessmentIds.length > 0) {
      await client.query(
        `UPDATE assessments
         SET is_released = true, released_at = COALESCE(released_at, now()), updated_at = now()
         WHERE id = ANY($1)`,
        [modifiedAssessmentIds]
      );
    }

    // Recalculate and synchronize final_grades for all active enrollments so that
    // transcripts and reports reflect the latest score, letter, and grade points
    const asmRes = await client.query(
      `SELECT id, max_marks, weight FROM assessments WHERE offering_id = $1`,
      [offeringId]
    );
    const policyObj = await getAcademicPolicy();
    const scale = await getActiveGradeScale();
    const scaleId = scale.id || 'gsc_0001';
    const scaleEntries = scale.entries || [];

    const allEnrsRes = await client.query(
      `SELECT id, status FROM course_enrollments WHERE offering_id = $1`,
      [offeringId]
    );
    const allScoresRes = await client.query(
      `SELECT scr.assessment_id, scr.enrollment_id, scr.marks
       FROM assessment_scores scr
       JOIN course_enrollments ce ON ce.id = scr.enrollment_id
       WHERE ce.offering_id = $1`,
      [offeringId]
    );

    const scoreMap = {};
    for (const s of allScoresRes.rows) {
      if (!scoreMap[s.enrollment_id]) scoreMap[s.enrollment_id] = {};
      scoreMap[s.enrollment_id][s.assessment_id] = parseFloat(s.marks);
    }

    const offStatusRes = await client.query(`SELECT grade_status FROM course_offerings WHERE id = $1`, [offeringId]);
    const offGradeStatus = offStatusRes.rows[0]?.grade_status || 'draft';

    for (const enr of allEnrsRes.rows) {
      if (enr.status === 'withdrawn') continue;
      const studentScores = scoreMap[enr.id] || {};
      const calcResult = computeEnrollmentScore(
        asmRes.rows.map((a) => ({
          id: a.id,
          maxMarks: parseFloat(a.max_marks),
          weight: parseFloat(a.weight),
        })),
        studentScores,
        scaleEntries,
        policyObj.passMark
      );

      const totalScore = calcResult.weightedTotal != null ? calcResult.weightedTotal : (calcResult.runningPercent || 0);
      const letter = calcResult.letter || 'F';
      const gradePoints = calcResult.gradePoints != null ? calcResult.gradePoints : 0;
      const fgId = newId('grd');

      await client.query(
        `INSERT INTO final_grades (
           id, enrollment_id, grade_scale_id, total_score, letter, grade_points,
           status, is_stale, computed_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, false, now(), now())
         ON CONFLICT (enrollment_id) DO UPDATE SET
           grade_scale_id = EXCLUDED.grade_scale_id,
           total_score = EXCLUDED.total_score,
           letter = EXCLUDED.letter,
           grade_points = EXCLUDED.grade_points,
           is_stale = false,
           updated_at = now()`,
        [fgId, enr.id, scaleId, totalScore, letter, gradePoints, offGradeStatus]
      );
    }

    return { created, updated, cleared };
  });
}

export async function getGradeHistory() {
  // Audit log query removed; return empty history list
  return [];
}

export async function getActiveEnrollmentIds(offeringId) {
  const offering = await getOfferingById(offeringId);
  const targetDeptId =
    offering?.teacher?.departmentId ||
    offering?.teacher?.department?.id ||
    offering?.course?.department?.id ||
    offering?.departmentId ||
    null;
  const rawYos =
    offering?.yearOfStudy ??
    offering?.year_of_study ??
    (offering?.course?.level ? (offering.course.level >= 100 ? Math.floor(offering.course.level / 100) : offering.course.level) : null);
  const targetYearOfStudy = rawYos !== null && rawYos !== undefined ? parseInt(rawYos, 10) : null;

  const res = await query(
    `SELECT ce.id
     FROM course_enrollments ce
     JOIN students s ON s.id = ce.student_id
     WHERE ce.offering_id = $1
       AND ce.status != 'withdrawn'
       AND ($2::varchar IS NULL OR s.department_id = $2)
       AND ($3::smallint IS NULL OR s.year_of_study = $3)`,
    [offeringId, targetDeptId, targetYearOfStudy]
  );
  return res.rows;
}

