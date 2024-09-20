import { Download } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { exportPdf } from '@/lib/export'

/**
 * Export rows as CSV / Excel / PDF.
 * columns: [{ header, value: (row) => any }]
 * rows: array or () => array | Promise<array> (to fetch all pages on demand)
 */
export function ExportMenu({ filename, title, subtitle, columns, rows, university, disabled, size = 'sm' }) {
  const run = async () => {
    try {
      const data = typeof rows === 'function' ? await rows() : rows
      if (!data?.length) {
        toast.info('There is nothing to export.')
        return
      }
      exportPdf({ filename, title: title ?? filename, subtitle, columns, rows: data, university })
      toast.success(`Exported ${data.length} row(s).`)
    } catch (err) {
      toast.error(err.message || 'Export failed.')
    }
  }
  return (
    <Button variant="outline" size={size} disabled={disabled} onClick={run}>
      <Download /> Export
    </Button>
  )
}
