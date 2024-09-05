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
  teacher: 'Teacher',
  student: 'Student',
}
