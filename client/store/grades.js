// Assessments, grade entry, submission, approval and publication.
import { newId, now, read, transaction } from './db'
import { ASSESSMENT_TYPES, gradeForScore, sumWeights, validateGradeScale, validateMark } from '@/lib/grading'
import {
  assertOfferingAccess,
  audit,
  badRequest,
  conflict,
  currentUser,
  matches,
  notFound,
  notify,
  notifyAdmins,
  numberIn,
  paginate,
  required,
  requireRole,
  validate,
} from './helpers'
import { buildGradebook, getActiveScale, getPolicy, gradebookStats, offeringView, strugglingStudents } from './selectors'

const LOCKED = ['submitted', 'approved', 'published']
const lockedMessage = (status) =>
  status === 'published'
    ? 'Grades for this course are published and can no longer be modified.'
    : 'Grades for this course have been submitted and are locked while under review.'

// ---------------- Grading configuration (admin) ----------------
export function getGradingConfig() {
  currentUser()
  const scale = read().gradeScales.find((s) => s.isActive)
  return { scale, policy: getPolicy(), courses: read().courses.map((c) => ({ id: c.id, code: c.code, title: c.title })) }
}

export function updateGradeScale(entries) {
  const actor = requireRole('admin')
  const clean = entries.map((e) => ({ letter: String(e.letter).trim(), min: Number(e.min), max: Number(e.max), points: Number(e.points) }))
  const errors = validateGradeScale(clean)
  if (errors.length) throw badRequest(errors[0], { scale: errors })
  const current = read().gradeScales.find((s) => s.isActive)
  transaction((tx) => {
    tx.update('gradeScales', current.id, { entries: clean.sort((a, b) => b.min - a.min) })
    audit(tx, actor, { action: 'grade_scale.updated', entityType: 'grade_scale', entityId: current.id, details: 'Updated the grading scale', before: { entries: current.entries }, after: { entries: clean } })
  })
  return read().gradeScales.find((s) => s.id === current.id)
}

export function updatePolicy(patch) {
  const actor = requireRole('admin')
  validate({
    passMark: () => numberIn(patch.passMark, 0, 100, 'Pass mark'),
    probationGpa: () => numberIn(patch.probationGpa, 0, 4, 'Probation GPA'),
    honorsGpa: () => numberIn(patch.honorsGpa, 0, 4, 'Honors GPA'),
    repeatPolicy: () => (['latest', 'highest', 'all'].includes(patch.repeatPolicy) ? null : 'Invalid option.'),
    incompletePolicy: () => (['exclude', 'as_fail'].includes(patch.incompletePolicy) ? null : 'Invalid option.'),
    withdrawalPolicy: () => (['exclude', 'as_fail'].includes(patch.withdrawalPolicy) ? null : 'Invalid option.'),
  })
  const before = getPolicy()
  const next = {
    ...before,
    passMark: Number(patch.passMark),
    probationGpa: Number(patch.probationGpa),
    honorsGpa: Number(patch.honorsGpa),
    repeatPolicy: patch.repeatPolicy,
    incompletePolicy: patch.incompletePolicy,
    withdrawalPolicy: patch.withdrawalPolicy,
    approvalWorkflowEnabled: Boolean(patch.approvalWorkflowEnabled),
    requireWeightsTotal100: true,
    excludedCourseIds: Array.isArray(patch.excludedCourseIds) ? patch.excludedCourseIds : before.excludedCourseIds,
  }
  transaction((tx) => {
    tx.state.settings.policy = next
    tx.state.settings.updatedAt = now()
    audit(tx, actor, { action: 'policy.updated', entityType: 'settings', entityId: 'policy', details: 'Updated grading and academic policies', before, after: next })
  })
  return next
}

// ---------------- Assessments (teacher / admin) ----------------
export function listAssessments(offeringId) {
  const user = requireRole('teacher', 'admin')
  assertOfferingAccess(user, offeringId)
  const db = read()
  return db.assessments
    .filter((a) => a.offeringId === offeringId)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .map((a) => ({ ...a, scoreCount: db.assessmentScores.filter((s) => s.assessmentId === a.id).length }))
}

