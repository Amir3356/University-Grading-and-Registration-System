import { query } from '../config/database.js';
import { getCurrentSemester } from './calendarRepository.js';
import { getAcademicPolicy, getActiveGradeScale, getGradebookData } from './gradebookRepository.js';
import { getUniversitySettings } from './settingsRepository.js';
import { getAcademicStanding, computeGpa, roundTo2, computeEnrollmentScore } from '../utils/gpaCalculator.js';

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

  // Recent activity (audit logs removed)
  const recentActivity = [];

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
    recentActivity,
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
           (u.first_name || ' ' || u.last_name) as teacher_name,
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

/** Parses "YYYY-MM-DD" as a local calendar date (new Date(str) would read it as UTC midnight). */
function parseLocalDate(str) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(str ?? ''));
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

/**
 * Resolves a report period to a [start, end] range: today, weekly (last 7 days incl. today)
 * or custom (startDate..endDate, whole days). Returns null for no date filter.
 */
function resolvePeriodRange(period, startDate, endDate) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  if (period === 'today') return [today, endOf(today)];
  if (period === 'weekly') return [new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6), endOf(today)];
  if (period === 'custom') {
    const start = parseLocalDate(startDate);
    const end = parseLocalDate(endDate) ?? today;
    return start ? [start, endOf(end)] : null;
  }
  return null;
}

