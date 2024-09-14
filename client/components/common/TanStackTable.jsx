import { useMemo, useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { TableSkeleton } from '@/components/common/Loading'
import { Pagination } from '@/components/common/Pagination'
import { SearchInput } from '@/components/common/SearchInput'
import { cn } from '@/lib/utils'

/**
 * Modern data table component powered by TanStack Table (@tanstack/react-table).
 * Supports client-side sorting, global searching/filtering, pagination, and custom rendering.
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
  pageSize: initialPageSize = 10,
  emptyTitle = 'No records found',
  emptyDescription,
  emptyIcon,
  emptyAction,
  className,
}) {
  const [globalFilter, setGlobalFilter] = useState('')
  const [sorting, setSorting] = useState(initialSort)
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: initialPageSize,
  })

  const data = useMemo(() => rawData ?? [], [rawData])

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter,
      pagination,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  if (loading && !rawData) {
    return <TableSkeleton cols={columns.length} />
  }

  if (error) {
    return <ErrorState error={error} onRetry={onRetry} />
  }

  const rows = table.getRowModel().rows
  const totalFiltered = table.getFilteredRowModel().rows.length

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
                  const isSorted = header.column.getIsSorted()
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
                        {canSort && (
                          <span className="text-muted-foreground">
                            {isSorted === 'asc' ? (
                              <ArrowUp className="size-3.5" />
                            ) : isSorted === 'desc' ? (
                              <ArrowDown className="size-3.5" />
                            ) : (
                              <ArrowUpDown className="size-3.5 opacity-50" />
                            )}
                          </span>
                        )}
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

      {/* Pagination Controls */}
      {totalFiltered > 0 && (
        <Pagination
          page={table.getState().pagination.pageIndex + 1}
          pageSize={table.getState().pagination.pageSize}
          total={totalFiltered}
          onPageChange={(p) => table.setPageIndex(p - 1)}
          onPageSizeChange={(s) => table.setPageSize(s)}
        />
      )}
    </div>
  )
}
export default TanStackTable