function validateAssessment(data, offeringId, ignoreId) {
  const others = read().assessments.filter((a) => a.offeringId === offeringId && a.id !== ignoreId)
  validate({
    name: () => required(data.name, 'Name') || (others.some((a) => a.name.toLowerCase() === data.name.trim().toLowerCase()) ? 'An assessment with this name already exists.' : null),
    type: () => (ASSESSMENT_TYPES.some((t) => t.value === data.type) ? null : 'Choose a type.'),
    maxMarks: () => numberIn(data.maxMarks, 1, 1000, 'Maximum marks'),
    weight: () => {
      const err = numberIn(data.weight, 0.5, 100, 'Weight')
      if (err) return err
      const total = sumWeights(others) + Number(data.weight)
      return total > 100.0001 ? `Total weight would be ${total}%. The remaining weight is ${Math.max(0, 100 - sumWeights(others))}%.` : null
    },
    dueDate: () => required(data.dueDate, 'Due date') || (!/^\d{4}-\d{2}-\d{2}$/.test(data.dueDate) ? 'Enter a valid date.' : null),
  })
}

function assertEditable(offering) {
  if (LOCKED.includes(offering.gradeStatus)) throw conflict(lockedMessage(offering.gradeStatus))
}

export function createAssessment(offeringId, data) {
  const user = requireRole('teacher', 'admin')
  const offering = assertOfferingAccess(user, offeringId)
  assertEditable(offering)
  validateAssessment(data, offeringId)
  return transaction((tx) => {
    const a = tx.insert('assessments', {
      id: newId('asm'),
      offeringId,
      name: data.name.trim(),
      type: data.type,
      maxMarks: Number(data.maxMarks),
      weight: Number(data.weight),
      dueDate: data.dueDate,
      isReleased: false,
      description: data.description?.trim() ?? '',
      createdAt: now(),
      updatedAt: now(),
    })
    const course = tx.find('courses', offering.courseId)
    audit(tx, user, { action: 'assessment.created', entityType: 'assessment', entityId: a.id, offeringId, details: `Created ${a.name} (${a.weight}%) in ${course.code}` })
    return a
  })
}

export function updateAssessment(id, data) {
  const user = requireRole('teacher', 'admin')
  const existing = read().assessments.find((a) => a.id === id)
  if (!existing) throw notFound('Assessment')
  const offering = assertOfferingAccess(user, existing.offeringId)
  assertEditable(offering)
  validateAssessment(data, existing.offeringId, id)
  const maxEntered = Math.max(0, ...read().assessmentScores.filter((s) => s.assessmentId === id).map((s) => s.marks ?? 0))
  if (Number(data.maxMarks) < maxEntered) throw badRequest('Please correct the highlighted fields.', { maxMarks: `A student already has ${maxEntered} marks; the maximum cannot be lower.` })
  return transaction((tx) => {
    const a = tx.update('assessments', id, { name: data.name.trim(), type: data.type, maxMarks: Number(data.maxMarks), weight: Number(data.weight), dueDate: data.dueDate, description: data.description?.trim() ?? '' })
    audit(tx, user, {
      action: 'assessment.updated',
      entityType: 'assessment',
      entityId: id,
      offeringId: existing.offeringId,
      details: `Updated assessment ${a.name}`,
      before: { maxMarks: existing.maxMarks, weight: existing.weight },
      after: { maxMarks: a.maxMarks, weight: a.weight },
    })
    return a
  })
}

export function deleteAssessment(id) {
  const user = requireRole('teacher', 'admin')
  const existing = read().assessments.find((a) => a.id === id)
  if (!existing) throw notFound('Assessment')
  const offering = assertOfferingAccess(user, existing.offeringId)
  assertEditable(offering)
  if (read().assessmentScores.some((s) => s.assessmentId === id)) throw conflict('Marks have already been entered for this assessment. Clear them before deleting it.')
  transaction((tx) => {
    tx.remove('assessments', (a) => a.id === id)
    audit(tx, user, { action: 'assessment.deleted', entityType: 'assessment', entityId: id, offeringId: existing.offeringId, details: `Deleted assessment ${existing.name}` })
  })
  return { ok: true }
}

