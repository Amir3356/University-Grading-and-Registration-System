import { useId } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FormField } from '@/components/common/FormField'

/**
 * Labelled radix Select for forms. `value` of '' shows the placeholder.
 * options: [{ value, label, disabled? }] — values must be non-empty strings.
 */
export function SelectField({ label, error, hint, required, value, onChange, options, placeholder = 'Select…', disabled, className }) {
  const id = useId()
  const hasEmptyOption = options.some((o) => o.value === '' || o.value === null || o.value === undefined)
  const safeValue =
    hasEmptyOption && (value === '' || value === null || value === undefined)
      ? '__ugs_empty__'
      : (value ?? '')

  const handleValueChange = (val) => {
    if (val === '__ugs_empty__') {
      onChange?.('')
    } else {
      onChange?.(val)
    }
  }

  return (
    <FormField label={label} error={error} hint={hint} required={required} className={className}>
      <Select id={id} value={safeValue} onValueChange={handleValueChange} disabled={disabled}>
        <SelectTrigger id={id} aria-invalid={error ? true : undefined} aria-required={required || undefined}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => {
            const itemVal =
              hasEmptyOption && (o.value === '' || o.value === null || o.value === undefined)
                ? '__ugs_empty__'
                : String(o.value ?? '')
            return (
              <SelectItem key={itemVal} value={itemVal} disabled={o.disabled}>
                {o.label}
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>
    </FormField>
  )
}
