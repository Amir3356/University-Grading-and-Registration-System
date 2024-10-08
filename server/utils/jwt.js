import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const getJwtSecret = () => process.env.JWT_SECRET || 'secret_jwt_access_key_university_grading';
const getJwtRefreshSecret = () => process.env.JWT_REFRESH_SECRET || 'secret_jwt_refresh_key_university_grading';
const getJwtExpiresIn = () => parseInt(process.env.JWT_EXPIRES_IN || '900', 10);
const getJwtRefreshExpiresIn = () => parseInt(process.env.JWT_REFRESH_EXPIRES_IN || '604800', 10);

export function signAccessToken(payload) {
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: getJwtExpiresIn(),
  });
}

export function signRefreshToken(payload) {
  return jwt.sign(payload, getJwtRefreshSecret(), {
    expiresIn: getJwtRefreshExpiresIn(),
  });
}

export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, getJwtSecret());
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, getJwtRefreshSecret());
  } catch {
    return null;
  }
}
