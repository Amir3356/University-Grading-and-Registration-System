// Teacher-scoped data. Every query is restricted to the signed-in teacher's offerings.
import { read } from './db'
import { assertOfferingAccess, matches, notFound, paginate, requireRole, teacherProfile } from './helpers'
import { buildGradebook, currentSemester, gradebookStats, offeringView, strugglingStudents } from './selectors'

function myOfferings(user) {
  const t = teacherProfile(user)
  return read().courseOfferings.filter((o) => o.teacherId === t.id)
}

export function getTeacherDashboard() {
  const user = requireRole('teacher')
  const db = read()
  const current = currentSemester()
  const offerings = myOfferings(user).map(offeringView)
  const currentOfferings = offerings.filter((o) => o.semesterId === current.id)
  const pending = offerings.filter((o) => ['draft', 'not_started', 'rejected'].includes(o.gradeStatus) && o.semester.order <= current.order)

  const coursePerformance = currentOfferings.map((o) => {
    const stats = gradebookStats(buildGradebook(o.id))
    return { offeringId: o.id, code: o.course.code, title: o.course.title, average: stats.runningAverage, students: stats.studentCount, missingMarks: stats.missingMarks }
  })
  const lastClosed = offerings.filter((o) => o.gradeStatus === 'published').sort((a, b) => b.semester.order - a.semester.order)
  const recentSemesterId = lastClosed[0]?.semesterId
  const distLetters = []
  for (const o of lastClosed.filter((x) => x.semesterId === recentSemesterId)) {
    for (const r of buildGradebook(o.id).rows) if (r.letter && r.letter !== 'W') distLetters.push(r.letter)
  }
  const scale = buildGradebook(offerings[0]?.id ?? '').scale ?? []
  const distribution = scale.map((e) => ({ letter: e.letter, count: distLetters.filter((l) => l === e.letter).length }))

  const myOfferingIds = new Set(offerings.map((o) => o.id))
  const recentActivity = db.auditLogs.filter((l) => l.userId === user.id && l.action !== 'auth.login' && l.action !== 'auth.logout').slice(0, 8)
  const upcoming = db.assessments
    .filter((a) => myOfferingIds.has(a.offeringId) && currentOfferings.some((o) => o.id === a.offeringId) && a.dueDate >= new Date().toISOString().slice(0, 10))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 6)
    .map((a) => ({ ...a, courseCode: currentOfferings.find((o) => o.id === a.offeringId).course.code }))

  return {
    currentSemester: current,
    stats: {
      courses: currentOfferings.length,
      students: currentOfferings.reduce((s, o) => s + o.enrolledCount, 0),
      pendingSubmissions: pending.length,
      awaitingApproval: offerings.filter((o) => o.gradeStatus === 'submitted').length,
    },
    currentOfferings,
    pendingOfferings: pending,
    coursePerformance,
    distribution,
    distributionSemester: lastClosed[0]?.semester?.name ?? null,
    recentActivity,
    upcoming,
  }
}

export function listMyOfferings({ semesterId, academicYearId, search } = {}) {
  const user = requireRole('teacher')
  return myOfferings(user)
    .map(offeringView)
    .filter((o) => (!semesterId || o.semesterId === semesterId) && (!academicYearId || o.semester.academicYearId === academicYearId))
    .filter((o) => matches(search, o.course.code, o.course.title))
    .sort((a, b) => b.semester.order - a.semester.order || a.course.code.localeCompare(b.course.code))
}

export function getMyOffering(offeringId) {
  const user = requireRole('teacher', 'admin')
  assertOfferingAccess(user, offeringId)
  const gb = buildGradebook(offeringId)
  return { offering: gb.offering, assessments: gb.assessments, students: gb.rows.map((r) => ({ enrollment: r.enrollment, student: r.student, runningPercent: r.runningPercent, total: r.total, complete: r.complete, letter: r.letter })) }
}

/** Class lists across the teacher's offerings, filterable by semester/year. */
export function listMyStudents({ semesterId, offeringId, search, page, pageSize } = {}) {
  const user = requireRole('teacher')
  const offerings = myOfferings(user).filter((o) => (!semesterId || o.semesterId === semesterId) && (!offeringId || o.id === offeringId))
  const items = []
  for (const o of offerings) {
    const view = offeringView(o)
    for (const r of buildGradebook(o.id).rows) {
      items.push({
        enrollmentId: r.enrollmentId,
        offeringId: o.id,
        courseCode: view.course.code,
        courseTitle: view.course.title,
        semesterName: view.semester.name,
        studentId: r.student.id,
        studentNumber: r.student.studentNumber,
        name: r.student.name,
        email: r.student.email,
        department: r.student.department?.name,
        status: r.enrollment.status,
        isRepeat: r.enrollment.isRepeat,
        runningPercent: r.runningPercent,
        letter: r.complete ? r.letter : null,
      })
    }
  }
  const filtered = items.filter((i) => matches(search, i.name, i.studentNumber, i.courseCode)).sort((a, b) => a.name.localeCompare(b.name))
  return paginate(filtered, { page, pageSize })
}

/** One student's performance within one of the teacher's offerings. */
export function getStudentPerformance(offeringId, enrollmentId) {
  const user = requireRole('teacher', 'admin')
  assertOfferingAccess(user, offeringId)
  const gb = buildGradebook(offeringId)
  const row = gb.rows.find((r) => r.enrollmentId === enrollmentId)
  if (!row) throw notFound('Student enrollment')
  const stats = gradebookStats(gb)
  return {
    offering: gb.offering,
    student: row.student,
    enrollment: row.enrollment,
    total: row.total,
    runningPercent: row.runningPercent,
    letter: row.letter,
    complete: row.complete,
    assessments: gb.assessments.map((a) => {
      const avg = stats.assessmentAverages.find((x) => x.assessmentId === a.id)
      const m = row.marks[a.id]
      return { ...a, marks: m ?? null, percent: m != null ? (m / a.maxMarks) * 100 : null, classAveragePercent: avg?.averagePercent ?? null }
    }),
    classAverage: stats.runningAverage,
    atRisk: strugglingStudents(gb).some((s) => s.enrollmentId === enrollmentId),
  }
}
