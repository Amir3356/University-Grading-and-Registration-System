import { newId, now, read, transaction } from './db'
import {
  audit,
  badRequest,
  conflict,
  forbidden,
  generateTempPassword,
  hashPassword,
  isEmail,
  makeSalt,
  matches,
  notFound,
  notify,
  numberIn,
  paginate,
  required,
  requireRole,
  sortBy,
  validate,
  validatePasswordStrength,
} from './helpers'
import { academicRecordFor, offeringView, publicUser, studentView, teacherView } from './selectors'

function userRow(u) {
  const db = read()
  const base = publicUser(u)
  const name = `${u.firstName} ${u.lastName}`
  if (u.roleId === 'student') {
    const s = db.students.find((x) => x.userId === u.id)
    const dep = db.departments.find((d) => d.id === s?.departmentId)
    return { ...base, name, profileId: s?.id, identifier: s?.studentNumber, departmentId: s?.departmentId, departmentName: dep?.name ?? '—', program: s?.program }
  }
  if (u.roleId === 'teacher' || u.roleId === 'dept_head') {
    const t = db.teachers.find((x) => x.userId === u.id)
    const dep = db.departments.find((d) => d.id === t?.departmentId)
    return { ...base, name, profileId: t?.id, identifier: t?.employeeNumber, departmentId: t?.departmentId, departmentName: dep?.name ?? '—', title: t?.title }
  }
  return { ...base, name, identifier: '—', departmentName: '—' }
}

export function listUsers({ search, role, status, departmentId, page, pageSize, sort } = {}) {
  requireRole('admin', 'dept_head')
  let items = read()
    .users.map(userRow)
    .filter((u) => (!role || u.roleId === role) && (!status || u.status === status) && (!departmentId || u.departmentId === departmentId))
    .filter((u) => matches(search, u.name, u.username, u.email, u.identifier))
  items = sortBy(items, sort?.key ? sort : { key: 'name', dir: 'asc' })
  return paginate(items, { page, pageSize })
}

export function getUser(id) {
  requireRole('admin', 'dept_head')
  const db = read()
  const u = db.users.find((x) => x.id === id)
  if (!u) throw notFound('User')
  const row = userRow(u)
  if (u.roleId === 'student') {
    const s = db.students.find((x) => x.userId === u.id)
    const record = academicRecordFor(s.id)
    row.profile = studentView(s)
    row.summary = {
      enrollments: db.courseEnrollments.filter((e) => e.studentId === s.id).length,
      cgpa: record.cgpa,
      earnedCredits: record.earnedCredits,
    }
  }
  if (u.roleId === 'teacher') {
    const t = db.teachers.find((x) => x.userId === u.id)
    row.profile = teacherView(t)
    row.offerings = db.courseOfferings.filter((o) => o.teacherId === t.id).map(offeringView)
  }
  row.recentActivity = db.auditLogs.filter((a) => a.userId === u.id).slice(0, 10)
  return row
}

function validateProfile(data, roleId) {
  return {
    firstName: () => required(data.firstName, 'First name'),
    lastName: () => required(data.lastName, 'Last name'),
    email: () => required(data.email, 'Email') || isEmail(data.email),
    roleId: () => (['admin', 'teacher', 'student', 'dept_head'].includes(roleId) ? null : 'Choose a role.'),
    departmentId: () => (roleId !== 'admin' && !read().departments.some((d) => d.id === data.departmentId) ? 'Choose a department.' : null),
    identifier: () => (roleId !== 'admin' ? required(data.identifier, roleId === 'student' ? 'Student ID' : roleId === 'dept_head' ? 'Department Head ID' : 'Employee ID') : null),
    admissionYear: () => (roleId === 'student' ? numberIn(data.admissionYear, 2000, 2100, 'Admission year') : null),
  }
}

function uniqueUsername(email) {
  const taken = new Set(read().users.map((u) => u.username.toLowerCase()))
  const base = email.trim().toLowerCase().split('@')[0].replace(/[^a-z0-9._-]/g, '') || 'user'
  let name = base
  for (let i = 2; taken.has(name); i++) name = `${base}${i}`
  return name
}

