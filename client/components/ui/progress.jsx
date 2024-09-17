import { Progress as ProgressPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'

/** tone: default | success | warning | danger */
export function Progress({ className, value, tone, indicatorClassName, ...props }) {
  const pct = Math.min(100, Math.max(0, value || 0))
  return (
    <ProgressPrimitive.Root className={cn('progress', tone && tone !== 'default' && `progress--${tone}`, className)} value={value} {...props}>
      <ProgressPrimitive.Indicator className={cn('progress__indicator', indicatorClassName)} style={{ transform: `translateX(-${100 - pct}%)` }} />
    </ProgressPrimitive.Root>
  )
}
