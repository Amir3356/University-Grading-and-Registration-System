import { query } from '../config/database.js';
import { getCurrentSemester } from './calendarRepository.js';
import { getAcademicPolicy, getActiveGradeScale, getGradebookData } from './gradebookRepository.js';
import { getUniversitySettings } from './settingsRepository.js';
import { getAcademicStanding, computeGpa, roundTo2 } from '../utils/gpaCalculator.js';

export async function getAdminDashboard() {
  const currentSemester = await getCurrentSemester();
  const currentSemId = currentSemester?.id;

  // General counts
  const stuCountRes = await query(`SELECT count(*) as count FROM students WHERE academic_status = 'active'`);
  const tchCountRes = await query(`SELECT count(*) as count FROM teachers`);
  const depCountRes = await query(`SELECT count(*) as count FROM departments`);
  const crsCountRes = await query(`SELECT count(*) as count FROM courses WHERE status = 'active'`);
  const offCountRes = await query(`SELECT count(*) as count FROM course_offerings WHERE semester_id = $1`, [currentSemId]);
  const enrCountRes = await query(
    `SELECT count(ce.id) as count
     FROM course_enrollments ce
     JOIN course_offerings co ON co.id = ce.offering_id
     WHERE co.semester_id = $1 AND ce.status != 'withdrawn'`,
    [currentSemId]
  );
  const pendingApprovalsRes = await query(`SELECT count(*) as count FROM grade_submissions WHERE status = 'pending'`);
  const approvedUnpubRes = await query(`SELECT count(*) as count FROM grade_submissions WHERE status = 'approved'`);
  const overdueRes = await query(
    `SELECT count(*) as count FROM course_offerings co
     JOIN semesters sem ON sem.id = co.semester_id
     WHERE CURRENT_DATE > sem.grade_submission_deadline AND co.grade_status IN ('not_started', 'draft', 'rejected')`
  );
  const pendingRegRes = await query(`SELECT count(*) as count FROM semester_registrations WHERE status = 'pending'`);
  const pendingWithdrawRes = await query(`SELECT count(*) as count FROM withdrawal_requests WHERE status = 'pending'`);

  // Overall pass rate & average score on published grades
  const passAvgRes = await query(`
    SELECT
      AVG(total_score) as avg_score,
      (count(*) FILTER (WHERE grade_points > 0)::numeric / NULLIF(count(*), 0) * 100) as pass_rate
    FROM final_grades
    WHERE status = 'published' AND total_score IS NOT NULL
  `);

  // Enrollment trend (last 4 semesters)
  const trendRes = await query(`
    SELECT sem.name as semester,
           count(DISTINCT ce.id) as enrollments,
           count(DISTINCT ce.student_id) as students
    FROM semesters sem
    JOIN course_offerings co ON co.semester_id = sem.id
    JOIN course_enrollments ce ON ce.offering_id = co.id
    WHERE ce.status != 'withdrawn'
    GROUP BY sem.id, sem.name, sem.sort_order
    ORDER BY sem.sort_order DESC
    LIMIT 4
  `);

  // Performance trend
  const perfRes = await query(`
    SELECT sem.name as semester,
           AVG(fg.total_score) as average,
           (count(*) FILTER (WHERE fg.grade_points > 0)::numeric / NULLIF(count(*), 0) * 100) as pass_rate
    FROM semesters sem
    JOIN course_offerings co ON co.semester_id = sem.id
    JOIN course_enrollments ce ON ce.offering_id = co.id
    JOIN final_grades fg ON fg.enrollment_id = ce.id
    WHERE fg.status = 'published' AND fg.total_score IS NOT NULL
    GROUP BY sem.id, sem.name, sem.sort_order
    ORDER BY sem.sort_order DESC
    LIMIT 4
  `);

  // Grade distribution
  const scale = await getActiveGradeScale();
  const distRes = await query(`
    SELECT fg.letter, count(fg.id) as count
    FROM final_grades fg
    WHERE fg.status = 'published'
    GROUP BY fg.letter
  `);
  const distMap = {};
  for (const d of distRes.rows) distMap[d.letter] = parseInt(d.count, 10);
  const distribution = scale.entries.map((e) => ({
    letter: e.letter,
    count: distMap[e.letter] || 0,
  }));

  // Department performance
  const deptPerfRes = await query(`
    SELECT d.code as department, d.name,
           AVG(fg.total_score) as average,
           AVG(fg.grade_points) as gpa
    FROM departments d
    JOIN courses c ON c.department_id = d.id
    JOIN course_offerings co ON co.course_id = c.id
    JOIN course_enrollments ce ON ce.offering_id = co.id
    JOIN final_grades fg ON fg.enrollment_id = ce.id
    WHERE fg.status = 'published' AND fg.total_score IS NOT NULL
    GROUP BY d.id
    ORDER BY average DESC
  `);

  // Attention items
  const attention = [];
  const pendingApprovalsCount = parseInt(pendingApprovalsRes.rows[0]?.count || '0', 10);
  if (pendingApprovalsCount > 0) {
    attention.push({
      id: 'approvals',
      tone: 'warning',
      title: `${pendingApprovalsCount} grade submission(s) awaiting approval`,
      link: '/admin/grade-approvals',
    });
  }
  const overdueCount = parseInt(overdueRes.rows[0]?.count || '0', 10);
  if (overdueCount > 0) {
    attention.push({
      id: 'overdue',
      tone: 'danger',
      title: `${overdueCount} course offering(s) have overdue grades`,
      link: '/admin/reports',
    });
  }
  const pendingRegCount = parseInt(pendingRegRes.rows[0]?.count || '0', 10);
  if (pendingRegCount > 0) {
    attention.push({
      id: 'registrations',
      tone: 'info',
      title: `${pendingRegCount} semester registration(s) pending review`,
      link: '/admin/semester-registration/students',
    });
  }

  // Recent activity
  const actRes = await query(`
    SELECT al.*, (u.first_name || ' ' || u.last_name) as user_name
    FROM audit_logs al
    LEFT JOIN users u ON u.id = al.user_id
    ORDER BY al.created_at DESC
    LIMIT 10
  `);

  return {
    currentSemester,
    stats: {
      students: parseInt(stuCountRes.rows[0]?.count || '0', 10),
      teachers: parseInt(tchCountRes.rows[0]?.count || '0', 10),
      departments: parseInt(depCountRes.rows[0]?.count || '0', 10),
      courses: parseInt(crsCountRes.rows[0]?.count || '0', 10),
      currentOfferings: parseInt(offCountRes.rows[0]?.count || '0', 10),
      currentEnrollments: parseInt(enrCountRes.rows[0]?.count || '0', 10),
      pendingApprovals: pendingApprovalsCount,
      overdueGrades: overdueCount,
      approvedUnpublished: parseInt(approvedUnpubRes.rows[0]?.count || '0', 10),
      passRate: passAvgRes.rows[0]?.pass_rate ? roundTo2(passAvgRes.rows[0].pass_rate) : 0,
      averageScore: passAvgRes.rows[0]?.avg_score ? roundTo2(passAvgRes.rows[0].avg_score) : 0,
      pendingRegistrations: pendingRegCount,
      pendingWithdrawals: parseInt(pendingWithdrawRes.rows[0]?.count || '0', 10),
    },
    enrollmentTrend: trendRes.rows.reverse().map((r) => ({
      semester: r.semester,
      enrollments: parseInt(r.enrollments, 10),
      students: parseInt(r.students, 10),
    })),
    performanceTrend: perfRes.rows.reverse().map((r) => ({
      semester: r.semester,
      average: r.average ? roundTo2(r.average) : 0,
      passRate: r.pass_rate ? roundTo2(r.pass_rate) : 0,
    })),
    distribution,
    departmentPerformance: deptPerfRes.rows.map((r) => ({
      department: r.department,
      name: r.name,
      average: r.average ? roundTo2(r.average) : 0,
      gpa: r.gpa ? roundTo2(r.gpa) : 0,
    })),
    attention,
    recentActivity: actRes.rows,
  };
}