export function setAssessmentReleased(id, isReleased) {
  const user = requireRole('teacher', 'admin')
  const existing = read().assessments.find((a) => a.id === id)
  if (!existing) throw notFound('Assessment')
  const offering = assertOfferingAccess(user, existing.offeringId)
  transaction((tx) => {
    tx.update('assessments', id, { isReleased: Boolean(isReleased) })
    if (isReleased && !existing.isReleased) {
      const course = tx.find('courses', offering.courseId)
      for (const e of tx.table('courseEnrollments').filter((x) => x.offeringId === offering.id && x.status !== 'withdrawn')) {
        const st = tx.find('students', e.studentId)
        notify(tx, st.userId, { title: 'Marks released', message: `${existing.name} marks for ${course.code} are now available.`, type: 'marks_released', link: '/student/assessments' })
      }
    }
    audit(tx, user, { action: isReleased ? 'assessment.released' : 'assessment.unreleased', entityType: 'assessment', entityId: id, offeringId: offering.id, details: `${isReleased ? 'Released' : 'Hid'} marks for ${existing.name}` })
  })
  return { ok: true }
}

// ---------------- Gradebook (teacher / admin) ----------------
export function getGradebook(offeringId) {
  const user = requireRole('teacher', 'admin')
  assertOfferingAccess(user, offeringId)
  const gb = buildGradebook(offeringId)
  const db = read()
  const requests = db.gradeApprovalRequests.filter((r) => r.offeringId === offeringId).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
  return {
    ...gb,
    stats: gradebookStats(gb),
    locked: LOCKED.includes(gb.offering.gradeStatus),
    latestRequest: requests[0] ?? null,
    requiresReason: requests.length > 0,
    approvalWorkflowEnabled: getPolicy().approvalWorkflowEnabled,
  }
}

/**
 * Save draft marks.
 * @param changes [{enrollmentId, assessmentId, marks: number|null}]
 * @param reason required when changing marks after a previous submission.
 */
export function saveScores(offeringId, { changes, reason }) {
  const user = requireRole('teacher', 'admin')
  const offering = assertOfferingAccess(user, offeringId)
  assertEditable(offering)
  if (!Array.isArray(changes) || !changes.length) throw badRequest('There are no changes to save.')
  const db = read()
  const assessments = new Map(db.assessments.filter((a) => a.offeringId === offeringId).map((a) => [a.id, a]))
  const enrollments = new Map(db.courseEnrollments.filter((e) => e.offeringId === offeringId).map((e) => [e.id, e]))
  const cellErrors = {}
  for (const c of changes) {
    const a = assessments.get(c.assessmentId)
    const e = enrollments.get(c.enrollmentId)
    const key = `${c.enrollmentId}:${c.assessmentId}`
    if (!a || !e) {
      cellErrors[key] = 'Unknown student or assessment.'
      continue
    }
    if (e.status === 'withdrawn') cellErrors[key] = 'Student has withdrawn.'
    const err = validateMark(c.marks, a.maxMarks)
    if (err) cellErrors[key] = err
  }
  if (Object.keys(cellErrors).length) throw badRequest('Some marks are invalid. Fix the highlighted cells and try again.', cellErrors)

  const previouslySubmitted = db.gradeApprovalRequests.some((r) => r.offeringId === offeringId)
  const toMarks = (v) => (v === '' || v == null ? null : Number(v))
  const modifiesExisting = changes.some((c) =>
    db.assessmentScores.some((s) => s.assessmentId === c.assessmentId && s.enrollmentId === c.enrollmentId && s.marks !== toMarks(c.marks)),
  )
  if (previouslySubmitted && modifiesExisting) validate({ reason: () => required(reason, 'A reason for the change') })

  const course = db.courses.find((c) => c.id === offering.courseId)
  let created = 0
  let updated = 0
  let cleared = 0
  transaction((tx) => {
    for (const c of changes) {
      const marks = c.marks === '' || c.marks == null ? null : Number(c.marks)
      const existing = tx.table('assessmentScores').find((s) => s.assessmentId === c.assessmentId && s.enrollmentId === c.enrollmentId)
      const a = assessments.get(c.assessmentId)
      if (!existing && marks == null) continue
      if (existing && existing.marks === marks) continue
      if (existing && marks == null) {
        tx.remove('assessmentScores', (s) => s.id === existing.id)
        cleared++
        audit(tx, user, { action: 'score.deleted', entityType: 'assessment_score', entityId: existing.id, offeringId, details: `Cleared ${a.name} mark in ${course.code}`, reason: reason || null, before: { marks: existing.marks }, after: { marks: null } })
      } else if (existing) {
        const before = existing.marks
        Object.assign(existing, { marks, updatedAt: now(), updatedBy: user.id })
        updated++
        audit(tx, user, { action: 'score.updated', entityType: 'assessment_score', entityId: existing.id, offeringId, details: `Updated ${a.name} mark in ${course.code}`, reason: reason || null, before: { marks: before }, after: { marks } })
      } else {
        tx.insert('assessmentScores', { id: newId('scr'), assessmentId: c.assessmentId, enrollmentId: c.enrollmentId, marks, remarks: '', updatedAt: now(), updatedBy: user.id })
        created++
      }
    }
    if (created) audit(tx, user, { action: 'score.created', entityType: 'course_offering', entityId: offeringId, offeringId, details: `Entered ${created} new mark(s) in ${course.code}` })
    // Any final grades computed earlier are stale once marks change.
    const enrIds = new Set(changes.map((c) => c.enrollmentId))
    for (const fg of tx.table('finalGrades')) if (enrIds.has(fg.enrollmentId) && fg.status === 'draft') fg.stale = true
    if (offering.gradeStatus === 'not_started') tx.update('courseOfferings', offeringId, { gradeStatus: 'draft' })
  })
  return { created, updated, cleared }
}

