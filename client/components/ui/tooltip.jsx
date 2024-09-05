import { Tooltip as TooltipPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'

export const TooltipProvider = ({ delayDuration = 200, ...props }) => <TooltipPrimitive.Provider delayDuration={delayDuration} {...props} />
export const Tooltip = (props) => <TooltipPrimitive.Root {...props} />
export const TooltipTrigger = (props) => <TooltipPrimitive.Trigger {...props} />

export function TooltipContent({ className, sideOffset = 4, ...props }) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content sideOffset={sideOffset} className={cn('tooltip', className)} {...props} />
    </TooltipPrimitive.Portal>
  )
}
