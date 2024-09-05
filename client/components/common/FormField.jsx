import { Children, cloneElement, isValidElement, useId } from 'react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

/**
 * Label + control + hint/error, wired for accessibility.
 * The single child control receives id, aria-invalid and aria-describedby.
 */
export function FormField({ label, error, hint, required, children, className }) {
  const id = useId()
  const descId = `${id}-desc`
  const child = Children.only(children)
  const control = isValidElement(child)
    ? cloneElement(child, {
        id: child.props.id ?? id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': error || hint ? descId : undefined,
      })
    : child
  return (
    <div className={cn('form-field', className)}>
      {label && (
        <Label htmlFor={child.props?.id ?? id}>
          {label}
          {required && (
            <span className="form-field__required" aria-hidden="true">
              *
            </span>
          )}
        </Label>
      )}
      {control}
      {(error || hint) && (
        <p id={descId} className={cn('form-field__message', error && 'form-field__message--error')}>
          {error || hint}
        </p>
      )}
    </div>
  )
}
