import { useId } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FormField } from '@/components/common/FormField'

/**
 * Labelled radix Select for forms. `value` of '' shows the placeholder.
 * options: [{ value, label, disabled? }] — values must be non-empty strings.
 */
export function SelectField({ label, error, hint, required, value, onChange, options, placeholder = 'Select…', disabled, className }) {
  const id = useId()
  return (
    <FormField label={label} error={error} hint={hint} required={required} className={className}>
      <Select id={id} value={value ?? ''} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={id} aria-invalid={error ? true : undefined} aria-required={required || undefined}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={String(o.value)} disabled={o.disabled}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FormField>
  )
}
