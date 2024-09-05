// Admin dashboard, reports, transcripts, audit logs and system settings.
import { now, read, resetDatabase, transaction } from './db'
import { academicStanding, gradeDistribution, round } from '@/lib/grading'
import { average } from '@/lib/utils'
import {
  assertOfferingAccess,
  audit,
  currentUser,
  forbidden,
  isEmail,
  matches,
  notFound,
  paginate,
  required,
  requireRole,
  validate,
} from './helpers'
import {
  academicRecordFor,
  buildGradebook,
  currentSemester,
  getActiveScale,
  getPolicy,
  gradebookStats,
  semesterView,
  studentView,
} from './selectors'

const userName = (id) => {
  const u = read().users.find((x) => x.id === id)
  return u ? `${u.firstName} ${u.lastName}` : 'System'
}

function publishedGradesIn(semesterId) {
  const db = read()
  const offerings = db.courseOfferings.filter((o) => !semesterId || o.semesterId === semesterId)
  const offIds = new Set(offerings.map((o) => o.id))
  const enr = new Map(db.courseEnrollments.filter((e) => offIds.has(e.offeringId)).map((e) => [e.id, e]))
  return db.finalGrades.filter((f) => f.status === 'published' && enr.has(f.enrollmentId)).map((f) => ({ ...f, enrollment: enr.get(f.enrollmentId) }))
}

// ---------------- Dashboard ----------------
export function getAdminDashboard() {
  requireRole('admin')
  const db = read()
  const current = currentSemester()
  const policy = getPolicy()
  const scale = getActiveScale()
  const activeUsers = (role) => db.users.filter((u) => u.roleId === role && u.status === 'active').length

  const enrollmentTrend = [...db.semesters]
    .filter((s) => s.order <= current.order)
    .sort((a, b) => a.order - b.order)
    .map((s) => {
      const offs = new Set(db.courseOfferings.filter((o) => o.semesterId === s.id).map((o) => o.id))
      const enr = db.courseEnrollments.filter((e) => offs.has(e.offeringId))
      return { semester: s.name.replace(/ (\d{2})(\d{2})\/(\d{2})(\d{2})/, ' $2/$4'), enrollments: enr.length, students: new Set(enr.map((e) => e.studentId)).size }
    })

  const allPublished = publishedGradesIn(null)
  const distribution = gradeDistribution(allPublished.filter((f) => !f.special).map((f) => f.letter), scale)
  const graded = allPublished.filter((f) => !f.special)
  const passRate = graded.length ? (graded.filter((f) => f.totalScore >= policy.passMark).length / graded.length) * 100 : null

  const performanceTrend = [...db.semesters]
    .filter((s) => s.order < current.order)
    .sort((a, b) => a.order - b.order)
    .map((s) => {
      const g = publishedGradesIn(s.id).filter((f) => !f.special)
      return {
        semester: s.name.replace(/ (\d{2})(\d{2})\/(\d{2})(\d{2})/, ' $2/$4'),
        average: g.length ? round(average(g.map((f) => f.totalScore)), 1) : null,
        passRate: g.length ? round((g.filter((f) => f.totalScore >= policy.passMark).length / g.length) * 100, 1) : null,
      }
    })

  const departmentPerformance = db.departments.map((d) => {
    const courseIds = new Set(db.courses.filter((c) => c.departmentId === d.id).map((c) => c.id))
    const offIds = new Set(db.courseOfferings.filter((o) => courseIds.has(o.courseId)).map((o) => o.id))
    const g = allPublished.filter((f) => !f.special && offIds.has(f.enrollment.offeringId))
    return { department: d.code, name: d.name, average: g.length ? round(average(g.map((f) => f.totalScore)), 1) : null, gpa: g.length ? round(average(g.map((f) => f.gradePoints)), 2) : null }
  })

  const pendingApprovals = db.gradeApprovalRequests.filter((r) => r.status === 'pending').length
  const overdueOfferings = db.courseOfferings.filter((o) => {
    const s = db.semesters.find((x) => x.id === o.semesterId)
    return s.order < current.order && ['draft', 'not_started', 'rejected'].includes(o.gradeStatus)
  })
  const approvedUnpublished = db.courseOfferings.filter((o) => o.gradeStatus === 'approved').length

  return {
    currentSemester: semesterView(current),
    stats: {
      students: activeUsers('student'),
      teachers: activeUsers('teacher'),
      departments: db.departments.length,
      courses: db.courses.filter((c) => c.status === 'active').length,
      currentOfferings: db.courseOfferings.filter((o) => o.semesterId === current.id).length,
      currentEnrollments: db.courseEnrollments.filter((e) => db.courseOfferings.find((o) => o.id === e.offeringId)?.semesterId === current.id).length,
      pendingApprovals,
      overdueGrades: overdueOfferings.length,
      approvedUnpublished,
      passRate,
      averageScore: graded.length ? average(graded.map((f) => f.totalScore)) : null,
    },
    enrollmentTrend,
    performanceTrend,
    distribution,
    departmentPerformance,
    attention: [
      ...(pendingApprovals ? [{ id: 'approvals', tone: 'warning', title: `${pendingApprovals} grade submission(s) awaiting approval`, link: '/admin/grade-approvals' }] : []),
      ...(approvedUnpublished ? [{ id: 'publish', tone: 'info', title: `${approvedUnpublished} approved offering(s) not yet published`, link: '/admin/grade-approvals' }] : []),
      ...(overdueOfferings.length ? [{ id: 'overdue', tone: 'danger', title: `${overdueOfferings.length} past offering(s) with missing final grades`, link: '/admin/reports?tab=missing' }] : []),
    ],
    recentActivity: db.auditLogs
      .filter((l) => !l.action.startsWith('auth.'))
      .slice(0, 8)
      .map((l) => ({ ...l, userName: userName(l.userId) })),
  }
}

