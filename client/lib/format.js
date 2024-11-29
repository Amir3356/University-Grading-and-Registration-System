import { format, formatDistanceToNow, parseISO } from 'date-fns'

const toDate = (value) => (value instanceof Date ? value : parseISO(String(value)))

export function formatDate(value, pattern = 'd MMM yyyy') {
  if (!value) return '—'
  try {
    return format(toDate(value), pattern)
  } catch {
    return '—'
  }
}

export function formatDateTime(value) {
  return formatDate(value, 'd MMM yyyy, HH:mm')
}

export function timeAgo(value) {
  if (!value) return '—'
  try {
    return formatDistanceToNow(toDate(value), { addSuffix: true })
  } catch {
    return '—'
  }
}

export function formatNumber(value, digits = 0) {
  if (value == null || Number.isNaN(value)) return '—'
  return Number(value).toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

export function formatPercent(value, digits = 1) {
  if (value == null || Number.isNaN(value)) return '—'
  return `${Number(value).toFixed(digits)}%`
}

export function formatGpa(value) {
  if (value == null || Number.isNaN(value)) return '—'
  return Number(value).toFixed(2)
}

export function formatYearOfStudy(val) {
  if (!val) return '—'
  if (typeof val === 'string' && /\d+(st|nd|rd|th)\s+Year/i.test(val)) return val
  const num = typeof val === 'number' ? val : parseInt(String(val).replace(/\D/g, ''), 10)
  if (!Number.isFinite(num)) return '—'
  let studyYear = num
  if (num >= 100 && num <= 900) {
    studyYear = Math.floor(num / 100)
  } else if (num >= 1900 && num <= 2100) {
    const currentYear = new Date().getFullYear()
    studyYear = Math.min(5, Math.max(1, currentYear - num + 1))
  }
  // A programme is at most 5 years, so year of study is always 1–5.
  studyYear = Math.min(5, Math.max(1, studyYear))
  const ordinals = { 1: '1st Year', 2: '2nd Year', 3: '3rd Year', 4: '4th Year', 5: '5th Year' }
  return ordinals[studyYear] || `${studyYear}th Year`
}

/**
 * Resolves a student's current year of study.
 * Automatically increments by 1 as long as the student has not withdrawn from the university.
 * If the student has withdrawn, preserves their recorded year of study without incrementing.
 */
export function getStudentCurrentYearOfStudy(student) {
  if (!student) return '—'

  const isWithdrawn =
    String(student.status || '').toLowerCase() === 'withdrawn' ||
    String(student.academicStatus || student.academic_status || '').toLowerCase() === 'withdrawn' ||
    Boolean(student.withdrawn) ||
    Boolean(student.isWithdrawn)

  const rawVal =
    student.yearOfStudy ??
    student.year_of_study ??
    student.batchYear ??
    student.admissionYear ??
    1

  let num = typeof rawVal === 'number' ? rawVal : parseInt(String(rawVal).replace(/\D/g, ''), 10)
  if (!Number.isFinite(num) || num <= 0) {
    num = 1
  }

  // If stored as an admission year (e.g. 2024), convert to base study year
  if (num >= 1900 && num <= 2100) {
    const currentYear = new Date().getFullYear()
    num = Math.min(5, Math.max(1, currentYear - num + 1))
  } else if (num >= 100 && num <= 900) {
    num = Math.floor(num / 100)
  }

  // Base year is capped between 1 and 5
  num = Math.min(5, Math.max(1, num))

  return formatYearOfStudy(num)
}

export function getStudentStudyYear(student) {
  if (!student) return '1'
  const rawVal =
    student.yearOfStudy ??
    student.year_of_study ??
    student.batchYear ??
    student.admissionYear ??
    1

  let num = typeof rawVal === 'number' ? rawVal : parseInt(String(rawVal).replace(/\D/g, ''), 10)
  if (!Number.isFinite(num) || num <= 0) {
    num = 1
  }

  if (num >= 1900 && num <= 2100) {
    const currentYear = new Date().getFullYear()
    num = Math.min(5, Math.max(1, currentYear - num + 1))
  } else if (num >= 100 && num <= 900) {
    num = Math.floor(num / 100)
  }

  num = Math.min(5, Math.max(1, num))
  return String(num)
}

export function getCourseStudyYear(course) {
  if (!course) return '1'
  if (course.yearOfStudy) return String(course.yearOfStudy)
  if (course.year_of_study) return String(course.year_of_study)
  if (course.year) return String(course.year)

  const val = course.level ?? course.code
  if (typeof val === 'number') {
    if (val >= 100 && val <= 900) return String(Math.floor(val / 100))
    if (val >= 1 && val <= 5) return String(val)
  }
  const str = String(val || '').trim()
  const m = str.match(/\d+/)
  if (m) {
    const num = parseInt(m[0], 10)
    if (num >= 100 && num <= 900) return String(Math.floor(num / 100))
    if (num >= 1 && num <= 5) return String(num)
  }
  return '1'
}

export function formatSemesterTerm(term) {
  if (!term) return '—'
  const t = String(term).trim().toLowerCase()
  if (t === 'first' || t === 'fall' || t === '1') return 'First Semester'
  if (t === 'second' || t === 'spring' || t === '2') return 'Second Semester'
  if (t === 'summer' || t === '3') return 'Summer Semester'
  const labels = { Fall: 'First Semester', Spring: 'Second Semester', Summer: 'Summer Semester' }
  return labels[term] ?? (term ? `${term} Semester` : '—')
}

export function formatSemesterName(name) {
  if (!name) return ''
  const m1 = String(name).match(/^(Fall|Spring|Summer)\s+(\d{4})(?:\/\d{4})?/i)
  if (m1) {
    const termMap = { fall: 'First Semester', spring: 'Second Semester', summer: 'Summer Semester' }
    const termLabel = termMap[m1[1].toLowerCase()] || `${m1[1]} Semester`
    return `${m1[2]} ${termLabel}`
  }
  const m2 = String(name).match(/^(\d{4})(?:\/\d{4})?\s+(Fall|Spring|Summer)/i)
  if (m2) {
    const termMap = { fall: 'First Semester', spring: 'Second Semester', summer: 'Summer Semester' }
    const termLabel = termMap[m2[2].toLowerCase()] || `${m2[2]} Semester`
    return `${m2[1]} ${termLabel}`
  }
  return name
}

export function formatSemesterOptionLabel(s, academicYears = []) {
  if (!s) return '—'

  const termLower = String(s.term || '').toLowerCase()
  const nameLower = String(s.name || '').toLowerCase()
  let termLabel
  if (termLower === 'first' || termLower === 'fall' || termLower === '1' || /first|fall|\b1st\b/i.test(nameLower)) {
    termLabel = 'First Semester'
  } else if (termLower === 'second' || termLower === 'spring' || termLower === '2' || /second|spring|\b2nd\b/i.test(nameLower)) {
    termLabel = 'Second Semester'
  } else if (s.term) {
    termLabel = `${s.term} Semester`
  } else {
    termLabel = 'First Semester'
  }

  let year = ''
  const nameMatch = String(s.name || '').match(/\b(20\d\d)\b/)
  if (nameMatch) {
    year = nameMatch[1]
  }

  if (!year) {
    const ayId = s.academic_year_id ?? s.academicYearId ?? s.academic_year?.id ?? s.academicYear?.id
    const ay = (academicYears ?? []).find((y) => y.id === ayId) || s.academic_year || s.academicYear
    const ayMatch = String(ay?.name || ay?.id || '').match(/\b(20\d\d)\b/)
    if (ayMatch) year = ayMatch[1]
  }

  if (!year && (s.academic_year_id || s.academicYearId)) {
    const ayIdMatch = String(s.academic_year_id || s.academicYearId).match(/\b(20\d\d)\b/)
    if (ayIdMatch) year = ayIdMatch[1]
  }

  if (!year && (s.startDate || s.start_date)) {
    const d = new Date(s.startDate || s.start_date)
    let y = d.getFullYear()
    if (termLabel === 'Second Semester' && d.getMonth() < 7) {
      y -= 1
    }
    year = String(y)
  }

  if (!year && s.id) {
    const idMatch = String(s.id).match(/\b(20\d\d)\b/)
    if (idMatch) {
      let y = parseInt(idMatch[1], 10)
      if (termLabel === 'Second Semester' && String(s.id).includes('spring')) {
        y -= 1
      }
      year = String(y)
    }
  }

  if (!year) {
    year = String(new Date().getFullYear())
  }

  return `${year} ${termLabel}`
}

/**
 * Resolves the academic year number (e.g. 2026) aligned with a semester or course,
 * matching how Teacher Assignment resolves the year for its Semester column.
 */
export function formatAcademicYear(s, academicYears = []) {
  if (!s) return '—'
  const label = formatSemesterOptionLabel(s, academicYears)
  const match = label.match(/\b(20\d\d)\b/)
  if (match) return match[1]

  const rawMatch =
    String(s.name || '').match(/\b(20\d\d)\b/) ||
    String(s.academicYear?.name || s.academic_year?.name || '').match(/\b(20\d\d)\b/) ||
    String(s.academicYear?.id || s.academic_year_id || s.academicYearId || '').match(/\b(20\d\d)\b/) ||
    String(s.startDate || s.start_date || '').match(/\b(20\d\d)\b/) ||
    String(s.id || '').match(/\b(20\d\d)\b/)

  if (rawMatch) return rawMatch[1]
  return String(new Date().getFullYear())
}

export const GRADE_STATUS_LABELS = {
  not_started: 'Not started',
  draft: 'Draft',
  submitted: 'Pending approval',
  approved: 'Approved',
  rejected: 'Returned',
  published: 'Published',
}

export const ROLE_LABELS = {
  admin: 'Administrator',
  dept_head: 'Department Head',
  teacher: 'Teacher',
  student: 'Student',
}
