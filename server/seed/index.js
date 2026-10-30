import bcrypt from 'bcryptjs';
import { pool, withTransaction } from '../config/database.js';

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
  console.log('--- Starting database seeding (Admin Credentials only) ---');

  const defaultPasswordHash = await bcrypt.hash('AEHJSS36', 10);

  await withTransaction(async (client) => {
    // 1. Roles & Permissions (required for user authentication and role assignments)
    console.log('Seeding roles and permissions...');
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

    // 2. Admin Credentials
    console.log('Seeding admin credentials...');
    for (const u of adminUsers) {
      const passwordHash = u.password
        ? await bcrypt.hash(u.password, 10)
        : defaultPasswordHash;

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
          passwordHash,
          u.mustChangePassword ?? false,
          u.status || 'active',
          u.createdAt || new Date(),
          u.updatedAt || new Date(),
        ]
      );
    }

    // Reassign foreign key references to Amir (usr_0001)
    await client.query(`UPDATE grade_scales SET created_by = 'usr_0001' WHERE created_by != 'usr_0001'`);
    await client.query(`UPDATE registration_periods SET created_by = 'usr_0001' WHERE created_by != 'usr_0001'`);
    await client.query(`UPDATE semester_registrations SET reviewed_by = 'usr_0001' WHERE reviewed_by IS NOT NULL AND reviewed_by != 'usr_0001'`);
    await client.query(`UPDATE withdrawal_requests SET decided_by = 'usr_0001' WHERE decided_by IS NOT NULL AND decided_by != 'usr_0001'`);
    await client.query(`UPDATE withdrawal_clearances SET cleared_by = 'usr_0001' WHERE cleared_by IS NOT NULL AND cleared_by != 'usr_0001'`);
    await client.query(`UPDATE users SET created_by = 'usr_0001' WHERE created_by IS NOT NULL AND created_by != 'usr_0001'`);
    await client.query(`UPDATE announcements SET author_id = 'usr_0001' WHERE author_id != 'usr_0001'`);
    await client.query(`UPDATE university_settings SET updated_by = 'usr_0001' WHERE updated_by IS NOT NULL AND updated_by != 'usr_0001'`);
    await client.query(`UPDATE academic_policies SET updated_by = 'usr_0001' WHERE updated_by IS NOT NULL AND updated_by != 'usr_0001'`);

    // Remove all operational seed data: grades, assessments, enrollments, courses, complaints, registrations
    console.log('Cleaning up operational seed data...');
    await client.query('DELETE FROM assessment_scores');
    await client.query('DELETE FROM assessments');
    await client.query('DELETE FROM department_assessment_templates');
    await client.query('DELETE FROM grade_submission_reviews');
    await client.query('DELETE FROM grade_submissions');
    await client.query('DELETE FROM final_grades');
    await client.query('DELETE FROM complaints');
    await client.query('DELETE FROM withdrawal_clearances');
    await client.query('DELETE FROM withdrawal_requests');
    await client.query('DELETE FROM semester_registrations');
    await client.query('DELETE FROM registration_period_types');
    await client.query('DELETE FROM registration_periods');
    await client.query('DELETE FROM course_enrollments');
    await client.query('DELETE FROM course_offerings');
    await client.query('DELETE FROM program_courses');
    await client.query('DELETE FROM policy_excluded_courses');
    await client.query('DELETE FROM courses');

    // Reset department head foreign keys before clearing teacher profiles
    await client.query('UPDATE departments SET head_teacher_id = NULL');
    await client.query('DELETE FROM students');
    await client.query('DELETE FROM teachers');

    // Clean up notifications, announcements and refresh tokens for non-admin users
    await client.query('DELETE FROM notifications');
    await client.query('DELETE FROM announcements');
    await client.query("DELETE FROM refresh_tokens WHERE user_id != 'usr_0001'");

    // Remove all users except Admin (Amir)
    await client.query("DELETE FROM users WHERE id != 'usr_0001'");
    console.log('Preserved Admin credentials (usr_0001 / Amir) and cleared all other seed data.');
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
