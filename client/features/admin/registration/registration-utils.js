// The API serialises Postgres DATE columns as ISO timestamps at local midnight,
// so read them back with local getters — splitting on 'T' can land on the previous day.
export function toDateInput(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

export function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  // DD/MM/YYYY, matching the form fields.
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export const TERM_LABELS = { first: 'First Semester', second: 'Second Semester', summer: 'Summer' }

export const TYPE_BADGE_CLASS = {
  regular: 'reg-badge--regular',
  extension: 'reg-badge--extension',
  weekend: 'reg-badge--weekend',
}

export function errorMessage(err, fallback) {
  return err?.message || fallback
}
