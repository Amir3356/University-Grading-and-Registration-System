import { Separator as SeparatorPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'

export function Separator({ className, orientation = 'horizontal', decorative = true, ...props }) {
  return <SeparatorPrimitive.Root decorative={decorative} orientation={orientation} className={cn('separator', className)} {...props} />
}
