// Student-scoped data. The student id always comes from the signed-in user, never from parameters,
// so a student can only ever read their own records.
import { read } from './db'
import { academicStanding, computeWeightedTotal } from '@/lib/grading'
import { notFound, requireRole, studentProfile } from './helpers'
import { buildTranscript } from './reports'
import { academicRecordFor, currentSemester, getPolicy, offeringView, semesterView, studentView } from './selectors'

function myEnrollments(student) {
  return read().courseEnrollments.filter((e) => e.studentId === student.id)
}

/** Assessments the student may see: weights always; marks only when released (or grades published). */
function visibleAssessments(enrollment, offering) {
  const db = read()
  const fg = db.finalGrades.find((f) => f.enrollmentId === enrollment.id)
  const published = fg?.status === 'published'
  return db.assessments
    .filter((a) => a.offeringId === offering.id)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .map((a) => {
      const visible = a.isReleased || published
      const s = db.assessmentScores.find((x) => x.assessmentId === a.id && x.enrollmentId === enrollment.id)
      return { id: a.id, name: a.name, type: a.type, maxMarks: a.maxMarks, weight: a.weight, dueDate: a.dueDate, isReleased: visible, marks: visible ? (s?.marks ?? null) : null }
    })
}

function courseRow(e) {
  const db = read()
  const o = offeringView(db.courseOfferings.find((x) => x.id === e.offeringId))
  const fg = db.finalGrades.find((f) => f.enrollmentId === e.id)
  const published = fg?.status === 'published'
  return {
    enrollmentId: e.id,
    offeringId: o.id,
    status: e.status,
    isRepeat: e.isRepeat,
    course: o.course,
    semester: o.semester,
    teacher: o.teacher ? { name: o.teacher.name, email: o.teacher.user?.email, officeRoom: o.teacher.officeRoom } : null,
    section: o.section,
    room: o.room,
    schedule: o.schedule,
    weightTotal: o.weightTotal,
    finalGrade: published ? { totalScore: fg.totalScore, letter: fg.letter, gradePoints: fg.gradePoints, special: fg.special, publishedAt: fg.publishedAt, passed: !fg.special && fg.totalScore >= getPolicy().passMark } : null,
    resultStatus: published ? 'published' : e.status === 'withdrawn' ? 'withdrawn' : o.semester.isCurrent ? 'in_progress' : 'pending',
  }
}

export function getStudentDashboard() {
  const user = requireRole('student')
  const me = studentProfile(user)
  const current = currentSemester()
  const record = academicRecordFor(me.id)
  const enrollments = myEnrollments(me).map(courseRow)
  const currentCourses = enrollments.filter((c) => c.semester.id === current.id)
  const lastSem = record.semesters.at(-1) ?? null
  const recentResults = enrollments.filter((c) => c.finalGrade).sort((a, b) => b.finalGrade.publishedAt.localeCompare(a.finalGrade.publishedAt)).slice(0, 6)
  const released = []
  for (const e of myEnrollments(me).filter((x) => currentCourses.some((c) => c.enrollmentId === x.id))) {
    const o = read().courseOfferings.find((x) => x.id === e.offeringId)
    const code = read().courses.find((c) => c.id === o.courseId).code
    for (const a of visibleAssessments(e, o)) if (a.isReleased && a.marks != null) released.push({ ...a, courseCode: code })
  }
  return {
    student: studentView(me),
    currentSemester: semesterView(current),
    currentCourses,
    gpa: lastSem?.gpa ?? null,
    gpaSemester: lastSem?.semester?.name ?? null,
    cgpa: record.cgpa,
    earnedCredits: record.earnedCredits,
    standing: academicStanding(record.cgpa, getPolicy()),
    trend: record.semesters.map((s) => ({ semester: s.semester.name, term: `${s.semester.term} ${s.semester.academicYear.name.slice(2, 4)}/${s.semester.academicYear.name.slice(7)}`, gpa: s.gpa, cgpa: s.cgpa, credits: s.credits })),
    recentResults,
    releasedMarks: released.slice(-6).reverse(),
    publishedCount: enrollments.filter((c) => c.finalGrade).length,
  }
}

export function listMyCourses({ semesterId } = {}) {
  const user = requireRole('student')
  const me = studentProfile(user)
  return myEnrollments(me)
    .map(courseRow)
    .filter((c) => !semesterId || c.semester.id === semesterId)
    .sort((a, b) => b.semester.order - a.semester.order || a.course.code.localeCompare(b.course.code))
}

export function getMyCourse(enrollmentId) {
  const user = requireRole('student')
  const me = studentProfile(user)
  const e = myEnrollments(me).find((x) => x.id === enrollmentId)
  if (!e) throw notFound('Course')
  const o = read().courseOfferings.find((x) => x.id === e.offeringId)
  const assessments = visibleAssessments(e, o)
  const marks = Object.fromEntries(assessments.filter((a) => a.marks != null).map((a) => [a.id, a.marks]))
  const running = computeWeightedTotal(assessments, marks)
  return { ...courseRow(e), assessments, runningPercent: running.runningPercent, earnedWeighted: running.total }
}

