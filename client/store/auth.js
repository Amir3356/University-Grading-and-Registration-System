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

export async function login({ username, role, identifier }) {
  validate({
    role: () => (ROLE_OPTIONS.includes(role) ? null : 'Select your role.'),
  })
  const trimmed = String(username ?? '').trim()
  const name = trimmed.toLowerCase()
  const credential = String(identifier ?? '').trim().toLowerCase()
  const db = read()

  // 1. Try to find user matching entered username and selected role
  let user = name ? db.users.find((u) => u.username.toLowerCase() === name && u.roleId === role) : null

  // 2. Try to match the Student ID / Teacher ID credential
  if (!user && credential && (role === 'student' || role === 'teacher')) {
    const profile =
      role === 'student'
        ? db.students.find((s) => s.studentNumber.toLowerCase() === credential)
        : db.teachers.find((t) => t.employeeNumber.toLowerCase() === credential)
    if (profile) user = db.users.find((u) => u.id === profile.userId && u.roleId === role) ?? null
  }

  // 3. Try to match by email prefix or first/last name with matching role
  if (!user && name) {
    user = db.users.find(
      (u) =>
        u.roleId === role &&
        (u.email?.toLowerCase() === name ||
          u.email?.toLowerCase().startsWith(name + '@') ||
          u.firstName?.toLowerCase() === name ||
          u.lastName?.toLowerCase() === name),
    )
  }

  // 4. Fallback to default canonical account for this role (admin -> 'admin', teacher -> 'teacher', student -> 'student')
  if (!user) {
    user =
      db.users.find((u) => u.username.toLowerCase() === role && u.roleId === role) ||
      db.users.find((u) => u.roleId === role && u.status === 'active') ||
      db.users.find((u) => u.roleId === role)
  }

  if (!user) {
    throw unauthorized(`Could not find an account for role ${role}.`)
  }

  // Ensure user is active so they are never blocked by status
  if (user.status !== 'active') {
    transaction((tx) => tx.update('users', user.id, { status: 'active' }))
    user = read().users.find((u) => u.id === user.id) || user
  }

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
