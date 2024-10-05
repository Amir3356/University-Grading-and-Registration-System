import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export function signAccessToken(payload) {
  return jwt.sign(payload, env.JWT.secret, {
    expiresIn: env.JWT.expiresIn,
  });
}

export function signRefreshToken(payload) {
  return jwt.sign(payload, env.JWT.refreshSecret, {
    expiresIn: env.JWT.refreshExpiresIn,
  });
}

export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, env.JWT.secret);
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, env.JWT.refreshSecret);
  } catch {
    return null;
  }
}
