import { useState } from 'react'
import { Download, FileSpreadsheet, FileText, Sheet } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { store } from '@/store'
import { exportCourseGradeSheet } from '../lib'

/** Export the official course grade sheet (store.reports.getCourseGradeSheet) as PDF, Excel or CSV. */
export function GradeSheetExportMenu({ offeringId, label = 'Export grade sheet', size = 'sm', variant = 'outline' }) {
  const [busy, setBusy] = useState(false)
  const run = async (kind) => {
    setBusy(true)
    try {
      const sheet = await store.reports.getCourseGradeSheet(offeringId)
      exportCourseGradeSheet(sheet, kind)
      toast.success('Grade sheet exported.')
    } catch (err) {
      toast.error(err.message || 'Export failed.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} loading={busy} disabled={!offeringId}>
          <Download /> {label}
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