/**
 * Validate (and optionally apply) a CSV import.
 * records: array of objects keyed by CSV header. Must include "student_id" plus assessment-name columns.
 */
export async function importScores(offeringId, { records, dryRun = true, reason }) {
  const user = requireRole('teacher', 'admin')
  const offering = assertOfferingAccess(user, offeringId)
  assertEditable(offering)
  if (!Array.isArray(records) || !records.length) throw badRequest('The file contains no rows.')
  const db = read()
  const assessments = db.assessments.filter((a) => a.offeringId === offeringId)
  const enrollments = db.courseEnrollments.filter((e) => e.offeringId === offeringId)
  const byNumber = new Map(enrollments.map((e) => [db.students.find((s) => s.id === e.studentId).studentNumber.toLowerCase(), e]))
  const headers = Object.keys(records[0])
  const idHeader = headers.find((h) => ['student_id', 'student id', 'studentid', 'student_number', 'student number'].includes(h.trim().toLowerCase()))
  if (!idHeader) throw badRequest('The file must contain a "student_id" column.')
  const columnMap = {}
  const unknownColumns = []
  for (const h of headers) {
    if (h === idHeader || ['name', 'student name', 'student_name', 'total', 'grade'].includes(h.trim().toLowerCase())) continue
    const a = assessments.find((x) => x.name.toLowerCase() === h.trim().toLowerCase())
    if (a) columnMap[h] = a
    else unknownColumns.push(h)
  }
  if (!Object.keys(columnMap).length) throw badRequest('No columns match this course’s assessment names.', { columns: assessments.map((a) => a.name) })

  const errors = []
  const changes = []
  records.forEach((rec, i) => {
    const rowNo = i + 2
    const sid = String(rec[idHeader] ?? '').trim()
    if (!sid) return
    const e = byNumber.get(sid.toLowerCase())
    if (!e) return errors.push({ row: rowNo, message: `Student ${sid} is not enrolled in this course.` })
    if (e.status === 'withdrawn') return errors.push({ row: rowNo, message: `Student ${sid} has withdrawn.` })
    for (const [h, a] of Object.entries(columnMap)) {
      const raw = String(rec[h] ?? '').trim()
      if (raw === '') continue
      const err = validateMark(raw, a.maxMarks)
      if (err) errors.push({ row: rowNo, message: `${a.name}: ${err} (value "${raw}").` })
      else changes.push({ enrollmentId: e.id, assessmentId: a.id, marks: Number(raw) })
    }
  })

  const result = { matchedColumns: Object.values(columnMap).map((a) => a.name), unknownColumns, errors, changeCount: changes.length, changes }
  if (dryRun || errors.length) return { ...result, applied: false }
  // Delegate to the same validation + audit path as manual entry.
  const saved = await saveScores(offeringId, { changes, reason })
  return { ...result, applied: true, saved }
}