export async function getCourseResultsReport({ semesterId, departmentId, period, startDate, endDate } = {}) {
  const conditions = [];
  const params = [];

  // The period filters grades by the date they were approved by the department.
  let gradeDateFilter = '';
  const range = resolvePeriodRange(period, startDate, endDate);
  if (range) {
    params.push(range[0], range[1]);
    gradeDateFilter = ` AND fg.approved_at BETWEEN $${params.length - 1} AND $${params.length}`;
  }

  if (semesterId) {
    params.push(semesterId);
    conditions.push(`co.semester_id = $${params.length}`);
  }

  if (departmentId) {
    params.push(departmentId);
    conditions.push(`c.department_id = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Results count grades that cleared department approval (approved or published);
  // W / I special grades are reported separately and excluded from pass / fail.
  const sql = `
    SELECT co.id as offering_id,
           c.code as course_code, c.title as course_title,
           co.section, sem.id as semester_id, sem.name as semester_name, sem.start_date as semester_start,
           (u.first_name || ' ' || u.last_name) as teacher_name,
           co.grade_status,
           COUNT(DISTINCT ce.id) as enrolled,
           COUNT(fg.id) as students,
           AVG(fg.total_score) FILTER (WHERE fg.special_grade IS NULL) as average,
           MAX(fg.total_score) FILTER (WHERE fg.special_grade IS NULL) as highest,
           MIN(fg.total_score) FILTER (WHERE fg.special_grade IS NULL) as lowest,
           COUNT(fg.id) FILTER (WHERE fg.special_grade IS NULL AND fg.grade_points > 0) as passed,
           COUNT(fg.id) FILTER (WHERE fg.special_grade IS NULL AND fg.grade_points = 0) as failed,
           COUNT(fg.id) FILTER (WHERE fg.special_grade = 'W') as withdrawn,
           COUNT(fg.id) FILTER (WHERE fg.special_grade = 'I') as incomplete
    FROM course_offerings co
    JOIN courses c ON c.id = co.course_id
    JOIN semesters sem ON sem.id = co.semester_id
    JOIN teachers t ON t.id = co.teacher_id
    JOIN users u ON u.id = t.user_id
    LEFT JOIN course_enrollments ce ON ce.offering_id = co.id
    LEFT JOIN final_grades fg ON fg.enrollment_id = ce.id AND fg.status IN ('approved', 'published')${gradeDateFilter}
    ${whereClause}
    GROUP BY co.id, c.id, sem.id, t.id, u.id
    ORDER BY sem.start_date DESC, c.code ASC, co.section ASC
  `;

  const res = await query(sql, params);
  const scale = await getActiveGradeScale();

  return Promise.all(
    res.rows.map(async (row) => {
      const distRes = await query(
        `SELECT fg.letter, count(fg.id) as count
         FROM final_grades fg
         JOIN course_enrollments ce ON ce.id = fg.enrollment_id
         WHERE ce.offering_id = $1 AND fg.status IN ('approved', 'published')${range ? ' AND fg.approved_at BETWEEN $2 AND $3' : ''}
         GROUP BY fg.letter`,
        range ? [row.offering_id, range[0], range[1]] : [row.offering_id]
      );
      const distMap = {};
      for (const d of distRes.rows) distMap[d.letter] = parseInt(d.count, 10);

      const students = parseInt(row.students || '0', 10);
      const passed = parseInt(row.passed || '0', 10);
      const failed = parseInt(row.failed || '0', 10);
      const passRate = passed + failed > 0 ? roundTo2((passed / (passed + failed)) * 100) : 0;

      return {
        ...row,
        enrolled: parseInt(row.enrolled || '0', 10),
        students,
        withdrawn: parseInt(row.withdrawn || '0', 10),
        incomplete: parseInt(row.incomplete || '0', 10),
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
      standingTone: transcript.standing.tone,
    });
  }

  let filtered = rows;
  if (standing) {
    filtered = filtered.filter((r) => r.standing.toLowerCase().includes(standing.toLowerCase()));
  }

  if (sort) {
    let sortKey = 'cgpa';
    let sortDir = 'desc';
    if (typeof sort === 'string') {
      const parts = sort.split(':');
      sortKey = parts[0];
      sortDir = parts[1] || 'desc';
    } else if (typeof sort === 'object') {
      sortKey = sort.key || 'cgpa';
      sortDir = sort.dir || 'desc';
    }

    filtered.sort((a, b) => {
      let va = a[sortKey];
      let vb = b[sortKey];
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
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
    all: filtered,
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
     LEFT JOIN departments d ON d.id = s.department_id
     LEFT JOIN programs p ON p.id = s.program_id
     WHERE s.id = $1`,
    [studentId]
  );
  const student = stuRes.rows[0];

  // Excluded courses
  const excRes = await query(`SELECT course_id FROM policy_excluded_courses`);
  const excludedSet = new Set(excRes.rows.map((r) => r.course_id));

  // Published course results, recorded grades, and official withdrawals grouped by semester
  const gradesSql = `
    SELECT fg.id as final_grade_id, fg.enrollment_id, fg.total_score, fg.letter, fg.grade_points,
           fg.special_grade, fg.status as final_grade_status, fg.published_at,
           c.id as course_id, c.code as course_code, c.title as course_title, c.credit_hours,
           s.id as semester_id, s.name as semester_name, s.term, s.sort_order,
           ce.is_repeat, ce.status as enrollment_status,
           co.id as offering_id, co.grade_status as offering_grade_status
    FROM course_enrollments ce
    JOIN course_offerings co ON co.id = ce.offering_id
    JOIN courses c ON c.id = co.course_id
    JOIN semesters s ON s.id = co.semester_id
    LEFT JOIN final_grades fg ON fg.enrollment_id = ce.id
    WHERE ce.student_id = $1
      AND (
        fg.status IS NOT NULL
        OR co.grade_status IN ('published', 'approved', 'draft', 'submitted')
        OR ce.status = 'withdrawn'
        OR fg.special_grade = 'W'
        OR EXISTS (SELECT 1 FROM assessment_scores scr WHERE scr.enrollment_id = ce.id)
      )
    ORDER BY s.sort_order ASC, c.code ASC
  `;
  const gradesRes = await query(gradesSql, [studentId]);

  const enrollmentIds = gradesRes.rows.map((r) => r.enrollment_id);
  const offeringIds = [...new Set(gradesRes.rows.map((r) => r.offering_id).filter(Boolean))];

  let asmRows = [];
  let scoreRows = [];

  if (offeringIds.length > 0 && enrollmentIds.length > 0) {
    const asmRes = await query(
      `SELECT id, offering_id, name, type, max_marks, weight FROM assessments WHERE offering_id = ANY($1)`,
      [offeringIds]
    );
    asmRows = asmRes.rows;

    const scrRes = await query(
      `SELECT assessment_id, enrollment_id, marks FROM assessment_scores WHERE enrollment_id = ANY($1) AND marks IS NOT NULL`,
      [enrollmentIds]
    );
    scoreRows = scrRes.rows;
  }

  // First pass: extract course records and track repeat attempts
  const attemptsByCourse = new Map();
  const rawList = [];

  for (const g of gradesRes.rows) {
    const isWithdrawn = g.enrollment_status === 'withdrawn' || g.special_grade === 'W';
    const isSpecialI = g.special_grade === 'I';
    const isExcluded = excludedSet.has(g.course_id);

    let letter = isWithdrawn ? 'W' : (g.letter || (isSpecialI ? 'I' : null));
    let totalScore = isWithdrawn ? null : (g.total_score !== null && g.total_score !== undefined ? parseFloat(g.total_score) : null);
    let gradePoints = isWithdrawn ? null : (g.grade_points !== null && g.grade_points !== undefined ? parseFloat(g.grade_points) : null);

    // If score or letter or points is missing or stale, calculate from raw assessment scores if available
    if (!isWithdrawn && !isSpecialI && (totalScore === null || !letter || gradePoints === null)) {
      const offeringAsms = asmRows.filter((a) => a.offering_id === g.offering_id);
      const studentScores = {};
      for (const sc of scoreRows) {
        if (sc.enrollment_id === g.enrollment_id) {
          studentScores[sc.assessment_id] = parseFloat(sc.marks);
        }
      }
      if (offeringAsms.length > 0 && Object.keys(studentScores).length > 0) {
        const calcResult = computeEnrollmentScore(
          offeringAsms.map((a) => ({ id: a.id, maxMarks: parseFloat(a.max_marks), weight: parseFloat(a.weight) })),
          studentScores,
          scale?.entries,
          policy.passMark
        );
        if (totalScore === null) {
          totalScore = calcResult.weightedTotal != null ? calcResult.weightedTotal : calcResult.runningPercent;
        }
        if (!letter || letter === '—') {
          letter = calcResult.letter || '—';
        }
        if (gradePoints === null) {
          gradePoints = calcResult.gradePoints != null ? calcResult.gradePoints : null;
        }
      }
    }

    if (!letter) letter = '—';

    // If gradePoints is missing but letter exists, resolve from scale entries
    if (gradePoints === null && letter && letter !== 'W' && letter !== 'I' && letter !== '—' && scale?.entries?.length > 0) {
      const match = scale.entries.find((e) => e.letter.toUpperCase() === letter.toUpperCase());
      if (match) {
        gradePoints = parseFloat(match.gradePoints ?? match.points);
      }
    }

    const countsInGpa = !isWithdrawn && !isSpecialI && !isExcluded && gradePoints !== null;

    let note = null;
    if (isWithdrawn) note = 'Withdrawn';
    else if (isSpecialI) note = 'Incomplete';
    else if (isExcluded) note = 'Excluded from GPA';
    else if (letter === 'F') note = 'Failed';
    else if (g.is_repeat) note = 'Repeated';

    const item = {
      enrollmentId: g.enrollment_id,
      courseId: g.course_id,
      courseCode: g.course_code,
      courseTitle: g.course_title,
      creditHours: parseInt(g.credit_hours, 10) || 0,
      totalScore,
      letter,
      gradePoints,
      countsInGpa,
      isRepeat: Boolean(g.is_repeat),
      specialGrade: isWithdrawn ? 'W' : g.special_grade,
      semesterId: g.semester_id,
      semesterName: g.semester_name,
      term: g.term,
      sortOrder: g.sort_order,
      superseded: false,
      note,
    };

    if (!attemptsByCourse.has(g.course_id)) {
      attemptsByCourse.set(g.course_id, []);
    }
    attemptsByCourse.get(g.course_id).push(item);
    rawList.push(item);
  }

  // Second pass: apply repeat policy ('latest', 'highest', 'all')
  const repeatPolicy = policy.repeatPolicy || 'latest';

  for (const [courseId, attempts] of attemptsByCourse.entries()) {
    if (attempts.length > 1) {
      for (const a of attempts) {
        a.isRepeat = true;
      }

      if (repeatPolicy === 'latest') {
        attempts.sort((a, b) => a.sortOrder - b.sortOrder);
        for (let i = 0; i < attempts.length - 1; i++) {
          attempts[i].superseded = true;
          attempts[i].countsInGpa = false;
          attempts[i].note = 'Repeated (superseded)';
        }
      } else if (repeatPolicy === 'highest') {
        let bestIndex = 0;
        let bestPoints = attempts[0].gradePoints ?? -1;
        let bestScore = attempts[0].totalScore ?? -1;

        for (let i = 1; i < attempts.length; i++) {
          const pts = attempts[i].gradePoints ?? -1;
          const sc = attempts[i].totalScore ?? -1;
          if (pts > bestPoints || (pts === bestPoints && sc > bestScore)) {
            bestIndex = i;
            bestPoints = pts;
            bestScore = sc;
          }
        }

        for (let i = 0; i < attempts.length; i++) {
          if (i !== bestIndex) {
            attempts[i].superseded = true;
            attempts[i].countsInGpa = false;
            attempts[i].note = 'Repeated (superseded)';
          }
        }
      }
    }
  }

  // Third pass: group into semesters and calculate semester totals and cumulative running CGPA
  const semsMap = new Map();
  const semsList = [];

  for (const item of rawList) {
    if (!semsMap.has(item.semesterId)) {
      const semObj = {
        semesterId: item.semesterId,
        name: item.semesterName,
        term: item.term,
        sortOrder: item.sortOrder,
        courses: [],
        gpa: 0,
        cgpa: 0,
        credits: 0,
        qualityPoints: 0,
      };
      semsMap.set(item.semesterId, semObj);
      semsList.push(semObj);
    }
    semsMap.get(item.semesterId).courses.push(item);
  }

  semsList.sort((a, b) => a.sortOrder - b.sortOrder);

  let cumulativeQP = 0;
  let cumulativeGpaCredits = 0;
  let totalAttemptedCredits = 0;
  let totalEarnedCredits = 0;
  const passedCourseIds = new Set();
  const passMark = policy.passMark ?? 50;

  for (const sem of semsList) {
    let semQP = 0;
    let semCredits = 0;

    for (const c of sem.courses) {
      totalAttemptedCredits += c.creditHours;

      // Semester GPA: reflects courses taken in this term
      if (c.gradePoints !== null && c.letter !== 'W' && c.specialGrade !== 'W' && !excludedSet.has(c.courseId)) {
        semQP += c.gradePoints * c.creditHours;
        semCredits += c.creditHours;
      }

      // Cumulative GPA: respects superseded status per repeat policy
      if (c.countsInGpa && !c.superseded && c.gradePoints !== null) {
        cumulativeQP += c.gradePoints * c.creditHours;
        cumulativeGpaCredits += c.creditHours;
      }

      // Earned credits: passing grade not superseded, awarded once per distinct course
      const isPassed =
        c.letter !== 'F' &&
        c.letter !== 'W' &&
        c.specialGrade !== 'W' &&
        c.specialGrade !== 'I' &&
        c.gradePoints !== null &&
        c.gradePoints > 0 &&
        (c.totalScore === null || c.totalScore >= passMark);

      if (isPassed && !c.superseded && !passedCourseIds.has(c.courseId)) {
        totalEarnedCredits += c.creditHours;
        passedCourseIds.add(c.courseId);
      }
    }

    sem.qualityPoints = roundTo2(semQP);
    sem.credits = semCredits;
    sem.gpa = semCredits > 0 ? roundTo2(semQP / semCredits) : 0;
    sem.cgpa = cumulativeGpaCredits > 0 ? roundTo2(cumulativeQP / cumulativeGpaCredits) : 0;
  }

  const finalCgpa = cumulativeGpaCredits > 0 ? roundTo2(cumulativeQP / cumulativeGpaCredits) : 0;
  const standing = cumulativeGpaCredits > 0 ? getAcademicStanding(finalCgpa, policy.honorsGpa, policy.probationGpa) : { label: 'Good Standing', tone: 'default' };

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
      id: student?.id || studentId,
      name: student?.name || 'Student',
      studentNumber: student?.student_number || '—',
      program: student?.program_name || 'Undergraduate Programme',
      department: {
        id: student?.department_id,
        name: student?.department_name || '—',
        code: student?.department_code || '—',
      },
      admissionYear: student?.admission_year || '—',
    },
    generatedAt: new Date().toISOString(),
    semesters: semsList,
    cgpa: finalCgpa,
    earnedCredits: totalEarnedCredits,
    attemptedCredits: totalAttemptedCredits,
    qualityPoints: roundTo2(cumulativeQP),
    gpaCredits: cumulativeGpaCredits,
    standing,
    scale: scale?.entries || [],
    policy: {
      repeatPolicy,
      passMark: policy.passMark,
    },
  };
}

