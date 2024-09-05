import { cn } from '@/lib/utils'

export function Input({ className, type, ...props }) {
  return <input type={type} className={cn('input', className)} {...props} />
}
