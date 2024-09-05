// Read-side joins over the mock database (equivalent to SQL views / JOINs).
import { read } from './db'
import {
  DEFAULT_POLICY,
  computeAcademicRecord,
  computeWeightedTotal,
  gradeDistribution,
  gradeForScore,
  sumWeights,
  weightsAreValid,
} from '@/lib/grading'
import { average } from '@/lib/utils'

const byId = (table, id) => read()[table].find((r) => r.id === id) ?? null

export const publicUser = (u) => {
  if (!u) return null
  const rest = { ...u }
  delete rest.passwordHash
  delete rest.passwordSalt
  return rest
}

export function getPolicy() {
  return { ...DEFAULT_POLICY, ...read().settings.policy }
}

export function getActiveScale() {
  const scale = read().gradeScales.find((s) => s.isActive) ?? read().gradeScales[0]
  return scale.entries
}

export function currentSemester() {
  return read().semesters.find((s) => s.isCurrent) ?? read().semesters.at(-1)
}

export function semesterView(sem) {
  if (!sem) return null
  return { ...sem, academicYear: byId('academicYears', sem.academicYearId) }
}

export function teacherView(t) {
  if (!t) return null
  const user = publicUser(byId('users', t.userId))
  return {
    ...t,
    user,
    name: user ? `${t.title} ${user.firstName} ${user.lastName}` : 'Unassigned',
    department: byId('departments', t.departmentId),
  }
}

export function studentView(s) {
  if (!s) return null
  const user = publicUser(byId('users', s.userId))
  return { ...s, user, name: user ? `${user.firstName} ${user.lastName}` : '', email: user?.email, department: byId('departments', s.departmentId) }
}

export function courseView(c) {
  if (!c) return null
  return { ...c, department: byId('departments', c.departmentId) }
}

export function offeringView(o) {
  if (!o) return null
  const db = read()
  const assessments = db.assessments.filter((a) => a.offeringId === o.id)
  const enrollments = db.courseEnrollments.filter((e) => e.offeringId === o.id)
  return {
    ...o,
    course: courseView(byId('courses', o.courseId)),
    semester: semesterView(byId('semesters', o.semesterId)),
    teacher: teacherView(byId('teachers', o.teacherId)),
    enrolledCount: enrollments.filter((e) => e.status !== 'withdrawn').length,
    withdrawnCount: enrollments.filter((e) => e.status === 'withdrawn').length,
    assessmentCount: assessments.length,
    weightTotal: sumWeights(assessments),
    weightsValid: weightsAreValid(assessments),
  }
}

/** Full gradebook for an offering: assessments × enrollments with computed totals. */
export function buildGradebook(offeringId) {
  const db = read()
  const offering = db.courseOfferings.find((o) => o.id === offeringId)
  const assessments = db.assessments
    .filter((a) => a.offeringId === offeringId)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const assessmentIds = new Set(assessments.map((a) => a.id))
  const scale = getActiveScale()
  const policy = getPolicy()
  const enrollments = db.courseEnrollments.filter((e) => e.offeringId === offeringId)
  const scoresByEnrollment = new Map()
  for (const s of db.assessmentScores) {
    if (!assessmentIds.has(s.assessmentId)) continue
    if (!scoresByEnrollment.has(s.enrollmentId)) scoresByEnrollment.set(s.enrollmentId, {})
    scoresByEnrollment.get(s.enrollmentId)[s.assessmentId] = s.marks
  }
  const rows = enrollments
    .map((e) => {
      const student = studentView(db.students.find((s) => s.id === e.studentId))
      const marks = scoresByEnrollment.get(e.id) ?? {}
      const calc = computeWeightedTotal(assessments, marks)
      const finalGrade = db.finalGrades.find((f) => f.enrollmentId === e.id) ?? null
      const g = calc.complete ? gradeForScore(calc.total, scale) : null
      return {
        enrollmentId: e.id,
        enrollment: e,
        student,
        marks,
        total: calc.total,
        runningPercent: calc.runningPercent,
        complete: calc.complete,
        enteredCount: calc.enteredCount,
        letter: e.status === 'withdrawn' ? 'W' : finalGrade?.special ?? g?.letter ?? null,
        gradePoints: e.status === 'withdrawn' ? null : (finalGrade?.special ? null : (g?.points ?? null)),
        passed: calc.complete ? calc.total >= policy.passMark : null,
        finalGrade,
      }
    })
    .sort((a, b) => a.student.name.localeCompare(b.student.name))
  return {
    offering: offeringView(offering),
    assessments,
    rows,
    weightTotal: sumWeights(assessments),
    weightsValid: weightsAreValid(assessments),
    passMark: policy.passMark,
    scale,
  }
}