export async function submitGrades(offeringId, { note } = {}) {
  const user = requireRole('teacher', 'admin')
  const offering = assertOfferingAccess(user, offeringId)
  assertEditable(offering)
  const policy = getPolicy()
  const gb = buildGradebook(offeringId)
  if (!gb.weightsValid) throw conflict(`Assessment weights total ${gb.weightTotal}%. They must total exactly 100% before grades can be submitted.`)
  const active = gb.rows.filter((r) => r.enrollment.status !== 'withdrawn')
  if (!active.length) throw conflict('There are no enrolled students to grade.')
  const incomplete = active.filter((r) => !r.complete)
  if (incomplete.length) throw conflict(`${incomplete.length} student(s) still have missing marks. Enter every mark before submitting.`)

  const scale = getActiveScale()
  const course = read().courses.find((c) => c.id === offering.courseId)
  const sem = read().semesters.find((s) => s.id === offering.semesterId)
  const directPublish = !policy.approvalWorkflowEnabled
  const status = directPublish ? 'published' : 'submitted'

  transaction((tx) => {
    for (const r of gb.rows) {
      const withdrawn = r.enrollment.status === 'withdrawn'
      const g = withdrawn ? null : gradeForScore(r.total, scale)
      const row = {
        totalScore: withdrawn ? null : r.total,
        letter: withdrawn ? 'W' : g.letter,
        gradePoints: withdrawn ? null : g.points,
        special: withdrawn ? 'W' : null,
        status,
        computedAt: now(),
        submittedAt: now(),
        approvedAt: directPublish ? now() : null,
        publishedAt: directPublish ? now() : null,
        updatedAt: now(),
        stale: false,
      }
      const existing = tx.table('finalGrades').find((f) => f.enrollmentId === r.enrollmentId)
      if (existing) Object.assign(existing, row)
      else tx.insert('finalGrades', { id: newId('fgr'), enrollmentId: r.enrollmentId, ...row })
    }
    tx.update('courseOfferings', offeringId, { gradeStatus: status })
    tx.insert('gradeApprovalRequests', {
      id: newId('gar'),
      offeringId,
      submittedBy: user.id,
      submittedAt: now(),
      status: directPublish ? 'approved' : 'pending',
      reviewedBy: directPublish ? user.id : null,
      reviewedAt: directPublish ? now() : null,
      comment: directPublish ? 'Published directly (approval workflow disabled).' : null,
      note: note?.trim() || null,
      studentCount: gb.rows.length,
    })
    audit(tx, user, { action: 'grades.submitted', entityType: 'course_offering', entityId: offeringId, offeringId, details: `Submitted final grades for ${course.code} (${sem.name})`, reason: note?.trim() || null })
    if (directPublish) {
      publishStudents(tx, offeringId, course)
      audit(tx, user, { action: 'grades.published', entityType: 'course_offering', entityId: offeringId, offeringId, details: `Published grades for ${course.code} (${sem.name})` })
    } else {
      notifyAdmins(tx, { title: 'Grade approval required', message: `${course.code} grades (${sem.name}) were submitted and await review.`, type: 'approval_required', link: '/admin/grade-approvals' })
    }
  })
  return { status }
}

function publishStudents(tx, offeringId, course) {
  for (const e of tx.table('courseEnrollments').filter((x) => x.offeringId === offeringId)) {
    const st = tx.find('students', e.studentId)
    notify(tx, st.userId, { title: 'New result published', message: `Your final grade for ${course.code} ${course.title} is now available.`, type: 'grade_published', link: '/student/grades' })
  }
}

