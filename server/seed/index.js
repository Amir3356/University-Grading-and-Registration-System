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

// System Roles and Permissions
const rolesData = [
  {
    id: 'admin',
    name: 'System Administrator',
    description: 'Manages the academic environment, users and grading policies.',
    permissions: [
      'users.manage',
      'academics.manage',
      'grades.approve',
      'grades.publish',
      'settings.manage',
      'audit.view',
    ],
  },
  {
    id: 'dept_head',
    name: 'Department Head',
    description: 'Supervises departmental academic activities, reviews and approves grades.',
    permissions: [
      'department.view',
      'courses.view_department',
      'teachers.view_department',
      'students.view_department',
      'grades.approve_department',
      'reports.department',
    ],
  },
  {
    id: 'teacher',
    name: 'Teacher',
    description: 'Manages assessments and grades for assigned course offerings.',
    permissions: [
      'courses.view_assigned',
      'assessments.manage',
      'grades.enter',
      'grades.submit',
      'reports.course',
    ],
  },
  {
    id: 'student',
    name: 'Student',
    description: 'Views own courses, grades, GPA and transcript.',
    permissions: [
      'grades.view_own',
      'transcript.view_own',
    ],
  },
];

// Admin Credentials
const adminUsers = [
  {
    id: 'usr_0001',
    roleId: 'admin',
    username: 'Amir',
    firstName: 'Amir',
    lastName: 'Admin',
    email: 'amir@university.edu',
    phone: '+251 955 592 554',
    status: 'active',
    password: 'AEHJSS36',
    mustChangePassword: false,
    createdAt: '2024-06-01T00:00:00.000Z',
    updatedAt: '2024-06-01T00:00:00.000Z',
  },
];

