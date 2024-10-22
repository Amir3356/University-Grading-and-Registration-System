import { query } from '../config/database.js';
import { getCurrentSemester } from './calendarRepository.js';
import { getAcademicPolicy, getActiveGradeScale } from './gradebookRepository.js';
import { computeEnrollmentScore, getAcademicStanding, computeGpa, roundTo2 } from '../utils/gpaCalculator.js';
import { getOfferingById } from './offeringRepository.js';

// ----------------- Teacher Workspace -----------------

export async function getTeacherDashboard(teacherId, userId) {
  const currentSemester = await getCurrentSemester();
  const currentSemId = currentSemester?.id;

  // Stats
  const coursesRes = await query(
    `SELECT count(DISTINCT id) as count FROM course_offerings WHERE teacher_id = $1 AND semester_id = $2`,
    [teacherId, currentSemId]
  );
  const studentsRes = await query(
    `SELECT count(DISTINCT ce.student_id) as count
     FROM course_enrollments ce
     JOIN course_offerings co ON co.id = ce.offering_id
     WHERE co.teacher_id = $1 AND co.semester_id = $2 AND ce.status != 'withdrawn'`,
    [teacherId, currentSemId]
  );
  const pendingSubRes = await query(
    `SELECT count(*) as count FROM course_offerings
     WHERE teacher_id = $1 AND semester_id = $2 AND grade_status IN ('not_started', 'draft', 'rejected')`,
    [teacherId, currentSemId]
  );
  const awaitingApprovalRes = await query(
    `SELECT count(*) as count FROM course_offerings
     WHERE teacher_id = $1 AND semester_id = $2 AND grade_status = 'submitted'`,
    [teacherId, currentSemId]
  );

  // Current Offerings (active semester)
  const { listOfferings } = await import('./offeringRepository.js');
  const currentOfferingsRes = await listOfferings({ teacherId, semesterId: currentSemId, pageSize: 'all' });

  // Pending offerings (grades needing action)
  const pendingOfferings = currentOfferingsRes.items.filter((o) =>
    ['not_started', 'draft', 'rejected'].includes(o.grade_status)
  );

  // Course performance
  const coursePerformance = [];
  for (const off of currentOfferingsRes.items) {
    const avgRes = await query(
      `SELECT AVG(scr.marks / a.max_marks * a.weight) as avg_score
       FROM assessment_scores scr
       JOIN assessments a ON a.id = scr.assessment_id
       JOIN course_enrollments ce ON ce.id = scr.enrollment_id
       WHERE a.offering_id = $1 AND ce.status != 'withdrawn'`,
      [off.id]
    );
    coursePerformance.push({
      offeringId: off.id,
      code: off.course.code,
      title: off.course.title,
      average: avgRes.rows[0]?.avg_score ? roundTo2(avgRes.rows[0].avg_score) : 0,
      students: off.enrolledCount,
      missingMarks: off.missingMarks,
    });
  }

  // Distribution
  const scale = await getActiveGradeScale();
  const distRes = await query(
    `SELECT fg.letter, count(fg.id) as count
     FROM final_grades fg
     JOIN course_enrollments ce ON ce.id = fg.enrollment_id
     JOIN course_offerings co ON co.id = ce.offering_id
     WHERE co.teacher_id = $1 AND co.semester_id = $2 AND fg.status = 'published'
     GROUP BY fg.letter`,
    [teacherId, currentSemId]
  );
  const distMap = {};
  for (const d of distRes.rows) distMap[d.letter] = parseInt(d.count, 10);
  const distribution = scale.entries.map((e) => ({
    letter: e.letter,
    count: distMap[e.letter] || 0,
  }));

  // Recent activity (audit logs removed)
  const recentActivity = [];

  // Upcoming assessments
  const upRes = await query(
    `SELECT a.id, a.name, a.type, a.max_marks, a.weight, a.due_date,
            c.code as course_code
     FROM assessments a
     JOIN course_offerings co ON co.id = a.offering_id
     JOIN courses c ON c.id = co.course_id
     WHERE co.teacher_id = $1 AND co.semester_id = $2 AND a.due_date >= CURRENT_DATE
     ORDER BY a.due_date ASC
     LIMIT 5`,
    [teacherId, currentSemId]
  );

  return {
    currentSemester,
    stats: {
      courses: parseInt(coursesRes.rows[0]?.count || '0', 10),
      students: parseInt(studentsRes.rows[0]?.count || '0', 10),
      pendingSubmissions: parseInt(pendingSubRes.rows[0]?.count || '0', 10),
      awaitingApproval: parseInt(awaitingApprovalRes.rows[0]?.count || '0', 10),
    },
    currentOfferings: currentOfferingsRes.items,
    pendingOfferings,
    coursePerformance,
    distribution,
    distributionSemester: currentSemester?.name || 'Current Semester',
    recentActivity,
    upcoming: upRes.rows.map((r) => ({
      ...r,
      maxMarks: parseFloat(r.max_marks),
      weight: parseFloat(r.weight),
    })),
  };
}

