import {
  differenceInCalendarDays,
  eachDayOfInterval,
  eachWeekOfInterval,
  format,
  parseISO,
  subDays,
} from 'date-fns'

/** Period choices shared by the report pages. */
export const PERIOD_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'custom', label: 'Custom Date Range' },
]

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
