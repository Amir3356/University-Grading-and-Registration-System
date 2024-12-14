// Pure grading / GPA logic (no browser or framework dependencies).

import {
  ASSESSMENT_TYPES,
  DEFAULT_GRADE_SCALE,
} from '@/config/grading.config';

export {
  ASSESSMENT_TYPES,
  DEFAULT_GRADE_SCALE,
};

export const round = (n, digits = 2) => {
  if (n == null || Number.isNaN(n)) return null
  const f = 10 ** digits
  return Math.round((n + Number.EPSILON) * f) / f
}

export function sumWeights(assessments) {
  return round(assessments.reduce((s, a) => s + Number(a.weight || 0), 0), 2)
}

/**
 * Validate a mark against an assessment. Returns an error string or null.
 * Empty values are allowed (they mean "not entered yet").
 */
export function validateMark(value, maxMarks) {
  if (value === '' || value == null) return null
  const n = Number(value)
  if (Number.isNaN(n)) return 'Must be a number'
  if (n < 0) return 'Cannot be negative'
  if (n > Number(maxMarks)) return `Cannot exceed ${maxMarks}`
  return null
}

/**
 * Weighted total out of 100.
 * @param assessments [{id, maxMarks, weight}]
 * @param marksByAssessment {assessmentId: number|null}
 */
export function computeWeightedTotal(assessments, marksByAssessment) {
  let total = 0
  let entered = 0
  let earnedWeight = 0
  for (const a of assessments) {
    const m = marksByAssessment[a.id]
    if (m == null || m === '') continue
    entered += 1
    const w = Number(a.weight ?? a.maxMarks ?? 0)
    const mm = Number(a.maxMarks ?? a.weight ?? 100) || 100
    earnedWeight += w
    total += (Number(m) / mm) * w
  }
  const roundedTotal = round(total, 2)
  return {
    total: roundedTotal,
    totalScore: roundedTotal,
    complete: assessments.length > 0 && entered === assessments.length,
    enteredCount: entered,
    expectedCount: assessments.length,
    /** Percentage over the weight assessed so far — useful for "current standing". */
    runningPercent: earnedWeight > 0 ? round((total / earnedWeight) * 100, 2) : null,
  }
}

function sortScale(scale) {
  return [...scale].sort((a, b) => b.min - a.min)
}

/** Find the scale entry for a numeric score. */
export function gradeForScore(score, scale = DEFAULT_GRADE_SCALE) {
  if (score == null) return null
  const s = round(score, 2)
  for (const entry of sortScale(scale)) {
    if (s >= entry.min) return entry
  }
  return sortScale(scale).at(-1)
}

export function isPassing(score, passMark, letter = null) {
  if (letter && String(letter).toUpperCase() === 'F') return false
  return score != null && score >= passMark
}

/**
 * Validate a grade scale. Returns an array of error strings.
 * Rules: unique letters, min <= max, 0..100, no overlaps, covers 0..100 without gaps > 0.01.
 */
export function validateGradeScale(entries) {
  const errors = []
  if (!entries || !entries.length) return []
  const letters = new Set()
  for (const e of entries) {
    if (!String(e.letter || '').trim()) errors.push('Every grade needs a letter.')
    if (letters.has(e.letter)) errors.push(`Duplicate letter "${e.letter}".`)
    letters.add(e.letter)
    if (Number(e.min) > Number(e.max)) errors.push(`${e.letter}: minimum is greater than maximum.`)
    if (Number(e.min) < 0 || Number(e.max) > 100) errors.push(`${e.letter}: bounds must be within 0–100.`)
    if (Number(e.points) < 0 || Number(e.points) > 5) errors.push(`${e.letter}: grade points must be within 0–5.`)
  }
  const sorted = [...entries].sort((a, b) => Number(a.min) - Number(b.min))
  if (sorted.length && Number(sorted[0].min) !== 0) errors.push('The lowest grade must start at 0.')
  if (sorted.length && Number(sorted.at(-1).max) !== 100) errors.push('The highest grade must end at 100.')
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]
    const cur = sorted[i]
    if (Number(cur.min) <= Number(prev.max)) errors.push(`${prev.letter} and ${cur.letter} overlap.`)
    else if (Number(cur.min) - Number(prev.max) > 0.011) errors.push(`Gap between ${prev.letter} and ${cur.letter}.`)
  }
  return [...new Set(errors)]
}

/**
 * Format grade points for display. If the decimal portion has duplicate zeros (e.g. 4.00),
 * one zero is removed so it displays as 4.0. Values with distinct decimals like 3.75 remain intact.
 */
export function formatGradePoints(points) {
  if (points == null || points === '') return '—'
  const num = Number(points)
  if (Number.isNaN(num)) return String(points)
  return num.toFixed(2).replace(/\.00$/, '.0')
}

