// Placeholder data for the Reports UI. Values are deterministic per period so the
// layout can be reviewed without a backend; replace buildReport() with an API call
// (e.g. getRegistrationsReport / getWithdrawalRegistrationReportData) when wiring it up.
import {
  differenceInCalendarDays,
  eachDayOfInterval,
  eachWeekOfInterval,
  format,
  parseISO,
  subDays,
} from 'date-fns'

const DEPARTMENTS = [
  'Computer Science',
  'Electrical Eng.',
  'Business Admin.',
  'Civil Eng.',
  'Medicine',
  'Law',
]

const WITHDRAWAL_REASONS = [
  'Schedule conflict',
  'Academic difficulty',
  'Financial reasons',
  'Personal / health',
  'Course change',
]

const STUDENT_NAMES = [
  'Abebe Kebede', 'Hana Tesfaye', 'Samuel Girma', 'Liya Mekonnen', 'Yonas Alemu',
  'Meron Haile', 'Dawit Bekele', 'Selam Tadesse', 'Natnael Asfaw', 'Ruth Gebre',
]

const COURSES = [
  'CS301 Data Structures', 'EE210 Circuits II', 'BA150 Accounting I', 'CE220 Statics',
  'MD101 Anatomy', 'LW201 Contract Law', 'CS410 Databases', 'BA305 Marketing',
]

