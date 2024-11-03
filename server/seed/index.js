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
      'reports.view',
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
    lastName: 'Administrator',
    email: 'amir@university.edu',
    phone: '+251 955 592 554',
    status: 'active',
    password: 'Password123!',
    mustChangePassword: false,
    createdAt: '2024-06-01T00:00:00.000Z',
    updatedAt: '2024-06-01T00:00:00.000Z',
  },
  {
    id: 'usr_0002',
    roleId: 'admin',
    username: 'registrar',
    firstName: 'Marcus',
    lastName: 'Bell',
    email: 'registrar@university.edu',
    phone: '+251 911 338 954',
    status: 'active',
    password: 'Password123!',
    mustChangePassword: false,
    createdAt: '2024-06-15T00:00:00.000Z',
    updatedAt: '2024-06-15T00:00:00.000Z',
  },
];

export async function seedDatabase() {
  console.log('--- Starting database seeding (Admin Credentials only) ---');

  const defaultPasswordHash = await bcrypt.hash('Password123!', 10);

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
