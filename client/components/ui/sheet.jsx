import { XIcon } from 'lucide-react'
import { Dialog as SheetPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'

export const Sheet = (props) => <SheetPrimitive.Root {...props} />
export const SheetTrigger = (props) => <SheetPrimitive.Trigger {...props} />
export const SheetClose = (props) => <SheetPrimitive.Close {...props} />

/** side: right (default) | left */
export function SheetContent({ className, children, side = 'right', ...props }) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay className="overlay" />
      <SheetPrimitive.Content className={cn('sheet', `sheet--${side}`, className)} {...props}>
        {children}
        <SheetPrimitive.Close className="sheet__close">
          <XIcon className="icon" />
          <span className="sr-only">Close</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  )
}

export const SheetHeader = ({ className, ...props }) => <div className={cn('sheet__header', className)} {...props} />
export const SheetFooter = ({ className, ...props }) => <div className={cn('sheet__footer', className)} {...props} />
export const SheetTitle = ({ className, ...props }) => <SheetPrimitive.Title className={cn('sheet__title', className)} {...props} />
export const SheetDescription = ({ className, ...props }) => <SheetPrimitive.Description className={cn('sheet__description', className)} {...props} />
