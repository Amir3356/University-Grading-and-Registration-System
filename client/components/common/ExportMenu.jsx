import { Download, FileSpreadsheet, FileText, Sheet } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { exportCsv, exportExcel, exportPdf } from '@/lib/export'

/**
 * Export rows as CSV / Excel / PDF.
 * columns: [{ header, value: (row) => any }]
 * rows: array or () => array | Promise<array> (to fetch all pages on demand)
 */
export function ExportMenu({ filename, title, subtitle, columns, rows, university, disabled, size = 'sm' }) {
  const run = async (kind) => {
    try {
      const data = typeof rows === 'function' ? await rows() : rows
      if (!data?.length) {
        toast.info('There is nothing to export.')
        return
      }
      if (kind === 'csv') exportCsv(filename, columns, data)
      if (kind === 'xlsx') exportExcel(filename, columns, data)
      if (kind === 'pdf') exportPdf({ filename, title: title ?? filename, subtitle, columns, rows: data, university })
      toast.success(`Exported ${data.length} row(s).`)
    } catch (err) {
      toast.error(err.message || 'Export failed.')
    }
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size={size} disabled={disabled}>
          <Download /> Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => run('pdf')}>
          <FileText /> PDF document
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => run('xlsx')}>
          <FileSpreadsheet /> Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => run('csv')}>
          <Sheet /> CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
