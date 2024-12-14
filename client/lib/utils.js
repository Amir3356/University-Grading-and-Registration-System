import { clsx } from 'clsx'

/** Join class names conditionally: cn('btn', isActive && 'active'). */
export function cn(...inputs) {
  return clsx(inputs)
}

export function fullName(user) {
  if (!user) return ''
  return `${user.firstName} ${user.lastName}`.trim()
}

export function initials(user) {
  if (!user) return '?'
  return `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase()
}

export function average(nums) {
  const valid = nums.filter((n) => n != null && !Number.isNaN(n))
  if (!valid.length) return null
  return valid.reduce((s, n) => s + n, 0) / valid.length
}