export async function getDeptDashboard(departmentId) {
  const currentSemester = await getCurrentSemester();
  const currentSemId = currentSemester?.id;

  const deptRes = await query(`SELECT * FROM departments WHERE id = $1`, [departmentId]);
  const department = deptRes.rows[0];

  const stuRes = await query(`SELECT count(*) as count FROM students WHERE department_id = $1 AND academic_status = 'active'`, [departmentId]);
  const tchRes = await query(`SELECT count(*) as count FROM teachers WHERE department_id = $1`, [departmentId]);
  const crsRes = await query(`SELECT count(*) as count FROM courses WHERE department_id = $1 AND status = 'active'`, [departmentId]);

  const offRes = await query(
    `SELECT count(co.id) as count
     FROM course_offerings co
     JOIN courses c ON c.id = co.course_id
     WHERE c.department_id = $1 AND co.semester_id = $2`,
    [departmentId, currentSemId]
  );

  const pendingSubRes = await query(
    `SELECT count(gs.id) as count
     FROM grade_submissions gs
     JOIN course_offerings co ON co.id = gs.offering_id
     JOIN courses c ON c.id = co.course_id
     WHERE c.department_id = $1 AND gs.status = 'pending'`,
    [departmentId]
  );

  const overdueRes = await query(
    `SELECT count(co.id) as count
     FROM course_offerings co
     JOIN courses c ON c.id = co.course_id
     JOIN semesters sem ON sem.id = co.semester_id
     WHERE c.department_id = $1 AND CURRENT_DATE > sem.grade_submission_deadline
       AND co.grade_status IN ('not_started', 'draft', 'rejected')`,
    [departmentId]
  );

  const passAvgRes = await query(
    `SELECT
       AVG(fg.total_score) as avg_score,
       (count(*) FILTER (WHERE fg.grade_points > 0)::numeric / NULLIF(count(*), 0) * 100) as pass_rate
     FROM final_grades fg
     JOIN course_enrollments ce ON ce.id = fg.enrollment_id
     JOIN course_offerings co ON co.id = ce.offering_id
     JOIN courses c ON c.id = co.course_id
     WHERE c.department_id = $1 AND fg.status = 'published'`,
    [departmentId]
  );

  // Pending Submissions
  const { listSubmissions } = await import('./submissionRepository.js');
  const subs = await listSubmissions({ departmentId, status: 'pending', pageSize: 10 });

  // Distribution
  const scale = await getActiveGradeScale();
  const distRes = await query(
    `SELECT fg.letter, count(fg.id) as count
     FROM final_grades fg
     JOIN course_enrollments ce ON ce.id = fg.enrollment_id
     JOIN course_offerings co ON co.id = ce.offering_id
     JOIN courses c ON c.id = co.course_id
     WHERE c.department_id = $1 AND fg.status = 'published'
     GROUP BY fg.letter`,
    [departmentId]
  );
  const distMap = {};
  for (const d of distRes.rows) distMap[d.letter] = parseInt(d.count, 10);
  const distribution = scale.entries.map((e) => ({
    letter: e.letter,
    count: distMap[e.letter] || 0,
  }));

  return {
    department,
    currentSemester,
    stats: {
      students: parseInt(stuRes.rows[0]?.count || '0', 10),
      teachers: parseInt(tchRes.rows[0]?.count || '0', 10),
      courses: parseInt(crsRes.rows[0]?.count || '0', 10),
      currentOfferings: parseInt(offRes.rows[0]?.count || '0', 10),
      pendingApprovals: parseInt(pendingSubRes.rows[0]?.count || '0', 10),
      overdueGrades: parseInt(overdueRes.rows[0]?.count || '0', 10),
      passRate: passAvgRes.rows[0]?.pass_rate ? roundTo2(passAvgRes.rows[0].pass_rate) : 0,
      averageScore: passAvgRes.rows[0]?.avg_score ? roundTo2(passAvgRes.rows[0].avg_score) : 0,
    },
    pendingSubmissions: subs.items,
    distribution,
    coursePerformance: [],
    studentsByStanding: [],
  };
}

