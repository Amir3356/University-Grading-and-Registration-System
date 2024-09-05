import { cn } from '@/lib/utils'

/** Loading placeholder. Pass width/height via style, e.g. style={{ height: 24, width: 200 }}. */
export function Skeleton({ className, ...props }) {
  return <div className={cn('skeleton', className)} {...props} />
}
