import * as authService from '../services/authService.js';

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

    res.status(200).json({
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
    res.status(200).json({ token });
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
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

export async function getMe(req, res, next) {
  try {
    const result = await authService.getMe(req.user.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function updateProfile(req, res, next) {
  try {
    const user = await authService.updateProfile(req.user.id, req.body);
    res.status(200).json({ user });
  } catch (err) {
    next(err);
  }
}

export async function changePassword(req, res, next) {
  try {
    await authService.changePassword(req.user.id, req.body);
    res.status(200).json({ message: 'Password updated successfully.' });
  } catch (err) {
    next(err);
  }
}