/** Aggregate statistics for a gradebook. */
export function gradebookStats(gb) {
  const active = gb.rows.filter((r) => r.enrollment.status !== 'withdrawn')
  const complete = active.filter((r) => r.complete)
  const totals = complete.map((r) => r.total)
  const running = active.map((r) => r.runningPercent).filter((n) => n != null)
  const passed = complete.filter((r) => r.passed).length
  const assessmentAverages = gb.assessments.map((a) => {
    const vals = active.map((r) => r.marks[a.id]).filter((m) => m != null)
    return {
      assessmentId: a.id,
      name: a.name,
      maxMarks: a.maxMarks,
      average: average(vals),
      averagePercent: vals.length ? (average(vals) / a.maxMarks) * 100 : null,
      entered: vals.length,
      expected: active.length,
    }
  })
  return {
    studentCount: active.length,
    completeCount: complete.length,
    average: average(totals),
    runningAverage: average(running),
    highest: totals.length ? Math.max(...totals) : null,
    lowest: totals.length ? Math.min(...totals) : null,
    passRate: complete.length ? (passed / complete.length) * 100 : null,
    passed,
    failed: complete.length - passed,
    distribution: gradeDistribution(complete.map((r) => r.letter), gb.scale),
    assessmentAverages,
    missingMarks: active.reduce((s, r) => s + (gb.assessments.length - r.enteredCount), 0),
  }
}

/** Students at risk: current standing below pass mark + 10, or failing. */
export function strugglingStudents(gb) {
  const threshold = gb.passMark + 10
  return gb.rows
    .filter((r) => r.enrollment.status !== 'withdrawn' && r.runningPercent != null && r.runningPercent < threshold)
    .map((r) => ({
      enrollmentId: r.enrollmentId,
      student: r.student,
      runningPercent: r.runningPercent,
      total: r.total,
      complete: r.complete,
      risk: r.runningPercent < gb.passMark ? 'high' : 'moderate',
    }))
    .sort((a, b) => a.runningPercent - b.runningPercent)
}

/** Published result rows for a student, ready for computeAcademicRecord. */
export function publishedRowsForStudent(studentId, { includeUnpublished = false } = {}) {
  const db = read()
  const rows = []
  for (const e of db.courseEnrollments.filter((x) => x.studentId === studentId)) {
    const fg = db.finalGrades.find((f) => f.enrollmentId === e.id)
    if (!fg) continue
    if (!includeUnpublished && fg.status !== 'published') continue
    const o = byId('courseOfferings', e.offeringId)
    const c = byId('courses', o.courseId)
    const sem = byId('semesters', o.semesterId)
    rows.push({
      enrollmentId: e.id,
      offeringId: o.id,
      courseId: c.id,
      courseCode: c.code,
      courseTitle: c.title,
      creditHours: c.creditHours,
      semesterId: sem.id,
      semesterName: sem.name,
      semesterOrder: sem.order,
      totalScore: fg.totalScore,
      letter: fg.letter,
      gradePoints: fg.gradePoints ?? 0,
      special: fg.special,
      isRepeat: e.isRepeat,
      publishedAt: fg.publishedAt,
      status: fg.status,
    })
  }
  return rows
}

export function academicRecordFor(studentId) {
  const rows = publishedRowsForStudent(studentId)
  const record = computeAcademicRecord(rows, getPolicy(), getActiveScale())
  record.semesters = record.semesters.map((s) => ({ ...s, semester: semesterView(byId('semesters', s.semesterId)) }))
  return record
}

export { byId }