export async function getMissingGradesReport({ semesterId, departmentId } = {}) {
  const conditions = [];
  const params = [];

  if (semesterId) {
    params.push(semesterId);
    conditions.push(`co.semester_id = $${params.length}`);
  }

  if (departmentId) {
    params.push(departmentId);
    conditions.push(`c.department_id = $${params.length}`);
  }

  conditions.push(`co.grade_status != 'published'`);

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const sql = `
    SELECT co.id as offering_id,
           c.code as course_code, c.title as course_title,
           sem.name as semester_name, sem.grade_submission_deadline as deadline,
           (t.title || ' ' || u.first_name || ' ' || u.last_name) as teacher_name,
           co.grade_status,
           COUNT(DISTINCT ce.id) FILTER (WHERE ce.status != 'withdrawn') as students,
           COALESCE(SUM(DISTINCT a.weight), 0) as weight_total,
           (CURRENT_DATE > sem.grade_submission_deadline) as overdue
    FROM course_offerings co
    JOIN courses c ON c.id = co.course_id
    JOIN semesters sem ON sem.id = co.semester_id
    JOIN teachers t ON t.id = co.teacher_id
    JOIN users u ON u.id = t.user_id
    LEFT JOIN course_enrollments ce ON ce.offering_id = co.id
    LEFT JOIN assessments a ON a.offering_id = co.id
    ${whereClause}
    GROUP BY co.id, c.id, sem.id, t.id, u.id
    ORDER BY overdue DESC, sem.sort_order DESC, c.code ASC
  `;

  const res = await query(sql, params);

  return Promise.all(
    res.rows.map(async (row) => {
      const statsRes = await query(
        `SELECT
           COUNT(ce.id) FILTER (
             WHERE (SELECT count(*) FROM assessment_scores scr
                    JOIN assessments a ON a.id = scr.assessment_id
                    WHERE a.offering_id = $1 AND scr.enrollment_id = ce.id) < (SELECT count(*) FROM assessments a WHERE a.offering_id = $1)
           ) as incomplete_students,
           ((COUNT(ce.id) * (SELECT count(*) FROM assessments a WHERE a.offering_id = $1)) -
            (SELECT count(*) FROM assessment_scores scr
             JOIN assessments a ON a.id = scr.assessment_id
             JOIN course_enrollments e ON e.id = scr.enrollment_id
             WHERE a.offering_id = $1 AND e.status != 'withdrawn')) as missing_marks
         FROM course_enrollments ce
         WHERE ce.offering_id = $1 AND ce.status != 'withdrawn'`,
        [row.offering_id]
      );
      const st = statsRes.rows[0];
      return {
        ...row,
        students: parseInt(row.students, 10),
        incompleteStudents: parseInt(st?.incomplete_students || '0', 10),
        missingMarks: Math.max(0, parseInt(st?.missing_marks || '0', 10)),
        weightTotal: parseFloat(row.weight_total || '0'),
      };
    })
  );
}

