import { useState, forwardRef } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from './input'
import { cn } from '@/lib/utils'

export const PasswordInput = forwardRef(function PasswordInput(
  { className, ...props },
  ref
) {
  const [show, setShow] = useState(false)

  return (
    <div className={cn('password-field', className)}>
      <Input
        ref={ref}
        type={show ? 'text' : 'password'}
        {...props}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="password-field__toggle"
        aria-label={show ? 'Hide password' : 'Show password'}
        title={show ? 'Hide password' : 'Show password'}
        tabIndex={-1}
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  )
})
