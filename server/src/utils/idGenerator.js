import crypto from 'crypto';

export function newId(prefix = '') {
  const bytes = crypto.randomBytes(8).toString('hex');
  return prefix ? `${prefix}_${bytes}` : bytes;
}

export function generateTemporaryPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const rnd = crypto.randomBytes(8);
  const core = Array.from(rnd)
    .map((b) => chars[b % chars.length])
    .join('');
  return `${core}7a!`;
}
