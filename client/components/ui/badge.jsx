import { cn } from '@/lib/utils'

/** variant: default | secondary | outline | success | warning | danger | info | muted */
export function Badge({ className, variant = 'default', ...props }) {
  return <span className={cn('badge', `badge--${variant}`, className)} {...props} />
}
