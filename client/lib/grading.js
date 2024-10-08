// Pure grading / GPA logic (no browser or framework dependencies).

import {
  ASSESSMENT_TYPES,
  DEFAULT_GRADE_SCALE,
  SPECIAL_GRADES,
  ACADEMIC_LIMITS,
} from '@/config/grading.config';

export {
  ASSESSMENT_TYPES,
  DEFAULT_GRADE_SCALE,
  SPECIAL_GRADES,
  ACADEMIC_LIMITS,
};

export const round = (n, digits = 2) => {
  if (n == null || Number.isNaN(n)) return null
  const f = 10 ** digits
  return Math.round((n + Number.EPSILON) * f) / f
}

export function sumWeights(assessments) {
  return round(assessments.reduce((s, a) => s + Number(a.weight || 0), 0), 2)
}

export function weightsAreValid(assessments) {
  return assessments.length > 0 && Math.abs(sumWeights(assessments) - 100) < 0.001
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
    earnedWeight += Number(a.weight)
    total += (Number(m) / Number(a.maxMarks)) * Number(a.weight)
  }
  return {
    total: round(total, 2),
    complete: assessments.length > 0 && entered === assessments.length,
    enteredCount: entered,
    expectedCount: assessments.length,
    /** Percentage over the weight assessed so far — useful for "current standing". */
    runningPercent: earnedWeight > 0 ? round((total / earnedWeight) * 100, 2) : null,
  }
}

