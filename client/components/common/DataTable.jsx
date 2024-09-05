import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { ExportMenu } from '@/components/common/ExportMenu'
import { TableSkeleton } from '@/components/common/Loading'
import { Pagination } from '@/components/common/Pagination'
import { SearchInput } from '@/components/common/SearchInput'
import { cn } from '@/lib/utils'

/**
 * Client-side data table with search, sorting, pagination and export.
 *
 * columns: [{
 *   key: string,                    // unique id; default accessor row[key]
 *   header: string,
 *   cell?: (row) => ReactNode,      // custom render
 *   value?: (row) => any,           // raw value for sort/search/export (defaults to row[key])
 *   sortable?: boolean (default true), searchable?: boolean (default true), export?: boolean (default true)
 *   className?: string, headerClassName?: string, align?: 'right'|'center'
 * }]
 * toolbar: extra filter controls rendered next to the search box.
 */
export function DataTable({
  columns,
  rows,
  loading,
  error,
  onRetry,
  rowKey = (r) => r.id,
  onRowClick,
  searchPlaceholder = 'Search…',
  searchable = true,
  toolbar,
  exportName,
  exportTitle,
  exportSubtitle,
  university,
  initialSort,
  pageSize: initialPageSize = 10,
  paginate = true,
  emptyTitle = 'No records found',
  emptyDescription,
  emptyIcon,
  emptyAction,
  dense,
  className,
  footer,
}) {
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState(initialSort ?? null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(initialPageSize)

  const getValue = (col, row) => (col.value ? col.value(row) : row[col.key])

  const filtered = useMemo(() => {
    const list = rows ?? []
    const q = search.trim().toLowerCase()
    if (!q) return list
    const cols = columns.filter((c) => c.searchable !== false)
    return list.filter((r) => cols.some((c) => {
      const v = getValue(c, r)
      return v != null && String(v).toLowerCase().includes(q)
    }))
  }, [rows, search, columns])

  const sorted = useMemo(() => {
    if (!sort) return filtered
    const col = columns.find((c) => c.key === sort.key)
    if (!col) return filtered
    const dir = sort.dir === 'desc' ? -1 : 1
    return [...filtered].sort((a, b) => {
      const av = getValue(col, a)
      const bv = getValue(col, b)
      if (av == null && bv == null) return 0
      if (av == null || av === '') return 1
      if (bv == null || bv === '') return -1
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
      return String(av).localeCompare(String(bv), undefined, { numeric: true }) * dir
    })
  }, [filtered, sort, columns])

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const visible = paginate ? sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize) : sorted

  const toggleSort = (key) => {
    setSort((s) => (!s || s.key !== key ? { key, dir: 'asc' } : s.dir === 'asc' ? { key, dir: 'desc' } : null))
  }

  const exportColumns = columns.filter((c) => c.export !== false && c.header).map((c) => ({ header: c.header, value: (r) => getValue(c, r) }))

  return (
    <div className={cn('data-table', className)}>
      {(searchable || toolbar || exportName) && (
        <div className="toolbar">
          {searchable && (
            <SearchInput
              value={search}
              onChange={(v) => {
                setSearch(v)
                setPage(1)
              }}
              placeholder={searchPlaceholder}
            />
          )}
          {toolbar}
          {exportName && (
            <div className="data-table__export">
              <ExportMenu filename={exportName} title={exportTitle ?? exportName} subtitle={exportSubtitle} columns={exportColumns} rows={sorted} university={university} disabled={loading || !sorted.length} />
            </div>
          )}
        </div>
      )}

      {loading && !rows ? (
        <TableSkeleton cols={Math.min(columns.length, 6)} />
      ) : error ? (
        <ErrorState error={error} onRetry={onRetry} />
      ) : (
        <div className="table-box">
          <Table className={dense ? 'table--dense' : undefined}>
            <TableHeader>
              <TableRow>
                {columns.map((c) => {
                  const sortable = c.sortable !== false && c.header
                  const active = sort?.key === c.key
                  return (
                    <TableHead
                      key={c.key}
                      className={cn(c.align === 'right' && 'num', c.align === 'center' && 'center', c.headerClassName)}
                      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                    >
                      {sortable ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(c.key)}
                          className={cn('sort-button', active && 'sort-button--active')}
                        >
                          {c.header}
                          {active ? sort.dir === 'asc' ? <ArrowUp /> : <ArrowDown /> : <ArrowUpDown className="sort-button__idle" />}
                        </button>
                      ) : (
                        c.header
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="wrap">
                    <EmptyState
                      compact
                      icon={emptyIcon}
                      title={search ? 'No results match your search' : emptyTitle}
                      description={search ? 'Try a different search term or clear the filters.' : emptyDescription}
                      action={search ? null : emptyAction}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                visible.map((r) => (
                  <TableRow
                    key={rowKey(r)}
                    onClick={onRowClick ? () => onRowClick(r) : undefined}
                    onKeyDown={onRowClick ? (e) => e.key === 'Enter' && e.target === e.currentTarget && onRowClick(r) : undefined}
                    tabIndex={onRowClick ? 0 : undefined}
                    className={cn(onRowClick && 'table__row--clickable')}
                  >
                    {columns.map((c) => (
                      <TableCell key={c.key} className={cn(c.align === 'right' && 'num', c.align === 'center' && 'center', c.className)}>
                        {c.cell ? c.cell(r) : (getValue(c, r) ?? '—')}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
            {footer}
          </Table>
        </div>
      )}

      {paginate && sorted.length > 0 && (
        <Pagination
          page={currentPage}
          pageSize={pageSize}
          total={sorted.length}
          onPageChange={setPage}
          onPageSizeChange={(s) => {
            setPageSize(s)
            setPage(1)
          }}
        />
      )}
    </div>
  )
}