export async function seedDatabase() {
  console.log('--- Starting database seeding with comprehensive academic dataset ---');

  const defaultPasswordHash = await bcrypt.hash('AEHJSS36', 10);
  const userPasswordHash = await bcrypt.hash('Password123!', 10);

  await withTransaction(async (client) => {
    // 1. Roles & Permissions
    console.log('1. Seeding roles and permissions...');
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

    // 2. Users: Admin first
    console.log('2. Seeding admin user (Amir)...');
    for (const u of adminUsers) {
      await client.query(
        `INSERT INTO users (
           id, role_id, username, first_name, last_name, email, phone,
           password_hash, must_change_password, status, is_seed, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, $11, $12)
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
          defaultPasswordHash,
          u.mustChangePassword ?? false,
          u.status || 'active',
          u.createdAt || new Date(),
          u.updatedAt || new Date(),
        ]
      );
    }

    // Additional users from data directory
    const usersData = readJson('users.json');
    if (usersData.length > 0) {
      console.log(`Seeding ${usersData.length} additional actors (teachers, students, staff)...`);
      for (const u of usersData) {
        if (u.id === 'usr_0001') continue; // Skip admin
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
             status = EXCLUDED.status`,
          [
            u.id,
            u.roleId,
            u.username,
            u.firstName,
            u.lastName,
            u.email,
            u.phone || null,
            userPasswordHash,
            u.mustChangePassword ?? false,
            u.status || 'active',
            u.lastLoginAt || null,
            u.createdAt || new Date(),
            u.updatedAt || new Date(),
          ]
        );
      }
    }

    // 3. Departments
    console.log('3. Seeding departments...');
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
    console.log('4. Seeding academic programs...');
    const defaultPrograms = [
      { id: 'prg_bsc_cs', departmentId: 'dep_cs', code: 'BSC-CS', name: 'BSc Computer Science', duration: 4, credits: 140 },
      { id: 'prg_bsc_math', departmentId: 'dep_math', code: 'BSC-MATH', name: 'BSc Mathematics', duration: 4, credits: 136 },
      { id: 'prg_bba_bus', departmentId: 'dep_bus', code: 'BBA-BUS', name: 'BBA Business Administration', duration: 4, credits: 132 },
      { id: 'prg_bsc_ee', departmentId: 'dep_ee', code: 'BSC-EE', name: 'BSc Electrical Engineering', duration: 4, credits: 148 },
      { id: 'prg_bsc_bio', departmentId: 'dep_bio', code: 'BSC-BIO', name: 'BSc Biology', duration: 4, credits: 136 },
      { id: 'prg_bsc_chem', departmentId: 'dep_chem', code: 'BSC-CHEM', name: 'BSc Chemistry', duration: 4, credits: 136 },
      { id: 'prg_bsc_phys', departmentId: 'dep_phys', code: 'BSC-PHYS', name: 'BSc Physics', duration: 4, credits: 136 },
      { id: 'prg_ba_econ', departmentId: 'dep_econ', code: 'BA-ECON', name: 'BA Economics', duration: 4, credits: 130 },
      { id: 'prg_ba_eng', departmentId: 'dep_eng', code: 'BA-ENG', name: 'BA English', duration: 4, credits: 128 },
    ];
    for (const p of defaultPrograms) {
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
    console.log('5. Seeding teachers...');
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
          t.title || 'Instructor',
          t.specialization || null,
          t.officeRoom || null,
          t.hireDate || '2020-01-01',
          t.createdAt || new Date(),
          t.updatedAt || new Date(),
        ]
      );
    }

    // Assign department heads
    for (const d of departmentsData) {
      if (d.headTeacherId) {
        await client.query(`UPDATE departments SET head_teacher_id = $1 WHERE id = $2`, [d.headTeacherId, d.id]);
      }
    }

    // 6. Students
    console.log('6. Seeding students...');
    const studentsData = readJson('students.json');
    const programMap = {
      'BSc Computer Science': 'prg_bsc_cs',
      'BSc Mathematics': 'prg_bsc_math',
      'BBA Business Administration': 'prg_bba_bus',
      'BSc Electrical Engineering': 'prg_bsc_ee',
      'BSc Biology': 'prg_bsc_bio',
      'BSc Chemistry': 'prg_bsc_chem',
      'BSc Physics': 'prg_bsc_phys',
      'BA Economics': 'prg_ba_econ',
      'BA English': 'prg_ba_eng',
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
    console.log('7. Seeding courses...');
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
      const prog = defaultPrograms.find((p) => p.departmentId === c.departmentId);
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
    console.log('8. Seeding academic calendar & semesters...');
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
    console.log('9. Seeding registration types & periods...');
    const regTypes = [
      { id: 'cafe', label: 'Regular (Café)', description: 'Full board cafeteria registration' },
      { id: 'non_cafe', label: 'Non-Regular (Non-Café)', description: 'Off-campus non-cafeteria registration' },
      { id: 'extension', label: 'Extension', description: 'Evening extension program registration' },
      { id: 'weekend', label: 'Weekend', description: 'Weekend program registration' },
    ];
    for (const rt of regTypes) {
      await client.query(
        `INSERT INTO registration_types (id, label, description, is_active)
         VALUES ($1, $2, $3, true)
         ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label`,
        [rt.id, rt.label, rt.description]
      );
    }

    const periods = [
      { id: 'per_2026_fall', semesterId: 'sem_2026_fall', startDate: '2026-08-01', deadline: '2026-11-30', status: 'open', types: ['cafe', 'non_cafe', 'extension', 'weekend'] },
      { id: 'per_2026_spring', semesterId: 'sem_2026_spring', startDate: '2026-01-15', deadline: '2026-02-15', status: 'closed', types: ['cafe', 'non_cafe', 'extension'] },
      { id: 'per_2027_spring', semesterId: 'sem_2027_spring', startDate: '2027-01-15', deadline: '2027-02-15', status: 'scheduled', types: ['cafe', 'non_cafe'] },
    ];
    for (const p of periods) {
      await client.query(
        `INSERT INTO registration_periods (id, semester_id, start_date, deadline, status, created_by)
         VALUES ($1, $2, $3, $4, $5, 'usr_0001')
         ON CONFLICT (id) DO UPDATE SET
           status = EXCLUDED.status,
           start_date = EXCLUDED.start_date,
           deadline = EXCLUDED.deadline`,
        [p.id, p.semesterId, p.startDate, p.deadline, p.status]
      );
      for (const t of p.types) {
        await client.query(
          `INSERT INTO registration_period_types (period_id, registration_type_id)
           VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [p.id, t]
        );
      }
    }

    // Student semester registrations
    for (let i = 0; i < studentsData.length; i++) {
      const s = studentsData[i];
      const isRegistered = i < 35;
      const isPending = i >= 35 && i < 45;
      if (isRegistered || isPending) {
        const regId = `reg_${s.id}_2026_fall`;
        const status = isRegistered ? 'registered' : 'pending';
        const type = i % 2 === 0 ? 'cafe' : 'non_cafe';
        await client.query(
          `INSERT INTO semester_registrations (
             id, student_id, semester_id, period_id, registration_type_id, status, submitted_at, reviewed_by, reviewed_at
           ) VALUES ($1, $2, 'sem_2026_fall', 'per_2026_fall', $3, $4, '2026-08-20T09:00:00Z', $5, $6)
           ON CONFLICT (student_id, semester_id) DO NOTHING`,
          [
            regId,
            s.id,
            type,
            status,
            isRegistered ? 'usr_0001' : null,
            isRegistered ? '2026-08-21T10:00:00Z' : null,
          ]
        );
      }
    }

    // 10. Course Offerings
    console.log('10. Seeding course offerings...');
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
    console.log('11. Seeding enrollments...');
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
    console.log('12. Seeding assessments...');
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
    console.log('13. Seeding assessment scores...');
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
    console.log('14. Seeding grade scales...');
    const scalesData = readJson('gradeScales.json');
    await client.query(`UPDATE grade_scales SET is_active = false`);
    for (let i = 0; i < scalesData.length; i++) {
      const sc = scalesData[i];
      const isActive = (i === 0);
      await client.query(
        `INSERT INTO grade_scales (id, name, is_active, effective_from, created_by)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET is_active = EXCLUDED.is_active`,
        [sc.id, sc.name, isActive, sc.effectiveFrom || new Date(), 'usr_0001']
      );
      if (Array.isArray(sc.entries)) {
        for (let j = 0; j < sc.entries.length; j++) {
          const entry = sc.entries[j];
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
    console.log('15. Seeding final grades...');
    const finalGradesData = readJson('finalGrades.json');
    // Ensure active scale id
    const activeScaleRes = await client.query(`SELECT id FROM grade_scales WHERE is_active = true LIMIT 1`);
    const defaultScaleId = activeScaleRes.rows[0]?.id || scalesData[0]?.id || 'gsc_0001';
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
    console.log('16. Seeding grade submissions...');
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
           VALUES ($1, $2, $7, $3, $4, $5, $6)
           ON CONFLICT (id) DO NOTHING`,
          [
            reviewId,
            sub.id,
            sub.status,
            sub.reviewedBy || 'usr_0001',
            sub.comment || 'Reviewed',
            sub.reviewedAt || new Date(),
            sub.reviewStage || 'registrar',
          ]
        );
      }
    }

    // 17. Withdrawal Reason Categories & Requests
    console.log('17. Seeding withdrawal requests...');
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

    // 18. Announcements & Notifications
    console.log('18. Seeding announcements & notifications...');
    const announcementsData = readJson('announcements.json');
    for (const a of announcementsData) {
      await client.query(
        `INSERT INTO announcements (id, title, body, audience, author_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO NOTHING`,
        [a.id, a.title, a.body, a.audience, a.authorId || 'usr_0001', a.createdAt || new Date()]
      );
    }

    // 19. University Settings & Policies
    console.log('19. Seeding university settings...');
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

    // Reassign key references to Amir
    await client.query(`UPDATE university_settings SET updated_by = 'usr_0001' WHERE updated_by IS NULL`);
    await client.query(`UPDATE academic_policies SET updated_by = 'usr_0001' WHERE updated_by IS NULL`);
    await client.query(`UPDATE grade_scales SET created_by = 'usr_0001' WHERE created_by IS NULL`);

    console.log('Preserved Admin credentials (usr_0001 / Amir / AEHJSS36) and populated full academic dataset.');
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