export async function getDepartmentReport({ semesterId } = {}) {
  const deptsRes = await query(`SELECT * FROM departments ORDER BY name ASC`);
  const scale = await getActiveGradeScale();

  const results = [];
  for (const dept of deptsRes.rows) {
    const params = [dept.id];
    let semFilter = '';
    if (semesterId) {
      params.push(semesterId);
      semFilter = `AND co.semester_id = $2`;
    }

    const dataRes = await query(
      `SELECT
         COUNT(fg.id) as grades,
         AVG(fg.total_score) as avg_score,
         AVG(fg.grade_points) as avg_points,
         COUNT(fg.id) FILTER (WHERE fg.grade_points > 0) as passed,
         COUNT(fg.id) FILTER (WHERE fg.grade_points = 0) as failed,
         COUNT(DISTINCT ce.student_id) as students
       FROM final_grades fg
       JOIN course_enrollments ce ON ce.id = fg.enrollment_id
       JOIN course_offerings co ON co.id = ce.offering_id
       JOIN courses c ON c.id = co.course_id
       WHERE c.department_id = $1 AND fg.status = 'published' ${semFilter}`,
      params
    );
    const d = dataRes.rows[0];
    const grades = parseInt(d?.grades || '0', 10);
    const passed = parseInt(d?.passed || '0', 10);
    const failed = parseInt(d?.failed || '0', 10);
    const passRate = grades > 0 ? roundTo2((passed / grades) * 100) : 0;

    // Distribution
    const distRes = await query(
      `SELECT fg.letter, count(fg.id) as count
       FROM final_grades fg
       JOIN course_enrollments ce ON ce.id = fg.enrollment_id
       JOIN course_offerings co ON co.id = ce.offering_id
       JOIN courses c ON c.id = co.course_id
       WHERE c.department_id = $1 AND fg.status = 'published' ${semFilter}
       GROUP BY fg.letter`,
      params
    );
    const distMap = {};
    for (const row of distRes.rows) distMap[row.letter] = parseInt(row.count, 10);

    results.push({
      departmentId: dept.id,
      code: dept.code,
      name: dept.name,
      grades,
      averageScore: d?.avg_score ? roundTo2(d.avg_score) : 0,
      averageGradePoint: d?.avg_points ? roundTo2(d.avg_points) : 0,
      passRate,
      passed,
      failed,
      students: parseInt(d?.students || '0', 10),
      averageCgpa: d?.avg_points ? roundTo2(d.avg_points) : 0,
      distribution: scale.entries.map((e) => ({
        letter: e.letter,
        count: distMap[e.letter] || 0,
      })),
    });
  }
  return results;
}