function hashString(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Small seeded PRNG (mulberry32) so the same period always renders the same numbers. */
function seeded(seedKey) {
  let a = hashString(seedKey)
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const between = (rand, min, max) => Math.round(min + rand() * (max - min))

/** Resolves a period into chart buckets plus a human label for the range. */
export function resolvePeriod(period, range, now = new Date()) {
  if (period === 'today') {
    const buckets = Array.from({ length: 11 }, (_, i) => {
      const hour = 8 + i
      return { key: `${format(now, 'yyyy-MM-dd')}-${hour}`, label: `${String(hour).padStart(2, '0')}:00`, scale: 1 }
    })
    return { buckets, rangeLabel: format(now, 'EEEE, d MMM yyyy'), granularity: 'Hourly' }
  }

  if (period === 'weekly') {
    const start = subDays(now, 6)
    const buckets = eachDayOfInterval({ start, end: now }).map((d) => ({
      key: format(d, 'yyyy-MM-dd'),
      label: format(d, 'EEE d'),
      scale: 8,
    }))
    return { buckets, rangeLabel: `${format(start, 'd MMM')} – ${format(now, 'd MMM yyyy')}`, granularity: 'Daily' }
  }

  if (period === 'monthly') {
    const start = subDays(now, 29)
    const buckets = eachWeekOfInterval({ start, end: now }, { weekStartsOn: 1 }).map((d) => ({
      key: `wk-${format(d, 'yyyy-MM-dd')}`,
      label: `Wk ${format(d, 'd MMM')}`,
      scale: 25,
    }))
    return { buckets, rangeLabel: `${format(start, 'd MMM')} – ${format(now, 'd MMM yyyy')}`, granularity: 'Weekly' }
  }

  if (period === 'quarterly') {
    const start = subDays(now, 89)
    const buckets = eachWeekOfInterval({ start, end: now }, { weekStartsOn: 1 }).map((d) => ({
      key: `wk-${format(d, 'yyyy-MM-dd')}`,
      label: `Wk ${format(d, 'd MMM')}`,
      scale: 50,
    }))
    return { buckets, rangeLabel: `${format(start, 'd MMM')} – ${format(now, 'd MMM yyyy')}`, granularity: 'Weekly' }
  }

  if (!range?.from || !range?.to || range.from > range.to) return null
  const start = parseISO(range.from)
  const end = parseISO(range.to)
  const days = differenceInCalendarDays(end, start) + 1
  const buckets =
    days <= 31
      ? eachDayOfInterval({ start, end }).map((d) => ({ key: format(d, 'yyyy-MM-dd'), label: format(d, 'd MMM'), scale: 8 }))
      : eachWeekOfInterval({ start, end }, { weekStartsOn: 1 }).map((d) => ({
          key: `wk-${format(d, 'yyyy-MM-dd')}`,
          label: `Wk ${format(d, 'd MMM')}`,
          scale: 50,
        }))
  return {
    buckets,
    rangeLabel: `${format(start, 'd MMM yyyy')} – ${format(end, 'd MMM yyyy')}`,
    granularity: days <= 31 ? 'Daily' : 'Weekly',
  }
}

function totalsFor(buckets, salt) {
  return buckets.reduce(
    (acc, b) => {
      const rand = seeded(`${salt}:${b.key}`)
      acc.registrations += between(rand, 4, 22) * b.scale
      acc.withdrawals += between(rand, 0, 5) * b.scale
      return acc
    },
    { registrations: 0, withdrawals: 0 },
  )
}

function pctChange(current, previous) {
  if (!previous) return null
  return ((current - previous) / previous) * 100
}

export function buildReport(resolved) {
  const { buckets } = resolved

  const trend = buckets.map((b) => {
    const rand = seeded(`cur:${b.key}`)
    return {
      label: b.label,
      registrations: between(rand, 4, 22) * b.scale,
      withdrawals: between(rand, 0, 5) * b.scale,
    }
  })

  const current = trend.reduce(
    (acc, t) => ({ registrations: acc.registrations + t.registrations, withdrawals: acc.withdrawals + t.withdrawals }),
    { registrations: 0, withdrawals: 0 },
  )
  const previous = totalsFor(buckets, 'prev')

  const net = current.registrations - current.withdrawals
  const prevNet = previous.registrations - previous.withdrawals
  const rate = current.registrations ? (current.withdrawals / current.registrations) * 100 : 0
  const prevRate = previous.registrations ? (previous.withdrawals / previous.registrations) * 100 : 0

  const periodKey = buckets[0]?.key ?? 'none'
  const deptRand = seeded(`dept:${periodKey}:${buckets.length}`)
  const deptWeights = DEPARTMENTS.map(() => 0.5 + deptRand())
  const deptWeightSum = deptWeights.reduce((s, w) => s + w, 0)
  const rows = DEPARTMENTS.map((name, i) => ({
    name,
    registrations: Math.round((current.registrations * deptWeights[i]) / deptWeightSum),
    withdrawals: Math.round((current.withdrawals * deptWeights[i]) / deptWeightSum),
  })).sort((a, b) => b.registrations - a.registrations)
  const breakdown = { title: 'By department', dimension: 'Department', rows }

  const reasonRand = seeded(`reason:${periodKey}:${buckets.length}`)
  const reasonWeights = WITHDRAWAL_REASONS.map(() => 0.3 + reasonRand())
  const reasonWeightSum = reasonWeights.reduce((s, w) => s + w, 0)
  const withdrawalReasons = WITHDRAWAL_REASONS.map((reason, i) => ({
    reason,
    count: Math.round((current.withdrawals * reasonWeights[i]) / reasonWeightSum),
  })).sort((a, b) => b.count - a.count)

  const actRand = seeded(`activity:${periodKey}:${buckets.length}`)
  const recentActivity = Array.from({ length: 8 }, (_, i) => {
    const bucket = buckets[Math.max(0, buckets.length - 1 - Math.floor(i / 2))]
    const isWithdrawal = actRand() < 0.3
    return {
      id: `${periodKey}-${i}`,
      student: STUDENT_NAMES[between(actRand, 0, STUDENT_NAMES.length - 1)],
      studentId: `UGR/${between(actRand, 1000, 9999)}/${between(actRand, 13, 17)}`,
      course: COURSES[between(actRand, 0, COURSES.length - 1)],
      type: isWithdrawal ? 'withdrawal' : 'registration',
      when: bucket.label,
    }
  })

  return {
    kpis: {
      registrations: { value: current.registrations, change: pctChange(current.registrations, previous.registrations) },
      withdrawals: { value: current.withdrawals, change: pctChange(current.withdrawals, previous.withdrawals) },
      net: { value: net, change: pctChange(net, prevNet) },
      rate: { value: rate, change: rate - prevRate },
    },
    trend,
    breakdown,
    withdrawalReasons,
    recentActivity,
  }
}
