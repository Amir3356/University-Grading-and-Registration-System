import { AlertDialog as AlertDialogPrimitive } from 'radix-ui'
import { buttonClass } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const AlertDialog = (props) => <AlertDialogPrimitive.Root {...props} />
export const AlertDialogTrigger = (props) => <AlertDialogPrimitive.Trigger {...props} />

export function AlertDialogContent({ className, ...props }) {
  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogPrimitive.Overlay className="overlay" />
      <AlertDialogPrimitive.Content className={cn('dialog dialog--sm', className)} {...props} />
    </AlertDialogPrimitive.Portal>
  )
}

export const AlertDialogHeader = ({ className, ...props }) => <div className={cn('dialog__header', className)} {...props} />
export const AlertDialogFooter = ({ className, ...props }) => <div className={cn('dialog__footer', className)} {...props} />
export const AlertDialogTitle = ({ className, ...props }) => <AlertDialogPrimitive.Title className={cn('dialog__title', className)} {...props} />
export const AlertDialogDescription = ({ className, ...props }) => <AlertDialogPrimitive.Description className={cn('dialog__description', className)} {...props} />
export const AlertDialogAction = ({ className, ...props }) => <AlertDialogPrimitive.Action className={buttonClass({ className })} {...props} />
export const AlertDialogCancel = ({ className, ...props }) => <AlertDialogPrimitive.Cancel className={buttonClass({ variant: 'outline', className })} {...props} />