export async function getStudentPerformanceReport(studentId) {
  const transcript = await getStudentTranscriptData(studentId);
  const stuRes = await query(
    `SELECT s.*, (u.first_name || ' ' || u.last_name) as name, u.email,
            d.name as department_name, d.code as department_code, p.name as program_name
     FROM students s
     JOIN users u ON u.id = s.user_id
     LEFT JOIN departments d ON d.id = s.department_id
     LEFT JOIN programs p ON p.id = s.program_id
     WHERE s.id = $1`,
    [studentId]
  );
  const sRow = stuRes.rows[0];

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
    student: {
      id: sRow?.id,
      name: sRow?.name,
      email: sRow?.email,
      studentNumber: sRow?.student_number,
      program: sRow?.program_name || 'Undergraduate Degree',
      admissionYear: sRow?.admission_year,
      department: {
        id: sRow?.department_id,
        name: sRow?.department_name,
        code: sRow?.department_code,
      },
    },
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

export async function getWithdrawalRegistrationReport({ period = 'monthly', startDate, endDate } = {}) {
  let start, end;
  const now = new Date();
  if (period === 'today') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  } else if (period === 'weekly') {
    start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    end = now;
  } else if (period === 'monthly') {
    start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    end = now;
  } else if (period === 'quarterly') {
    start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    end = now;
  } else if (period === 'custom' && startDate) {
    start = new Date(startDate);
    end = endDate ? new Date(endDate) : now;
    end.setHours(23, 59, 59, 999);
  } else {
    start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    end = now;
  }

  // Period-specific Registrations
  const regCountsRes = await query(
    `SELECT
       count(*) as total,
       count(*) FILTER (WHERE status = 'registered') as registered,
       count(*) FILTER (WHERE status = 'pending') as pending,
       count(*) FILTER (WHERE status = 'rejected') as rejected,
       count(*) FILTER (WHERE status = 'cancelled') as cancelled
     FROM semester_registrations
     WHERE submitted_at BETWEEN $1 AND $2`,
    [start, end]
  );

  // Overall Registrations
  const regAllTimeRes = await query(`
    SELECT
      count(*) as total,
      count(*) FILTER (WHERE status = 'registered') as registered,
      count(*) FILTER (WHERE status = 'pending') as pending,
      count(*) FILTER (WHERE status = 'rejected') as rejected
    FROM semester_registrations
  `);

  // Period-specific Withdrawals
  const wdrCountsRes = await query(
    `SELECT
       count(*) as total,
       count(*) FILTER (WHERE status = 'approved') as approved,
       count(*) FILTER (WHERE status = 'pending') as pending,
       count(*) FILTER (WHERE status = 'rejected') as rejected,
       count(*) FILTER (WHERE status = 'cancelled') as cancelled,
       count(*) FILTER (WHERE scope = 'course') as scope_course,
       count(*) FILTER (WHERE scope = 'semester') as scope_semester,
       count(*) FILTER (WHERE scope = 'university') as scope_university
     FROM withdrawal_requests
     WHERE submitted_at BETWEEN $1 AND $2`,
    [start, end]
  );

  // Overall Withdrawals
  const wdrAllTimeRes = await query(`
    SELECT
      count(*) as total,
      count(*) FILTER (WHERE status = 'approved') as approved,
      count(*) FILTER (WHERE status = 'pending') as pending,
      count(*) FILTER (WHERE status = 'rejected') as rejected,
      count(*) FILTER (WHERE scope = 'course') as scope_course,
      count(*) FILTER (WHERE scope = 'semester') as scope_semester,
      count(*) FILTER (WHERE scope = 'university') as scope_university
    FROM withdrawal_requests
  `);

  // Registrations by type
  const regByTypeRes = await query(`
    SELECT COALESCE(rt.label, sr.registration_type_id) as type_name, count(sr.id) as count
    FROM semester_registrations sr
    LEFT JOIN registration_types rt ON rt.id = sr.registration_type_id
    GROUP BY rt.label, sr.registration_type_id
    ORDER BY count DESC
  `);

  // Registrations by department
  const regByDeptRes = await query(`
    SELECT d.name as department, count(sr.id) as count
    FROM semester_registrations sr
    JOIN students s ON s.id = sr.student_id
    JOIN departments d ON d.id = s.department_id
    GROUP BY d.name
    ORDER BY count DESC
    LIMIT 6
  `);

  // Withdrawals by category
  const wdrByCatRes = await query(`
    SELECT COALESCE(rc.label, wr.reason_category_id) as category, count(wr.id) as count
    FROM withdrawal_requests wr
    LEFT JOIN withdrawal_reason_categories rc ON rc.id = wr.reason_category_id
    GROUP BY rc.label, wr.reason_category_id
    ORDER BY count DESC
  `);

  // Recent registrations
  const recentRegRes = await query(`
    SELECT
      sr.id,
      sr.status,
      sr.submitted_at,
      s.student_number,
      u.first_name || ' ' || u.last_name as student_name,
      d.name as department_name,
      COALESCE(rt.label, sr.registration_type_id) as registration_type
    FROM semester_registrations sr
    JOIN students s ON s.id = sr.student_id
    JOIN users u ON u.id = s.user_id
    LEFT JOIN departments d ON d.id = s.department_id
    LEFT JOIN registration_types rt ON rt.id = sr.registration_type_id
    ORDER BY sr.submitted_at DESC
    LIMIT 10
  `);

  // Recent withdrawals
  const recentWdrRes = await query(`
    SELECT
      wr.id,
      wr.reference_no,
      wr.scope,
      wr.reason,
      wr.status,
      wr.submitted_at,
      s.student_number,
      u.first_name || ' ' || u.last_name as student_name,
      d.name as department_name,
      COALESCE(rc.label, wr.reason_category_id) as reason_category
    FROM withdrawal_requests wr
    JOIN students s ON s.id = wr.student_id
    JOIN users u ON u.id = s.user_id
    LEFT JOIN departments d ON d.id = s.department_id
    LEFT JOIN withdrawal_reason_categories rc ON rc.id = wr.reason_category_id
    ORDER BY wr.submitted_at DESC
    LIMIT 10
  `);

  // Time-series trend by date
  const regTrendRes = await query(
    `SELECT TO_CHAR(submitted_at, 'YYYY-MM-DD') as day, count(*) as count
     FROM semester_registrations
     WHERE submitted_at BETWEEN $1 AND $2
     GROUP BY TO_CHAR(submitted_at, 'YYYY-MM-DD')
     ORDER BY day ASC`,
    [start, end]
  );

  const wdrTrendRes = await query(
    `SELECT TO_CHAR(submitted_at, 'YYYY-MM-DD') as day, count(*) as count
     FROM withdrawal_requests
     WHERE submitted_at BETWEEN $1 AND $2
     GROUP BY TO_CHAR(submitted_at, 'YYYY-MM-DD')
     ORDER BY day ASC`,
    [start, end]
  );

  // Also all-time trends for comprehensive overview
  const allTimeRegTrendRes = await query(`
    SELECT TO_CHAR(submitted_at, 'YYYY-MM-DD') as day, count(*) as count
    FROM semester_registrations
    GROUP BY TO_CHAR(submitted_at, 'YYYY-MM-DD')
    ORDER BY day ASC
  `);

  const allTimeWdrTrendRes = await query(`
    SELECT TO_CHAR(submitted_at, 'YYYY-MM-DD') as day, count(*) as count
    FROM withdrawal_requests
    GROUP BY TO_CHAR(submitted_at, 'YYYY-MM-DD')
    ORDER BY day ASC
  `);

  // Merge trends by date
  const dateMap = new Map();
  // Use period trends if available, otherwise fallback to all-time trends so charts are never empty
  const regTrend = regTrendRes.rows.length > 0 ? regTrendRes.rows : allTimeRegTrendRes.rows;
  const wdrTrend = wdrTrendRes.rows.length > 0 ? wdrTrendRes.rows : allTimeWdrTrendRes.rows;

  for (const r of regTrend) {
    if (!dateMap.has(r.day)) {
      dateMap.set(r.day, { date: r.day, registrations: 0, withdrawals: 0 });
    }
    dateMap.get(r.day).registrations = parseInt(r.count, 10);
  }

  for (const w of wdrTrend) {
    if (!dateMap.has(w.day)) {
      dateMap.set(w.day, { date: w.day, registrations: 0, withdrawals: 0 });
    }
    dateMap.get(w.day).withdrawals = parseInt(w.count, 10);
  }

  const trend = Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  const rc = regCountsRes.rows[0];
  const ra = regAllTimeRes.rows[0];
  const wc = wdrCountsRes.rows[0];
  const wa = wdrAllTimeRes.rows[0];

  return {
    period,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    registrations: {
      period: {
        total: parseInt(rc.total || '0', 10),
        registered: parseInt(rc.registered || '0', 10),
        pending: parseInt(rc.pending || '0', 10),
        rejected: parseInt(rc.rejected || '0', 10),
        cancelled: parseInt(rc.cancelled || '0', 10),
      },
      allTime: {
        total: parseInt(ra.total || '0', 10),
        registered: parseInt(ra.registered || '0', 10),
        pending: parseInt(ra.pending || '0', 10),
        rejected: parseInt(ra.rejected || '0', 10),
      },
      byType: regByTypeRes.rows.map((r) => ({ name: r.type_name, count: parseInt(r.count, 10) })),
      byDepartment: regByDeptRes.rows.map((r) => ({ department: r.department, count: parseInt(r.count, 10) })),
      recent: recentRegRes.rows.map((r) => ({
        id: r.id,
        status: r.status,
        submittedAt: r.submitted_at,
        studentNumber: r.student_number,
        studentName: r.student_name,
        departmentName: r.department_name,
        registrationType: r.registration_type,
      })),
    },
    withdrawals: {
      period: {
        total: parseInt(wc.total || '0', 10),
        approved: parseInt(wc.approved || '0', 10),
        pending: parseInt(wc.pending || '0', 10),
        rejected: parseInt(wc.rejected || '0', 10),
        cancelled: parseInt(wc.cancelled || '0', 10),
        byScope: {
          course: parseInt(wc.scope_course || '0', 10),
          semester: parseInt(wc.scope_semester || '0', 10),
          university: parseInt(wc.scope_university || '0', 10),
        },
      },
      allTime: {
        total: parseInt(wa.total || '0', 10),
        approved: parseInt(wa.approved || '0', 10),
        pending: parseInt(wa.pending || '0', 10),
        rejected: parseInt(wa.rejected || '0', 10),
        byScope: {
          course: parseInt(wa.scope_course || '0', 10),
          semester: parseInt(wa.scope_semester || '0', 10),
          university: parseInt(wa.scope_university || '0', 10),
        },
      },
      byCategory: wdrByCatRes.rows.map((r) => ({ category: r.category, count: parseInt(r.count, 10) })),
      recent: recentWdrRes.rows.map((r) => ({
        id: r.id,
        referenceNo: r.reference_no,
        scope: r.scope,
        reason: r.reason,
        status: r.status,
        submittedAt: r.submitted_at,
        studentNumber: r.student_number,
        studentName: r.student_name,
        departmentName: r.department_name,
        reasonCategory: r.reason_category,
      })),
    },
    trend,
  };
}
