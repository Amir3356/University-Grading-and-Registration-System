import { cn } from '@/lib/utils'

export const Card = ({ className, ...props }) => <div className={cn('card', className)} {...props} />
export const CardHeader = ({ className, ...props }) => <div className={cn('card__header', className)} {...props} />
export const CardTitle = ({ className, ...props }) => <h3 className={cn('card__title', className)} {...props} />
export const CardDescription = ({ className, ...props }) => <p className={cn('card__description', className)} {...props} />
export const CardContent = ({ className, ...props }) => <div className={cn('card__content', className)} {...props} />
export const CardFooter = ({ className, ...props }) => <div className={cn('card__footer', className)} {...props} />
