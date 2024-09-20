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
  let control
  let targetId = id

  if (isValidElement(children)) {
    targetId = children.props.id ?? id
    control = cloneElement(children, {
      id: targetId,
      'aria-invalid': error ? true : undefined,
      'aria-describedby': error || hint ? descId : undefined,
    })
  } else {
    let cloned = false
    control = Children.map(children, (child) => {
      if (!cloned && isValidElement(child)) {
        cloned = true
        targetId = child.props.id ?? id
        return cloneElement(child, {
          id: targetId,
          'aria-invalid': error ? true : undefined,
          'aria-describedby': error || hint ? descId : undefined,
        })
      }
      return child
    })
  }
  return (
    <div className={cn('form-field', className)}>
      {label && (
        <Label htmlFor={targetId}>
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
