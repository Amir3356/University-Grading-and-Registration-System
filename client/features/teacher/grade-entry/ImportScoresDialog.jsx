import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Download, FileUp } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { FormField } from '@/components/common/FormField'
import { useMutation } from '@/hooks/useStore'
import { exportCsv, parseCsvFile } from '@/lib/export'
import { store } from '@/store'

/** CSV import of assessment marks: template download → upload → dry-run preview → apply. */
export function ImportScoresDialog({ gb, onClose, onApplied }) {
  const o = gb.offering
  const [records, setRecords] = useState(null)
  const [fileName, setFileName] = useState('')
  const [parseError, setParseError] = useState(null)
  const [preview, setPreview] = useState(null)
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState(null)

  const [runPreview, previewState] = useMutation((recs) => store.grades.importScores(o.id, { records: recs, dryRun: true }), { errorToast: false })
  const [apply, applyState] = useMutation((payload) => store.grades.importScores(o.id, { ...payload, dryRun: false }), {
    success: (r) => (r.applied ? `Import applied: ${r.saved.created} new, ${r.saved.updated} updated mark(s).` : 'Nothing was applied.'),
  })

  const downloadTemplate = () => {
    const columns = [
      { header: 'student_id', value: (r) => r.student.studentNumber },
      { header: 'name', value: (r) => r.student.name },
      ...gb.assessments.map((a) => ({ header: a.name, value: (r) => r.marks[a.id] ?? '' })),
    ]
    exportCsv(`${o.course.code}_marks_template`, columns, gb.rows.filter((r) => r.enrollment.status !== 'withdrawn'))
  }

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    setPreview(null)
    setParseError(null)
    setRecords(null)
    if (!file) return
    setFileName(file.name)
    try {
      const recs = await parseCsvFile(file)
      if (!recs.length) throw new Error('The file contains no rows.')
      setRecords(recs)
      const res = await runPreview(recs)
      if (res.ok) setPreview(res.result)
    } catch (err) {
      setParseError(err.message || 'Could not read this file.')
    }
  }

  // Classify the proposed changes against the saved gradebook.
  const byEnrollment = new Map(gb.rows.map((r) => [r.enrollmentId, r]))
  let added = 0
  let modified = 0
  let unchanged = 0
  for (const c of preview?.changes ?? []) {
    const orig = byEnrollment.get(c.enrollmentId)?.marks[c.assessmentId]
    if (orig == null) added++
    else if (orig !== c.marks) modified++
    else unchanged++
  }
  // The API asks for a reason whenever any already-saved mark is included in the import (even unchanged ones).
  const needsReason = gb.requiresReason && modified + unchanged > 0
  const canApply = preview && !preview.errors.length && added + modified > 0

  const onApply = async () => {
    if (needsReason && !reason.trim()) {
      setReasonError('A reason for changing existing marks is required.')
      return
    }
    const res = await apply({ records, reason: reason.trim() || undefined })
    if (res.ok && res.result.applied) onApplied()
  }

  const previewError = previewState.error
  return (
    <Dialog open onOpenChange={(v) => !v && !applyState.loading && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import marks from CSV</DialogTitle>
          <DialogDescription>
            The file needs a <code>student_id</code> column plus one column per assessment, named exactly as in this course. Empty cells are ignored.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm">
              <p className="font-medium">1. Download the template</p>
              <p className="text-muted-foreground">Pre-filled with your class list and current marks.</p>
            </div>
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download /> Template
            </Button>
          </div>

          <div className="rounded-md border p-3">
            <p className="mb-2 text-sm font-medium">2. Upload the completed file</p>
            <FormField label="CSV file" error={parseError}>
              <Input type="file" accept=".csv,text/csv" onChange={onFile} />
            </FormField>
            {previewState.loading && <p className="mt-2 text-sm text-muted-foreground">Checking {fileName}…</p>}
          </div>

          {previewError && (
            <Alert variant="destructive">
              <AlertTriangle />
              <AlertDescription>
                {previewError.message}
                {Array.isArray(previewError.fieldErrors?.columns) && <span>Expected columns: {previewError.fieldErrors.columns.join(', ')}</span>}
              </AlertDescription>
            </Alert>
          )}

          {preview && (
            <div className="space-y-3 rounded-md border p-3">
              <p className="text-sm font-medium">3. Review</p>
              <div className="flex flex-wrap items-center gap-1.5 text-sm">
                <span className="text-muted-foreground">Matched columns:</span>
                {preview.matchedColumns.map((c) => (
                  <Badge key={c} variant="success">
                    <CheckCircle2 aria-hidden="true" /> {c}
                  </Badge>
                ))}
              </div>
              {preview.unknownColumns.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 text-sm">
                  <span className="text-muted-foreground">Ignored (unknown) columns:</span>
                  {preview.unknownColumns.map((c) => (
                    <Badge key={c} variant="warning">
                      {c}
                    </Badge>
                  ))}
                </div>
              )}
              <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-xs text-muted-foreground">Marks in file</dt>
                  <dd className="font-semibold tabular">{preview.changeCount}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">New marks</dt>
                  <dd className="font-semibold tabular">{added}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Changed marks</dt>
                  <dd className="font-semibold tabular">{modified}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Unchanged</dt>
                  <dd className="font-semibold tabular">{unchanged}</dd>
                </div>
              </dl>
              {preview.errors.length > 0 ? (
                <Alert variant="destructive">
                  <AlertTriangle />
                  <AlertDescription>
                    <p>
                      {preview.errors.length} problem(s) found. Fix the file and upload it again — nothing will be imported until it is clean.
                    </p>
                    <ul className="mt-1 max-h-40 w-full list-disc overflow-y-auto pl-4">
                      {preview.errors.map((err, i) => (
                        <li key={i}>
                          Row {err.row}: {err.message}
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              ) : added + modified === 0 ? (
                <Alert>
                  <AlertDescription>The file contains no new or changed marks.</AlertDescription>
                </Alert>
              ) : (
                <Alert variant="success">
                  <CheckCircle2 />
                  <AlertDescription>The file is valid and ready to import.</AlertDescription>
                </Alert>
              )}
              {needsReason && canApply && (
                <FormField label="Reason for the change" required error={reasonError}>
                  <Textarea
                    rows={2}
                    value={reason}
                    onChange={(e) => {
                      setReason(e.target.value)
                      setReasonError(null)
                    }}
                    placeholder="e.g. Corrected after exam script review"
                  />
                </FormField>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={applyState.loading}>
            Cancel
          </Button>
          <Button onClick={onApply} disabled={!canApply} loading={applyState.loading}>
            <FileUp /> Import {added + modified > 0 ? `${added + modified} mark(s)` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