export async function getTeacherOfferingDetail(offeringId) {
  const offering = await getOfferingById(offeringId);
  if (!offering) return null;

  const { getGradebookData } = await import('./gradebookRepository.js');
  const gradebook = await getGradebookData(offeringId);

  const students = gradebook.rows.map((r) => ({
    enrollment: r.enrollment,
    student: r.student,
    runningPercent: r.runningPercent,
    total: r.total,
    complete: r.complete,
    letter: r.letter,
  }));

  return {
    offering,
    assessments: gradebook.assessments,
    students,
  };
}

export async function listTeacherStudents(teacherId, { semesterId, offeringId, search, page = 1, pageSize = 10 } = {}) {
  const conditions = [`co.teacher_id = $1`];
  const params = [teacherId];

  if (semesterId) {
    params.push(semesterId);
    conditions.push(`co.semester_id = $${params.length}`);
  }

  if (offeringId) {
    params.push(offeringId);
    conditions.push(`co.id = $${params.length}`);
  }

  if (search) {
    params.push(`%${search.trim()}%`);
    conditions.push(`(
      u.first_name ILIKE $${params.length}
      OR u.last_name ILIKE $${params.length}
      OR s.student_number ILIKE $${params.length}
      OR c.code ILIKE $${params.length}
    )`);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const countQuery = `
    SELECT count(*) as total
    FROM course_enrollments ce
    JOIN course_offerings co ON co.id = ce.offering_id
    JOIN courses c ON c.id = co.course_id
    JOIN students s ON s.id = ce.student_id
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

  const sql = `
    SELECT ce.id as enrollment_id, co.id as offering_id,
           c.code as course_code, c.title as course_title,
           sem.name as semester_name,
           s.id as student_id, s.student_number,
           (u.first_name || ' ' || u.last_name) as name,
           u.email,
           d.name as department,
           s.year_of_study,
           ce.status,
           ce.is_repeat,
           fg.letter as final_letter,
           fg.total_score as final_total
    FROM course_enrollments ce
    JOIN course_offerings co ON co.id = ce.offering_id
    JOIN courses c ON c.id = co.course_id
    JOIN semesters sem ON sem.id = co.semester_id
    JOIN students s ON s.id = ce.student_id
    JOIN users u ON u.id = s.user_id
    JOIN departments d ON d.id = s.department_id
    LEFT JOIN final_grades fg ON fg.enrollment_id = ce.id
    ${whereClause}
    ORDER BY c.code ASC, s.student_number ASC
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `;

  const res = await query(sql, params);
  return { items: res.rows, total };
}

// ----------------- Student Workspace -----------------

export async function getStudentDashboard(studentId, userId) {
  const currentSemester = await getCurrentSemester();
  const currentSemId = currentSemester?.id;

  // Student profile
  const stuRes = await query(
    `SELECT s.*, (u.first_name || ' ' || u.last_name) as name, u.email,
            d.name as department_name, d.code as department_code,
            p.name as program_name, p.required_credits
     FROM students s
     JOIN users u ON u.id = s.user_id
     JOIN departments d ON d.id = s.department_id
     JOIN programs p ON p.id = s.program_id
     WHERE s.id = $1`,
    [studentId]
  );
  const student = stuRes.rows[0];

  // Current enrolled courses
  const { listStudentCourses } = await import('./workspaceRepository.js');
  const currentCourses = currentSemId ? await listStudentCourses(studentId, { semesterId: currentSemId }) : [];

  // Calculate Cumulative GPA across published grades
  const { getStudentTranscriptData } = await import('./reportRepository.js');
  const transcriptData = await getStudentTranscriptData(studentId);

  const policy = await getAcademicPolicy();
  const standing = getAcademicStanding(transcriptData.cgpa, policy.honorsGpa, policy.probationGpa);

  // Released marks in recent assessments
  const marksRes = await query(
    `SELECT a.id as assessment_id, a.name as assessment_name, a.max_marks, a.weight,
            c.code as course_code, c.title as course_title,
            scr.marks,
            scr.updated_at
     FROM assessment_scores scr
     JOIN assessments a ON a.id = scr.assessment_id
     JOIN course_enrollments ce ON ce.id = scr.enrollment_id
     JOIN course_offerings co ON co.id = a.offering_id
     JOIN courses c ON c.id = co.course_id
     WHERE ce.student_id = $1 AND (a.is_released = true OR co.grade_status = 'published')
     ORDER BY scr.updated_at DESC
     LIMIT 5`,
    [studentId]
  );

  const publishedCountRes = await query(
    `SELECT count(fg.id) as count
     FROM final_grades fg
     JOIN course_enrollments ce ON ce.id = fg.enrollment_id
     WHERE ce.student_id = $1 AND fg.status = 'published'`,
    [studentId]
  );

  return {
    student,
    currentSemester,
    currentCourses,
    gpa: transcriptData.semesters[transcriptData.semesters.length - 1]?.gpa || 0,
    gpaSemester: transcriptData.semesters[transcriptData.semesters.length - 1]?.name || null,
    cgpa: transcriptData.cgpa,
    earnedCredits: transcriptData.earnedCredits,
    standing,
    trend: transcriptData.semesters.map((s) => ({
      semester: s.name,
      term: s.term,
      gpa: s.gpa,
      cgpa: s.cgpa,
      credits: s.credits,
    })),
    recentResults: transcriptData.semesters[transcriptData.semesters.length - 1]?.courses || [],
    releasedMarks: marksRes.rows.map((r) => ({
      ...r,
      marks: parseFloat(r.marks),
      maxMarks: parseFloat(r.max_marks),
      weight: parseFloat(r.weight),
    })),
    publishedCount: parseInt(publishedCountRes.rows[0]?.count || '0', 10),
  };
}

export async function listStudentCourses(studentId, { academicYearId, semesterId, term } = {}) {
  const conditions = [`ce.student_id = $1`];
  const params = [studentId];

  if (academicYearId) {
    params.push(academicYearId);
    conditions.push(`s.academic_year_id = $${params.length}`);
  }

  if (semesterId) {
    params.push(semesterId);
    conditions.push(`co.semester_id = $${params.length}`);
  }

  if (term) {
    params.push(term);
    conditions.push(`s.term = $${params.length}`);
  }

  const sql = `
    SELECT ce.id as enrollment_id, co.id as offering_id, ce.status, ce.is_repeat,
           co.section, co.room, co.schedule, co.grade_status as offering_grade_status,
           c.id as course_id, c.code as course_code, c.title as course_title, c.credit_hours, c.level,
           s.id as semester_id, s.name as semester_name, s.term as semester_term, s.is_current as semester_is_current,
           ay.id as academic_year_id, ay.name as academic_year_name,
           t.id as teacher_id, t.office_room as teacher_office_room,
           (t.title || ' ' || u.first_name || ' ' || u.last_name) as teacher_name,
           u.email as teacher_email,
           COALESCE(SUM(a.weight), 0) as weight_total,
           fg.id as final_grade_id, fg.total_score, fg.letter as final_letter,
           fg.grade_points, fg.special_grade, fg.status as final_grade_status,
           fg.published_at,
           (
             SELECT json_build_object('id', wr.id, 'referenceNo', wr.reference_no, 'status', wr.status)
             FROM withdrawal_requests wr
             WHERE wr.enrollment_id = ce.id AND wr.status = 'pending'
             LIMIT 1
           ) as pending_withdrawal
    FROM course_enrollments ce
    JOIN course_offerings co ON co.id = ce.offering_id
    JOIN courses c ON c.id = co.course_id
    JOIN semesters s ON s.id = co.semester_id
    JOIN academic_years ay ON ay.id = s.academic_year_id
    JOIN teachers t ON t.id = co.teacher_id
    JOIN users u ON u.id = t.user_id
    LEFT JOIN assessments a ON a.offering_id = co.id
    LEFT JOIN final_grades fg ON fg.enrollment_id = ce.id
    WHERE ${conditions.join(' AND ')}
    GROUP BY ce.id, co.id, c.id, s.id, ay.id, t.id, u.id, fg.id
    ORDER BY s.sort_order DESC, c.code ASC
  `;

  const res = await query(sql, params);
  const policy = await getAcademicPolicy();

  return res.rows.map((r) => {
    let resultStatus = 'in_progress';
    if (r.final_grade_status === 'published') {
      resultStatus = 'published';
    } else if (r.status === 'withdrawn') {
      resultStatus = 'withdrawn';
    } else if (!r.semester_is_current) {
      resultStatus = 'pending';
    }

    const isPublished = r.final_grade_status === 'published';
    const finalGrade = isPublished
      ? {
          totalScore: r.total_score !== null ? parseFloat(r.total_score) : null,
          letter: r.final_letter,
          gradePoints: r.grade_points !== null ? parseFloat(r.grade_points) : null,
          special: r.special_grade,
          publishedAt: r.published_at,
          passed: r.total_score !== null ? parseFloat(r.total_score) >= policy.passMark : false,
        }
      : null;

    return {
      enrollmentId: r.enrollment_id,
      offeringId: r.offering_id,
      status: r.status,
      isRepeat: r.is_repeat,
      course: {
        id: r.course_id,
        code: r.course_code,
        title: r.course_title,
        creditHours: r.credit_hours,
        level: r.level,
      },
      semester: {
        id: r.semester_id,
        name: r.semester_name,
        term: r.semester_term,
        isCurrent: r.semester_is_current,
        academicYear: {
          id: r.academic_year_id,
          name: r.academic_year_name,
        },
      },
      teacher: {
        id: r.teacher_id,
        name: r.teacher_name,
        email: r.teacher_email,
        officeRoom: r.teacher_office_room,
      },
      section: r.section,
      room: r.room,
      schedule: r.schedule,
      weightTotal: parseFloat(r.weight_total || '0'),
      resultStatus,
      finalGrade,
      pendingWithdrawal: r.pending_withdrawal || null,
    };
  });
}

export async function getStudentCourseDetail(studentId, enrollmentId) {
  const courses = await listStudentCourses(studentId);
  const courseRow = courses.find((c) => c.enrollmentId === enrollmentId);
  if (!courseRow) return null;

  // Assessments and marks
  const asmRes = await query(
    `SELECT a.id, a.name, a.type, a.max_marks, a.weight, a.due_date, a.is_released,
            scr.marks
     FROM assessments a
     LEFT JOIN assessment_scores scr ON scr.assessment_id = a.id AND scr.enrollment_id = $1
     WHERE a.offering_id = $2
     ORDER BY a.due_date ASC`,
    [enrollmentId, courseRow.offeringId]
  );

  let earnedWeighted = 0;
  let enteredWeightSum = 0;

  const assessments = asmRes.rows.map((a) => {
    const isVisible = a.is_released || courseRow.resultStatus === 'published';
    const marks = isVisible && a.marks !== null ? parseFloat(a.marks) : null;
    const maxMarks = parseFloat(a.max_marks);
    const weight = parseFloat(a.weight);

    if (marks !== null && maxMarks > 0) {
      earnedWeighted += (marks / maxMarks) * weight;
      enteredWeightSum += weight;
    }

    return {
      id: a.id,
      name: a.name,
      type: a.type,
      maxMarks,
      weight,
      dueDate: a.due_date,
      isReleased: a.is_released,
      marks,
    };
  });

  const runningPercent = enteredWeightSum > 0 ? roundTo2((earnedWeighted / enteredWeightSum) * 100) : 0;

  return {
    ...courseRow,
    assessments,
    runningPercent,
    earnedWeighted: roundTo2(earnedWeighted),
  };
}

export async function listStudentAssessments(studentId, { semesterId, offeringId, status } = {}) {
  const conditions = [`ce.student_id = $1`];
  const params = [studentId];

  if (semesterId) {
    params.push(semesterId);
    conditions.push(`co.semester_id = $${params.length}`);
  }

  if (offeringId) {
    params.push(offeringId);
    conditions.push(`co.id = $${params.length}`);
  }

  const sql = `
    SELECT a.id, a.name, a.type, a.max_marks, a.weight, a.due_date, a.is_released,
           c.code as course_code, c.title as course_title,
           co.id as offering_id, co.grade_status as offering_grade_status,
           scr.marks
    FROM assessments a
    JOIN course_offerings co ON co.id = a.offering_id
    JOIN courses c ON c.id = co.course_id
    JOIN course_enrollments ce ON ce.offering_id = co.id
    LEFT JOIN assessment_scores scr ON scr.assessment_id = a.id AND scr.enrollment_id = ce.id
    WHERE ${conditions.join(' AND ')}
    ORDER BY a.due_date ASC
  `;

  const res = await query(sql, params);

  const mapped = res.rows.map((r) => {
    const isGraded = r.marks !== null && (r.is_released || r.offering_grade_status === 'published');
    const marks = isGraded ? parseFloat(r.marks) : null;
    const maxMarks = parseFloat(r.max_marks);
    const percent = marks !== null && maxMarks > 0 ? roundTo2((marks / maxMarks) * 100) : null;

    let itemStatus = 'upcoming';
    if (marks !== null) {
      itemStatus = 'graded';
    } else if (new Date(r.due_date) < new Date()) {
      itemStatus = 'pending';
    }

    return {
      id: r.id,
      name: r.name,
      type: r.type,
      maxMarks,
      weight: parseFloat(r.weight),
      dueDate: r.due_date,
      courseCode: r.course_code,
      courseTitle: r.course_title,
      offeringId: r.offering_id,
      marks,
      percent,
      status: itemStatus,
    };
  });

  if (status) {
    return mapped.filter((m) => m.status === status);
  }
  return mapped;
}

export async function getStudentGrades(studentId, { academicYearId, semesterId, offeringId } = {}) {
  const { getStudentTranscriptData } = await import('./reportRepository.js');
  const transcriptData = await getStudentTranscriptData(studentId);
  const policy = await getAcademicPolicy();

  let semesters = transcriptData.semesters;
  if (semesterId) {
    semesters = semesters.filter((s) => s.semesterId === semesterId);
  }

  return {
    semesters,
    cgpa: transcriptData.cgpa,
    earnedCredits: transcriptData.earnedCredits,
    passMark: policy.passMark,
  };
}

export async function getStudentProgress(studentId) {
  const stuRes = await query(
    `SELECT s.*, p.name as program_name, p.required_credits, p.duration_years,
            d.name as department_name
     FROM students s
     JOIN programs p ON p.id = s.program_id
     JOIN departments d ON d.id = s.department_id
     WHERE s.id = $1`,
    [studentId]
  );
  const student = stuRes.rows[0];
  if (!student) return null;

  const { getStudentTranscriptData } = await import('./reportRepository.js');
  const transcript = await getStudentTranscriptData(studentId);
  const policy = await getAcademicPolicy();

  // Completed courses
  const completed = [];
  const passedCourseIds = new Set();
  for (const sem of transcript.semesters) {
    for (const c of sem.courses) {
      if (c.gradePoints !== null && c.letter !== 'F' && c.letter !== 'W') {
        completed.push(c);
        passedCourseIds.add(c.courseId);
      }
    }
  }

  // Failed courses
  const failedMap = {};
  for (const sem of transcript.semesters) {
    for (const c of sem.courses) {
      if (c.letter === 'F' && !passedCourseIds.has(c.courseId)) {
        if (!failedMap[c.courseId]) {
          failedMap[c.courseId] = { course: c, attempts: [] };
        }
        failedMap[c.courseId].attempts.push(sem.name);
      }
    }
  }
  const failed = Object.values(failedMap);

  // In-progress courses (active semester)
  const currentSemester = await getCurrentSemester();
  const currentCourses = currentSemester ? await listStudentCourses(studentId, { semesterId: currentSemester.id }) : [];
  const inProgress = currentCourses.filter((c) => c.resultStatus === 'in_progress');

  // Curriculum remaining courses
  const curRes = await query(
    `SELECT pc.*, c.id as course_id, c.code as course_code, c.title as course_title, c.credit_hours, c.level
     FROM program_courses pc
     JOIN courses c ON c.id = pc.course_id
     WHERE pc.program_id = $1
     ORDER BY pc.year_of_study ASC, pc.term ASC, c.code ASC`,
    [student.program_id]
  );

  const inProgressCourseIds = new Set(inProgress.map((c) => c.course.id));
  const remaining = curRes.rows.filter(
    (cur) => !passedCourseIds.has(cur.course_id) && !inProgressCourseIds.has(cur.course_id)
  );

  const standing = getAcademicStanding(transcript.cgpa, policy.honorsGpa, policy.probationGpa);

  return {
    student,
    cgpa: transcript.cgpa,
    earnedCredits: transcript.earnedCredits,
    attemptedCredits: transcript.attemptedCredits,
    requiredCredits: student.required_credits,
    gpaCredits: transcript.gpaCredits,
    qualityPoints: transcript.qualityPoints,
    standing,
    policy,
    semesters: transcript.semesters,
    completed,
    failed,
    inProgress,
    remaining: remaining.map((r) => ({
      courseId: r.course_id,
      courseCode: r.course_code,
      courseTitle: r.course_title,
      creditHours: r.credit_hours,
      level: r.level,
      yearOfStudy: r.year_of_study,
      term: r.term,
      isRequired: r.is_required,
    })),
  };
}
