import { query, withTransaction } from '../config/database.js';
import * as userRepo from '../repositories/userRepository.js';
import { newId, generateTemporaryPassword } from '../utils/idGenerator.js';
import { hashPassword } from '../utils/password.js';
import { ValidationError, ConflictError, NotFoundError, ForbiddenError } from '../utils/errors.js';
import { logAudit } from '../middleware/audit.js';

export async function listUsers(filters, caller) {
  if (caller.roleId === 'dept_head') {
    filters.departmentId = caller.departmentId;
  }
  return await userRepo.listUsers(filters);
}

export async function getUserDetail(id, caller) {
  const user = await userRepo.findById(id);
  if (!user) throw new NotFoundError('User');

  const profile = await userRepo.getUserProfile(user.id, user.role_id);
  if (caller.roleId === 'dept_head' && profile?.department_id && profile.department_id !== caller.departmentId) {
    throw new ForbiddenError('You can only view users in your department.');
  }

  let summary = null;
  let offerings = null;

  if (user.role_id === 'student' && profile) {
    const enrRes = await query(`SELECT count(*) as count FROM course_enrollments WHERE student_id = $1`, [profile.id]);
    const { getStudentTranscriptData } = await import('../repositories/reportRepository.js');
    const transcript = await getStudentTranscriptData(profile.id);
    summary = {
      enrollments: parseInt(enrRes.rows[0]?.count || '0', 10),
      cgpa: transcript.cgpa,
      earnedCredits: transcript.earnedCredits,
    };
  } else if ((user.role_id === 'teacher' || user.role_id === 'dept_head') && profile) {
    const { listOfferings } = await import('../repositories/offeringRepository.js');
    const offRes = await listOfferings({ teacherId: profile.id, pageSize: 'all' });
    offerings = offRes.items;
  }

  // Recent activity
  const actRes = await query(
    `SELECT * FROM audit_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10`,
    [id]
  );

  return {
    user: {
      id: user.id,
      roleId: user.role_id,
      username: user.username,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      phone: user.phone,
      status: user.status,
      mustChangePassword: user.must_change_password,
      lastLoginAt: user.last_login_at,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    },
    profile,
    summary,
    offerings,
    recentActivity: actRes.rows,
  };
}

