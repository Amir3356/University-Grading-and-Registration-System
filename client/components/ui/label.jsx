import { Label as LabelPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'

export function Label({ className, ...props }) {
  return <LabelPrimitive.Root className={cn('label', className)} {...props} />
}