export function sortScale(scale) {
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

export function isPassing(score, passMark) {
  return score != null && score >= passMark
}

/**
 * Validate a grade scale. Returns an array of error strings.
 * Rules: unique letters, min <= max, 0..100, no overlaps, covers 0..100 without gaps > 0.01.
 */
export function validateGradeScale(entries) {
  const errors = []
  if (!entries.length) return ['The scale must contain at least one grade.']
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

export const DEFAULT_POLICY = {
  passMark: 50,
  approvalWorkflowEnabled: true,
  repeatPolicy: 'latest', // 'latest' | 'highest' | 'all'
  incompletePolicy: 'exclude', // 'exclude' | 'as_fail'
  withdrawalPolicy: 'exclude', // 'exclude' | 'as_fail'
  excludedCourseIds: [],
  probationGpa: 2.0,
  honorsGpa: 3.5,
  requireWeightsTotal100: true,
}

/**
 * Build a student's academic record.
 * @param rows [{enrollmentId, courseId, courseCode, courseTitle, creditHours, semesterId, semesterOrder,
 *               totalScore, letter, gradePoints, special ('W'|'I'|null)}] — only *published* results.
 * @param policy see DEFAULT_POLICY
 * @returns {semesters: [{semesterId, gpa, credits, qualityPoints, rows}], cgpa, earnedCredits, attemptedCredits, rows}
 */
export function computeAcademicRecord(rows, policy = DEFAULT_POLICY, scale = DEFAULT_GRADE_SCALE) {
  const failEntry = sortScale(scale).at(-1)
  const excluded = new Set(policy.excludedCourseIds || [])

  const normalized = rows.map((r) => {
    let gradePoints = r.gradePoints
    let countsInGpa = true
    let passed = r.special ? false : isPassing(r.totalScore, policy.passMark)
    let note = null
    if (r.special === 'W') {
      if (policy.withdrawalPolicy === 'as_fail') gradePoints = failEntry.points
      else countsInGpa = false
      note = 'Withdrawn'
    } else if (r.special === 'I') {
      if (policy.incompletePolicy === 'as_fail') gradePoints = failEntry.points
      else countsInGpa = false
      note = 'Incomplete'
    }
    if (excluded.has(r.courseId)) {
      countsInGpa = false
      note = 'Excluded from GPA'
    }
    return { ...r, gradePoints, countsInGpa, passed, note, supersededBy: null }
  })

  // Repeated course handling for the cumulative GPA.
  const byCourse = new Map()
  for (const r of normalized) {
    if (!r.countsInGpa) continue
    if (!byCourse.has(r.courseId)) byCourse.set(r.courseId, [])
    byCourse.get(r.courseId).push(r)
  }
  const cumulativeIds = new Set()
  for (const attempts of byCourse.values()) {
    if (policy.repeatPolicy === 'all' || attempts.length === 1) {
      attempts.forEach((a) => cumulativeIds.add(a.enrollmentId))
      continue
    }
    const sorted = [...attempts].sort((a, b) => a.semesterOrder - b.semesterOrder)
    const keep =
      policy.repeatPolicy === 'highest'
        ? sorted.reduce((best, a) => (a.gradePoints > best.gradePoints ? a : best), sorted[0])
        : sorted.at(-1)
    cumulativeIds.add(keep.enrollmentId)
    for (const a of sorted) if (a !== keep) a.supersededBy = keep.enrollmentId
  }

  const gpaOf = (list) => {
    const credits = list.reduce((s, r) => s + r.creditHours, 0)
    const qp = list.reduce((s, r) => s + r.gradePoints * r.creditHours, 0)
    return { credits, qualityPoints: round(qp, 2), gpa: credits ? round(qp / credits, 2) : null }
  }

  const semesterMap = new Map()
  for (const r of normalized) {
    if (!semesterMap.has(r.semesterId)) semesterMap.set(r.semesterId, { semesterId: r.semesterId, semesterOrder: r.semesterOrder, rows: [] })
    semesterMap.get(r.semesterId).rows.push(r)
  }
  const semesters = [...semesterMap.values()]
    .sort((a, b) => a.semesterOrder - b.semesterOrder)
    .map((s) => ({ ...s, ...gpaOf(s.rows.filter((r) => r.countsInGpa)) }))

  // Running CGPA after each semester (respecting the repeat policy up to that point).
  for (const sem of semesters) {
    const upTo = normalized.filter((r) => r.semesterOrder <= sem.semesterOrder)
    sem.cgpa = computeAcademicRecordCgpaOnly(upTo, policy)
  }

  const cumulativeRows = normalized.filter((r) => cumulativeIds.has(r.enrollmentId))
  const cum = gpaOf(cumulativeRows)

  // A course counts as earned if any attempt passed.
  const passedCourses = new Set(normalized.filter((r) => r.passed).map((r) => r.courseId))
  const earnedCredits = [...passedCourses].reduce((s, cid) => s + normalized.find((r) => r.courseId === cid).creditHours, 0)
  const attemptedCredits = normalized.filter((r) => r.special !== 'W').reduce((s, r) => s + r.creditHours, 0)

  return {
    semesters,
    rows: normalized,
    cgpa: cum.gpa,
    gpaCredits: cum.credits,
    qualityPoints: cum.qualityPoints,
    earnedCredits,
    attemptedCredits,
    passedCourseIds: [...passedCourses],
    failedCourseIds: [...new Set(normalized.filter((r) => !r.passed && !r.special).map((r) => r.courseId))].filter(
      (cid) => !passedCourses.has(cid),
    ),
  }
}

function computeAcademicRecordCgpaOnly(rows, policy) {
  const byCourse = new Map()
  for (const r of rows) {
    if (!r.countsInGpa) continue
    if (!byCourse.has(r.courseId)) byCourse.set(r.courseId, [])
    byCourse.get(r.courseId).push(r)
  }
  const kept = []
  for (const attempts of byCourse.values()) {
    if (policy.repeatPolicy === 'all') kept.push(...attempts)
    else if (policy.repeatPolicy === 'highest') kept.push(attempts.reduce((b, a) => (a.gradePoints > b.gradePoints ? a : b)))
    else kept.push([...attempts].sort((a, b) => a.semesterOrder - b.semesterOrder).at(-1))
  }
  const credits = kept.reduce((s, r) => s + r.creditHours, 0)
  return credits ? round(kept.reduce((s, r) => s + r.gradePoints * r.creditHours, 0) / credits, 2) : null
}

/** Academic standing label from a CGPA. */
export function academicStanding(cgpa, policy = DEFAULT_POLICY) {
  if (cgpa == null) return { label: 'No GPA yet', tone: 'muted' }
  if (cgpa >= policy.honorsGpa) return { label: "Dean's List", tone: 'success' }
  if (cgpa < policy.probationGpa) return { label: 'Academic Probation', tone: 'danger' }
  return { label: 'Good Standing', tone: 'default' }
}

/** Distribution of letters, in scale order. */
export function gradeDistribution(letters, scale = DEFAULT_GRADE_SCALE) {
  const counts = Object.fromEntries(sortScale(scale).map((e) => [e.letter, 0]))
  for (const l of letters) if (l in counts) counts[l] += 1
  return sortScale(scale).map((e) => ({ letter: e.letter, count: counts[e.letter] }))
}
