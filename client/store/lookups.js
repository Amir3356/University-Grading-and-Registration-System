import { read } from './db'
import { currentUser } from './helpers'
import { courseView, currentSemester, getActiveScale, getPolicy, semesterView, studentView, teacherView } from './selectors'

/** Reference data needed by forms and filters across the app. */
export function getLookups() {
  const user = currentUser()
  const db = read()
  const base = {
    departments: db.departments,
    academicYears: [...db.academicYears].sort((a, b) => b.startDate.localeCompare(a.startDate)),
    semesters: [...db.semesters].sort((a, b) => b.order - a.order).map(semesterView),
    currentSemester: semesterView(currentSemester()),
    gradeScale: getActiveScale(),
    policy: getPolicy(),
    university: db.settings.university,
    roles: db.roles,
  }
  if (user.roleId === 'admin') {
    base.courses = db.courses.map(courseView)
    base.teachers = db.teachers.map(teacherView).filter((t) => t.user?.status === 'active')
    base.students = db.students.map(studentView).filter((s) => s.user?.status === 'active')
  }
  return base
}