// ---------------- Reports ----------------
export function getMissingGradesReport({ semesterId, departmentId } = {}) {
  requireRole('admin')
  const db = read()
  const current = currentSemester()
  const deptOf = (o) => db.courses.find((c) => c.id === o.courseId)?.departmentId
  return db.courseOfferings
    .filter((o) => (!semesterId || o.semesterId === semesterId) && (!departmentId || deptOf(o) === departmentId) && o.gradeStatus !== 'published')
    .map((o) => {
      const gb = buildGradebook(o.id)
      const stats = gradebookStats(gb)
      const sem = db.semesters.find((s) => s.id === o.semesterId)
      return {
        offeringId: o.id,
        courseCode: gb.offering.course.code,
        courseTitle: gb.offering.course.title,
        departmentId: gb.offering.course.departmentId,
        semesterName: sem.name,
        teacherName: gb.offering.teacher?.name,
        gradeStatus: o.gradeStatus,
        students: stats.studentCount,
        incompleteStudents: stats.studentCount - stats.completeCount,
        missingMarks: stats.missingMarks,
        weightTotal: gb.weightTotal,
        deadline: sem.gradeSubmissionDeadline,
        overdue: sem.order < current.order && ['draft', 'not_started', 'rejected'].includes(o.gradeStatus),
      }
    })
    .sort((a, b) => b.overdue - a.overdue || a.courseCode.localeCompare(b.courseCode))
}

export function getDepartmentReport({ semesterId } = {}) {
  requireRole('admin')
  const db = read()
  const policy = getPolicy()
  const scale = getActiveScale()
  const published = publishedGradesIn(semesterId || null)
  return db.departments.map((d) => {
    const courseIds = new Set(db.courses.filter((c) => c.departmentId === d.id).map((c) => c.id))
    const offIds = new Set(db.courseOfferings.filter((o) => courseIds.has(o.courseId)).map((o) => o.id))
    const g = published.filter((f) => !f.special && offIds.has(f.enrollment.offeringId))
    const passed = g.filter((f) => f.totalScore >= policy.passMark).length
    const studentIds = db.students.filter((s) => s.departmentId === d.id).map((s) => s.id)
    const cgpas = studentIds.map((id) => academicRecordFor(id).cgpa).filter((x) => x != null)
    return {
      departmentId: d.id,
      code: d.code,
      name: d.name,
      grades: g.length,
      averageScore: g.length ? round(average(g.map((f) => f.totalScore)), 1) : null,
      averageGradePoint: g.length ? round(average(g.map((f) => f.gradePoints)), 2) : null,
      passRate: g.length ? round((passed / g.length) * 100, 1) : null,
      passed,
      failed: g.length - passed,
      students: studentIds.length,
      averageCgpa: cgpas.length ? round(average(cgpas), 2) : null,
      distribution: gradeDistribution(g.map((f) => f.letter), scale),
    }
  })
}

