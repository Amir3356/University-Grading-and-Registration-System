import { cn } from '@/lib/utils'

/** variant: default | info | warning | destructive | success */
export function Alert({ className, variant = 'default', ...props }) {
  return <div role="alert" className={cn('alert', variant !== 'default' && `alert--${variant}`, className)} {...props} />
}

export const AlertTitle = ({ className, ...props }) => <div className={cn('alert__title', className)} {...props} />
export const AlertDescription = ({ className, ...props }) => <div className={cn('alert__description', className)} {...props} />
