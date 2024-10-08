import * as authService from '../services/authService.js';
import { sendSuccess, sendNoContent } from '../utils/response.js';

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
    const { refreshToken } = req.body;
    const token = await authService.refreshToken(refreshToken);
    sendSuccess(res, { token });
  } catch (err) {
    next(err);
  }
}

export async function logout(req, res, next) {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await authService.revokeRefreshToken(refreshToken);
    }
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
