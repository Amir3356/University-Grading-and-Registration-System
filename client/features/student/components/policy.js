// Plain-language helpers shared by the student pages (no components here).
import { ASSESSMENT_TYPES } from '@/lib/grading'

export const typeLabel = (type) => ASSESSMENT_TYPES.find((t) => t.value === type)?.label ?? type

export function standingVariant(tone) {
  if (tone === 'success') return 'success'
  if (tone === 'danger') return 'danger'
  if (tone === 'muted') return 'muted'
  return 'secondary'
}

export function repeatPolicyText(policy) {
  if (policy === 'highest') return 'If you repeat a course, only your best attempt counts toward your cumulative GPA. Other attempts stay on your record but are marked as superseded.'
  if (policy === 'all') return 'If you repeat a course, every attempt counts toward your cumulative GPA, so a failed attempt keeps lowering it even after you pass.'
  return 'If you repeat a course, only your latest attempt counts toward your cumulative GPA. Earlier attempts stay on your record but are marked as superseded.'
}

export function incompletePolicyText(policy) {
  return policy === 'as_fail'
    ? 'An Incomplete (I) counts as a fail (zero grade points) in your GPA until it is resolved.'
    : 'An Incomplete (I) is left out of your GPA until it is resolved; it earns no credits.'
}

export function withdrawalPolicyText(policy) {
  return policy === 'as_fail'
    ? 'A withdrawal (W) counts as a fail (zero grade points) in your GPA.'
    : 'A withdrawal (W) appears on your record but is not counted in your GPA and earns no credits.'
}

export const RESULT_STATUS_LABELS = {
  published: 'Published',
  in_progress: 'In progress',
  pending: 'Pending publication',
  withdrawn: 'Withdrawn',
}
