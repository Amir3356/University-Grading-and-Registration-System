import { Popover as PopoverPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'

export const Popover = (props) => <PopoverPrimitive.Root {...props} />
export const PopoverTrigger = (props) => <PopoverPrimitive.Trigger {...props} />

export function PopoverContent({ className, align = 'center', sideOffset = 4, ...props }) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content align={align} sideOffset={sideOffset} className={cn('popover', className)} {...props} />
    </PopoverPrimitive.Portal>
  )
}
