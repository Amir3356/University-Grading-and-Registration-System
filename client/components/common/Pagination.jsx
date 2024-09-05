import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export function Pagination({ page, pageSize, total, onPageChange, onPageSizeChange, pageSizes = [10, 20, 50] }) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  return (
    <div className="pagination">
      <p className="tabular">
        {from}–{to} of {total}
      </p>
      <div className="pagination__controls">
        {onPageSizeChange && (
          <div className="pagination__controls">
            <span className="pagination__size-label">Rows</span>
            <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
              <SelectTrigger className="pagination__size" aria-label="Rows per page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizes.map((s) => (
                  <SelectItem key={s} value={String(s)}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <span className="tabular">
          Page {page} of {pageCount}
        </span>
        <Button variant="outline" size="icon-sm" onClick={() => onPageChange(1)} disabled={page <= 1} aria-label="First page">
          <ChevronsLeft />
        </Button>
        <Button variant="outline" size="icon-sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1} aria-label="Previous page">
          <ChevronLeft />
        </Button>
        <Button variant="outline" size="icon-sm" onClick={() => onPageChange(page + 1)} disabled={page >= pageCount} aria-label="Next page">
          <ChevronRight />
        </Button>
        <Button variant="outline" size="icon-sm" onClick={() => onPageChange(pageCount)} disabled={page >= pageCount} aria-label="Last page">
          <ChevronsRight />
        </Button>
      </div>
    </div>
  )
}
