/** Error raised by store functions. kind: 'validation' | 'unauthenticated' | 'forbidden' | 'not_found' | 'conflict' */
export class StoreError extends Error {
  constructor(kind, message, fieldErrors = null) {
    super(message)
    this.name = 'StoreError'
    this.kind = kind
    this.fieldErrors = fieldErrors
  }
}

export const badRequest = (msg, fieldErrors) => new StoreError('validation', msg, fieldErrors)
export const unauthorized = (msg = 'Please sign in again.') => new StoreError('unauthenticated', msg)
export const forbidden = (msg = 'You do not have permission to perform this action.') => new StoreError('forbidden', msg)
export const notFound = (what = 'Record') => new StoreError('not_found', `${what} not found.`)
export const conflict = (msg) => new StoreError('conflict', msg)

// ---------------- Validation helpers ----------------
export function validate(rules) {
  const errors = {}
  for (const [field, check] of Object.entries(rules)) {
    const msg = check()
    if (msg) errors[field] = msg
  }
  if (Object.keys(errors).length) throw badRequest('Please correct the highlighted fields.', errors)
}

export const required = (v, label = 'This field') => (v == null || String(v).trim() === '' ? `${label} is required.` : null)
export const isEmail = (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '')) ? null : 'Enter a valid email address.')
export const numberIn = (v, min, max, label = 'Value') => {
  const n = Number(v)
  if (v === '' || v == null || Number.isNaN(n)) return `${label} must be a number.`
  if (n < min || n > max) return `${label} must be between ${min} and ${max}.`
  return null
}

// ---------------- Pagination / search ----------------
export function paginate(items, { page = 1, pageSize = 10 } = {}) {
  const total = items.length
  if (pageSize === null || pageSize === false || pageSize === 0) {
    return { items, total, page: 1, pageSize: total, pageCount: 1 }
  }
  const size = Math.max(1, Math.min(100, Number(pageSize) || 10))
  const pageCount = Math.max(1, Math.ceil(total / size))
  const p = Math.min(Math.max(1, Number(page) || 1), pageCount)
  return { items: items.slice((p - 1) * size, p * size), total, page: p, pageSize: size, pageCount }
}

export function matches(search, ...fields) {
  if (!search) return true
  const q = String(search).toLowerCase().trim()
  return fields.some((f) => f != null && String(f).toLowerCase().includes(q))
}

export function sortBy(items, sort) {
  if (!sort?.key) return items
  const dir = sort.dir === 'desc' ? -1 : 1
  return [...items].sort((a, b) => {
    const av = a[sort.key]
    const bv = b[sort.key]
    if (av == null && bv == null) return 0
    if (av == null) return 1
    if (bv == null) return -1
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
    return String(av).localeCompare(String(bv), undefined, { numeric: true }) * dir
  })
}
