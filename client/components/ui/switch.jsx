import { Switch as SwitchPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'

export function Switch({ className, ...props }) {
  return (
    <SwitchPrimitive.Root className={cn('switch', className)} {...props}>
      <SwitchPrimitive.Thumb className="switch__thumb" />
    </SwitchPrimitive.Root>
  )
}
