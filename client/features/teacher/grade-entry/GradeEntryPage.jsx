import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, ClipboardList, FileUp, Info, Lock, Save, Send, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { Link, useParams } from 'react-router-dom'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { ExportMenu } from '@/components/common/ExportMenu'
import { PageSkeleton } from '@/components/common/Loading'
import { PageHeader } from '@/components/common/PageHeader'
import { SearchInput } from '@/components/common/SearchInput'
import { GradeBadge, GradeStatusBadge, PassFailBadge } from '@/components/common/StatusBadge'
import { useLookups } from '@/context/lookups-context'
import { useQuery, useMutation } from '@/hooks/useStore'
import { formatDateTime, formatNumber, formatPercent } from '@/lib/format'
import { computeWeightedTotal, gradeForScore, validateMark } from '@/lib/grading'
import { average, cn } from '@/lib/utils'
import { store } from '@/store'
import { gradeSheetColumns, lockedExplanation } from '../lib'
import { ImportScoresDialog } from './ImportScoresDialog'

const cellKey = (enrollmentId, assessmentId) => `${enrollmentId}:${assessmentId}`
const toMarks = (raw) => (String(raw).trim() === '' ? null : Number(String(raw).trim()))
const LEAVE_MESSAGE = 'You have unsaved grade changes. Leave this page without saving?'

/** Warn before leaving with unsaved changes (tab close/reload + in-app links). */
function useUnsavedChangesGuard(active) {
  useEffect(() => {
    if (!active) return undefined
    const onBeforeUnload = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    // The app uses <BrowserRouter> (not a data router), so react-router's useBlocker is unavailable.
    // Intercept in-app link clicks in the capture phase instead; <Link> skips navigation when defaultPrevented.
    const onClick = (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = e.target instanceof Element ? e.target.closest('a[href]') : null
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return
      const url = new URL(a.href, window.location.href)
      if (url.origin !== window.location.origin) return
      if (url.pathname === window.location.pathname && url.search === window.location.search) return
      if (!window.confirm(LEAVE_MESSAGE)) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    document.addEventListener('click', onClick, true)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      document.removeEventListener('click', onClick, true)
    }
  }, [active])
}