// ---------------- Approvals (admin) ----------------
export function listApprovalRequests({ status, semesterId, search, page, pageSize } = {}) {
  requireRole('admin')
  const db = read()
  const items = db.gradeApprovalRequests
    .map((r) => {
      const o = offeringView(db.courseOfferings.find((x) => x.id === r.offeringId))
      const submitter = db.users.find((u) => u.id === r.submittedBy)
      const reviewer = db.users.find((u) => u.id === r.reviewedBy)
      return {
        ...r,
        offering: o,
        submitterName: submitter ? `${submitter.firstName} ${submitter.lastName}` : '—',
        reviewerName: reviewer ? `${reviewer.firstName} ${reviewer.lastName}` : null,
        offeringStatus: o.gradeStatus,
      }
    })
    .filter((r) => (!status || r.status === status) && (!semesterId || r.offering.semesterId === semesterId))
    .filter((r) => matches(search, r.offering.course.code, r.offering.course.title, r.submitterName))
    .sort((a, b) => (b.status === 'pending') - (a.status === 'pending') || b.submittedAt.localeCompare(a.submittedAt))
  return { ...paginate(items, { page, pageSize }), pendingCount: items.filter((r) => r.status === 'pending').length }
}

export function getApprovalRequest(id) {
  requireRole('admin')
  const db = read()
  const r = db.gradeApprovalRequests.find((x) => x.id === id)
  if (!r) throw notFound('Approval request')
  const gb = buildGradebook(r.offeringId)
  const nameOf = (id) => {
    const u = db.users.find((x) => x.id === id)
    return u ? `${u.firstName} ${u.lastName}` : '—'
  }
  return {
    request: { ...r, submitterName: nameOf(r.submittedBy), reviewerName: r.reviewedBy ? nameOf(r.reviewedBy) : null },
    ...gb,
    stats: gradebookStats(gb),
    history: db.gradeApprovalRequests
      .filter((x) => x.offeringId === r.offeringId)
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
      .map((x) => ({ ...x, submitterName: nameOf(x.submittedBy), reviewerName: x.reviewedBy ? nameOf(x.reviewedBy) : null })),
  }
}

export function approveGrades(requestId, { comment, publish = false } = {}) {
  const actor = requireRole('admin')
  const r = read().gradeApprovalRequests.find((x) => x.id === requestId)
  if (!r) throw notFound('Approval request')
  if (r.status !== 'pending') throw conflict('This request has already been reviewed.')
  const o = read().courseOfferings.find((x) => x.id === r.offeringId)
  if (o.gradeStatus !== 'submitted') throw conflict('This offering is not awaiting approval.')
  const course = read().courses.find((c) => c.id === o.courseId)
  const sem = read().semesters.find((s) => s.id === o.semesterId)
  transaction((tx) => {
    tx.update('gradeApprovalRequests', requestId, { status: 'approved', reviewedBy: actor.id, reviewedAt: now(), comment: comment?.trim() || 'Approved.' })
    const status = publish ? 'published' : 'approved'
    for (const e of tx.table('courseEnrollments').filter((x) => x.offeringId === o.id)) {
      const fg = tx.table('finalGrades').find((f) => f.enrollmentId === e.id)
      if (fg) Object.assign(fg, { status, approvedAt: now(), publishedAt: publish ? now() : null, updatedAt: now() })
    }
    tx.update('courseOfferings', o.id, { gradeStatus: status })
    const teacher = tx.find('teachers', o.teacherId)
    notify(tx, teacher.userId, { title: publish ? 'Grades published' : 'Grades approved', message: `Your grades for ${course.code} (${sem.name}) were approved${publish ? ' and published' : ''}.`, type: 'grade_approved', link: `/teacher/courses/${o.id}` })
    audit(tx, actor, { action: 'grades.approved', entityType: 'course_offering', entityId: o.id, offeringId: o.id, details: `Approved grades for ${course.code} (${sem.name})`, reason: comment?.trim() || null })
    if (publish) {
      publishStudents(tx, o.id, course)
      audit(tx, actor, { action: 'grades.published', entityType: 'course_offering', entityId: o.id, offeringId: o.id, details: `Published grades for ${course.code} (${sem.name})` })
    }
  })
  return { ok: true }
}

