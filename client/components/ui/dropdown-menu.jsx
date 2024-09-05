import { CheckIcon } from 'lucide-react'
import { DropdownMenu as DropdownMenuPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'

export const DropdownMenu = (props) => <DropdownMenuPrimitive.Root {...props} />
export const DropdownMenuTrigger = (props) => <DropdownMenuPrimitive.Trigger {...props} />
export const DropdownMenuGroup = (props) => <DropdownMenuPrimitive.Group {...props} />

export function DropdownMenuContent({ className, sideOffset = 4, ...props }) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content sideOffset={sideOffset} className={cn('menu', className)} {...props} />
    </DropdownMenuPrimitive.Portal>
  )
}

/** variant: default | destructive */
export function DropdownMenuItem({ className, variant = 'default', ...props }) {
  return <DropdownMenuPrimitive.Item className={cn('menu__item', variant === 'destructive' && 'menu__item--destructive', className)} {...props} />
}

export function DropdownMenuCheckboxItem({ className, children, checked, ...props }) {
  return (
    <DropdownMenuPrimitive.CheckboxItem className={cn('menu__item menu__item--checkbox', className)} checked={checked} {...props}>
      <span className="menu__indicator">
        <DropdownMenuPrimitive.ItemIndicator>
          <CheckIcon className="icon" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  )
}

export const DropdownMenuLabel = ({ className, ...props }) => <DropdownMenuPrimitive.Label className={cn('menu__label', className)} {...props} />
export const DropdownMenuSeparator = ({ className, ...props }) => <DropdownMenuPrimitive.Separator className={cn('menu__separator', className)} {...props} />
