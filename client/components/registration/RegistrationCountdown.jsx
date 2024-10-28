import { useState, useEffect, useMemo } from 'react'
import { Clock, Calendar, AlertCircle, CheckCircle2 } from 'lucide-react'

/** Parse date strings into timestamps safely */
function getTimestamp(value, isEndOfDay = false) {
  if (!value) return null
  if (value instanceof Date) return value.getTime()

  // Format: YYYY-MM-DD
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number)
    return isEndOfDay
      ? new Date(y, m - 1, d, 23, 59, 59, 999).getTime()
      : new Date(y, m - 1, d, 0, 0, 0, 0).getTime()
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null

  // If midnight UTC/local, adjust to end of day if requested
  if (isEndOfDay && parsed.getHours() === 0 && parsed.getMinutes() === 0 && parsed.getSeconds() === 0) {
    return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 23, 59, 59, 999).getTime()
  }
  return parsed.getTime()
}

function pad2(n) {
  return String(Math.max(0, n)).padStart(2, '0')
}

/** Formats a date into DD/MM/YYYY (Day/Month/Year) format */
export function formatDateDMY(value) {
  if (!value) return '—'
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const [y, m, d] = value.split('T')[0].split('-')
    return `${d}/${m}/${y}`
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const yyyy = date.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

/** Hook for continuous real-time countdown updates */
export function useRegistrationCountdown(startDate, deadline) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    // Ticks every second
    const interval = setInterval(() => {
      setNow(Date.now())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const startMs = useMemo(() => getTimestamp(startDate, false), [startDate])
  const endMs = useMemo(() => getTimestamp(deadline, true), [deadline])

  return useMemo(() => {
    if (!startMs || !endMs) {
      return {
        status: 'unknown',
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        totalSeconds: 0,
        isUrgent: false,
        progressPercent: 0,
        formatted: '—',
        shortFormatted: '—',
      }
    }

    if (now < startMs) {
      // Upcoming: counting down to start
      const diffMs = Math.max(0, startMs - now)
      const totalSec = Math.floor(diffMs / 1000)
      const days = Math.floor(totalSec / 86400)
      const hours = Math.floor((totalSec % 86400) / 3600)
      const minutes = Math.floor((totalSec % 3600) / 60)
      const seconds = totalSec % 60

      return {
        status: 'upcoming',
        days,
        hours,
        minutes,
        seconds,
        totalSeconds: totalSec,
        isUrgent: false,
        progressPercent: 0,
        formatted: `${days}d ${pad2(hours)}h ${pad2(minutes)}m ${pad2(seconds)}s`,
        shortFormatted: `${days}d ${pad2(hours)}h ${pad2(minutes)}m ${pad2(seconds)}s`,
      }
    }

    if (now <= endMs) {
      // Active: counting down to deadline
      const diffMs = Math.max(0, endMs - now)
      const totalSec = Math.floor(diffMs / 1000)
      const days = Math.floor(totalSec / 86400)
      const hours = Math.floor((totalSec % 86400) / 3600)
      const minutes = Math.floor((totalSec % 3600) / 60)
      const seconds = totalSec % 60

      const totalWindow = endMs - startMs
      const elapsed = now - startMs
      const progressPercent = totalWindow > 0 ? Math.min(100, Math.max(0, Math.round((elapsed / totalWindow) * 100))) : 0
      const isUrgent = days === 0 // less than 24 hours left

      return {
        status: 'active',
        days,
        hours,
        minutes,
        seconds,
        totalSeconds: totalSec,
        isUrgent,
        progressPercent,
        formatted: `${days}d ${pad2(hours)}h ${pad2(minutes)}m ${pad2(seconds)}s`,
        shortFormatted: `${days}d ${pad2(hours)}h ${pad2(minutes)}m ${pad2(seconds)}s`,
      }
    }

    // Ended
    return {
      status: 'ended',
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      totalSeconds: 0,
      isUrgent: false,
      progressPercent: 100,
      formatted: 'Closed',
      shortFormatted: 'Closed',
    }
  }, [now, startMs, endMs])
}

/**
 * Registration Countdown Timer Component
 * Displays live running timer with ticking seconds
 */
export function RegistrationCountdown({
  startDate,
  deadline,
  variant = 'banner', // 'banner' | 'card' | 'compact' | 'inline'
  semesterName,
  academicYearName,
  actionButton,
  className = '',
}) {
  const cd = useRegistrationCountdown(startDate, deadline)

  if (cd.status === 'unknown') return null

  // Clean human-readable remaining label (e.g., "8 days, 0 hours left remaining")
  const remainingLabel = useMemo(() => {
    if (cd.status === 'ended') return 'Registration Closed'
    if (cd.status === 'upcoming') {
      if (cd.days > 0) {
        return `Registration opens in ${cd.days} day${cd.days === 1 ? '' : 's'}, ${cd.hours} hour${cd.hours === 1 ? '' : 's'}`
      }
      if (cd.hours > 0) {
        return `Registration opens in ${cd.hours} hour${cd.hours === 1 ? '' : 's'}, ${cd.minutes} min`
      }
      return `Registration opens in ${cd.minutes} min`
    }
    // active
    if (cd.days > 0) {
      return `${cd.days} day${cd.days === 1 ? '' : 's'}, ${cd.hours} hour${cd.hours === 1 ? '' : 's'} left remaining`
    }
    if (cd.hours > 0) {
      return `${cd.hours} hour${cd.hours === 1 ? '' : 's'}, ${cd.minutes} min left remaining`
    }
    if (cd.minutes > 0) {
      return `${cd.minutes} min${cd.minutes === 1 ? '' : 's'}, ${cd.seconds}s left remaining`
    }
    return `${cd.seconds} seconds left remaining`
  }, [cd.status, cd.days, cd.hours, cd.minutes, cd.seconds])

  // Badge label explicitly mentioning days and hours
  const badgeLabel = useMemo(() => {
    if (cd.days > 0) {
      return `${cd.days} Days, ${cd.hours} Hours Left Remaining`
    }
    if (cd.hours > 0) {
      return `${cd.hours} Hours, ${cd.minutes} Mins Left Remaining`
    }
    return `${cd.minutes}m ${cd.seconds}s Left Remaining`
  }, [cd.days, cd.hours, cd.minutes, cd.seconds])

  // Compact inline format for tables and chips
  if (variant === 'compact' || variant === 'inline') {
    if (cd.status === 'ended') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
          <Clock className="size-3.5 text-muted-foreground" />
          Closed
        </span>
      )
    }

    const isUpcoming = cd.status === 'upcoming'
    const compactLabel = isUpcoming
      ? (cd.days > 0 ? `Starts in ${cd.days}d ${cd.hours}h` : `Starts in ${cd.hours}h`)
      : (cd.days > 0 ? `${cd.days} days, ${cd.hours}h left remaining` : `${cd.hours}h ${cd.minutes}m left`)

    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold tabular-nums border ${
          isUpcoming
            ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30'
            : cd.isUrgent
            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/40 animate-pulse'
            : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
        } ${className}`}
        title={isUpcoming ? `Registration opens in ${cd.formatted}` : `Registration closes in ${cd.formatted} (${formatDateDMY(deadline)})`}
      >
        <span
          className={`size-1.5 rounded-full ${
            isUpcoming ? 'bg-blue-500' : cd.isUrgent ? 'bg-amber-500 animate-ping' : 'bg-emerald-500 animate-pulse'
          }`}
        />
        <Clock className="size-3" />
        <span>{compactLabel}</span>
      </span>
    )
  }

  // Full Hero Banner & Card variant with large live digital clock blocks
  const isActive = cd.status === 'active'
  const isUpcoming = cd.status === 'upcoming'
  const isEnded = cd.status === 'ended'

  const badgeColor = isUpcoming
    ? 'border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300'
    : isActive && cd.isUrgent
    ? 'border-amber-500/50 bg-amber-500/15 text-amber-700 dark:text-amber-300'
    : isActive
    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
    : 'border-muted-foreground/30 bg-muted/40 text-muted-foreground'

  const dotColor = isUpcoming
    ? 'bg-blue-500'
    : isActive && cd.isUrgent
    ? 'bg-amber-500'
    : isActive
    ? 'bg-emerald-500'
    : 'bg-muted-foreground'

  return (
    <div
      className={`reg-countdown-banner ${
        isActive && cd.isUrgent ? 'reg-countdown-banner--urgent' : ''
      } ${className}`}
    >
      <div className="reg-countdown-banner__header">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className={`reg-countdown-pulse-badge ${badgeColor}`}>
            <span className={`reg-countdown-pulse-dot ${dotColor}`} />
            {isUpcoming ? 'UPCOMING PERIOD' : isActive ? 'LIVE COUNTDOWN' : 'PERIOD CLOSED'}
          </span>
          {semesterName && (
            <span className="font-semibold text-foreground text-sm sm:text-base">
              {semesterName} {academicYearName ? `(${academicYearName})` : ''}
            </span>
          )}
        </div>

        {actionButton && <div className="ml-auto">{actionButton}</div>}
      </div>

      <div className="reg-countdown-banner__body">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="reg-countdown-banner__subhead">
            <Clock className="size-4 text-primary shrink-0" />
            <span className="text-base font-bold text-foreground">
              {remainingLabel}
            </span>
          </div>

          {!isEnded && (
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/25">
              {badgeLabel}
            </span>
          )}
        </div>

        {!isEnded ? (
          <>
            <div className="reg-countdown-digits" aria-label={`Time remaining: ${cd.formatted}`}>
              <div className="reg-countdown-block">
                <span className="reg-countdown-num">{pad2(cd.days)}</span>
                <span className="reg-countdown-unit">Days</span>
              </div>
              <span className="reg-countdown-colon">:</span>
              <div className="reg-countdown-block">
                <span className="reg-countdown-num">{pad2(cd.hours)}</span>
                <span className="reg-countdown-unit">Hours</span>
              </div>
              <span className="reg-countdown-colon">:</span>
              <div className="reg-countdown-block">
                <span className="reg-countdown-num">{pad2(cd.minutes)}</span>
                <span className="reg-countdown-unit">Minutes</span>
              </div>
              <span className="reg-countdown-colon">:</span>
              <div className="reg-countdown-block reg-countdown-block--seconds">
                <span className="reg-countdown-num">{pad2(cd.seconds)}</span>
                <span className="reg-countdown-unit">Seconds</span>
              </div>
            </div>

            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <Clock className="size-3.5 text-primary shrink-0" />
              <span>
                <strong className="text-foreground font-semibold">
                  {cd.days > 0 ? `${cd.days} day${cd.days === 1 ? '' : 's'}, ` : ''}
                  {cd.hours} hour${cd.hours === 1 ? '' : 's'}, {cd.minutes} minute${cd.minutes === 1 ? '' : 's'} left remaining
                </strong>{' '}
                until registration closes on <strong className="text-foreground">{formatDateDMY(deadline)}</strong>
              </span>
            </p>
          </>
        ) : (
          <div className="text-sm font-medium text-muted-foreground py-2">
            The deadline for this registration period has passed.
          </div>
        )}

        {isActive && (
          <div className="reg-countdown-progress-wrapper mt-1">
            <div className="flex flex-wrap justify-between items-center gap-2 text-xs text-muted-foreground font-mono">
              <span className="whitespace-nowrap">
                Start: <strong className="text-foreground font-semibold">{formatDateDMY(startDate)}</strong>
              </span>
              <span className="rounded-full bg-primary/10 border border-primary/25 px-3 py-0.5 text-xs font-semibold text-primary whitespace-nowrap shadow-xs">
                {cd.days > 0 ? `${cd.days} days, ${cd.hours} hours left remaining` : `${cd.hours}h ${cd.minutes}m left remaining`}
              </span>
              <span className="whitespace-nowrap">
                Deadline: <strong className="text-foreground font-semibold">{formatDateDMY(deadline)}</strong>
              </span>
            </div>
            <div className="reg-countdown-progress-bar">
              <div
                className={`reg-countdown-progress-fill ${
                  cd.isUrgent ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${cd.progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {isUpcoming && (
          <div className="flex flex-wrap justify-between items-center gap-2 text-xs text-muted-foreground font-mono mt-1">
            <span className="whitespace-nowrap">
              Start: <strong className="text-foreground font-semibold">{formatDateDMY(startDate)}</strong>
            </span>
            <span className="whitespace-nowrap">
              Deadline: <strong className="text-foreground font-semibold">{formatDateDMY(deadline)}</strong>
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
