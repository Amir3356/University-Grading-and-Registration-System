import { Avatar as AvatarPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'

/** size: md (default) | lg */
export const Avatar = ({ className, size, ...props }) => <AvatarPrimitive.Root className={cn('avatar', size === 'lg' && 'avatar--lg', className)} {...props} />
export const AvatarImage = ({ className, ...props }) => <AvatarPrimitive.Image className={cn('avatar__image', className)} {...props} />
export const AvatarFallback = ({ className, ...props }) => <AvatarPrimitive.Fallback className={cn('avatar__fallback', className)} {...props} />
