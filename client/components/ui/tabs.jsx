import { Tabs as TabsPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'

export const Tabs = ({ className, ...props }) => <TabsPrimitive.Root className={cn('tabs', className)} {...props} />
export const TabsList = ({ className, ...props }) => <TabsPrimitive.List className={cn('tabs__list', className)} {...props} />
export const TabsTrigger = ({ className, ...props }) => <TabsPrimitive.Trigger className={cn('tabs__trigger', className)} {...props} />
export const TabsContent = ({ className, ...props }) => <TabsPrimitive.Content className={cn('tabs__content', className)} {...props} />
