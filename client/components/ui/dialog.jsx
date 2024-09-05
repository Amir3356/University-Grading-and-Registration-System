import { XIcon } from 'lucide-react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'

export const Dialog = (props) => <DialogPrimitive.Root {...props} />
export const DialogTrigger = (props) => <DialogPrimitive.Trigger {...props} />
export const DialogClose = (props) => <DialogPrimitive.Close {...props} />
export const DialogOverlay = ({ className, ...props }) => <DialogPrimitive.Overlay className={cn('overlay', className)} {...props} />

/** size: sm | md (default) | lg | xl */
export function DialogContent({ className, children, size, showCloseButton = true, ...props }) {
  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content className={cn('dialog', size && `dialog--${size}`, className)} {...props}>
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close className="dialog__close">
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

export const DialogHeader = ({ className, ...props }) => <div className={cn('dialog__header', className)} {...props} />
export const DialogFooter = ({ className, ...props }) => <div className={cn('dialog__footer', className)} {...props} />
export const DialogTitle = ({ className, ...props }) => <DialogPrimitive.Title className={cn('dialog__title', className)} {...props} />
export const DialogDescription = ({ className, ...props }) => <DialogPrimitive.Description className={cn('dialog__description', className)} {...props} />