export async function getCourseResultsReport({ semesterId, departmentId } = {}) {
  const conditions = [];
  const params = [];

  if (semesterId) {
    params.push(semesterId);
    conditions.push(`co.semester_id = $${params.length}`);
  }

  if (departmentId) {
    params.push(departmentId);
    conditions.push(`c.department_id = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `
    SELECT co.id as offering_id,
           c.code as course_code, c.title as course_title,
           sem.name as semester_name,
           (t.title || ' ' || u.first_name || ' ' || u.last_name) as teacher_name,
           co.grade_status,
           COUNT(fg.id) as students,
           AVG(fg.total_score) as average,
           MAX(fg.total_score) as highest,
           MIN(fg.total_score) as lowest,
           COUNT(fg.id) FILTER (WHERE fg.grade_points > 0) as passed,
           COUNT(fg.id) FILTER (WHERE fg.grade_points = 0) as failed
    FROM course_offerings co
    JOIN courses c ON c.id = co.course_id
    JOIN semesters sem ON sem.id = co.semester_id
    JOIN teachers t ON t.id = co.teacher_id
    JOIN users u ON u.id = t.user_id
    LEFT JOIN course_enrollments ce ON ce.offering_id = co.id
    LEFT JOIN final_grades fg ON fg.enrollment_id = ce.id AND fg.status = 'published'
    ${whereClause}
    GROUP BY co.id, c.id, sem.id, t.id, u.id
    ORDER BY c.code ASC, co.section ASC
  `;

  const res = await query(sql, params);
  const scale = await getActiveGradeScale();

  return Promise.all(
    res.rows.map(async (row) => {
      const distRes = await query(
        `SELECT fg.letter, count(fg.id) as count
         FROM final_grades fg
         JOIN course_enrollments ce ON ce.id = fg.enrollment_id
         WHERE ce.offering_id = $1 AND fg.status = 'published'
         GROUP BY fg.letter`,
        [row.offering_id]
      );
      const distMap = {};
      for (const d of distRes.rows) distMap[d.letter] = parseInt(d.count, 10);

      const students = parseInt(row.students || '0', 10);
      const passed = parseInt(row.passed || '0', 10);
      const failed = parseInt(row.failed || '0', 10);
      const passRate = students > 0 ? roundTo2((passed / students) * 100) : 0;

      return {
        ...row,
        students,
        average: row.average ? roundTo2(row.average) : 0,
        highest: row.highest ? roundTo2(row.highest) : 0,
        lowest: row.lowest ? roundTo2(row.lowest) : 0,
        passRate,
        passed,
        failed,
        distribution: scale.entries.map((e) => ({
          letter: e.letter,
          count: distMap[e.letter] || 0,
        })),
      };
    })
  );
}

export async function getGradeDistributionReport({ semesterId, departmentId } = {}) {
  const conditions = [`fg.status = 'published'`];
  const params = [];

  if (semesterId) {
    params.push(semesterId);
    conditions.push(`co.semester_id = $${params.length}`);
  }

  if (departmentId) {
    params.push(departmentId);
    conditions.push(`c.department_id = $${params.length}`);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const totalRes = await query(
    `SELECT count(*) as total,
            AVG(fg.total_score) as avg_score,
            count(*) FILTER (WHERE fg.special_grade = 'W') as withdrawn,
            count(*) FILTER (WHERE fg.special_grade = 'I') as incomplete
     FROM final_grades fg
     JOIN course_enrollments ce ON ce.id = fg.enrollment_id
     JOIN course_offerings co ON co.id = ce.offering_id
     JOIN courses c ON c.id = co.course_id
     ${whereClause}`,
    params
  );
  const tot = totalRes.rows[0];

  const distRes = await query(
    `SELECT fg.letter, count(fg.id) as count
     FROM final_grades fg
     JOIN course_enrollments ce ON ce.id = fg.enrollment_id
     JOIN course_offerings co ON co.id = ce.offering_id
     JOIN courses c ON c.id = co.course_id
     ${whereClause}
     GROUP BY fg.letter`,
    params
  );
  const distMap = {};
  for (const d of distRes.rows) distMap[d.letter] = parseInt(d.count, 10);

  const scale = await getActiveGradeScale();

  return {
    total: parseInt(tot?.total || '0', 10),
    withdrawn: parseInt(tot?.withdrawn || '0', 10),
    incomplete: parseInt(tot?.incomplete || '0', 10),
    averageScore: tot?.avg_score ? roundTo2(tot.avg_score) : 0,
    distribution: scale.entries.map((e) => ({
      letter: e.letter,
      count: distMap[e.letter] || 0,
    })),
  };
}

export async function getGpaReport({ departmentId, programType, yearOfStudy, standing, search, sort, page = 1, pageSize = 10 } = {}) {
  const { listStudents } = await import('./userRepository.js');
  const studentsRes = await listStudents({
    departmentId,
    programType,
    yearOfStudy,
    search,
    pageSize: 'all',
  });

  const rows = [];
  let deansCount = 0;
  let probCount = 0;
  let totalCgpaSum = 0;

  for (const stu of studentsRes.items) {
    const transcript = await getStudentTranscriptData(stu.id);
    const lastSem = transcript.semesters[transcript.semesters.length - 1];

    if (transcript.standing.label === "Dean's List") deansCount++;
    if (transcript.standing.label === "Academic Probation") probCount++;
    totalCgpaSum += transcript.cgpa;

    rows.push({
      studentId: stu.id,
      studentNumber: stu.student_number,
      name: stu.name,
      department: stu.department_name,
      program: stu.program_name,
      admissionYear: stu.admission_year,
      semesterGpa: lastSem?.gpa || 0,
      semesterName: lastSem?.name || '—',
      cgpa: transcript.cgpa,
      earnedCredits: transcript.earnedCredits,
      standing: transcript.standing.label,
    });
  }

  let filtered = rows;
  if (standing) {
    filtered = filtered.filter((r) => r.standing.toLowerCase().includes(standing.toLowerCase()));
  }

  const total = filtered.length;
  const p = Math.max(1, parseInt(page, 10) || 1);
  const size = pageSize === 'all' ? total || 1 : Math.max(1, parseInt(pageSize, 10) || 10);
  const pageCount = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(total / size));
  const offset = pageSize === 'all' ? 0 : (p - 1) * size;

  const paginated = filtered.slice(offset, offset + size);
  const averageCgpa = rows.length > 0 ? roundTo2(totalCgpaSum / rows.length) : 0;

  return {
    items: paginated,
    total,
    page: p,
    pageSize: size,
    pageCount,
    summary: {
      averageCgpa,
      deansList: deansCount,
      probation: probCount,
    },
  };
}

export async function getRegistrationsReport({ semesterId } = {}) {
  let semId = semesterId;
  if (!semId) {
    const curr = await getCurrentSemester();
    semId = curr?.id;
  }

  const deptCountsRes = await query(
    `SELECT d.name as department_name, count(sr.id) as count
     FROM semester_registrations sr
     JOIN students s ON s.id = sr.student_id
     JOIN departments d ON d.id = s.department_id
     WHERE sr.semester_id = $1 AND sr.status = 'registered'
     GROUP BY d.id
     ORDER BY d.name ASC`,
    [semId]
  );

  const progTypeCountsRes = await query(
    `SELECT s.program_type, count(sr.id) as count
     FROM semester_registrations sr
     JOIN students s ON s.id = sr.student_id
     WHERE sr.semester_id = $1 AND sr.status = 'registered'
     GROUP BY s.program_type`,
    [semId]
  );

  const regTypeCountsRes = await query(
    `SELECT rt.label as registration_type, count(sr.id) as count
     FROM semester_registrations sr
     JOIN registration_types rt ON rt.id = sr.registration_type_id
     WHERE sr.semester_id = $1 AND sr.status = 'registered'
     GROUP BY rt.id`,
    [semId]
  );

  return {
    semesterId: semId,
    byDepartment: deptCountsRes.rows.map((r) => ({ name: r.department_name, count: parseInt(r.count, 10) })),
    byProgramType: progTypeCountsRes.rows.map((r) => ({ type: r.program_type, count: parseInt(r.count, 10) })),
    byRegistrationType: regTypeCountsRes.rows.map((r) => ({ type: r.registration_type, count: parseInt(r.count, 10) })),
  };
}

export async function getStudentTranscriptData(studentId) {
  const university = await getUniversitySettings();
  const policy = await getAcademicPolicy();
  const scale = await getActiveGradeScale();

  const stuRes = await query(
    `SELECT s.*, (u.first_name || ' ' || u.last_name) as name, u.email,
            d.name as department_name, d.code as department_code,
            p.name as program_name
     FROM students s
     JOIN users u ON u.id = s.user_id
     JOIN departments d ON d.id = s.department_id
     JOIN programs p ON p.id = s.program_id
     WHERE s.id = $1`,
    [studentId]
  );
  const student = stuRes.rows[0];

  // Excluded courses
  const excRes = await query(`SELECT course_id FROM policy_excluded_courses`);
  const excludedSet = new Set(excRes.rows.map((r) => r.course_id));

  // Published course results grouped by semester
  const gradesSql = `
    SELECT fg.*,
           c.id as course_id, c.code as course_code, c.title as course_title, c.credit_hours,
           s.id as semester_id, s.name as semester_name, s.term, s.sort_order,
           ce.is_repeat
    FROM final_grades fg
    JOIN course_enrollments ce ON ce.id = fg.enrollment_id
    JOIN course_offerings co ON co.id = ce.offering_id
    JOIN courses c ON c.id = co.course_id
    JOIN semesters s ON s.id = co.semester_id
    WHERE ce.student_id = $1 AND fg.status = 'published'
    ORDER BY s.sort_order ASC, c.code ASC
  `;
  const gradesRes = await query(gradesSql, [studentId]);

  // Group by semester
  const semsMap = {};
  const semsList = [];

  for (const g of gradesRes.rows) {
    if (!semsMap[g.semester_id]) {
      const semObj = {
        semesterId: g.semester_id,
        name: g.semester_name,
        term: g.term,
        sortOrder: g.sort_order,
        courses: [],
        gpa: 0,
        cgpa: 0,
        credits: 0,
        qualityPoints: 0,
      };
      semsMap[g.semester_id] = semObj;
      semsList.push(semObj);
    }

    const countsInGpa = !excludedSet.has(g.course_id) && g.special_grade !== 'W';
    let note = null;
    if (g.special_grade === 'W') note = 'Withdrawn';
    else if (g.special_grade === 'I') note = 'Incomplete';
    else if (excludedSet.has(g.course_id)) note = 'Excluded from GPA';
    else if (g.letter === 'F') note = 'Failed';
    else if (g.is_repeat) note = 'Repeated';

    semsMap[g.semester_id].courses.push({
      courseId: g.course_id,
      courseCode: g.course_code,
      courseTitle: g.course_title,
      creditHours: g.credit_hours,
      totalScore: g.total_score !== null ? parseFloat(g.total_score) : null,
      letter: g.letter,
      gradePoints: g.grade_points !== null ? parseFloat(g.grade_points) : null,
      countsInGpa,
      isRepeat: g.is_repeat,
      superseded: false,
      note,
    });
  }

  // Calculate semester GPAs and running CGPA
  let cumulativeQP = 0;
  let cumulativeGpaCredits = 0;
  let totalAttemptedCredits = 0;
  let totalEarnedCredits = 0;

  for (const sem of semsList) {
    let semQP = 0;
    let semCredits = 0;

    for (const c of sem.courses) {
      totalAttemptedCredits += c.creditHours;
      if (c.countsInGpa && c.gradePoints !== null) {
        semQP += c.gradePoints * c.creditHours;
        semCredits += c.creditHours;

        cumulativeQP += c.gradePoints * c.creditHours;
        cumulativeGpaCredits += c.creditHours;
      }
      if (c.gradePoints !== null && c.letter !== 'F' && c.letter !== 'W') {
        totalEarnedCredits += c.creditHours;
      }
    }

    sem.qualityPoints = roundTo2(semQP);
    sem.credits = semCredits;
    sem.gpa = semCredits > 0 ? roundTo2(semQP / semCredits) : 0;
    sem.cgpa = cumulativeGpaCredits > 0 ? roundTo2(cumulativeQP / cumulativeGpaCredits) : 0;
  }

  const finalCgpa = cumulativeGpaCredits > 0 ? roundTo2(cumulativeQP / cumulativeGpaCredits) : 0;
  const standing = getAcademicStanding(finalCgpa, policy.honorsGpa, policy.probationGpa);

  return {
    university: {
      name: university?.name || 'Northbridge University',
      registrarName: university?.registrarName || 'Registrar',
      shortName: university?.shortName || 'NBU',
      address: university?.address || '',
      email: university?.email || '',
      website: university?.website || '',
    },
    student: {
      id: student?.id,
      name: student?.name,
      studentNumber: student?.student_number,
      program: student?.program_name,
      department: {
        id: student?.department_id,
        name: student?.department_name,
        code: student?.department_code,
      },
      admissionYear: student?.admission_year,
    },
    generatedAt: new Date().toISOString(),
    semesters: semsList,
    cgpa: finalCgpa,
    earnedCredits: totalEarnedCredits,
    attemptedCredits: totalAttemptedCredits,
    qualityPoints: roundTo2(cumulativeQP),
    gpaCredits: cumulativeGpaCredits,
    standing,
    scale: scale.entries,
    policy: {
      repeatPolicy: policy.repeatPolicy,
      passMark: policy.passMark,
    },
  };
}

export async function getStudentPerformanceReport(studentId) {
  const transcript = await getStudentTranscriptData(studentId);
  const stuRes = await query(
    `SELECT s.*, (u.first_name || ' ' || u.last_name) as name, u.email,
            d.name as department_name, p.name as program_name
     FROM students s
     JOIN users u ON u.id = s.user_id
     JOIN departments d ON d.id = s.department_id
     JOIN programs p ON p.id = s.program_id
     WHERE s.id = $1`,
    [studentId]
  );

  const coursesRes = await query(
    `SELECT ce.id as enrollment_id, c.code as course_code, c.title as course_title,
            c.credit_hours, sem.name as semester_name, ce.status, co.grade_status,
            fg.total_score as total, fg.letter, (fg.status = 'published') as published
     FROM course_enrollments ce
     JOIN course_offerings co ON co.id = ce.offering_id
     JOIN courses c ON c.id = co.course_id
     JOIN semesters sem ON sem.id = co.semester_id
     LEFT JOIN final_grades fg ON fg.enrollment_id = ce.id
     WHERE ce.student_id = $1
     ORDER BY sem.sort_order DESC, c.code ASC`,
    [studentId]
  );

  return {
    student: stuRes.rows[0],
    cgpa: transcript.cgpa,
    earnedCredits: transcript.earnedCredits,
    standing: transcript.standing,
    trend: transcript.semesters.map((s) => ({
      semester: s.name,
      gpa: s.gpa,
      cgpa: s.cgpa,
    })),
    courses: coursesRes.rows.map((r) => ({
      enrollmentId: r.enrollment_id,
      courseCode: r.course_code,
      courseTitle: r.course_title,
      creditHours: r.credit_hours,
      semesterName: r.semester_name,
      status: r.status,
      gradeStatus: r.grade_status,
      runningPercent: r.total !== null ? parseFloat(r.total) : null,
      total: r.total !== null ? parseFloat(r.total) : null,
      letter: r.letter,
      published: r.published,
    })),
  };
}

export async function getCourseGradeSheet(offeringId) {
  const gradebook = await getGradebookData(offeringId);
  const university = await getUniversitySettings();

  return {
    ...gradebook,
    university,
    generatedAt: new Date().toISOString(),
  };
}
