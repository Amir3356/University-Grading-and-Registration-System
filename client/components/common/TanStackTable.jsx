import { useMemo, useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { TableSkeleton } from '@/components/common/Loading'
import { SearchInput } from '@/components/common/SearchInput'
import { cn } from '@/lib/utils'

/**
 * Modern data table component powered by TanStack Table (@tanstack/react-table).
 * Supports client-side sorting, global searching/filtering, and custom rendering.
 */
export function TanStackTable({
  columns,
  data: rawData,
  loading,
  error,
  onRetry,
  searchPlaceholder = 'Search…',
  searchable = true,
  toolbar,
  initialSort = [],
  emptyTitle = 'No records found',
  emptyDescription,
  emptyIcon,
  emptyAction,
  className,
}) {
  const [globalFilter, setGlobalFilter] = useState('')
  const [sorting, setSorting] = useState(initialSort)

  const data = useMemo(() => rawData ?? [], [rawData])

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  if (loading && !rawData) {
    return <TableSkeleton cols={columns.length} />
  }

  if (error) {
    return <ErrorState error={error} onRetry={onRetry} />
  }

  const rows = table.getRowModel().rows

  return (
    <div className={cn('space-y-3', className)}>
      {/* Table Toolbar */}
      {(searchable || toolbar) && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {searchable ? (
            <div className="relative flex-1 max-w-sm">
              <SearchInput
                value={globalFilter ?? ''}
                onChange={(val) => setGlobalFilter(val)}
                placeholder={searchPlaceholder}
              />
            </div>
          ) : (
            <div />
          )}
          {toolbar && <div className="flex items-center gap-2">{toolbar}</div>}
        </div>
      )}

      {/* Table Main Content */}
      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort()
                  const meta = header.column.columnDef.meta ?? {}

                  return (
                    <TableHead
                      key={header.id}
                      className={cn(
                        meta.className,
                        meta.align === 'right' && 'text-right',
                        meta.align === 'center' && 'text-center',
                        canSort && 'cursor-pointer select-none hover:text-foreground',
                      )}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                    >
                      <div
                        className={cn(
                          'inline-flex items-center gap-1.5',
                          meta.align === 'right' && 'justify-end w-full',
                          meta.align === 'center' && 'justify-center w-full',
                        )}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </div>
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columns.length} className="whitespace-normal">
                  <EmptyState
                    compact
                    icon={emptyIcon}
                    title={emptyTitle}
                    description={
                      globalFilter
                        ? 'No records match your search criteria.'
                        : emptyDescription
                    }
                    action={emptyAction}
                  />
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id} className="hover:bg-muted/50">
                  {row.getVisibleCells().map((cell) => {
                    const meta = cell.column.columnDef.meta ?? {}
                    return (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          meta.className,
                          meta.align === 'right' && 'text-right',
                          meta.align === 'center' && 'text-center',
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
export default TanStackTable
