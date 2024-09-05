import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export function SearchInput({ value, onChange, placeholder = 'Search…', className, label = 'Search' }) {
  return (
    <div className={cn('search-input', className)}>
      <Search className="search-input__icon" aria-hidden="true" />
      <Input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label} />
      {value && (
        <button type="button" onClick={() => onChange('')} className="search-input__clear" aria-label="Clear search">
          <X />
        </button>
      )}
    </div>
  )
}
