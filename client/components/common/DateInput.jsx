import { useEffect, useRef, useState } from 'react'
import { CalendarDays } from 'lucide-react'

function isoToDmy(iso) {
  const [y, m, d] = (iso || '').split('-')
  return y && m && d ? `${d}/${m}/${y}` : ''
}

/** "DD/MM/YYYY" → "YYYY-MM-DD", or null when incomplete or not a real calendar date. */
function dmyToIso(text) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text)
  if (!match) return null
  const [, dd, mm, yyyy] = match
  const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd))
  if (date.getFullYear() !== Number(yyyy) || date.getMonth() !== Number(mm) - 1 || date.getDate() !== Number(dd)) {
    return null
  }
  return `${yyyy}-${mm}-${dd}`
}

/** Keeps digits only and inserts the slashes: "21102026" → "21/10/2026". */
function maskDmy(raw) {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join('/')
}

/**
 * Date field that always shows DD/MM/YYYY, whatever the browser locale
 * (a native <input type="date"> follows the locale, e.g. MM/DD/YYYY in en-US).
 * `value`, `min` and onChange use ISO "YYYY-MM-DD"; onChange only fires with a complete, valid date or ''.
 */
export function DateInput({ id, value, onChange, min, required, className, inputClassName }) {
  const inputRef = useRef(null)
  const pickerRef = useRef(null)
  const [text, setText] = useState(() => isoToDmy(value))
  const [syncedValue, setSyncedValue] = useState(value)

  // Follow value changes made outside this field (e.g. the form being reset).
  if (value !== syncedValue) {
    setSyncedValue(value)
    setText(isoToDmy(value))
  }

  const parsed = dmyToIso(text)
  const error =
    text && !parsed
      ? 'Enter a valid date as DD/MM/YYYY.'
      : parsed && min && parsed < min
        ? `Date must be on or after ${isoToDmy(min)}.`
        : ''

  useEffect(() => {
    inputRef.current?.setCustomValidity(error)
  }, [error])

  const handleText = (e) => {
    const next = maskDmy(e.target.value)
    setText(next)
    if (!next) onChange('')
    else {
      const iso = dmyToIso(next)
      if (iso) onChange(iso)
    }
  }

  const openPicker = () => {
    const picker = pickerRef.current
    if (!picker) return
    try {
      picker.showPicker()
    } catch {
      picker.focus()
      picker.click()
    }
  }

  return (
    <div className={`date-dmy ${className ?? ''}`}>
      <input
        ref={inputRef}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="DD/MM/YYYY"
        maxLength={10}
        value={text}
        onChange={handleText}
        required={required}
        aria-invalid={error ? true : undefined}
        title={error || undefined}
        className={inputClassName}
      />
      <button type="button" className="date-dmy__picker-btn" onClick={openPicker} aria-label="Open calendar" title="Open calendar">
        <CalendarDays aria-hidden="true" />
      </button>
      <input
        ref={pickerRef}
        type="date"
        value={value || ''}
        min={min || undefined}
        onChange={(e) => onChange(e.target.value)}
        className="date-dmy__native"
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  )
}
