import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

export async function hashPassword(plainText) {
  return await bcrypt.hash(plainText, SALT_ROUNDS);
}

export async function comparePassword(plainText, hash) {
  return await bcrypt.compare(plainText, hash);
}

export function validatePasswordStrength(pw) {
  if (!pw || pw.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(pw) || !/[a-z]/.test(pw) || !/\d/.test(pw)) {
    return 'Use upper- and lower-case letters and a number.';
  }
  return null;
}
