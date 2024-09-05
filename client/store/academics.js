// Departments, courses, academic calendar, course offerings (teacher assignment) and enrollment.
import { newId, now, read, transaction } from './db'
import {
  audit,
  badRequest,
  conflict,
  matches,
  notFound,
  notify,
  numberIn,
  paginate,
  required,
  requireRole,
  sortBy,
  validate,
} from './helpers'
import { courseView, offeringView, semesterView, studentView, teacherView } from './selectors'

// ---------------- Departments ----------------
export function listDepartments({ search } = {}) {
  requireRole('admin')
  const db = read()
  return db.departments
    .filter((d) => matches(search, d.name, d.code))
    .map((d) => ({
      ...d,
      head: teacherView(db.teachers.find((t) => t.id === d.headTeacherId)),
      courseCount: db.courses.filter((c) => c.departmentId === d.id).length,
      teacherCount: db.teachers.filter((t) => t.departmentId === d.id).length,
      studentCount: db.students.filter((s) => s.departmentId === d.id).length,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

function validateDepartment(data, ignoreId) {
  validate({
    code: () =>
      required(data.code, 'Code') ||
      (!/^[A-Z]{2,6}$/.test(String(data.code).trim().toUpperCase()) ? 'Use 2–6 letters.' : null) ||
      (read().departments.some((d) => d.code === data.code.trim().toUpperCase() && d.id !== ignoreId) ? 'Code already exists.' : null),
    name: () => required(data.name, 'Name'),
    headTeacherId: () =>
      data.headTeacherId && !read().teachers.some((t) => t.id === data.headTeacherId && (!ignoreId || t.departmentId === ignoreId))
        ? 'Head must be a teacher in this department.'
        : null,
  })
}

export function createDepartment(data) {
  const actor = requireRole('admin')
  validateDepartment({ ...data, headTeacherId: null })
  return transaction((tx) => {
    const d = tx.insert('departments', { id: newId('dep'), code: data.code.trim().toUpperCase(), name: data.name.trim(), description: data.description?.trim() ?? '', headTeacherId: null, createdAt: now(), updatedAt: now() })
    audit(tx, actor, { action: 'department.created', entityType: 'department', entityId: d.id, details: `Created department ${d.name}` })
    return d
  })
}

export function updateDepartment(id, data) {
  const actor = requireRole('admin')
  const dep = read().departments.find((d) => d.id === id)
  if (!dep) throw notFound('Department')
  validateDepartment(data, id)
  return transaction((tx) => {
    const d = tx.update('departments', id, { code: data.code.trim().toUpperCase(), name: data.name.trim(), description: data.description?.trim() ?? '', headTeacherId: data.headTeacherId || null })
    audit(tx, actor, { action: 'department.updated', entityType: 'department', entityId: id, details: `Updated department ${d.name}`, before: { name: dep.name, code: dep.code }, after: { name: d.name, code: d.code } })
    return d
  })
}

export function deleteDepartment(id) {
  const actor = requireRole('admin')
  const db = read()
  const dep = db.departments.find((d) => d.id === id)
  if (!dep) throw notFound('Department')
  if (db.courses.some((c) => c.departmentId === id) || db.teachers.some((t) => t.departmentId === id) || db.students.some((s) => s.departmentId === id)) {
    throw conflict('This department still has courses, teachers or students and cannot be deleted.')
  }
  transaction((tx) => {
    tx.remove('departments', (d) => d.id === id)
    audit(tx, actor, { action: 'department.deleted', entityType: 'department', entityId: id, details: `Deleted department ${dep.name}` })
  })
  return { ok: true }
}

// ---------------- Courses ----------------
export function listCourses({ search, departmentId, status, page, pageSize, sort } = {}) {
  requireRole('admin')
  const db = read()
  let items = db.courses
    .filter((c) => (!departmentId || c.departmentId === departmentId) && (!status || c.status === status))
    .filter((c) => matches(search, c.code, c.title))
    .map((c) => ({ ...courseView(c), departmentName: db.departments.find((d) => d.id === c.departmentId)?.name, offeringCount: db.courseOfferings.filter((o) => o.courseId === c.id).length }))
  items = sortBy(items, sort?.key ? sort : { key: 'code', dir: 'asc' })
  return paginate(items, { page, pageSize })
}

function validateCourse(data, ignoreId) {
  validate({
    code: () =>
      required(data.code, 'Course code') ||
      (!/^[A-Z]{2,6}\d{3}[A-Z]?$/.test(String(data.code).trim().toUpperCase()) ? 'Use a format like CS101.' : null) ||
      (read().courses.some((c) => c.code === data.code.trim().toUpperCase() && c.id !== ignoreId) ? 'Course code already exists.' : null),
    title: () => required(data.title, 'Title'),
    departmentId: () => (read().departments.some((d) => d.id === data.departmentId) ? null : 'Choose a department.'),
    creditHours: () => numberIn(data.creditHours, 1, 6, 'Credit hours'),
    level: () => numberIn(data.level, 100, 900, 'Level'),
  })
}

export function createCourse(data) {
  const actor = requireRole('admin')
  validateCourse(data)
  return transaction((tx) => {
    const c = tx.insert('courses', {
      id: newId('crs'),
      code: data.code.trim().toUpperCase(),
      title: data.title.trim(),
      departmentId: data.departmentId,
      creditHours: Number(data.creditHours),
      level: Number(data.level),
      description: data.description?.trim() ?? '',
      status: 'active',
      createdAt: now(),
      updatedAt: now(),
    })
    audit(tx, actor, { action: 'course.created', entityType: 'course', entityId: c.id, details: `Created course ${c.code} ${c.title}` })
    return c
  })
}

export function updateCourse(id, data) {
  const actor = requireRole('admin')
  const course = read().courses.find((c) => c.id === id)
  if (!course) throw notFound('Course')
  validateCourse(data, id)
  const hasPublished = read().courseOfferings.some((o) => o.courseId === id && o.gradeStatus === 'published')
  if (hasPublished && Number(data.creditHours) !== course.creditHours) {
    throw conflict('Credit hours cannot change after grades have been published for this course; create a new course version instead.')
  }
  return transaction((tx) => {
    const c = tx.update('courses', id, {
      code: data.code.trim().toUpperCase(),
      title: data.title.trim(),
      departmentId: data.departmentId,
      creditHours: Number(data.creditHours),
      level: Number(data.level),
      description: data.description?.trim() ?? '',
      status: data.status ?? course.status,
    })
    audit(tx, actor, { action: 'course.updated', entityType: 'course', entityId: id, details: `Updated course ${c.code}`, before: { title: course.title, creditHours: course.creditHours, status: course.status }, after: { title: c.title, creditHours: c.creditHours, status: c.status } })
    return c
  })
}

export function deleteCourse(id) {
  const actor = requireRole('admin')
  const course = read().courses.find((c) => c.id === id)
  if (!course) throw notFound('Course')
  if (read().courseOfferings.some((o) => o.courseId === id)) throw conflict('This course has been offered and cannot be deleted. Archive it instead.')
  transaction((tx) => {
    tx.remove('courses', (c) => c.id === id)
    audit(tx, actor, { action: 'course.deleted', entityType: 'course', entityId: id, details: `Deleted course ${course.code}` })
  })
  return { ok: true }
}

// ---------------- Academic years & semesters ----------------
export function listAcademicCalendar() {
  requireRole('admin')
  const db = read()
  return [...db.academicYears]
    .sort((a, b) => b.startDate.localeCompare(a.startDate))
    .map((y) => ({
      ...y,
      semesters: db.semesters
        .filter((s) => s.academicYearId === y.id)
        .sort((a, b) => a.order - b.order)
        .map((s) => ({ ...s, offeringCount: db.courseOfferings.filter((o) => o.semesterId === s.id).length })),
    }))
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const dateCheck = (v, label) => required(v, label) || (!DATE_RE.test(v) ? `${label} must be a valid date.` : null)

export function createAcademicYear(data) {
  const actor = requireRole('admin')
  validate({
    name: () =>
      required(data.name, 'Name') ||
      (!/^\d{4}\/\d{4}$/.test(data.name.trim()) ? 'Use the format 2027/2028.' : null) ||
      (read().academicYears.some((y) => y.name === data.name.trim()) ? 'This academic year already exists.' : null),
    startDate: () => dateCheck(data.startDate, 'Start date'),
    endDate: () => dateCheck(data.endDate, 'End date') || (data.endDate <= data.startDate ? 'End date must be after the start date.' : null),
  })
  return transaction((tx) => {
    const y = tx.insert('academicYears', { id: newId('ay'), name: data.name.trim(), startDate: data.startDate, endDate: data.endDate, isCurrent: false, createdAt: now() })
    audit(tx, actor, { action: 'academic_year.created', entityType: 'academic_year', entityId: y.id, details: `Created academic year ${y.name}` })
    return y
  })
}

export function updateAcademicYear(id, data) {
  const actor = requireRole('admin')
  if (!read().academicYears.some((y) => y.id === id)) throw notFound('Academic year')
  validate({
    startDate: () => dateCheck(data.startDate, 'Start date'),
    endDate: () => dateCheck(data.endDate, 'End date') || (data.endDate <= data.startDate ? 'End date must be after the start date.' : null),
  })
  return transaction((tx) => {
    const y = tx.update('academicYears', id, { startDate: data.startDate, endDate: data.endDate })
    audit(tx, actor, { action: 'academic_year.updated', entityType: 'academic_year', entityId: id, details: `Updated academic year ${y.name}` })
    return y
  })
}

function validateSemester(data, ignoreId) {
  const year = read().academicYears.find((y) => y.id === data.academicYearId)
  validate({
    academicYearId: () => (year ? null : 'Choose an academic year.'),
    term: () => (['Fall', 'Spring', 'Summer'].includes(data.term) ? null : 'Choose a term.'),
    startDate: () => dateCheck(data.startDate, 'Start date') || (year && (data.startDate < year.startDate || data.startDate > year.endDate) ? 'Must fall within the academic year.' : null),
    endDate: () => dateCheck(data.endDate, 'End date') || (data.endDate <= data.startDate ? 'End date must be after the start date.' : null),
    gradeSubmissionDeadline: () => dateCheck(data.gradeSubmissionDeadline, 'Grade deadline') || (data.gradeSubmissionDeadline < data.endDate ? 'Deadline must be on or after the end date.' : null),
  })
  if (read().semesters.some((s) => s.academicYearId === data.academicYearId && s.term === data.term && s.id !== ignoreId)) {
    throw badRequest('Please correct the highlighted fields.', { term: `${data.term} already exists in this academic year.` })
  }
}

export function createSemester(data) {
  const actor = requireRole('admin')
  validateSemester(data)
  return transaction((tx) => {
    const year = tx.find('academicYears', data.academicYearId)
    const order = Math.max(0, ...tx.table('semesters').map((s) => s.order)) + 1
    const s = tx.insert('semesters', {
      id: newId('sem'),
      academicYearId: data.academicYearId,
      name: `${data.term} ${year.name}`,
      term: data.term,
      order,
      startDate: data.startDate,
      endDate: data.endDate,
      gradeSubmissionDeadline: data.gradeSubmissionDeadline,
      isCurrent: false,
      status: 'upcoming',
      createdAt: now(),
    })
    // Keep chronological ordering consistent.
    const sorted = [...tx.table('semesters')].sort((a, b) => a.startDate.localeCompare(b.startDate))
    sorted.forEach((sem, i) => (sem.order = i + 1))
    audit(tx, actor, { action: 'semester.created', entityType: 'semester', entityId: s.id, details: `Created semester ${s.name}` })
    return s
  })
}

export function updateSemester(id, data) {
  const actor = requireRole('admin')
  const sem = read().semesters.find((s) => s.id === id)
  if (!sem) throw notFound('Semester')
  validateSemester({ ...data, academicYearId: sem.academicYearId, term: sem.term }, id)
  return transaction((tx) => {
    const s = tx.update('semesters', id, { startDate: data.startDate, endDate: data.endDate, gradeSubmissionDeadline: data.gradeSubmissionDeadline, status: data.status ?? sem.status })
    audit(tx, actor, { action: 'semester.updated', entityType: 'semester', entityId: id, details: `Updated semester ${s.name}` })
    return s
  })
}

export function setCurrentSemester(id) {
  const actor = requireRole('admin')
  const sem = read().semesters.find((s) => s.id === id)
  if (!sem) throw notFound('Semester')
  transaction((tx) => {
    for (const s of tx.table('semesters')) {
      s.isCurrent = s.id === id
      s.status = s.order < sem.order ? 'closed' : s.id === id ? 'active' : 'upcoming'
    }
    for (const y of tx.table('academicYears')) y.isCurrent = y.id === sem.academicYearId
    audit(tx, actor, { action: 'semester.set_current', entityType: 'semester', entityId: id, details: `Set ${sem.name} as the current semester` })
  })
  return semesterView(read().semesters.find((s) => s.id === id))
}

export function deleteSemester(id) {
  const actor = requireRole('admin')
  const sem = read().semesters.find((s) => s.id === id)
  if (!sem) throw notFound('Semester')
  if (sem.isCurrent) throw conflict('The current semester cannot be deleted.')
  if (read().courseOfferings.some((o) => o.semesterId === id)) throw conflict('This semester has course offerings and cannot be deleted.')
  transaction((tx) => {
    tx.remove('semesters', (s) => s.id === id)
    audit(tx, actor, { action: 'semester.deleted', entityType: 'semester', entityId: id, details: `Deleted semester ${sem.name}` })
  })
  return { ok: true }
}

// ---------------- Course offerings / teacher assignments ----------------
export function listOfferings({ semesterId, departmentId, teacherId, gradeStatus, search, page, pageSize, sort } = {}) {
  requireRole('admin')
  let items = read()
    .courseOfferings.map(offeringView)
    .filter(
      (o) =>
        (!semesterId || o.semesterId === semesterId) &&
        (!departmentId || o.course.departmentId === departmentId) &&
        (!teacherId || o.teacherId === teacherId) &&
        (!gradeStatus || o.gradeStatus === gradeStatus),
    )
    .filter((o) => matches(search, o.course.code, o.course.title, o.teacher?.name))
    .map((o) => ({ ...o, courseCode: o.course.code, teacherName: o.teacher?.name, semesterOrder: o.semester.order }))
  items = sortBy(items, sort?.key ? sort : { key: 'courseCode', dir: 'asc' })
  return paginate(items, { page, pageSize })
}

export function getOfferingAdmin(id) {
  requireRole('admin')
  const o = read().courseOfferings.find((x) => x.id === id)
  if (!o) throw notFound('Course offering')
  return offeringView(o)
}

function validateOffering(data, ignoreId) {
  const db = read()
  validate({
    courseId: () => (db.courses.some((c) => c.id === data.courseId && c.status === 'active') ? null : 'Choose an active course.'),
    semesterId: () => (db.semesters.some((s) => s.id === data.semesterId) ? null : 'Choose a semester.'),
    teacherId: () => {
      const t = db.teachers.find((x) => x.id === data.teacherId)
      if (!t) return 'Choose a teacher.'
      if (db.users.find((u) => u.id === t.userId)?.status !== 'active') return 'This teacher account is inactive.'
      return null
    },
    section: () => required(data.section, 'Section'),
    capacity: () => numberIn(data.capacity, 1, 500, 'Capacity'),
  })
  const section = String(data.section).trim().toUpperCase()
  if (db.courseOfferings.some((o) => o.courseId === data.courseId && o.semesterId === data.semesterId && o.section === section && o.id !== ignoreId)) {
    throw badRequest('Please correct the highlighted fields.', { section: 'This course already has that section in the selected semester.' })
  }
}

export function createOffering(data) {
  const actor = requireRole('admin')
  validateOffering(data)
  const sem = read().semesters.find((s) => s.id === data.semesterId)
  if (sem.status === 'closed') throw conflict('Offerings cannot be added to a closed semester.')
  return transaction((tx) => {
    const o = tx.insert('courseOfferings', {
      id: newId('off'),
      courseId: data.courseId,
      semesterId: data.semesterId,
      teacherId: data.teacherId,
      section: String(data.section).trim().toUpperCase(),
      capacity: Number(data.capacity),
      room: data.room?.trim() ?? '',
      schedule: data.schedule?.trim() ?? '',
      gradeStatus: 'not_started',
      createdAt: now(),
      updatedAt: now(),
    })
    const course = tx.find('courses', o.courseId)
    const teacher = tx.find('teachers', o.teacherId)
    notify(tx, teacher.userId, { title: 'New course assignment', message: `You have been assigned to teach ${course.code} ${course.title} (${sem.name}).`, type: 'assignment', link: `/teacher/courses/${o.id}` })
    audit(tx, actor, { action: 'offering.created', entityType: 'course_offering', entityId: o.id, details: `Offered ${course.code} in ${sem.name}` })
    return o
  })
}

export function updateOffering(id, data) {
  const actor = requireRole('admin')
  const existing = read().courseOfferings.find((o) => o.id === id)
  if (!existing) throw notFound('Course offering')
  validateOffering({ ...data, courseId: existing.courseId, semesterId: existing.semesterId }, id)
  if (data.teacherId !== existing.teacherId && ['submitted', 'approved', 'published'].includes(existing.gradeStatus)) {
    throw conflict('The teacher cannot be changed after grades have been submitted.')
  }
  const enrolled = read().courseEnrollments.filter((e) => e.offeringId === id && e.status !== 'withdrawn').length
  if (Number(data.capacity) < enrolled) throw badRequest('Please correct the highlighted fields.', { capacity: `Capacity cannot be below the ${enrolled} students already enrolled.` })
  return transaction((tx) => {
    const o = tx.update('courseOfferings', id, { teacherId: data.teacherId, section: String(data.section).trim().toUpperCase(), capacity: Number(data.capacity), room: data.room?.trim() ?? '', schedule: data.schedule?.trim() ?? '' })
    const course = tx.find('courses', o.courseId)
    if (data.teacherId !== existing.teacherId) {
      const newT = tx.find('teachers', data.teacherId)
      const oldT = tx.find('teachers', existing.teacherId)
      notify(tx, newT.userId, { title: 'New course assignment', message: `You have been assigned to teach ${course.code} ${course.title}.`, type: 'assignment', link: `/teacher/courses/${id}` })
      if (oldT) notify(tx, oldT.userId, { title: 'Course reassigned', message: `${course.code} has been reassigned to another teacher.`, type: 'assignment', link: null })
      audit(tx, actor, { action: 'offering.teacher_assigned', entityType: 'course_offering', entityId: id, details: `Reassigned ${course.code} teacher`, before: { teacherId: existing.teacherId }, after: { teacherId: data.teacherId } })
    } else {
      audit(tx, actor, { action: 'offering.updated', entityType: 'course_offering', entityId: id, details: `Updated offering ${course.code}` })
    }
    return o
  })
}

export function deleteOffering(id) {
  const actor = requireRole('admin')
  const o = read().courseOfferings.find((x) => x.id === id)
  if (!o) throw notFound('Course offering')
  if (read().courseEnrollments.some((e) => e.offeringId === id)) throw conflict('Remove all enrolled students before deleting this offering.')
  transaction((tx) => {
    tx.remove('assessments', (a) => a.offeringId === id)
    tx.remove('courseOfferings', (x) => x.id === id)
    audit(tx, actor, { action: 'offering.deleted', entityType: 'course_offering', entityId: id, details: 'Deleted course offering' })
  })
  return { ok: true }
}

// ---------------- Enrollment ----------------
export function listOfferingEnrollments(offeringId) {
  requireRole('admin')
  const db = read()
  if (!db.courseOfferings.some((o) => o.id === offeringId)) throw notFound('Course offering')
  return db.courseEnrollments
    .filter((e) => e.offeringId === offeringId)
    .map((e) => ({ ...e, student: studentView(db.students.find((s) => s.id === e.studentId)), hasScores: db.assessmentScores.some((s) => s.enrollmentId === e.id) }))
    .sort((a, b) => a.student.name.localeCompare(b.student.name))
}

export function listEligibleStudents(offeringId, { search, departmentId } = {}) {
  requireRole('admin')
  const db = read()
  const enrolled = new Set(db.courseEnrollments.filter((e) => e.offeringId === offeringId).map((e) => e.studentId))
  return db.students
    .filter((s) => s.status === 'active' && !enrolled.has(s.id) && (!departmentId || s.departmentId === departmentId))
    .map(studentView)
    .filter((s) => matches(search, s.name, s.studentNumber))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 200)
}

export function enrollStudents(offeringId, studentIds) {
  const actor = requireRole('admin')
  const db = read()
  const o = db.courseOfferings.find((x) => x.id === offeringId)
  if (!o) throw notFound('Course offering')
  const sem = db.semesters.find((s) => s.id === o.semesterId)
  if (sem.status === 'closed') throw conflict('Enrollment is closed for this semester.')
  if (['submitted', 'approved', 'published'].includes(o.gradeStatus)) throw conflict('Grades for this offering have been submitted; enrollment is locked.')
  if (!Array.isArray(studentIds) || !studentIds.length) throw badRequest('Select at least one student.')
  const unique = [...new Set(studentIds)]
  const duplicates = unique.filter((sid) => db.courseEnrollments.some((e) => e.offeringId === offeringId && e.studentId === sid))
  if (duplicates.length) throw conflict(`${duplicates.length} selected student(s) are already enrolled in this offering.`)
  const active = db.courseEnrollments.filter((e) => e.offeringId === offeringId && e.status !== 'withdrawn').length
  if (active + unique.length > o.capacity) throw conflict(`Only ${o.capacity - active} seat(s) remain in this offering.`)
  const course = db.courses.find((c) => c.id === o.courseId)
  transaction((tx) => {
    for (const sid of unique) {
      const st = tx.find('students', sid)
      if (!st || st.status !== 'active') throw badRequest('One of the selected students is not active.')
      // A repeat if the student already has a final grade for this course.
      const isRepeat = tx
        .table('courseEnrollments')
        .some((e) => e.studentId === sid && tx.find('courseOfferings', e.offeringId)?.courseId === o.courseId)
      tx.insert('courseEnrollments', { id: newId('enr'), offeringId, studentId: sid, status: 'enrolled', isRepeat, enrolledAt: now() })
      notify(tx, st.userId, { title: 'Course enrollment', message: `You have been enrolled in ${course.code} ${course.title} (${sem.name}).`, type: 'enrollment', link: '/student/courses' })
    }
    audit(tx, actor, { action: 'enrollment.created', entityType: 'course_offering', entityId: offeringId, details: `Enrolled ${unique.length} student(s) in ${course.code} (${sem.name})` })
  })
  return { enrolled: unique.length }
}

export function withdrawEnrollment(enrollmentId, { reason }) {
  const actor = requireRole('admin')
  const e = read().courseEnrollments.find((x) => x.id === enrollmentId)
  if (!e) throw notFound('Enrollment')
  if (e.status === 'withdrawn') throw conflict('This student has already withdrawn.')
  const o = read().courseOfferings.find((x) => x.id === e.offeringId)
  if (o.gradeStatus === 'published') throw conflict('Grades for this offering are published; withdrawals are no longer possible.')
  validate({ reason: () => required(reason, 'Reason') })
  transaction((tx) => {
    tx.update('courseEnrollments', enrollmentId, { status: 'withdrawn' })
    const st = tx.find('students', e.studentId)
    const course = tx.find('courses', o.courseId)
    notify(tx, st.userId, { title: 'Course withdrawal', message: `You have been withdrawn from ${course.code}.`, type: 'enrollment', link: '/student/courses' })
    audit(tx, actor, { action: 'enrollment.withdrawn', entityType: 'course_enrollment', entityId: enrollmentId, details: `Withdrew student from ${course.code}`, reason })
  })
  return { ok: true }
}

export function removeEnrollment(enrollmentId) {
  const actor = requireRole('admin')
  const db = read()
  const e = db.courseEnrollments.find((x) => x.id === enrollmentId)
  if (!e) throw notFound('Enrollment')
  if (db.assessmentScores.some((s) => s.enrollmentId === enrollmentId) || db.finalGrades.some((f) => f.enrollmentId === enrollmentId)) {
    throw conflict('This enrollment already has marks recorded. Withdraw the student instead.')
  }
  transaction((tx) => {
    tx.remove('courseEnrollments', (x) => x.id === enrollmentId)
    audit(tx, actor, { action: 'enrollment.removed', entityType: 'course_enrollment', entityId: enrollmentId, details: 'Removed enrollment created in error' })
  })
  return { ok: true }
}

export function listTeachers({ departmentId } = {}) {
  requireRole('admin')
  const db = read()
  return db.teachers
    .filter((t) => !departmentId || t.departmentId === departmentId)
    .map(teacherView)
    .map((t) => ({ ...t, offeringCount: db.courseOfferings.filter((o) => o.teacherId === t.id && db.semesters.find((s) => s.id === o.semesterId)?.isCurrent).length }))
    .sort((a, b) => a.name.localeCompare(b.name))
}