export function listMyAssessments({ semesterId } = {}) {
  const user = requireRole('student')
  const me = studentProfile(user)
  const sid = !semesterId || semesterId === 'all' ? null : semesterId
  const out = []
  for (const e of myEnrollments(me)) {
    const o = read().courseOfferings.find((x) => x.id === e.offeringId)
    if (sid && o.semesterId !== sid) continue
    const c = read().courses.find((x) => x.id === o.courseId)
    for (const a of visibleAssessments(e, o)) out.push({ ...a, enrollmentId: e.id, courseCode: c.code, courseTitle: c.title, percent: a.marks != null ? (a.marks / a.maxMarks) * 100 : null })
  }
  return out.sort((a, b) => a.dueDate.localeCompare(b.dueDate))
}

export function getMyGrades() {
  const user = requireRole('student')
  const me = studentProfile(user)
  const record = academicRecordFor(me.id)
  const rows = myEnrollments(me).map(courseRow)
  // Group every enrollment by semester; published grades carry the GPA data.
  const bySem = new Map()
  for (const r of rows) {
    if (!bySem.has(r.semester.id)) bySem.set(r.semester.id, { semester: r.semester, courses: [] })
    const recRow = record.rows.find((x) => x.enrollmentId === r.enrollmentId)
    bySem.get(r.semester.id).courses.push({ ...r, countsInGpa: recRow?.countsInGpa ?? null, supersededBy: recRow?.supersededBy ?? null, note: recRow?.note ?? null })
  }
  const semesters = [...bySem.values()]
    .sort((a, b) => b.semester.order - a.semester.order)
    .map((s) => {
      const recSem = record.semesters.find((x) => x.semesterId === s.semester.id)
      return { ...s, gpa: recSem?.gpa ?? null, cgpa: recSem?.cgpa ?? null, credits: recSem?.credits ?? 0, qualityPoints: recSem?.qualityPoints ?? 0 }
    })
  return { semesters, cgpa: record.cgpa, earnedCredits: record.earnedCredits, passMark: getPolicy().passMark }
}

export function getMyProgress() {
  const user = requireRole('student')
  const me = studentProfile(user)
  const db = read()
  const record = academicRecordFor(me.id)
  const policy = getPolicy()
  const inProgress = myEnrollments(me)
    .map(courseRow)
    .filter((c) => !c.finalGrade && c.status !== 'withdrawn')
  const inProgressIds = new Set(inProgress.map((c) => c.course.id))
  const passed = new Set(record.passedCourseIds)
  const failed = record.failedCourseIds
  // Programme requirements: every active course in the student's department, plus the
  // courses from other departments the student has been enrolled in (core/service courses).
  const takenCourseIds = new Set(myEnrollments(me).map((e) => db.courseOfferings.find((o) => o.id === e.offeringId).courseId))
  const requiredCourses = db.courses.filter((c) => (c.departmentId === me.departmentId && c.status === 'active') || takenCourseIds.has(c.id))
  const remaining = requiredCourses.filter((c) => !passed.has(c.id) && !inProgressIds.has(c.id))
  const courseById = (id) => db.courses.find((c) => c.id === id)
  const completed = record.rows
    .filter((r) => r.passed && !r.supersededBy)
    .map((r) => ({ ...r, course: courseById(r.courseId) }))
  return {
    student: studentView(me),
    cgpa: record.cgpa,
    earnedCredits: record.earnedCredits,
    attemptedCredits: record.attemptedCredits,
    gpaCredits: record.gpaCredits,
    qualityPoints: record.qualityPoints,
    standing: academicStanding(record.cgpa, policy),
    policy: { repeatPolicy: policy.repeatPolicy, incompletePolicy: policy.incompletePolicy, withdrawalPolicy: policy.withdrawalPolicy, passMark: policy.passMark, probationGpa: policy.probationGpa, honorsGpa: policy.honorsGpa },
    semesters: record.semesters.map((s) => ({ semesterId: s.semesterId, name: s.semester.name, gpa: s.gpa, cgpa: s.cgpa, credits: s.credits, qualityPoints: s.qualityPoints, courseCount: s.rows.length })),
    completed,
    failed: failed.map((id) => ({ course: courseById(id), attempts: record.rows.filter((r) => r.courseId === id) })),
    inProgress,
    remaining,
    requiredCredits: requiredCourses.reduce((s, c) => s + c.creditHours, 0),
  }
}

export function getMyTranscript() {
  const user = requireRole('student')
  const me = studentProfile(user)
  return buildTranscript(me.id)
}
