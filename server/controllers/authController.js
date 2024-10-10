import * as authService from '../services/authService.js';
import { sendSuccess, sendNoContent } from '../utils/response.js';

const COOKIE_BASE_OPTIONS = {
  path: '/',
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
};

const ACCESS_COOKIE_OPTIONS = {
  ...COOKIE_BASE_OPTIONS,
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
};

const REFRESH_COOKIE_OPTIONS = {
  ...COOKIE_BASE_OPTIONS,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

export async function login(req, res, next) {
  try {
    const { role, identifier, username, password } = req.body;
    const userAgent = req.headers['user-agent'] || null;
    const ipAddress = req.ip || req.socket.remoteAddress || null;

    const result = await authService.login({
      role,
      identifier,
      username,
      password,
      userAgent,
      ipAddress,
    });

    // Store tokens in browser cookies
    res.cookie('ugs_token', result.accessToken, ACCESS_COOKIE_OPTIONS);
    res.cookie('token', result.accessToken, ACCESS_COOKIE_OPTIONS);
    res.cookie('ugs_refresh_token', result.refreshToken, REFRESH_COOKIE_OPTIONS);
    res.cookie('refreshToken', result.refreshToken, REFRESH_COOKIE_OPTIONS);

    sendSuccess(res, {
      user: result.user,
      token: result.accessToken,
      refreshToken: result.refreshToken,
    });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req, res, next) {
  try {
    const refreshToken = req.cookies?.ugs_refresh_token || req.cookies?.refreshToken || req.body?.refreshToken;
    const userAgent = req.headers['user-agent'] || null;
    const ipAddress = req.ip || req.socket.remoteAddress || null;
    const result = await authService.refreshAccessToken(refreshToken, userAgent, ipAddress);

    // Update token in browser cookies
    res.cookie('ugs_token', result.accessToken, ACCESS_COOKIE_OPTIONS);
    res.cookie('token', result.accessToken, ACCESS_COOKIE_OPTIONS);

    sendSuccess(res, { token: result.accessToken, expiresIn: result.expiresIn });
  } catch (err) {
    next(err);
  }
}

export async function logout(req, res, next) {
  try {
    const refreshToken = req.cookies?.ugs_refresh_token || req.cookies?.refreshToken || req.body?.refreshToken;
    await authService.logout(req.user, refreshToken);

    // Clear token cookies from browser
    res.clearCookie('ugs_token', COOKIE_BASE_OPTIONS);
    res.clearCookie('token', COOKIE_BASE_OPTIONS);
    res.clearCookie('ugs_refresh_token', COOKIE_BASE_OPTIONS);
    res.clearCookie('refreshToken', COOKIE_BASE_OPTIONS);

    sendNoContent(res);
  } catch (err) {
    next(err);
  }
}

export async function getMe(req, res, next) {
  try {
    const result = await authService.getMe(req.user.id);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function updateProfile(req, res, next) {
  try {
    const user = await authService.updateProfile(req.user.id, req.body);
    sendSuccess(res, { user });
  } catch (err) {
    next(err);
  }
}

export async function changePassword(req, res, next) {
  try {
    await authService.changePassword(req.user.id, req.body);
    sendSuccess(res, { message: 'Password updated successfully.' });
  } catch (err) {
    next(err);
  }
}
