import { verifyAccessToken } from '../utils/jwt.js';
import { UnauthorizedError } from '../utils/errors.js';
import { query } from '../config/database.js';
import { defineAbilityFor } from './authorize.js';

export async function authenticate(req, res, next) {
  try {
    let token = null;
    let decoded = null;

    // 1. Check Bearer authorization header first
    if (req.headers.authorization?.startsWith('Bearer ')) {
      const bearerToken = req.headers.authorization.split(' ')[1];
      const bearerDecoded = verifyAccessToken(bearerToken);
      if (bearerDecoded?.userId) {
        token = bearerToken;
        decoded = bearerDecoded;
      }
    }

    // 2. Fall back to browser cookies
    if (!decoded) {
      const cookieToken = req.cookies?.ugs_token || req.cookies?.token || req.cookies?.accessToken;
      if (cookieToken) {
        const cookieDecoded = verifyAccessToken(cookieToken);
        if (cookieDecoded?.userId) {
          token = cookieToken;
          decoded = cookieDecoded;
        }
      }
    }

    if (!decoded || !decoded.userId) {
      res.clearCookie('ugs_token', { path: '/' });
      res.clearCookie('token', { path: '/' });
      throw new UnauthorizedError('Authentication token missing or invalid.');
    }

    const userRes = await query(
      `SELECT u.id, u.role_id, u.username, u.first_name, u.last_name, u.email, u.phone,
              u.status, u.must_change_password
       FROM users u
       WHERE u.id = $1`,
      [decoded.userId]
    );

    if (userRes.rows.length === 0) {
      throw new UnauthorizedError('User account not found.');
    }

    const user = userRes.rows[0];
    if (user.status !== 'active') {
      throw new UnauthorizedError('Deactivated your account');
    }

    req.user = {
      id: user.id,
      roleId: user.role_id,
      username: user.username,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      phone: user.phone,
      mustChangePassword: user.must_change_password,
    };

    // Attach role profile details
    if (user.role_id === 'teacher' || user.role_id === 'dept_head') {
      const tRes = await query(
        `SELECT t.id AS teacher_id, t.department_id, t.employee_number, t.title
         FROM teachers t
         WHERE t.user_id = $1`,
        [user.id]
      );
      if (tRes.rows.length > 0) {
        req.user.teacherId = tRes.rows[0].teacher_id;
        req.user.departmentId = tRes.rows[0].department_id;
        req.user.employeeNumber = tRes.rows[0].employee_number;
        req.user.title = tRes.rows[0].title;
      }
    } else if (user.role_id === 'student') {
      const sRes = await query(
        `SELECT s.id AS student_id, s.department_id, s.program_id, s.student_number, s.academic_status, s.program_type
         FROM students s
         WHERE s.user_id = $1`,
        [user.id]
      );
      if (sRes.rows.length > 0) {
        req.user.studentId = sRes.rows[0].student_id;
        req.user.departmentId = sRes.rows[0].department_id;
        req.user.programId = sRes.rows[0].program_id;
        req.user.studentNumber = sRes.rows[0].student_number;
        req.user.academicStatus = sRes.rows[0].academic_status;
        req.user.programType = sRes.rows[0].program_type;
      }
    }

    // Attach CASL ability instance
    req.ability = defineAbilityFor(req.user);

    next();
  } catch (err) {
    next(err);
  }
}

export async function optionalAuthenticate(req, res, next) {
  const hasToken =
    req.cookies?.ugs_token ||
    req.cookies?.token ||
    req.cookies?.accessToken ||
    (req.headers.authorization && req.headers.authorization.startsWith('Bearer '));

  if (hasToken) {
    return authenticate(req, res, (err) => {
      if (err) {
        // Optional auth: gracefully fall back to unauthenticated guest mode
        req.user = null;
        req.ability = defineAbilityFor(null);
        return next();
      }
      next();
    });
  }
  req.user = null;
  req.ability = defineAbilityFor(null);
  next();
}