/** Validates an explicitly chosen username (blank = generate one from the email). */
function validateUsername(data, ignoreUserId) {
  const value = String(data.username ?? '').trim()
  if (!value) {
    if (ignoreUserId) return null
    return 'Enter a username.'
  }
  if (!/^[a-z0-9._-]{3,32}$/i.test(value)) return 'Use 3–32 letters, numbers, dots, dashes or underscores.'
  if (read().users.some((u) => u.username.toLowerCase() === value.toLowerCase() && u.id !== ignoreUserId)) return 'This username is already taken.'
  return null
}

const EMAIL_DOMAIN = 'university.edu'

/** Suggested unique email derived from a full name, e.g. jane.doe@university.edu. */
export function suggestEmail(name) {
  requireRole('admin', 'dept_head')
  const base =
    String(name ?? '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s.-]/g, '')
      .split(/\s+/)
      .filter(Boolean)
      .join('.') || 'user'
  const taken = new Set(read().users.map((u) => u.email.toLowerCase()))
  let email = `${base}@${EMAIL_DOMAIN}`
  for (let i = 2; taken.has(email); i++) email = `${base}${i}@${EMAIL_DOMAIN}`
  return email
}

/** Suggested unique ID for a new student or teacher account ('' for admins). */
export function suggestIdentifier(roleId, departmentId) {
  requireRole('admin', 'dept_head')
  const db = read()
  const year = now().slice(2, 4)
  if (roleId === 'student') {
    const taken = new Set(db.students.map((s) => s.studentNumber))
    let n = db.students.length + 1
    let id = `UGR/${year}/${String(n).padStart(4, '0')}`
    while (taken.has(id)) id = `UGR/${year}/${String(++n).padStart(4, '0')}`
    return id
  }
  if (roleId === 'teacher') {
    const code = db.departments.find((d) => d.id === departmentId)?.code ?? 'GEN'
    const taken = new Set(db.teachers.map((t) => t.employeeNumber))
    let n = db.teachers.filter((t) => t.employeeNumber.startsWith(`EMP-${code}-`)).length + 1
    let id = `EMP-${code}-${String(n).padStart(2, '0')}`
    while (taken.has(id)) id = `EMP-${code}-${String(++n).padStart(2, '0')}`
    return id
  }
  return ''
}

function assertUnique(data, ignoreUserId) {
  const db = read()
  const email = data.email.trim().toLowerCase()
  if (db.users.some((u) => u.email.toLowerCase() === email && u.id !== ignoreUserId)) {
    throw badRequest('Please correct the highlighted fields.', { email: 'This email is already in use.' })
  }
  if (data.identifier) {
    const clash =
      db.students.some((s) => s.studentNumber === data.identifier.trim() && s.userId !== ignoreUserId) ||
      db.teachers.some((t) => t.employeeNumber === data.identifier.trim() && t.userId !== ignoreUserId)
    if (clash) throw badRequest('Please correct the highlighted fields.', { identifier: 'This ID is already assigned.' })
  }
}

export async function createUser(data) {
  const actor = requireRole('admin', 'dept_head')
  if (actor.roleId === 'dept_head' && data.roleId !== 'student') {
    throw forbidden('Department heads can only create student accounts.')
  }
  validate({ ...validateProfile(data, data.roleId), username: () => validateUsername(data) })
  if (data.password) validate({ password: () => validatePasswordStrength(data.password) })
  assertUnique(data)
  const temporaryPassword = data.password || generateTempPassword()
  const salt = makeSalt()
  const hash = await hashPassword(salt, temporaryPassword)
  const created = transaction((tx) => {
    const user = tx.insert('users', {
      id: newId('usr'),
      roleId: data.roleId,
      username: String(data.username ?? '').trim() || uniqueUsername(data.email),
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      email: data.email.trim().toLowerCase(),
      phone: data.phone?.trim() ?? '',
      status: 'active',
      passwordSalt: salt,
      passwordHash: hash,
      mustChangePassword: true,
      createdAt: now(),
      updatedAt: now(),
      lastLoginAt: null,
    })
    if (data.roleId === 'student') {
      tx.insert('students', {
        id: newId('stu'),
        userId: user.id,
        studentNumber: data.identifier.trim(),
        departmentId: data.departmentId,
        program: data.program?.trim() || read().departments.find((d) => d.id === data.departmentId).name,
        admissionYear: Number(data.admissionYear),
        dateOfBirth: data.dateOfBirth || null,
        status: 'active',
      })
    }
    if (data.roleId === 'teacher' || data.roleId === 'dept_head') {
      const tch = tx.insert('teachers', {
        id: newId('tch'),
        userId: user.id,
        employeeNumber: data.identifier.trim(),
        departmentId: data.departmentId,
        title: data.title || (data.roleId === 'dept_head' ? 'Prof.' : 'Dr.'),
        specialization: data.specialization?.trim() ?? '',
        officeRoom: data.officeRoom?.trim() ?? '',
        hireDate: now().slice(0, 10),
      })
      if (data.roleId === 'dept_head') {
        tx.update('departments', data.departmentId, { headTeacherId: tch.id })
      }
    }
    notify(tx, user.id, { title: 'Welcome', message: 'Your account has been created. Please change your temporary password.', type: 'system', link: '/profile' })
    audit(tx, actor, { action: 'user.created', entityType: 'user', entityId: user.id, details: `Created ${data.roleId} account for ${user.firstName} ${user.lastName}`, after: { email: user.email, roleId: user.roleId } })
    return user
  })
  return { user: userRow(created), username: created.username, temporaryPassword }
}

export async function updateUser(id, data) {
  const actor = requireRole('admin', 'dept_head')
  const db = read()
  const u = db.users.find((x) => x.id === id)
  if (!u) throw notFound('User')
  if (actor.roleId === 'dept_head' && u.roleId !== 'student') {
    throw forbidden('Department heads can only update student accounts.')
  }
  const roleId = data.roleId ?? u.roleId
  const password = String(data.password ?? '')
  validate({ ...validateProfile(data, roleId), username: () => validateUsername(data, id) })
  if (password) validate({ password: () => validatePasswordStrength(password) })
  assertUnique(data, id)
  if (id === actor.id && roleId !== 'admin') throw forbidden('You cannot remove your own administrator role.')

  let credentials = null
  if (password) {
    const salt = makeSalt()
    credentials = { passwordSalt: salt, passwordHash: await hashPassword(salt, password), mustChangePassword: true }
  }

  // Role changes must not orphan academic records.
  if (roleId !== u.roleId) {
    const s = db.students.find((x) => x.userId === id)
    const t = db.teachers.find((x) => x.userId === id)
    if (s && db.courseEnrollments.some((e) => e.studentId === s.id)) throw conflict('This student has enrollment records; their role cannot be changed.')
    if (t && db.courseOfferings.some((o) => o.teacherId === t.id)) throw conflict('This teacher has course assignments; reassign them before changing the role.')
  }

  transaction((tx) => {
    const before = { firstName: u.firstName, lastName: u.lastName, email: u.email, roleId: u.roleId }
    tx.update('users', id, { firstName: data.firstName.trim(), lastName: data.lastName.trim(), username: String(data.username ?? '').trim() || u.username, email: data.email.trim().toLowerCase(), phone: data.phone?.trim() ?? '', roleId, ...(credentials ?? {}) })
    if (roleId !== u.roleId) {
      tx.remove('students', (s) => s.userId === id)
      tx.remove('teachers', (t) => t.userId === id)
    }
    if (roleId === 'student') {
      const s = tx.table('students').find((x) => x.userId === id)
      const patch = { studentNumber: data.identifier.trim(), departmentId: data.departmentId, program: data.program?.trim() ?? '', admissionYear: Number(data.admissionYear), dateOfBirth: data.dateOfBirth || null }
      if (s) Object.assign(s, patch)
      else tx.insert('students', { id: newId('stu'), userId: id, status: 'active', ...patch })
    }
    if (roleId === 'teacher' || roleId === 'dept_head') {
      const t = tx.table('teachers').find((x) => x.userId === id)
      const patch = { employeeNumber: data.identifier.trim(), departmentId: data.departmentId, title: data.title || (roleId === 'dept_head' ? 'Prof.' : 'Dr.'), specialization: data.specialization?.trim() ?? '', officeRoom: data.officeRoom?.trim() ?? '' }
      if (t) Object.assign(t, patch)
      else tx.insert('teachers', { id: newId('tch'), userId: id, hireDate: now().slice(0, 10), ...patch })
      if (roleId === 'dept_head') {
        const headTch = t || tx.table('teachers').find((x) => x.userId === id)
        if (headTch) tx.update('departments', data.departmentId, { headTeacherId: headTch.id })
      }
    }
    audit(tx, actor, {
      action: roleId !== u.roleId ? 'user.role_changed' : 'user.updated',
      entityType: 'user',
      entityId: id,
      details: `Updated account for ${data.firstName} ${data.lastName}`,
      before,
      after: { firstName: data.firstName, lastName: data.lastName, email: data.email, roleId },
    })
    if (credentials) {
      audit(tx, actor, { action: 'user.password_changed', entityType: 'user', entityId: id, details: `Changed password for ${data.firstName} ${data.lastName}` })
    }
  })
  return userRow(read().users.find((x) => x.id === id))
}

export function setUserStatus(id, { status, reason }) {
  const actor = requireRole('admin', 'dept_head')
  if (!['active', 'inactive'].includes(status)) throw badRequest('Invalid status.')
  if (id === actor.id) throw forbidden('You cannot deactivate your own account.')
  const u = read().users.find((x) => x.id === id)
  if (!u) throw notFound('User')
  if (status === 'inactive') validate({ reason: () => required(reason, 'Reason') })
  transaction((tx) => {
    tx.update('users', id, { status })
    const s = tx.table('students').find((x) => x.userId === id)
    if (s) s.status = status === 'active' ? 'active' : 'suspended'
    audit(tx, actor, {
      action: status === 'active' ? 'user.activated' : 'user.deactivated',
      entityType: 'user',
      entityId: id,
      details: `${status === 'active' ? 'Activated' : 'Deactivated'} account for ${u.firstName} ${u.lastName}`,
      reason: reason || null,
      before: { status: u.status },
      after: { status },
    })
  })
  return userRow(read().users.find((x) => x.id === id))
}

/** Permanently removes an account. Blocked when linked academic records exist. */
export function deleteUser(id) {
  const actor = requireRole('admin', 'dept_head')
  const db = read()
  const u = db.users.find((x) => x.id === id)
  if (!u) throw notFound('User')
  if (id === actor.id) throw forbidden('You cannot delete your own account.')
  if (actor.roleId === 'dept_head' && u.roleId !== 'student') {
    throw forbidden('Department heads can only delete student accounts.')
  }
  const s = db.students.find((x) => x.userId === id)
  const t = db.teachers.find((x) => x.userId === id)
  if (s && db.courseEnrollments.some((e) => e.studentId === s.id)) {
    throw conflict('This student has enrollment records and cannot be deleted. Deactivate the account instead.')
  }
  if (t && db.courseOfferings.some((o) => o.teacherId === t.id)) {
    throw conflict('This teacher has course assignments and cannot be deleted. Deactivate the account instead.')
  }
  transaction((tx) => {
    tx.remove('users', (x) => x.id === id)
    tx.remove('students', (x) => x.userId === id)
    tx.remove('teachers', (x) => x.userId === id)
    tx.remove('notifications', (n) => n.userId === id)
    audit(tx, actor, { action: 'user.deleted', entityType: 'user', entityId: id, details: `Deleted account for ${u.firstName} ${u.lastName}`, before: { email: u.email, roleId: u.roleId } })
  })
  return { ok: true }
}

export async function resetUserPassword(id) {
  const actor = requireRole('admin', 'dept_head')
  const u = read().users.find((x) => x.id === id)
  if (!u) throw notFound('User')
  const temporaryPassword = generateTempPassword()
  const salt = makeSalt()
  const hash = await hashPassword(salt, temporaryPassword)
  transaction((tx) => {
    tx.update('users', id, { passwordSalt: salt, passwordHash: hash, mustChangePassword: true })
    notify(tx, id, { title: 'Password reset', message: 'An administrator reset your password. Please choose a new one after signing in.', type: 'system', link: '/profile' })
    audit(tx, actor, { action: 'user.password_reset', entityType: 'user', entityId: id, details: `Reset password for ${u.firstName} ${u.lastName}` })
  })
  return { temporaryPassword }
}

/** Students search for pickers (enrollment, transcripts, reports). */
export function searchStudents({ search, departmentId, status, page = 1, pageSize = 20 } = {}) {
  requireRole('admin', 'dept_head')
  const items = read()
    .students.map(studentView)
    .filter((s) => (!departmentId || s.departmentId === departmentId) && (!status || s.status === status))
    .filter((s) => matches(search, s.name, s.studentNumber, s.email))
    .sort((a, b) => a.name.localeCompare(b.name))
  return paginate(items, { page, pageSize })
}
