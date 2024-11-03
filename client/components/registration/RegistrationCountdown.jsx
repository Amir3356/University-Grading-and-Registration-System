import { useState, useEffect, useMemo } from 'react'
import { Clock, Calendar, AlertCircle } from 'lucide-react'

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

/** Utility to check if a deadline has passed */
export function isDeadlinePassed(deadline) {
  const endMs = getTimestamp(deadline, true)
  if (!endMs) return false
  return Date.now() > endMs
}

/**
 * Hook for continuous real-time countdown updates.
 * - Ticks every second.
 * - Transitions to 'ended' the instant deadline is reached.
 * - Transitions to 'expired' exactly 1 additional day after the deadline so the timer is automatically removed.
 */
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
  const removalMs = useMemo(() => (endMs ? endMs + 24 * 60 * 60 * 1000 : null), [endMs])

  return useMemo(() => {
    if (!startMs || !endMs) {
      return {
        status: 'unknown',
        isEnded: false,
        isExpired: false,
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

    // 1. Upcoming: counting down to start
    if (now < startMs) {
      const diffMs = Math.max(0, startMs - now)
      const totalSec = Math.floor(diffMs / 1000)
      const days = Math.floor(totalSec / 86400)
      const hours = Math.floor((totalSec % 86400) / 3600)
      const minutes = Math.floor((totalSec % 3600) / 60)
      const seconds = totalSec % 60

      return {
        status: 'upcoming',
        isEnded: false,
        isExpired: false,
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

    // 2. Active: counting down to deadline
    if (now <= endMs) {
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
        isEnded: false,
        isExpired: false,
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

    // 3. One additional day has passed after the registration deadline: automatically remove timer
    if (removalMs && now > removalMs) {
      return {
        status: 'expired',
        isEnded: true,
        isExpired: true,
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
    }

    // 4. Deadline reached, but still within the 1 additional day grace period: show closed status
    return {
      status: 'ended',
      isEnded: true,
      isExpired: false,
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
  }, [now, startMs, endMs, removalMs])
}

/**
 * Registration Countdown Timer Component
 * Displays live running timer with ticking seconds.
 * Automatically removed once 1 additional day after the deadline has passed.
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

  // Automatically remove timer when expired (> 1 day after deadline) or unknown
  if (cd.status === 'unknown' || cd.status === 'expired') return null

  // Compact inline format for tables and chips
  if (variant === 'compact' || variant === 'inline') {
    if (cd.status === 'ended') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 font-mono font-medium">
          <Clock className="size-3.5" />
          Closed
        </span>
      )
    }

    const isUpcoming = cd.status === 'upcoming'
    const compactLabel = isUpcoming
      ? (cd.days > 0 ? `Opens in ${cd.days}d ${cd.hours}h` : `Opens in ${cd.hours}h ${cd.minutes}m`)
      : (cd.days > 0 ? `${cd.days}d ${cd.hours}h remaining` : `${cd.hours}h ${cd.minutes}m left`)

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

  // Full Banner variant
  const isActive = cd.status === 'active'
  const isUpcoming = cd.status === 'upcoming'
  const isEnded = cd.status === 'ended'

  const badgeColor = isUpcoming
    ? 'border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300'
    : isActive && cd.isUrgent
    ? 'border-amber-500/50 bg-amber-500/15 text-amber-700 dark:text-amber-300'
    : isActive
    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
    : 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300'

  const dotColor = isUpcoming
    ? 'bg-blue-500'
    : isActive && cd.isUrgent
    ? 'bg-amber-500'
    : isActive
    ? 'bg-emerald-500'
    : 'bg-rose-500'

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
            {isUpcoming ? 'UPCOMING PERIOD' : isActive ? 'LIVE COUNTDOWN' : 'REGISTRATION CLOSED'}
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
        {isActive && (
          <>
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-primary shrink-0" />
              <span className="text-base font-bold text-foreground">
                {cd.days > 0
                  ? `${cd.days} day${cd.days === 1 ? '' : 's'}, ${cd.hours} hour${cd.hours === 1 ? '' : 's'} remaining`
                  : cd.hours > 0
                  ? `${cd.hours} hour${cd.hours === 1 ? '' : 's'}, ${cd.minutes} min remaining`
                  : `${cd.minutes}m ${cd.seconds}s remaining`}
              </span>
            </div>

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
              <Calendar className="size-3.5 text-primary shrink-0" />
              <span>
                Registration closes on <strong className="text-foreground">{formatDateDMY(deadline)}</strong> (23:59:59).
              </span>
            </p>

            <div className="reg-countdown-progress-wrapper mt-1">
              <div className="flex justify-between items-center text-xs text-muted-foreground font-mono">
                <span>Start: <strong className="text-foreground font-semibold">{formatDateDMY(startDate)}</strong></span>
                <span>Deadline: <strong className="text-foreground font-semibold">{formatDateDMY(deadline)}</strong></span>
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
          </>
        )}

        {isEnded && (
          <div className="py-2 flex items-center gap-3">
            <div className="size-10 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-600 shrink-0">
              <AlertCircle className="size-5" />
            </div>
            <div>
              <p className="font-semibold text-foreground text-sm">
                Registration Deadline Has Passed
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                The registration deadline for this semester closed on <strong className="text-foreground">{formatDateDMY(deadline)}</strong>. New student registrations and edits are no longer accepted.
              </p>
            </div>
          </div>
        )}

        {isUpcoming && (
          <>
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-primary shrink-0" />
              <span className="text-base font-bold text-foreground">
                {cd.days > 0
                  ? `Registration opens in ${cd.days} day${cd.days === 1 ? '' : 's'}, ${cd.hours} hour${cd.hours === 1 ? '' : 's'}`
                  : `Registration opens in ${cd.hours} hour${cd.hours === 1 ? '' : 's'}, ${cd.minutes} min`}
              </span>
            </div>

            <div className="reg-countdown-digits" aria-label={`Opens in: ${cd.formatted}`}>
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

            <div className="flex justify-between items-center text-xs text-muted-foreground font-mono mt-1">
              <span>Start: <strong className="text-foreground font-semibold">{formatDateDMY(startDate)}</strong></span>
              <span>Deadline: <strong className="text-foreground font-semibold">{formatDateDMY(deadline)}</strong></span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