export function getCourseResultsReport({ semesterId, departmentId } = {}) {
  requireRole('admin')
  const db = read()
  return db.courseOfferings
    .filter((o) => (!semesterId || o.semesterId === semesterId) && (!departmentId || db.courses.find((c) => c.id === o.courseId).departmentId === departmentId))
    .map((o) => {
      const gb = buildGradebook(o.id)
      const stats = gradebookStats(gb)
      return {
        offeringId: o.id,
        courseCode: gb.offering.course.code,
        courseTitle: gb.offering.course.title,
        departmentId: gb.offering.course.departmentId,
        semesterName: gb.offering.semester.name,
        semesterOrder: gb.offering.semester.order,
        teacherName: gb.offering.teacher?.name,
        gradeStatus: o.gradeStatus,
        students: stats.studentCount,
        average: stats.average != null ? round(stats.average, 1) : null,
        passRate: stats.passRate != null ? round(stats.passRate, 1) : null,
        passed: stats.passed,
        failed: stats.failed,
        highest: stats.highest,
        lowest: stats.lowest,
        distribution: stats.distribution,
      }
    })
    .sort((a, b) => b.semesterOrder - a.semesterOrder || a.courseCode.localeCompare(b.courseCode))
}

export function getGradeDistributionReport({ semesterId, departmentId } = {}) {
  requireRole('admin')
  const db = read()
  const published = publishedGradesIn(semesterId || null).filter((f) => {
    if (!departmentId) return true
    const o = db.courseOfferings.find((x) => x.id === f.enrollment.offeringId)
    return db.courses.find((c) => c.id === o.courseId).departmentId === departmentId
  })
  const graded = published.filter((f) => !f.special)
  return {
    total: graded.length,
    withdrawn: published.filter((f) => f.special === 'W').length,
    incomplete: published.filter((f) => f.special === 'I').length,
    distribution: gradeDistribution(graded.map((f) => f.letter), getActiveScale()),
    averageScore: graded.length ? round(average(graded.map((f) => f.totalScore)), 1) : null,
  }
}

export function getGpaReport({ departmentId, search, standing, page, pageSize, sort } = {}) {
  requireRole('admin')
  const db = read()
  const policy = getPolicy()
  let items = db.students
    .filter((s) => !departmentId || s.departmentId === departmentId)
    .map((s) => {
      const view = studentView(s)
      const rec = academicRecordFor(s.id)
      const last = rec.semesters.at(-1)
      const st = academicStanding(rec.cgpa, policy)
      return {
        studentId: s.id,
        studentNumber: s.studentNumber,
        name: view.name,
        department: view.department?.code,
        program: s.program,
        admissionYear: s.admissionYear,
        semesterGpa: last?.gpa ?? null,
        semesterName: last?.semester?.name ?? null,
        cgpa: rec.cgpa,
        earnedCredits: rec.earnedCredits,
        standing: st.label,
        standingTone: st.tone,
      }
    })
    .filter((r) => matches(search, r.name, r.studentNumber) && (!standing || r.standing === standing))
  const sorted = [...items]
  const k = sort?.key || 'cgpa'
  const dir = sort?.dir === 'asc' ? 1 : -1
  sorted.sort((a, b) => ((a[k] ?? -1) > (b[k] ?? -1) ? 1 : (a[k] ?? -1) < (b[k] ?? -1) ? -1 : 0) * dir)
  items = sorted
  const cgpas = items.map((i) => i.cgpa).filter((x) => x != null)
  return {
    ...paginate(items, { page, pageSize }),
    summary: {
      averageCgpa: cgpas.length ? round(average(cgpas), 2) : null,
      deansList: items.filter((i) => i.standing === "Dean's List").length,
      probation: items.filter((i) => i.standing === 'Academic Probation').length,
    },
    all: items,
  }
}

/** Transcript data (shared by admin and the student's own transcript). */
export function buildTranscript(studentId) {
  const db = read()
  const s = db.students.find((x) => x.id === studentId)
  if (!s) throw notFound('Student')
  const record = academicRecordFor(studentId)
  const policy = getPolicy()
  return {
    university: db.settings.university,
    student: studentView(s),
    generatedAt: now(),
    semesters: record.semesters.map((sem) => ({
      semesterId: sem.semesterId,
      name: sem.semester.name,
      gpa: sem.gpa,
      cgpa: sem.cgpa,
      credits: sem.credits,
      qualityPoints: sem.qualityPoints,
      courses: sem.rows.map((r) => ({
        courseCode: r.courseCode,
        courseTitle: r.courseTitle,
        creditHours: r.creditHours,
        totalScore: r.totalScore,
        letter: r.letter,
        gradePoints: r.special ? null : r.gradePoints,
        countsInGpa: r.countsInGpa,
        isRepeat: r.isRepeat,
        superseded: Boolean(r.supersededBy),
        note: r.note || (r.supersededBy ? 'Repeated' : null),
      })),
    })),
    cgpa: record.cgpa,
    earnedCredits: record.earnedCredits,
    attemptedCredits: record.attemptedCredits,
    qualityPoints: record.qualityPoints,
    gpaCredits: record.gpaCredits,
    standing: academicStanding(record.cgpa, policy),
    scale: getActiveScale(),
    policy: { repeatPolicy: policy.repeatPolicy, passMark: policy.passMark },
  }
}

