import { now, read, transaction } from './db'
import {
  audit,
  badRequest,
  clearCurrentUser,
  currentUser,
  hashPassword,
  makeSalt,
  setCurrentUserId,
  required,
  unauthorized,
  validate,
  validatePasswordStrength,
} from './helpers'
import { publicUser, studentView, teacherView } from './selectors'

function profileFor(user) {
  const db = read()
  if (user.roleId === 'teacher') return teacherView(db.teachers.find((t) => t.userId === user.id))
  if (user.roleId === 'student') return studentView(db.students.find((s) => s.userId === user.id))
  return null
}

export const ROLE_OPTIONS = ['admin', 'teacher', 'student']

export async function login({ username, password, role }) {
  validate({
    username: () => required(username, 'Username'),
    password: () => required(password, 'Password'),
    role: () => (ROLE_OPTIONS.includes(role) ? null : 'Select your role.'),
  })
  const name = String(username).trim().toLowerCase()
  const user = read().users.find((u) => u.username.toLowerCase() === name)
  // One generic message for unknown user, wrong password or wrong role, to avoid account enumeration.
  if (!user || user.roleId !== role || (await hashPassword(user.passwordSalt, password)) !== user.passwordHash) {
    throw unauthorized('Invalid username, password or role.')
  }
  if (user.status !== 'active') throw unauthorized('This account has been deactivated. Contact the registrar.')
  setCurrentUserId(user.id)
  transaction((tx) => {
    tx.update('users', user.id, { lastLoginAt: now() })
    audit(tx, user, { action: 'auth.login', entityType: 'user', entityId: user.id, details: 'Signed in' })
  })
  return { user: publicUser(user), profile: profileFor(user) }
}

export function logout() {
  try {
    const user = currentUser()
    transaction((tx) => audit(tx, user, { action: 'auth.logout', entityType: 'user', entityId: user.id, details: 'Signed out' }))
  } catch {
    // Already signed out.
  }
  clearCurrentUser()
  return { ok: true }
}

export function me() {
  const user = currentUser()
  return { user: publicUser(user), profile: profileFor(user) }
}

export function updateProfile({ firstName, lastName, phone }) {
  const user = currentUser()
  validate({ firstName: () => required(firstName, 'First name'), lastName: () => required(lastName, 'Last name') })
  transaction((tx) => {
    tx.update('users', user.id, { firstName: firstName.trim(), lastName: lastName.trim(), phone: phone?.trim() ?? '' })
    audit(tx, user, { action: 'user.profile_updated', entityType: 'user', entityId: user.id, details: 'Updated own profile' })
  })
  return { user: publicUser(read().users.find((u) => u.id === user.id)), profile: profileFor(user) }
}

export async function changePassword({ currentPassword, newPassword, confirmPassword }) {
  const user = currentUser()
  if ((await hashPassword(user.passwordSalt, currentPassword || '')) !== user.passwordHash) {
    throw badRequest('Current password is incorrect.', { currentPassword: 'Current password is incorrect.' })
  }
  validate({
    newPassword: () => validatePasswordStrength(newPassword),
    confirmPassword: () => (newPassword !== confirmPassword ? 'Passwords do not match.' : null),
  })
  const salt = makeSalt()
  const hash = await hashPassword(salt, newPassword)
  transaction((tx) => {
    tx.update('users', user.id, { passwordSalt: salt, passwordHash: hash, mustChangePassword: false })
    audit(tx, user, { action: 'auth.password_changed', entityType: 'user', entityId: user.id, details: 'Changed own password' })
  })
  return { ok: true }
}
