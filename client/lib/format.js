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

export function formatSemesterTerm(term) {
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
