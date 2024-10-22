
// Shared helpers for the local data store: errors, the signed-in user, role checks,
// validation, pagination, audit logging and notifications.
import { newId, now, read } from './db'

/** Error raised by store functions. kind: 'validation' | 'unauthenticated' | 'forbidden' | 'not_found' | 'conflict' */
export class StoreError extends Error {
  constructor(kind, message, fieldErrors = null) {
    super(message)
    this.name = 'StoreError'
    this.kind = kind
    this.fieldErrors = fieldErrors
  }
}

export const badRequest = (msg, fieldErrors) => new StoreError('validation', msg, fieldErrors)
export const unauthorized = (msg = 'Please sign in again.') => new StoreError('unauthenticated', msg)
export const forbidden = (msg = 'You do not have permission to perform this action.') => new StoreError('forbidden', msg)
export const notFound = (what = 'Record') => new StoreError('not_found', `${what} not found.`)
export const conflict = (msg) => new StoreError('conflict', msg)

// ---------------- Signed-in user ----------------
const SESSION_KEY = 'ugs-current-user'

export function setCurrentUserId(userId) {
  localStorage.setItem(SESSION_KEY, userId)
}

export function clearCurrentUser() {
  localStorage.removeItem(SESSION_KEY)
}

/** The signed-in user, read from the store. */
export function currentUser() {
  const id = localStorage.getItem(SESSION_KEY)
  const user = id ? read().users.find((u) => u.id === id) : null
  if (!user || user.status !== 'active') {
    clearCurrentUser()
    throw unauthorized()
  }
  return user
}

/** The signed-in user must have one of the given roles. */
export function requireRole(...roles) {
  const user = currentUser()
  if (!roles.includes(user.roleId)) throw forbidden()
  return user
}

export function teacherProfile(user) {
  const t = read().teachers.find((x) => x.userId === user.id)
  if (!t) throw forbidden('No teacher profile is linked to this account.')
  return t
}

export function studentProfile(user) {
  const s = read().students.find((x) => x.userId === user.id)
  if (!s) throw forbidden('No student profile is linked to this account.')
  return s
}

/** Teachers may only touch offerings assigned to them; admins may touch any; dept heads may access offerings in their department. */
export function assertOfferingAccess(user, offeringId) {
  const offering = read().courseOfferings.find((o) => o.id === offeringId)
  if (!offering) throw notFound('Course offering')
  if (user.roleId === 'admin') return offering
  if (user.roleId === 'dept_head') {
    const db = read()
    const deptHeadTeacher = db.teachers.find((t) => t.userId === user.id)
    const course = db.courses.find((c) => c.id === offering.courseId)
    if (!deptHeadTeacher || !course || course.departmentId === deptHeadTeacher.departmentId || offering.teacherId === deptHeadTeacher.id) {
      return offering
    }
  }
  if (user.roleId === 'teacher' && offering.teacherId === teacherProfile(user).id) return offering
  throw forbidden('This course offering is not assigned to you.')
}

// ---------------- Passwords ----------------
export async function hashPassword(salt, password) {
  const data = new TextEncoder().encode(`${salt}:${password}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function makeSalt() {
  return [...crypto.getRandomValues(new Uint8Array(4))].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function validatePasswordStrength(pw) {
  if (!pw || pw.length < 8) return 'Password must be at least 8 characters.'
  if (!/[A-Z]/.test(pw) || !/[a-z]/.test(pw) || !/\d/.test(pw)) return 'Use upper- and lower-case letters and a number.'
  return null
}

export function generateTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  const rnd = crypto.getRandomValues(new Uint8Array(10))
  return `${[...rnd].map((b) => chars[b % chars.length]).join('')}7a`
}

// ---------------- Validation helpers ----------------
export function validate(rules) {
  const errors = {}
  for (const [field, check] of Object.entries(rules)) {
    const msg = check()
    if (msg) errors[field] = msg
  }
  if (Object.keys(errors).length) throw badRequest('Please correct the highlighted fields.', errors)
}

export const required = (v, label = 'This field') => (v == null || String(v).trim() === '' ? `${label} is required.` : null)
export const isEmail = (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '')) ? null : 'Enter a valid email address.')
export const numberIn = (v, min, max, label = 'Value') => {
  const n = Number(v)
  if (v === '' || v == null || Number.isNaN(n)) return `${label} must be a number.`
  if (n < min || n > max) return `${label} must be between ${min} and ${max}.`
  return null
}

// ---------------- Pagination / search ----------------
export function paginate(items, { page = 1, pageSize = 10 } = {}) {
  const total = items.length
  if (pageSize === null || pageSize === false || pageSize === 0) {
    return { items, total, page: 1, pageSize: total, pageCount: 1 }
  }
  const size = Math.max(1, Math.min(100, Number(pageSize) || 10))
  const pageCount = Math.max(1, Math.ceil(total / size))
  const p = Math.min(Math.max(1, Number(page) || 1), pageCount)
  return { items: items.slice((p - 1) * size, p * size), total, page: p, pageSize: size, pageCount }
}

export function matches(search, ...fields) {
  if (!search) return true
  const q = String(search).toLowerCase().trim()
  return fields.some((f) => f != null && String(f).toLowerCase().includes(q))
}

export function sortBy(items, sort) {
  if (!sort?.key) return items
  const dir = sort.dir === 'desc' ? -1 : 1
  return [...items].sort((a, b) => {
    const av = a[sort.key]
    const bv = b[sort.key]
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
    return String(av).localeCompare(String(bv), undefined, { numeric: true }) * dir
  })
}

// ---------------- Side effects (inside transactions) ----------------

export function notify(tx, userId, { title, message, type = 'system', link = null }) {
  tx.insert('notifications', { id: newId('ntf'), userId, title, message, type, link, isRead: false, createdAt: now() })
}

export function notifyAdmins(tx, payload) {
  for (const u of tx.table('users').filter((x) => x.roleId === 'admin' && x.status === 'active')) notify(tx, u.id, payload)
}
