import { cn } from '@/lib/utils'

export function Table({ className, wrapClassName, ...props }) {
  return (
    <div className={cn('table-wrap', wrapClassName)}>
      <table className={cn('table', className)} {...props} />
    </div>
  )
}

export const TableHeader = (props) => <thead {...props} />
export const TableBody = (props) => <tbody {...props} />
export const TableFooter = (props) => <tfoot {...props} />
export const TableRow = ({ className, ...props }) => <tr className={className} {...props} />
export const TableHead = ({ className, ...props }) => <th className={className} {...props} />
export const TableCell = ({ className, ...props }) => <td className={className} {...props} />
export const TableCaption = ({ className, ...props }) => <caption className={className} {...props} />