export function getTranscript(studentId) {
  const user = currentUser()
  if (user.roleId === 'student') {
    const me = read().students.find((x) => x.userId === user.id)
    if (me?.id !== studentId) throw forbidden('You can only view your own transcript.')
  } else if (user.roleId !== 'admin') throw forbidden()
  return buildTranscript(studentId)
}

/** Admin: one student's performance across all enrollments (including unpublished). */
export function getStudentPerformanceReport(studentId) {
  requireRole('admin')
  const db = read()
  const s = db.students.find((x) => x.id === studentId)
  if (!s) throw notFound('Student')
  const record = academicRecordFor(studentId)
  const courses = db.courseEnrollments
    .filter((e) => e.studentId === studentId)
    .map((e) => {
      const gb = buildGradebook(e.offeringId)
      const row = gb.rows.find((r) => r.enrollmentId === e.id)
      return {
        enrollmentId: e.id,
        courseCode: gb.offering.course.code,
        courseTitle: gb.offering.course.title,
        creditHours: gb.offering.course.creditHours,
        semesterName: gb.offering.semester.name,
        semesterOrder: gb.offering.semester.order,
        status: e.status,
        gradeStatus: gb.offering.gradeStatus,
        runningPercent: row.runningPercent,
        total: row.total,
        letter: row.finalGrade?.letter ?? (row.complete ? row.letter : null),
        published: row.finalGrade?.status === 'published',
      }
    })
    .sort((a, b) => b.semesterOrder - a.semesterOrder)
  return {
    student: studentView(s),
    cgpa: record.cgpa,
    earnedCredits: record.earnedCredits,
    standing: academicStanding(record.cgpa, getPolicy()),
    trend: record.semesters.map((x) => ({ semester: x.semester.name, gpa: x.gpa, cgpa: x.cgpa })),
    courses,
  }
}

/** Course grade sheet (admin or the assigned teacher). */
export function getCourseGradeSheet(offeringId) {
  const user = requireRole('admin', 'teacher')
  assertOfferingAccess(user, offeringId)
  const gb = buildGradebook(offeringId)
  return { university: read().settings.university, ...gb, stats: gradebookStats(gb), generatedAt: now() }
}

// ---------------- Audit logs ----------------
export function listAuditLogs({ search, action, entityType, userId, from, to, page, pageSize } = {}) {
  requireRole('admin')
  const db = read()
  const items = db.auditLogs
    .filter((l) => (!action || l.action.startsWith(action)) && (!entityType || l.entityType === entityType) && (!userId || l.userId === userId))
    .filter((l) => (!from || l.createdAt.slice(0, 10) >= from) && (!to || l.createdAt.slice(0, 10) <= to))
    .map((l) => {
      const u = db.users.find((x) => x.id === l.userId)
      return { ...l, userName: u ? `${u.firstName} ${u.lastName}` : 'System', userRole: u?.roleId ?? null }
    })
    .filter((l) => matches(search, l.details, l.userName, l.action, l.reason))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return paginate(items, { page, pageSize })
}

export function listAuditActions() {
  requireRole('admin')
  return [...new Set(read().auditLogs.map((l) => l.action.split('.')[0]))].sort()
}

// ---------------- Settings ----------------
export function getSettings() {
  requireRole('admin')
  return read().settings
}

export function updateUniversitySettings(data) {
  const actor = requireRole('admin')
  validate({
    name: () => required(data.name, 'University name'),
    shortName: () => required(data.shortName, 'Short name'),
    email: () => required(data.email, 'Email') || isEmail(data.email),
    registrarName: () => required(data.registrarName, 'Registrar name'),
  })
  const before = read().settings.university
  const next = { name: data.name.trim(), shortName: data.shortName.trim(), motto: data.motto?.trim() ?? '', address: data.address?.trim() ?? '', email: data.email.trim(), phone: data.phone?.trim() ?? '', website: data.website?.trim() ?? '', registrarName: data.registrarName.trim() }
  transaction((tx) => {
    tx.state.settings.university = next
    tx.state.settings.updatedAt = now()
    audit(tx, actor, { action: 'settings.updated', entityType: 'settings', entityId: 'university', details: 'Updated university information', before, after: next })
  })
  return next
}

export function resetDemoData() {
  requireRole('admin')
  resetDatabase()
  return { ok: true }
}