export async function createUser(data, caller) {
  // Dept head restriction
  if (caller.roleId === 'dept_head') {
    if (!['student', 'teacher'].includes(data.roleId)) {
      throw new ForbiddenError('Department heads can only create student and teacher accounts.');
    }
    data.departmentId = caller.departmentId;
  }

  // Validation
  const errors = {};
  if (!data.firstName?.trim()) errors.firstName = 'First name is required.';
  if (!data.lastName?.trim()) errors.lastName = 'Last name is required.';
  if (!data.username?.trim()) errors.username = 'Username is required.';
  if (!data.email?.trim()) errors.email = 'Email is required.';
  if (!data.identifier?.trim()) errors.identifier = 'Student / Teacher ID is required.';
  if (!data.departmentId) errors.departmentId = 'Department is required.';

  if (Object.keys(errors).length > 0) {
    throw new ValidationError('Please correct the highlighted fields.', errors);
  }

  // Uniqueness
  const existingUsername = await userRepo.findByUsername(data.username);
  if (existingUsername) {
    throw new ValidationError('This username is already in use.', { username: 'This username is already in use.' });
  }

  const existingEmail = await userRepo.findByEmail(data.email);
  if (existingEmail) {
    throw new ValidationError('This email is already in use.', { email: 'This email is already in use.' });
  }

  const tempPassword = data.password && String(data.password).trim() !== ''
    ? data.password
    : generateTemporaryPassword();
  const passwordHash = await hashPassword(tempPassword);

  return await withTransaction(async (client) => {
    const userId = newId('usr');
    const userRes = await client.query(
      `INSERT INTO users (
         id, role_id, username, first_name, last_name, email, phone,
         password_hash, must_change_password, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, 'active')
       RETURNING *`,
      [
        userId,
        data.roleId,
        data.username.trim(),
        data.firstName.trim(),
        data.lastName.trim(),
        data.email.trim(),
        data.phone?.trim() || null,
        passwordHash,
      ]
    );
    const user = userRes.rows[0];

    // Profile creation
    if (data.roleId === 'student') {
      const studentId = newId('stu');
      await client.query(
        `INSERT INTO students (
           id, user_id, student_number, department_id, program_id, program_type,
           admission_year, year_of_study, date_of_birth, academic_status
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active')`,
        [
          studentId,
          userId,
          data.identifier.trim(),
          data.departmentId,
          data.programId || 'prg_bsc_cs',
          data.programType || 'regular',
          data.admissionYear || new Date().getFullYear(),
          data.yearOfStudy || 1,
          data.dateOfBirth || null,
        ]
      );
    } else if (data.roleId === 'teacher' || data.roleId === 'dept_head') {
      const teacherId = newId('tch');
      await client.query(
        `INSERT INTO teachers (
           id, user_id, employee_number, department_id, title, specialization, office_room, hire_date
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          teacherId,
          userId,
          data.identifier.trim(),
          data.departmentId,
          data.title || 'Dr.',
          data.specialization || null,
          data.officeRoom || null,
          data.hireDate || new Date().toISOString().split('T')[0],
        ]
      );

      // If dept_head: update department head
      if (data.roleId === 'dept_head') {
        // Demote previous head user to teacher
        const prevHeadRes = await client.query(
          `SELECT t.user_id FROM departments d JOIN teachers t ON t.id = d.head_teacher_id WHERE d.id = $1`,
          [data.departmentId]
        );
        if (prevHeadRes.rows.length > 0) {
          await client.query(`UPDATE users SET role_id = 'teacher' WHERE id = $1`, [prevHeadRes.rows[0].user_id]);
        }
        await client.query(`UPDATE departments SET head_teacher_id = $1 WHERE id = $2`, [teacherId, data.departmentId]);
      }
    }

    await logAudit(client, {
      userId: caller.id,
      action: 'user.created',
      entityType: 'user',
      entityId: userId,
      details: `Created new ${data.roleId} account for ${data.firstName} ${data.lastName} (${data.username})`,
      after: { username: data.username, roleId: data.roleId, email: data.email },
    });

    return {
      user: {
        id: user.id,
        roleId: user.role_id,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        phone: user.phone,
        status: user.status,
      },
      username: user.username,
      temporaryPassword: tempPassword,
    };
  });
}

export async function updateUser(id, data, caller) {
  const user = await userRepo.findById(id);
  if (!user) throw new NotFoundError('User');

  if (caller.roleId === 'dept_head') {
    const profile = await userRepo.getUserProfile(user.id, user.role_id);
    if (profile?.department_id && profile.department_id !== caller.departmentId) {
      throw new ForbiddenError('You can only update users in your department.');
    }
  }

  // Prevent role change if academic records exist
  if (data.roleId && data.roleId !== user.role_id) {
    if (caller.id === id) throw new ConflictError('You cannot change your own role.');
    const enrRes = await query(`SELECT count(*) as count FROM course_enrollments ce JOIN students s ON s.id = ce.student_id WHERE s.user_id = $1`, [id]);
    const offRes = await query(`SELECT count(*) as count FROM course_offerings co JOIN teachers t ON t.id = co.teacher_id WHERE t.user_id = $1`, [id]);
    if (parseInt(enrRes.rows[0]?.count || '0', 10) > 0 || parseInt(offRes.rows[0]?.count || '0', 10) > 0) {
      throw new ConflictError('Cannot change user role because academic records (enrollments or offerings) are attached.');
    }
  }

  return await withTransaction(async (client) => {
    await client.query(
      `UPDATE users
       SET first_name = COALESCE($2, first_name),
           last_name = COALESCE($3, last_name),
           email = COALESCE($4, email),
           phone = $5,
           role_id = COALESCE($6, role_id),
           updated_at = now()
       WHERE id = $1`,
      [id, data.firstName, data.lastName, data.email, data.phone || null, data.roleId]
    );

    // Update profile
    if (user.role_id === 'student') {
      await client.query(
        `UPDATE students
         SET student_number = COALESCE($2, student_number),
             department_id = COALESCE($3, department_id),
             program_id = COALESCE($4, program_id),
             program_type = COALESCE($5, program_type),
             year_of_study = COALESCE($6, year_of_study),
             updated_at = now()
         WHERE user_id = $1`,
        [id, data.identifier, data.departmentId, data.programId, data.programType, data.yearOfStudy]
      );
    } else if (user.role_id === 'teacher' || user.role_id === 'dept_head') {
      await client.query(
        `UPDATE teachers
         SET employee_number = COALESCE($2, employee_number),
             department_id = COALESCE($3, department_id),
             title = COALESCE($4, title),
             specialization = $5,
             office_room = $6,
             updated_at = now()
         WHERE user_id = $1`,
        [id, data.identifier, data.departmentId, data.title, data.specialization || null, data.officeRoom || null]
      );
    }

    await logAudit(client, {
      userId: caller.id,
      action: 'user.updated',
      entityType: 'user',
      entityId: id,
      details: `Updated account details for user ${user.username}`,
      before: { firstName: user.first_name, lastName: user.last_name, email: user.email },
      after: { firstName: data.firstName, lastName: data.lastName, email: data.email },
    });

    return await getUserDetail(id, caller);
  });
}

export async function setUserStatus(id, { status, reason }, caller) {
  if (caller.id === id) {
    throw new ConflictError('You cannot deactivate your own account.');
  }

  if (status === 'inactive' && (!reason || !String(reason).trim())) {
    throw new ValidationError('A reason is required when deactivating an account.', {
      reason: 'Please provide a deactivation reason.',
    });
  }

  return await withTransaction(async (client) => {
    const userRes = await client.query(`SELECT * FROM users WHERE id = $1`, [id]);
    if (userRes.rows.length === 0) throw new NotFoundError('User');
    const user = userRes.rows[0];

    await client.query(
      `UPDATE users
       SET status = $2, deactivation_reason = $3, updated_at = now()
       WHERE id = $1`,
      [id, status, reason || null]
    );

    // If student, set academic_status
    if (user.role_id === 'student') {
      const stuStatus = status === 'inactive' ? 'suspended' : 'active';
      await client.query(`UPDATE students SET academic_status = $2, updated_at = now() WHERE user_id = $1`, [id, stuStatus]);
    }

    await logAudit(client, {
      userId: caller.id,
      action: 'user.status_changed',
      entityType: 'user',
      entityId: id,
      details: `Changed account status to ${status}`,
      reason,
      before: { status: user.status },
      after: { status },
    });

    return { id, status, reason };
  });
}

export async function deleteUser(id, caller) {
  if (caller.id === id) {
    throw new ConflictError('You cannot delete your own account.');
  }

  const enrRes = await query(
    `SELECT count(*) as count FROM course_enrollments ce JOIN students s ON s.id = ce.student_id WHERE s.user_id = $1`,
    [id]
  );
  if (parseInt(enrRes.rows[0]?.count || '0', 10) > 0) {
    throw new ConflictError('Cannot delete user: student has active enrollment history. Deactivate the user instead.');
  }

  const offRes = await query(
    `SELECT count(*) as count FROM course_offerings co JOIN teachers t ON t.id = co.teacher_id WHERE t.user_id = $1`,
    [id]
  );
  if (parseInt(offRes.rows[0]?.count || '0', 10) > 0) {
    throw new ConflictError('Cannot delete user: teacher has assigned course offerings. Deactivate the user instead.');
  }

  return await withTransaction(async (client) => {
    await client.query(`DELETE FROM students WHERE user_id = $1`, [id]);
    await client.query(`DELETE FROM teachers WHERE user_id = $1`, [id]);
    await client.query(`DELETE FROM users WHERE id = $1`, [id]);

    await logAudit(client, {
      userId: caller.id,
      action: 'user.deleted',
      entityType: 'user',
      entityId: id,
      details: `Deleted user account ${id}`,
    });

    return { ok: true };
  });
}

export async function resetPassword(id, caller) {
  const tempPassword = generateTemporaryPassword();
  const hash = await hashPassword(tempPassword);

  await query(
    `UPDATE users SET password_hash = $2, must_change_password = true, updated_at = now() WHERE id = $1`,
    [id, hash]
  );

  await userRepo.revokeAllUserRefreshTokens(id);

  const notifId = newId('ntf');
  await query(
    `INSERT INTO notifications (id, user_id, title, message, type)
     VALUES ($1, $2, 'Password Reset', 'An administrator has reset your password. Please sign in with your temporary password and choose a new one.', 'system')`,
    [notifId, id]
  );

  await logAudit(query, {
    userId: caller.id,
    action: 'auth.password_reset',
    entityType: 'user',
    entityId: id,
    details: 'Administrator reset user password',
  });

  return { temporaryPassword: tempPassword };
}

export async function suggestEmail(name) {
  if (!name || !String(name).trim()) return { email: '' };
  const parts = name.trim().toLowerCase().split(/\s+/);
  const first = parts[0] || 'user';
  const last = parts.slice(1).join('.') || 'name';
  let base = `${first}.${last}@university.edu`;

  let email = base;
  let counter = 1;
  while (await userRepo.findByEmail(email)) {
    email = `${first}.${last}${counter}@university.edu`;
    counter++;
  }
  return { email };
}

export async function suggestIdentifier(roleId, departmentId) {
  const currentYear = new Date().getFullYear() % 100;
  if (roleId === 'student') {
    const maxRes = await query(
      `SELECT count(*) as count FROM students WHERE student_number LIKE 'UGR/%'`
    );
    const nextNum = parseInt(maxRes.rows[0]?.count || '0', 10) + 1;
    const identifier = `UGR/${currentYear}/${String(nextNum).padStart(4, '0')}`;
    return { identifier };
  }

  // Teacher
  const deptRes = await query(`SELECT code FROM departments WHERE id = $1`, [departmentId]);
  const code = deptRes.rows[0]?.code || 'CS';
  const maxRes = await query(
    `SELECT count(*) as count FROM teachers WHERE employee_number LIKE $1`,
    [`EMP-${code}-%`]
  );
  const nextNum = parseInt(maxRes.rows[0]?.count || '0', 10) + 1;
  const identifier = `EMP-${code}-${String(nextNum).padStart(2, '0')}`;
  return { identifier };
}
