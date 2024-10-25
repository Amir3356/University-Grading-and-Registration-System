import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import { pool, withTransaction } from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, './data');


function readJson(filename) {
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) {
    console.warn(`File not found: ${filePath}`);
    return [];
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

export async function seedDatabase() {
  console.log('--- Starting database seeding ---');

  // Common password hash for 'Password123!'
  const defaultPasswordHash = await bcrypt.hash('Password123!', 10);

  await withTransaction(async (client) => {
    // 1. Roles & Permissions
    console.log('Seeding roles and permissions...');
    const rolesData = readJson('roles.json');
    for (const r of rolesData) {
      await client.query(
        `INSERT INTO roles (id, name, description) VALUES ($1, $2, $3)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description`,
        [r.id, r.name, r.description || null]
      );
      if (Array.isArray(r.permissions)) {
        for (const p of r.permissions) {
          await client.query(
            `INSERT INTO role_permissions (role_id, permission) VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [r.id, p]
          );
        }
      }
    }

    // 2. Users (Admin credentials only)
    console.log('Seeding users (admin only)...');
    const usersData = readJson('users.json').filter((u) => u.roleId === 'admin');
    for (const u of usersData) {
      const passwordHash = u.password
        ? await bcrypt.hash(u.password, 10)
        : defaultPasswordHash;

      await client.query(
        `INSERT INTO users (
           id, role_id, username, first_name, last_name, email, phone,
           password_hash, must_change_password, status, is_seed, last_login_at, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, $11, $12, $13)
         ON CONFLICT (id) DO UPDATE SET
           role_id = EXCLUDED.role_id,
           username = EXCLUDED.username,
           first_name = EXCLUDED.first_name,
           last_name = EXCLUDED.last_name,
           email = EXCLUDED.email,
           phone = EXCLUDED.phone,
           password_hash = EXCLUDED.password_hash,
           is_seed = true,
           status = EXCLUDED.status`,
        [
          u.id,
          u.roleId,
          u.username,
          u.firstName,
          u.lastName,
          u.email,
          u.phone || null,
          passwordHash,
          u.mustChangePassword ?? false,
          u.status || 'active',
          u.lastLoginAt || null,
          u.createdAt || new Date(),
          u.updatedAt || new Date(),
        ]
      );
    }

    // 3. Departments
    console.log('Seeding departments...');
    const departmentsData = readJson('departments.json');
    for (const d of departmentsData) {
      await client.query(
        `INSERT INTO departments (id, code, name, description, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET
           code = EXCLUDED.code,
           name = EXCLUDED.name,
           description = EXCLUDED.description`,
        [d.id, d.code, d.name, d.description || null, d.createdAt || new Date(), d.updatedAt || new Date()]
      );
    }

    // 4. Programs
    console.log('Seeding programs...');
    const programs = [
      { id: 'prg_bsc_cs', departmentId: 'dep_cs', code: 'BSC-CS', name: 'BSc Computer Science', duration: 4, credits: 140 },
      { id: 'prg_bsc_math', departmentId: 'dep_math', code: 'BSC-MATH', name: 'BSc Mathematics', duration: 4, credits: 136 },
      { id: 'prg_bba_bus', departmentId: 'dep_bus', code: 'BBA-BUS', name: 'BBA Business Administration', duration: 4, credits: 132 },
      { id: 'prg_bsc_ee', departmentId: 'dep_ee', code: 'BSC-EE', name: 'BSc Electrical Engineering', duration: 4, credits: 148 },
      { id: 'prg_bsc_bio', departmentId: 'dep_bio', code: 'BSC-BIO', name: 'BSc Biology', duration: 4, credits: 136 },
    ];
    for (const p of programs) {
      await client.query(
        `INSERT INTO programs (id, department_id, code, name, duration_years, required_credits, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'active')
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           required_credits = EXCLUDED.required_credits`,
        [p.id, p.departmentId, p.code, p.name, p.duration, p.credits]
      );
    }

    // 5. Teachers
    console.log('Seeding teachers...');
    const teachersData = readJson('teachers.json');
    for (const t of teachersData) {
      await client.query(
        `INSERT INTO teachers (
           id, user_id, employee_number, department_id, title, specialization, office_room, hire_date, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO UPDATE SET
           department_id = EXCLUDED.department_id,
           title = EXCLUDED.title,
           specialization = EXCLUDED.specialization,
           office_room = EXCLUDED.office_room`,
        [
          t.id,
          t.userId,
          t.employeeNumber,
          t.departmentId,
          t.title || 'Dr.',
          t.specialization || null,
          t.officeRoom || null,
          t.hireDate || '2020-01-01',
          t.createdAt || new Date(),
          t.updatedAt || new Date(),
        ]
      );
    }

    // Update department head teachers if teachers exist
    for (const d of departmentsData) {
      if (d.headTeacherId) {
        const teacherExists = await client.query(`SELECT 1 FROM teachers WHERE id = $1`, [d.headTeacherId]);
        if (teacherExists.rows.length > 0) {
          await client.query(`UPDATE departments SET head_teacher_id = $1 WHERE id = $2`, [d.headTeacherId, d.id]);
        }
      }
    }

    // 6. Students
    console.log('Seeding students...');
    const studentsData = readJson('students.json');
    const programMap = {
      'BSc Computer Science': 'prg_bsc_cs',
      'BSc Mathematics': 'prg_bsc_math',
      'BBA Business Administration': 'prg_bba_bus',
      'BSc Electrical Engineering': 'prg_bsc_ee',
      'BSc Biology': 'prg_bsc_bio',
    };

    for (const s of studentsData) {
      const progId = programMap[s.program] || 'prg_bsc_cs';
      const yearOfStudy = Math.min(4, Math.max(1, 2026 - Number(s.admissionYear || 2024) + 1));
      await client.query(
        `INSERT INTO students (
           id, user_id, student_number, department_id, program_id, program_type,
           admission_year, year_of_study, date_of_birth, academic_status, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now(), now())
         ON CONFLICT (id) DO UPDATE SET
           department_id = EXCLUDED.department_id,
           program_id = EXCLUDED.program_id,
           year_of_study = EXCLUDED.year_of_study,
           academic_status = EXCLUDED.academic_status`,
        [
          s.id,
          s.userId,
          s.studentNumber,
          s.departmentId,
          progId,
          'regular',
          s.admissionYear || 2024,
          yearOfStudy,
          s.dateOfBirth || null,
          s.status || 'active',
        ]
      );
    }

    // 7. Courses
    console.log('Seeding courses...');
    const coursesData = readJson('courses.json');
    for (const c of coursesData) {
      await client.query(
        `INSERT INTO courses (
           id, code, title, department_id, credit_hours, level, description, status, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO UPDATE SET
           code = EXCLUDED.code,
           title = EXCLUDED.title,
           credit_hours = EXCLUDED.credit_hours,
           level = EXCLUDED.level,
           description = EXCLUDED.description,
           status = EXCLUDED.status`,
        [
          c.id,
          c.code,
          c.title,
          c.departmentId,
          c.creditHours || 3,
          c.level || 100,
          c.description || null,
          c.status || 'active',
          c.createdAt || new Date(),
          c.updatedAt || new Date(),
        ]
      );
    }

    // Program Courses curriculum
    for (const c of coursesData) {
      const prog = programs.find((p) => p.departmentId === c.departmentId);
      if (prog) {
        await client.query(
          `INSERT INTO program_courses (program_id, course_id, year_of_study, term, is_required)
           VALUES ($1, $2, $3, 'first', true)
           ON CONFLICT DO NOTHING`,
          [prog.id, c.id, Math.floor((c.level || 100) / 100)]
        );
      }
    }

    // 8. Academic Calendar
    console.log('Seeding calendar...');
    const yearsData = readJson('academicYears.json');
    for (const y of yearsData) {
      await client.query(
        `INSERT INTO academic_years (id, name, start_date, end_date, is_current)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           start_date = EXCLUDED.start_date,
           end_date = EXCLUDED.end_date,
           is_current = EXCLUDED.is_current`,
        [y.id, y.name, y.startDate, y.endDate, y.isCurrent || false]
      );
    }

    const termMap = { Fall: 'first', Spring: 'second', Summer: 'summer' };
    const semestersData = readJson('semesters.json');
    for (const sem of semestersData) {
      const term = termMap[sem.term] || 'first';
      const deadline = sem.gradeSubmissionDeadline || sem.endDate;
      await client.query(
        `INSERT INTO semesters (
           id, academic_year_id, term, name, sort_order, start_date, end_date,
           grade_submission_deadline, withdrawal_deadline, is_current, status, created_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           term = EXCLUDED.term,
           sort_order = EXCLUDED.sort_order,
           start_date = EXCLUDED.start_date,
           end_date = EXCLUDED.end_date,
           grade_submission_deadline = EXCLUDED.grade_submission_deadline,
           withdrawal_deadline = EXCLUDED.withdrawal_deadline,
           is_current = EXCLUDED.is_current,
           status = EXCLUDED.status`,
        [
          sem.id,
          sem.academicYearId,
          term,
          sem.name,
          sem.order,
          sem.startDate,
          sem.endDate,
          deadline,
          sem.withdrawalDeadline || sem.endDate,
          sem.isCurrent || false,
          sem.status,
          sem.createdAt || new Date(),
        ]
      );
    }

    // 9. Registration Types & Periods
    console.log('Seeding registration types & periods...');
    const regTypes = [
      { id: 'regular', label: 'Regular', description: 'Regular program registration' },
      { id: 'extension', label: 'Extension', description: 'Evening extension program registration' },
      { id: 'weekend', label: 'Weekend', description: 'Weekend program registration' },
    ];
    for (const rt of regTypes) {
      await client.query(
        `INSERT INTO registration_types (id, label, description, is_active)
         VALUES ($1, $2, $3, true)
         ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, description = EXCLUDED.description`,
        [rt.id, rt.label, rt.description]
      );
    }

    // 10. Course Offerings
    console.log('Seeding course offerings...');
    const offeringsData = readJson('courseOfferings.json');
    for (const off of offeringsData) {
      await client.query(
        `INSERT INTO course_offerings (
           id, course_id, semester_id, teacher_id, section, capacity, room, schedule, grade_status, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (id) DO UPDATE SET
           teacher_id = EXCLUDED.teacher_id,
           grade_status = EXCLUDED.grade_status,
           capacity = EXCLUDED.capacity`,
        [
          off.id,
          off.courseId,
          off.semesterId,
          off.teacherId,
          off.section,
          off.capacity || 50,
          off.room || null,
          off.schedule || null,
          off.gradeStatus || 'not_started',
          off.createdAt || new Date(),
          off.updatedAt || new Date(),
        ]
      );
    }

    // 11. Enrollments
    console.log('Seeding course enrollments...');
    const enrollmentsData = readJson('courseEnrollments.json');
    for (const enr of enrollmentsData) {
      await client.query(
        `INSERT INTO course_enrollments (
           id, offering_id, student_id, status, is_repeat, enrolled_at, withdrawn_at, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO UPDATE SET
           status = EXCLUDED.status,
           withdrawn_at = EXCLUDED.withdrawn_at`,
        [
          enr.id,
          enr.offeringId,
          enr.studentId,
          enr.status || 'enrolled',
          enr.isRepeat || false,
          enr.enrolledAt || new Date(),
          enr.withdrawnAt || null,
          enr.createdAt || new Date(),
          enr.updatedAt || new Date(),
        ]
      );
    }

    // 12. Assessments
    console.log('Seeding assessments...');
    const assessmentsData = readJson('assessments.json');
    for (const asm of assessmentsData) {
      await client.query(
        `INSERT INTO assessments (
           id, offering_id, name, type, max_marks, weight, due_date, description, is_released, released_at, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           max_marks = EXCLUDED.max_marks,
           weight = EXCLUDED.weight,
           is_released = EXCLUDED.is_released`,
        [
          asm.id,
          asm.offeringId,
          asm.name,
          asm.type,
          asm.maxMarks,
          asm.weight,
          asm.dueDate,
          asm.description || null,
          asm.isReleased ?? false,
          asm.releasedAt || null,
          asm.createdAt || new Date(),
          asm.updatedAt || new Date(),
        ]
      );
    }

    // 13. Assessment Scores
    console.log('Seeding assessment scores...');
    const scoresData = readJson('assessmentScores.json');
    for (const scr of scoresData) {
      if (scr.marks !== null && scr.marks !== undefined) {
        await client.query(
          `INSERT INTO assessment_scores (
             id, assessment_id, enrollment_id, marks, remarks, updated_by, created_at, updated_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO UPDATE SET
             marks = EXCLUDED.marks,
             remarks = EXCLUDED.remarks`,
          [
            scr.id,
            scr.assessmentId,
            scr.enrollmentId,
            scr.marks,
            scr.remarks || null,
            scr.updatedBy || 'usr_0003',
            scr.createdAt || new Date(),
            scr.updatedAt || new Date(),
          ]
        );
      }
    }

    // 14. Grade Scales
    console.log('Seeding grade scales...');
    const scalesData = readJson('gradeScales.json');
    for (const sc of scalesData) {
      await client.query(
        `INSERT INTO grade_scales (id, name, is_active, effective_from, created_by)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET is_active = EXCLUDED.is_active`,
        [sc.id, sc.name, sc.isActive ?? true, sc.effectiveFrom || new Date(), 'usr_0001']
      );
      if (Array.isArray(sc.entries)) {
        for (let i = 0; i < sc.entries.length; i++) {
          const entry = sc.entries[i];
          const entryId = `${sc.id}_${entry.letter}`;
          await client.query(
            `INSERT INTO grade_scale_entries (id, scale_id, letter, min_score, max_score, grade_points)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (id) DO UPDATE SET
               min_score = EXCLUDED.min_score,
               max_score = EXCLUDED.max_score,
               grade_points = EXCLUDED.grade_points`,
            [entryId, sc.id, entry.letter, entry.min ?? entry.minScore, entry.max ?? entry.maxScore, entry.points ?? entry.gradePoints]
          );
        }
      }
    }

    // 15. Final Grades
    console.log('Seeding final grades...');
    const finalGradesData = readJson('finalGrades.json');
    const defaultScaleId = scalesData[0]?.id || 'gsc_0001';
    for (const fg of finalGradesData) {
      await client.query(
        `INSERT INTO final_grades (
           id, enrollment_id, grade_scale_id, total_score, letter, grade_points,
           special_grade, status, is_stale, computed_at, submitted_at, approved_at, published_at
         ) VALUES ($1, $2, $13, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (enrollment_id) DO UPDATE SET
           total_score = EXCLUDED.total_score,
           letter = EXCLUDED.letter,
           grade_points = EXCLUDED.grade_points,
           special_grade = EXCLUDED.special_grade,
           status = EXCLUDED.status,
           published_at = EXCLUDED.published_at`,
        [
          fg.id,
          fg.enrollmentId,
          fg.totalScore,
          fg.letter,
          fg.gradePoints,
          fg.special || fg.specialGrade || null,
          fg.status || 'published',
          fg.stale ?? fg.isStale ?? false,
          fg.computedAt || new Date(),
          fg.submittedAt || null,
          fg.approvedAt || null,
          fg.publishedAt || null,
          defaultScaleId,
        ]
      );
    }

    // 16. Grade Submissions & Reviews
    console.log('Seeding grade submissions...');
    const submissionsData = readJson('gradeApprovalRequests.json');
    for (const sub of submissionsData) {
      await client.query(
        `INSERT INTO grade_submissions (id, offering_id, submitted_by, submitted_at, note, student_count, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status`,
        [
          sub.id,
          sub.offeringId,
          sub.submittedBy || 'usr_0003',
          sub.submittedAt || new Date(),
          sub.note || null,
          sub.studentCount || 0,
          sub.status || 'pending',
        ]
      );

      if (sub.reviewedBy || sub.reviewedAt) {
        const reviewId = `rev_${sub.id}`;
        await client.query(
          `INSERT INTO grade_submission_reviews (id, submission_id, stage, decision, reviewer_id, comment, reviewed_at)
           VALUES ($1, $2, 'registrar', $3, $4, $5, $6)
           ON CONFLICT (id) DO NOTHING`,
          [
            reviewId,
            sub.id,
            sub.status,
            sub.reviewedBy || 'usr_0001',
            sub.comment || 'Reviewed',
            sub.reviewedAt || new Date(),
          ]
        );
      }
    }

    // 17. Withdrawal Reason Categories
    console.log('Seeding withdrawal reason categories...');
    const reasonCategories = [
      { id: 'medical', label: 'Medical / Health' },
      { id: 'financial', label: 'Financial Hardship' },
      { id: 'personal_family', label: 'Personal / Family' },
      { id: 'relocation_transfer', label: 'Relocation / Transfer' },
      { id: 'employment', label: 'Employment' },
      { id: 'academic', label: 'Academic Difficulty' },
      { id: 'personal_emergency', label: 'Personal Emergency' },
      { id: 'other', label: 'Other' },
    ];
    for (const rc of reasonCategories) {
      await client.query(
        `INSERT INTO withdrawal_reason_categories (id, label, is_active)
         VALUES ($1, $2, true)
         ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label`,
        [rc.id, rc.label]
      );
    }

    // Withdrawal requests
    console.log('Seeding withdrawal requests...');
    const withdrawalRequests = [];

    for (const wr of withdrawalRequests) {
      await client.query(
        `INSERT INTO withdrawal_requests (
           id, reference_no, student_id, scope, semester_id, reason_category_id, reason,
           status, submitted_at, decided_by, decided_at, admin_notes
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (id) DO NOTHING`,
        [
          wr.id,
          wr.referenceNo,
          wr.studentId,
          wr.scope,
          wr.semesterId,
          wr.reasonCategoryId,
          wr.reason,
          wr.status,
          wr.submittedAt,
          wr.decidedBy || null,
          wr.decidedAt || null,
          wr.adminNotes || null,
        ]
      );

      for (const [office, status] of Object.entries(wr.clearances)) {
        await client.query(
          `INSERT INTO withdrawal_clearances (request_id, office, status, cleared_at)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (request_id, office) DO UPDATE SET status = EXCLUDED.status`,
          [wr.id, office, status, status === 'approved' ? wr.submittedAt : null]
        );
      }
    }

    // 18. Notifications & Announcements
    console.log('Seeding notifications & announcements...');
    const notifsData = readJson('notifications.json');
    for (const n of notifsData) {
      await client.query(
        `INSERT INTO notifications (id, user_id, title, message, type, link, is_read, read_at, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO NOTHING`,
        [
          n.id,
          n.userId,
          n.title,
          n.message,
          n.type,
          n.link || null,
          n.isRead ?? false,
          n.readAt || null,
          n.createdAt || new Date(),
        ]
      );
    }

    const announcementsData = readJson('announcements.json');
    for (const a of announcementsData) {
      await client.query(
        `INSERT INTO announcements (id, title, body, audience, author_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO NOTHING`,
        [a.id, a.title, a.body, a.audience, a.authorId || 'usr_0001', a.createdAt || new Date()]
      );
    }

    // 19. Settings
    console.log('Seeding university settings & academic policies...');
    const settingsData = readJson('settings.json');
    const uSettings = settingsData.university || {
      name: 'Northbridge University',
      shortName: 'NBU',
      motto: 'Knowledge, Integrity, Service',
      address: '1 University Avenue, Addis Ababa',
      email: 'registrar@university.edu',
      phone: '+251 11 555 0100',
      website: 'https://www.university.edu',
      registrarName: 'Marcus Bell',
    };
    await client.query(
      `INSERT INTO university_settings (
         id, name, short_name, motto, address, email, phone, website, registrar_name, updated_at
       ) VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, now())
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         short_name = EXCLUDED.short_name,
         motto = EXCLUDED.motto,
         address = EXCLUDED.address,
         email = EXCLUDED.email,
         phone = EXCLUDED.phone,
         website = EXCLUDED.website,
         registrar_name = EXCLUDED.registrar_name`,
      [
        uSettings.name,
        uSettings.shortName,
        uSettings.motto || null,
        uSettings.address || null,
        uSettings.email,
        uSettings.phone || null,
        uSettings.website || null,
        uSettings.registrarName,
      ]
    );

    const pol = settingsData.policy || {
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
    await client.query(
      `INSERT INTO academic_policies (
         id, pass_mark, approval_workflow_enabled, repeat_policy, incomplete_policy,
         withdrawal_policy, probation_gpa, honors_gpa, require_weights_total_100, at_risk_margin, updated_at
       ) VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9, now())
       ON CONFLICT (id) DO UPDATE SET
         pass_mark = EXCLUDED.pass_mark,
         approval_workflow_enabled = EXCLUDED.approval_workflow_enabled,
         repeat_policy = EXCLUDED.repeat_policy,
         incomplete_policy = EXCLUDED.incomplete_policy,
         withdrawal_policy = EXCLUDED.withdrawal_policy,
         probation_gpa = EXCLUDED.probation_gpa,
         honors_gpa = EXCLUDED.honors_gpa,
         require_weights_total_100 = EXCLUDED.require_weights_total_100,
         at_risk_margin = EXCLUDED.at_risk_margin`,
      [
        pol.passMark,
        pol.approvalWorkflowEnabled ?? true,
        pol.repeatPolicy || 'latest',
        pol.incompletePolicy || 'exclude',
        pol.withdrawalPolicy || 'exclude',
        pol.probationGpa || 2.0,
        pol.honorsGpa || 3.5,
        pol.requireWeightsTotal100 ?? true,
        pol.atRiskMargin || 10,
      ]
    );

    if (Array.isArray(pol.excludedCourseIds)) {
      for (const cid of pol.excludedCourseIds) {
        await client.query(
          `INSERT INTO policy_excluded_courses (course_id) VALUES ($1) ON CONFLICT DO NOTHING`,
          [cid]
        );
      }
    }

    // 21. Department Assessment Templates
    console.log('Seeding assessment templates...');
    const depts = await client.query(`SELECT id FROM departments`);
    const defaultTemplates = [
      { name: 'Assignment 1', type: 'assignment', maxMarks: 100, weight: 15, sortOrder: 1 },
      { name: 'Quiz 1', type: 'quiz', maxMarks: 20, weight: 15, sortOrder: 2 },
      { name: 'Midterm Exam', type: 'midterm', maxMarks: 100, weight: 30, sortOrder: 3 },
      { name: 'Final Exam', type: 'final', maxMarks: 100, weight: 40, sortOrder: 4 },
    ];
    for (const d of depts.rows) {
      for (const t of defaultTemplates) {
        const tId = `tpl_${d.id}_${t.sortOrder}`;
        await client.query(
          `INSERT INTO department_assessment_templates (id, department_id, name, type, max_marks, weight, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT DO NOTHING`,
          [tId, d.id, t.name, t.type, t.maxMarks, t.weight, t.sortOrder]
        );
      }
    }
  });

  console.log('--- Database seeding completed successfully! ---');
}

export const runSeed = seedDatabase;

// Run standalone if executed directly
if (process.argv[1] && (process.argv[1].endsWith('seed/index.js') || process.argv[1].endsWith('seed.js'))) {
  seedDatabase()
    .then(() => pool.end())
    .catch((err) => {
      console.error('Seeding error:', err);
      pool.end();
      process.exit(1);
    });
}

