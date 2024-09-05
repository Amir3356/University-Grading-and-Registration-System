import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

const ALL = '__all__'

/**
 * Select for filter bars. `value` of '' means "all".
 * options: [{ value, label }]
 */
export function FilterSelect({ value, onChange, options, allLabel = 'All', placeholder, label, className, includeAll = true }) {
  return (
    <Select value={value === '' || value == null ? (includeAll ? ALL : undefined) : String(value)} onValueChange={(v) => onChange(v === ALL ? '' : v)}>
      <SelectTrigger className={cn('filter-select', className)} aria-label={label ?? placeholder ?? allLabel}>
        <SelectValue placeholder={placeholder ?? allLabel} />
      </SelectTrigger>
      <SelectContent>
        {includeAll && <SelectItem value={ALL}>{allLabel}</SelectItem>}
        {options.map((o) => (
          <SelectItem key={o.value} value={String(o.value)}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
