import { Loader2 } from 'lucide-react'
import { Slot } from 'radix-ui'
import { cn } from '@/lib/utils'

const VARIANTS = { default: 'btn--primary', destructive: 'btn--destructive', outline: 'btn--outline', secondary: 'btn--secondary', ghost: 'btn--ghost', link: 'btn--link', teal: 'btn--teal' }
const SIZES = { default: '', sm: 'btn--sm', lg: 'btn--lg', icon: 'btn--icon', 'icon-sm': 'btn--icon-sm' }

/** Class names for a button look, e.g. on a <Link>. */
// eslint-disable-next-line react-refresh/only-export-components
export function buttonClass({ variant = 'default', size = 'default', className } = {}) {
  return cn('btn', VARIANTS[variant], SIZES[size], className)
}

export function Button({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }) {
  const Comp = asChild ? Slot.Root : 'button'
  return (
    <Comp className={buttonClass({ variant, size, className })} disabled={disabled || loading} {...props}>
      {asChild ? (
        children
      ) : (
        <>
          {loading && <Loader2 className="spin" aria-hidden="true" />}
          {children}
        </>
      )}
    </Comp>
  )
}
