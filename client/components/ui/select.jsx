import { CheckIcon, ChevronDownIcon } from 'lucide-react'
import { Select as SelectPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'

export const Select = (props) => <SelectPrimitive.Root {...props} />
export const SelectGroup = (props) => <SelectPrimitive.Group {...props} />
export const SelectValue = (props) => <SelectPrimitive.Value {...props} />

export function SelectTrigger({ className, children, ...props }) {
  return (
    <SelectPrimitive.Trigger className={cn('select-trigger', className)} {...props}>
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDownIcon className="select-trigger__icon" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

export function SelectContent({ className, children, position = 'popper', sideOffset = 4, ...props }) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content className={cn('select-content', position === 'popper' && 'select-content--popper', className)} position={position} sideOffset={sideOffset} {...props}>
        <SelectPrimitive.Viewport className="select-viewport">{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
}

export const SelectLabel = ({ className, ...props }) => <SelectPrimitive.Label className={cn('select-label', className)} {...props} />

export function SelectItem({ className, children, ...props }) {
  return (
    <SelectPrimitive.Item className={cn('select-item', className)} {...props}>
      <span className="select-item__check">
        <SelectPrimitive.ItemIndicator>
          <CheckIcon className="icon" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}

export const SelectSeparator = ({ className, ...props }) => <SelectPrimitive.Separator className={cn('select-separator', className)} {...props} />