function SummaryItem({ label, value, hint }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function Gradebook({ gb, refetch, university }) {
  const { offering: o, assessments, scale, passMark, locked } = gb
  const [edits, setEdits] = useState({})
  const [search, setSearch] = useState('')
  const [onlyIncomplete, setOnlyIncomplete] = useState(false)
  const [reasonOpen, setReasonOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const gridRef = useRef(null)

  const [save, saveState] = useMutation((payload) => store.grades.saveScores(o.id, payload), {
    success: (r) => `Draft saved — ${r.created} new, ${r.updated} updated, ${r.cleared} cleared.`,
  })

  // ---- Live computation over saved marks + local edits ----
  const changes = []
  const computed = []
  for (const row of gb.rows) {
    const withdrawn = row.enrollment.status === 'withdrawn'
    const marks = {}
    const errors = {}
    const dirty = {}
    for (const a of assessments) {
      const k = cellKey(row.enrollmentId, a.id)
      const orig = row.marks[a.id] ?? null
      if (!(k in edits) || withdrawn) {
        marks[a.id] = orig
        continue
      }
      const raw = String(edits[k]).trim()
      const err = validateMark(raw, a.maxMarks)
      const next = err ? undefined : toMarks(raw)
      if (err) {
        errors[a.id] = err
        dirty[a.id] = true
      } else if (next !== orig) {
        dirty[a.id] = true
        changes.push({ enrollmentId: row.enrollmentId, assessmentId: a.id, marks: next, existing: orig != null })
      }
      marks[a.id] = err ? null : next
    }
    const calc = computeWeightedTotal(assessments, marks)
    const grade = calc.complete ? gradeForScore(calc.total, scale) : null
    computed.push({
      row,
      withdrawn,
      errors,
      dirty,
      calc,
      letter: withdrawn ? 'W' : (grade?.letter ?? null),
      passed: withdrawn || !calc.complete ? null : calc.total >= passMark,
    })
  }
  const invalidCount = computed.reduce((n, c) => n + Object.keys(c.errors).length, 0)
  const modifiesExisting = changes.some((c) => c.existing)
  const dirtyCount = changes.length + invalidCount
  useUnsavedChangesGuard(dirtyCount > 0)

  const active = computed.filter((c) => !c.withdrawn)
  const complete = active.filter((c) => c.calc.complete)
  const classAverage = average(complete.map((c) => c.calc.total))
  const runningAverage = average(active.map((c) => c.calc.runningPercent))
  const missing = active.reduce((s, c) => s + (assessments.length - c.calc.enteredCount), 0)

  const q = search.trim().toLowerCase()
  const visible = computed.filter(
    (c) =>
      (!q || c.row.student.name.toLowerCase().includes(q) || c.row.student.studentNumber.toLowerCase().includes(q)) &&
      (!onlyIncomplete || (!c.withdrawn && (!c.calc.complete || Object.keys(c.errors).length > 0))),
  )

  const setCell = (enrollmentId, assessmentId, value) => setEdits((prev) => ({ ...prev, [cellKey(enrollmentId, assessmentId)]: value }))

  const focusCell = (rowIdx, colIdx, step) => {
    const grid = gridRef.current
    if (!grid) return
    for (let i = rowIdx; i >= 0 && i < visible.length; i += step) {
      const el = grid.querySelector(`[data-cell="${i}-${colIdx}"]`)
      if (el && !el.disabled) {
        el.focus()
        el.select()
        return
      }
    }
  }

  const onCellKeyDown = (e, rowIdx, colIdx) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault()
      focusCell(rowIdx + 1, colIdx, 1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      focusCell(rowIdx - 1, colIdx, -1)
    }
  }

  const doSave = async (reason) => {
    const res = await save({ changes: changes.map(({ enrollmentId, assessmentId, marks }) => ({ enrollmentId, assessmentId, marks })), reason: reason || undefined })
    if (res.ok) {
      await refetch({ silent: true })
      setEdits({})
    }
    return res.ok
  }

  const onSave = () => {
    if (invalidCount) {
      toast.error(`Fix ${invalidCount} invalid mark(s) before saving.`)
      return
    }
    if (!changes.length) return
    if (gb.requiresReason && modifiesExisting) setReasonOpen(true)
    else doSave()
  }

  const rejected = o.gradeStatus === 'rejected' && gb.latestRequest?.status === 'rejected'

  return (
    <>
      <PageHeader
        title={`Grade entry — ${o.course.code}`}
        description={`${o.course.title} · ${o.semester.name} · Section ${o.section}`}
        backTo="/teacher/grade-entry"
        backLabel="All courses"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)} disabled={locked || !assessments.length || dirtyCount > 0} title={dirtyCount ? 'Save or discard your changes before importing' : undefined}>
              <FileUp /> Import CSV
            </Button>
            <ExportMenu
              filename={`${o.course.code}_grade_sheet`}
              title={`Grade sheet — ${o.course.code} ${o.course.title}`}
              subtitle={`${o.semester.name} · Section ${o.section} · saved marks`}
              columns={gradeSheetColumns(assessments)}
              rows={gb.rows}
              university={university}
              disabled={!gb.rows.length}
            />
            {!locked && (
              <Button size="sm" asChild>
                <Link to={`/teacher/grade-submission?offering=${o.id}`}>
                  <Send /> Submit grades
                </Link>
              </Button>
            )}
          </>
        }
      >
        <div className="mt-2">
          <GradeStatusBadge status={o.gradeStatus} />
        </div>
      </PageHeader>

      <div className="mb-4 space-y-3">
        {locked && (
          <Alert variant="info">
            <Lock />
            <AlertTitle>Read-only</AlertTitle>
            <AlertDescription>
              {lockedExplanation(o.gradeStatus)}
              {gb.latestRequest?.submittedAt && ` Submitted ${formatDateTime(gb.latestRequest.submittedAt)}.`}
            </AlertDescription>
          </Alert>
        )}
        {rejected && (
          <Alert variant="destructive">
            <Undo2 />
            <AlertTitle>Grades returned by the registrar</AlertTitle>
            <AlertDescription>
              <p>“{gb.latestRequest.comment}”</p>
              <p className="text-xs">Reviewed {formatDateTime(gb.latestRequest.reviewedAt)}. Make the corrections, save, then submit again.</p>
            </AlertDescription>
          </Alert>
        )}
        {!gb.weightsValid && assessments.length > 0 && (
          <Alert variant="warning">
            <AlertTriangle />
            <AlertTitle>Assessment weights total {gb.weightTotal}%</AlertTitle>
            <AlertDescription>
              <p>
                Weights must add up to exactly 100% before grades can be submitted.{' '}
                <Link to={`/teacher/assessments/${o.id}`} className="font-medium underline underline-offset-2">
                  Fix assessments
                </Link>
              </p>
            </AlertDescription>
          </Alert>
        )}
        {gb.requiresReason && !locked && (
          <Alert variant="info">
            <Info />
            <AlertDescription>These grades were submitted before. Changing an existing mark requires a reason, which is recorded in the audit trail.</AlertDescription>
          </Alert>
        )}
      </div>

      {assessments.length === 0 ? (
        <Card>
          <EmptyState
            icon={ClipboardList}
            title="No assessments yet"
            description="Create the course's assessments before entering marks."
            action={
              <Button size="sm" asChild>
                <Link to={`/teacher/assessments/${o.id}`}>Set up assessments</Link>
              </Button>
            }
          />
        </Card>
      ) : gb.rows.length === 0 ? (
        <Card>
          <EmptyState title="No students enrolled" description="Students enrolled in this course will appear here." />
        </Card>
      ) : (
        <>
          <Card className="mb-4 grid grid-cols-2 gap-4 px-5 py-4 sm:grid-cols-4">
            <SummaryItem label="Students" value={active.length} hint={gb.rows.length > active.length ? `${gb.rows.length - active.length} withdrawn` : undefined} />
            <SummaryItem label="Complete" value={`${complete.length} / ${active.length}`} hint="All marks entered" />
            <SummaryItem label="Class average" value={classAverage == null ? '—' : formatNumber(classAverage, 1)} hint={`Running ${formatPercent(runningAverage)}`} />
            <SummaryItem label="Missing marks" value={missing} hint={missing ? 'Across active students' : 'Everything entered'} />
          </Card>

          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <SearchInput value={search} onChange={setSearch} placeholder="Search student or ID…" label="Search students" />
            <div className="flex items-center gap-2">
              <Checkbox id="only-incomplete" checked={onlyIncomplete} onCheckedChange={(v) => setOnlyIncomplete(v === true)} />
              <Label htmlFor="only-incomplete" className="font-normal">
                Show only incomplete
              </Label>
            </div>
            {!locked && <p className="text-xs text-muted-foreground sm:ml-auto">Enter / ↓ next student · ↑ previous student · Tab next assessment</p>}
          </div>

          <div ref={gridRef} className="max-h-[70vh] overflow-auto rounded-lg border bg-card">
            <table className="w-full border-separate border-spacing-0 text-sm">
              <caption className="sr-only">
                Marks for {o.course.code}. Totals, letter grades and results update as you type.
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="sticky top-0 left-0 z-30 min-w-48 border-r border-b bg-muted px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">
                    Student
                  </th>
                  {assessments.map((a) => (
                    <th key={a.id} scope="col" className="sticky top-0 z-20 min-w-28 border-b bg-muted px-2 py-2 text-right align-bottom">
                      <span className="block text-xs font-semibold text-foreground">{a.name}</span>
                      <span className="block text-[11px] font-normal text-muted-foreground tabular">
                        /{a.maxMarks} · {a.weight}%
                      </span>
                    </th>
                  ))}
                  <th scope="col" className="sticky top-0 z-20 border-b border-l bg-muted px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase">
                    Total
                  </th>
                  <th scope="col" className="sticky top-0 z-20 border-b bg-muted px-3 py-2 text-center text-xs font-medium text-muted-foreground uppercase">
                    Grade
                  </th>
                  <th scope="col" className="sticky top-0 z-20 border-b bg-muted px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">
                    Result
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={assessments.length + 4} className="px-3 py-10 text-center text-sm text-muted-foreground">
                      No students match the current filters.
                    </td>
                  </tr>
                )}
                {visible.map((c, rowIdx) => {
                  const r = c.row
                  return (
                    <tr key={r.enrollmentId} className={cn('group', c.withdrawn && 'text-muted-foreground')}>
                      <th scope="row" className="sticky left-0 z-10 border-r border-b bg-card px-3 py-1.5 text-left font-normal group-hover:bg-muted">
                        <span className="block truncate font-medium">{r.student.name}</span>
                        <span className="block text-xs text-muted-foreground tabular">
                          {r.student.studentNumber}
                          {c.withdrawn && ' · Withdrawn'}
                          {r.enrollment.isRepeat && ' · Repeat'}
                        </span>
                      </th>
                      {assessments.map((a, colIdx) => {
                        const k = cellKey(r.enrollmentId, a.id)
                        const value = k in edits ? edits[k] : (r.marks[a.id] ?? '')
                        const err = c.errors[a.id]
                        const errId = `err-${k}`
                        return (
                          <td key={a.id} className="border-b px-2 py-1.5 text-right align-top group-hover:bg-muted/50">
                            {c.withdrawn ? (
                              <span className="inline-block w-20 text-right" aria-label={`${a.name}: withdrawn`}>
                                W
                              </span>
                            ) : (
                              <>
                                <Input
                                  data-cell={`${rowIdx}-${colIdx}`}
                                  inputMode="decimal"
                                  autoComplete="off"
                                  value={value}
                                  disabled={locked}
                                  onChange={(e) => setCell(r.enrollmentId, a.id, e.target.value)}
                                  onKeyDown={(e) => onCellKeyDown(e, rowIdx, colIdx)}
                                  onFocus={(e) => e.target.select()}
                                  aria-label={`${a.name} marks for ${r.student.name}, out of ${a.maxMarks}`}
                                  aria-invalid={err ? true : undefined}
                                  aria-describedby={err ? errId : undefined}
                                  title={err ?? undefined}
                                  className={cn(
                                    'ml-auto h-8 w-20 px-2 text-right tabular',
                                    c.dirty[a.id] && !err && 'border-teal bg-teal/10',
                                    err && 'border-destructive bg-destructive/5 focus-visible:ring-destructive/30',
                                  )}
                                />
                                {err && (
                                  <span id={errId} className="mt-0.5 block text-[11px] leading-tight text-destructive">
                                    {err}
                                  </span>
                                )}
                              </>
                            )}
                          </td>
                        )
                      })}
                      <td className="border-b border-l px-3 py-1.5 text-right font-medium tabular group-hover:bg-muted/50">
                        {c.withdrawn ? '—' : c.calc.enteredCount ? (
                          <span title={c.calc.complete ? 'Final weighted total' : `Partial total (${c.calc.enteredCount}/${assessments.length} marked)`}>
                            {formatNumber(c.calc.total, 2)}
                            {!c.calc.complete && <span className="text-xs font-normal text-muted-foreground">*</span>}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="border-b px-3 py-1.5 text-center group-hover:bg-muted/50">
                        <GradeBadge letter={c.letter} passed={c.passed} />
                      </td>
                      <td className="border-b px-3 py-1.5 group-hover:bg-muted/50">
                        {c.withdrawn ? <span className="text-xs">Withdrawn</span> : c.calc.complete ? <PassFailBadge passed={c.passed} /> : <span className="text-xs text-muted-foreground">Incomplete</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">* Partial total — not all assessments are marked yet. Pass mark: {passMark}%.</p>

          {!locked && (
            <div className="sticky bottom-0 z-30 mt-4 flex flex-col gap-2 rounded-lg border bg-card/95 p-3 shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm" role="status" aria-live="polite">
                {dirtyCount === 0 ? (
                  <span className="text-muted-foreground">All changes saved.</span>
                ) : (
                  <>
                    <span className="font-medium">{changes.length} unsaved change(s)</span>
                    {invalidCount > 0 && <span className="text-destructive"> · {invalidCount} invalid mark(s) — fix before saving</span>}
                  </>
                )}
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setDiscardOpen(true)} disabled={!dirtyCount || saveState.loading}>
                  Discard
                </Button>
                <Button onClick={onSave} disabled={!changes.length || invalidCount > 0} loading={saveState.loading}>
                  <Save /> Save draft
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={reasonOpen}
        onOpenChange={setReasonOpen}
        title="Reason for changing marks"
        description="These grades were submitted before. Explain why existing marks are being changed — this is recorded in the grade history."
        confirmLabel="Save changes"
        reasonLabel="Reason"
        reasonPlaceholder="e.g. Re-marked after script review"
        onConfirm={(reason) => doSave(reason)}
      />
      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title="Discard unsaved changes?"
        description={`${dirtyCount} edited cell(s) will be reverted to the last saved marks.`}
        confirmLabel="Discard changes"
        variant="destructive"
        onConfirm={() => setEdits({})}
      />
      {importOpen && (
        <ImportScoresDialog
          gb={gb}
          onClose={() => setImportOpen(false)}
          onApplied={() => {
            setImportOpen(false)
            refetch({ silent: true })
          }}
        />
      )}
    </>
  )
}

export function GradeEntryPage() {
  const { offeringId } = useParams()
  const lookups = useLookups()
  const { data, loading, error, refetch } = useQuery(() => store.grades.getGradebook(offeringId), [offeringId])

  if (loading && !data) return <PageSkeleton />
  if (error) {
    return (
      <>
        <PageHeader title="Grade entry" backTo="/teacher/grade-entry" backLabel="All courses" />
        <ErrorState error={error} onRetry={refetch} />
      </>
    )
  }
  return <Gradebook key={offeringId} gb={data} refetch={refetch} university={lookups?.university} />
}