export function rejectGrades(requestId, { comment }) {
  const actor = requireRole('admin')
  validate({ comment: () => required(comment, 'A reason for rejection') })
  const r = read().gradeApprovalRequests.find((x) => x.id === requestId)
  if (!r) throw notFound('Approval request')
  if (r.status !== 'pending') throw conflict('This request has already been reviewed.')
  const o = read().courseOfferings.find((x) => x.id === r.offeringId)
  const course = read().courses.find((c) => c.id === o.courseId)
  const sem = read().semesters.find((s) => s.id === o.semesterId)
  transaction((tx) => {
    tx.update('gradeApprovalRequests', requestId, { status: 'rejected', reviewedBy: actor.id, reviewedAt: now(), comment: comment.trim() })
    for (const e of tx.table('courseEnrollments').filter((x) => x.offeringId === o.id)) {
      const fg = tx.table('finalGrades').find((f) => f.enrollmentId === e.id)
      if (fg) Object.assign(fg, { status: 'draft', updatedAt: now() })
    }
    tx.update('courseOfferings', o.id, { gradeStatus: 'rejected' })
    const teacher = tx.find('teachers', o.teacherId)
    notify(tx, teacher.userId, { title: 'Grade submission returned', message: `Your grades for ${course.code} were returned: ${comment.trim()}`, type: 'grade_rejected', link: `/teacher/grade-entry/${o.id}` })
    audit(tx, actor, { action: 'grades.rejected', entityType: 'course_offering', entityId: o.id, offeringId: o.id, details: `Rejected grades for ${course.code} (${sem.name})`, reason: comment.trim() })
  })
  return { ok: true }
}

export function publishGrades(offeringId) {
  const actor = requireRole('admin')
  const o = read().courseOfferings.find((x) => x.id === offeringId)
  if (!o) throw notFound('Course offering')
  if (o.gradeStatus !== 'approved') throw conflict('Only approved grades can be published.')
  const course = read().courses.find((c) => c.id === o.courseId)
  const sem = read().semesters.find((s) => s.id === o.semesterId)
  transaction((tx) => {
    for (const e of tx.table('courseEnrollments').filter((x) => x.offeringId === o.id)) {
      const fg = tx.table('finalGrades').find((f) => f.enrollmentId === e.id)
      if (fg) Object.assign(fg, { status: 'published', publishedAt: now(), updatedAt: now() })
    }
    tx.update('courseOfferings', o.id, { gradeStatus: 'published' })
    publishStudents(tx, o.id, course)
    const teacher = tx.find('teachers', o.teacherId)
    notify(tx, teacher.userId, { title: 'Grades published', message: `Grades for ${course.code} (${sem.name}) are now visible to students.`, type: 'grade_published', link: `/teacher/courses/${o.id}` })
    audit(tx, actor, { action: 'grades.published', entityType: 'course_offering', entityId: o.id, offeringId: o.id, details: `Published grades for ${course.code} (${sem.name})` })
  })
  return { ok: true }
}

// ---------------- Performance (teacher / admin) ----------------
export function getOfferingPerformance(offeringId) {
  const user = requireRole('teacher', 'admin')
  assertOfferingAccess(user, offeringId)
  const gb = buildGradebook(offeringId)
  return { offering: gb.offering, assessments: gb.assessments, rows: gb.rows, stats: gradebookStats(gb), struggling: strugglingStudents(gb), passMark: gb.passMark }
}

/** Grade change history for an offering (who / when / why). */
export function getGradeHistory(offeringId) {
  const user = requireRole('teacher', 'admin')
  assertOfferingAccess(user, offeringId)
  const db = read()
  const asmIds = new Set(db.assessments.filter((a) => a.offeringId === offeringId).map((a) => a.id))
  const scoreIds = new Set(db.assessmentScores.filter((s) => asmIds.has(s.assessmentId)).map((s) => s.id))
  return db.auditLogs
    .filter((l) => l.offeringId === offeringId || (l.entityType === 'course_offering' && l.entityId === offeringId) || (l.entityType === 'assessment_score' && scoreIds.has(l.entityId)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((l) => {
      const u = db.users.find((x) => x.id === l.userId)
      return { ...l, userName: u ? `${u.firstName} ${u.lastName}` : 'System' }
    })
}

