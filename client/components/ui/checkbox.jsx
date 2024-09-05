import { CheckIcon, MinusIcon } from 'lucide-react'
import { Checkbox as CheckboxPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'

export function Checkbox({ className, ...props }) {
  return (
    <CheckboxPrimitive.Root className={cn('checkbox', className)} {...props}>
      <CheckboxPrimitive.Indicator>{props.checked === 'indeterminate' ? <MinusIcon /> : <CheckIcon />}</CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}
