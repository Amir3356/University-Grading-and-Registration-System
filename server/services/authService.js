import crypto from 'crypto';
import * as userRepo from '../repositories/userRepository.js';
import { comparePassword, hashPassword, validatePasswordStrength } from '../utils/password.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { UnauthorizedError, ValidationError, NotFoundError, ConflictError } from '../utils/errors.js';
import { logAudit } from '../middleware/audit.js';
import { query } from '../config/database.js';

export async function login({ role, identifier, username, password, userAgent, ipAddress }) {
  const cred = (identifier || username || '').trim();
  if (!cred) {
    throw new UnauthorizedError('Username or identifier is required.');
  }

  // Find user by role and identifier or username
  const user = await userRepo.findByIdentifierOrUsername(role, cred);
  if (!user || user.status !== 'active') {
    throw new UnauthorizedError('Invalid credentials or inactive account.');
  }

  // Verify password
  let passwordValid = false;
  if (password && String(password).trim() !== '') {
    passwordValid = await comparePassword(password, user.password_hash);
  } else if (['student', 'teacher', 'dept_head'].includes(role)) {
    // When logging in from client UI where password field was omitted for role credentials
    // Verify default Password123! against hash
    passwordValid = await comparePassword('Password123!', user.password_hash);
  }

  if (!passwordValid) {
    throw new UnauthorizedError('Invalid credentials or inactive account.');
  }

  // Generate tokens
  const payload = { userId: user.id, roleId: user.role_id };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  // Store refresh token hash
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await userRepo.createRefreshToken(user.id, tokenHash, userAgent, ipAddress, expiresAt);

  // Update last_login_at
  await query(`UPDATE users SET last_login_at = now() WHERE id = $1`, [user.id]);
  await logAudit(query, {
    userId: user.id,
    action: 'auth.login',
    entityType: 'user',
    entityId: user.id,
    details: 'Signed in successfully',
    ipAddress,
  });

  const profile = await userRepo.getUserProfile(user.id, user.role_id);

  return {
    accessToken,
    refreshToken,
    expiresIn: 900,
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
    },
    profile,
  };
}

export async function refreshAccessToken(refreshToken, userAgent, ipAddress) {
  if (!refreshToken) {
    throw new UnauthorizedError('Refresh token required.');
  }

  const decoded = verifyRefreshToken(refreshToken);
  if (!decoded || !decoded.userId) {
    throw new UnauthorizedError('Invalid or expired refresh token.');
  }

  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const storedToken = await userRepo.findRefreshToken(tokenHash);
  if (!storedToken) {
    throw new UnauthorizedError('Refresh token revoked or not found.');
  }

  const user = await userRepo.findById(decoded.userId);
  if (!user || user.status !== 'active') {
    throw new UnauthorizedError('User account inactive or not found.');
  }

  const newAccessToken = signAccessToken({ userId: user.id, roleId: user.role_id });
  return {
    accessToken: newAccessToken,
    expiresIn: 900,
  };
}

export async function logout(user, refreshToken) {
  if (refreshToken) {
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await userRepo.revokeRefreshToken(tokenHash);
  }
  if (user?.id) {
    await logAudit(query, {
      userId: user.id,
      action: 'auth.logout',
      entityType: 'user',
      entityId: user.id,
      details: 'Signed out',
    });
  }
  return { ok: true };
}

export async function getMe(userId) {
  const user = await userRepo.findById(userId);
  if (!user || user.status !== 'active') {
    throw new UnauthorizedError('User account not found or inactive.');
  }
  const profile = await userRepo.getUserProfile(user.id, user.role_id);
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
    },
    profile,
  };
}

export async function updateOwnProfile(userId, { firstName, lastName, phone }) {
  if (!firstName || !String(firstName).trim()) {
    throw new ValidationError('First name is required.', { firstName: 'First name is required.' });
  }
  if (!lastName || !String(lastName).trim()) {
    throw new ValidationError('Last name is required.', { lastName: 'Last name is required.' });
  }

  const res = await query(
    `UPDATE users
     SET first_name = $2, last_name = $3, phone = $4, updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [userId, firstName.trim(), lastName.trim(), phone?.trim() || null]
  );
  const user = res.rows[0];

  await logAudit(query, {
    userId,
    action: 'user.profile_updated',
    entityType: 'user',
    entityId: userId,
    details: 'Updated own profile details',
  });

  const profile = await userRepo.getUserProfile(user.id, user.role_id);
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
    },
    profile,
  };
}

export async function changeOwnPassword(userId, { currentPassword, newPassword, confirmPassword }) {
  const user = await userRepo.findById(userId);
  if (!user) throw new NotFoundError('User');

  const match = await comparePassword(currentPassword || '', user.password_hash);
  if (!match) {
    throw new ValidationError('Current password is incorrect.', {
      currentPassword: 'Current password is incorrect.',
    });
  }

  const strengthErr = validatePasswordStrength(newPassword);
  if (strengthErr) {
    throw new ValidationError(strengthErr, { newPassword: strengthErr });
  }

  if (newPassword !== confirmPassword) {
    throw new ValidationError('Passwords do not match.', { confirmPassword: 'Passwords do not match.' });
  }

  const newHash = await hashPassword(newPassword);
  await query(
    `UPDATE users SET password_hash = $2, must_change_password = false, updated_at = now() WHERE id = $1`,
    [userId, newHash]
  );

  await userRepo.revokeAllUserRefreshTokens(userId);

  await logAudit(query, {
    userId,
    action: 'auth.password_changed',
    entityType: 'user',
    entityId: userId,
    details: 'Changed own password',
  });

  return { ok: true };
}
