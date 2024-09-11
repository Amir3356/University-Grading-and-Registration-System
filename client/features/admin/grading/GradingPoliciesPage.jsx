import { useMemo, useState } from 'react'
import { AlertTriangle, Check, Pencil, Plus, Save, Trash2, X } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { ErrorState } from '@/components/common/ErrorState'
import { PageSkeleton } from '@/components/common/Loading'
import { PageHeader } from '@/components/common/PageHeader'
import { useQuery, useMutation } from '@/hooks/useStore'
import { DEFAULT_GRADE_SCALE, validateGradeScale } from '@/lib/grading'
import { store } from '@/store'

let rowSeq = 0
const withKeys = (entries) => entries.map((e) => ({ key: `row-${++rowSeq}`, letter: e.letter, min: String(e.min), max: String(e.max), points: String(e.points) }))

export function GradingPoliciesPage() {
  const { data, loading, error, refetch } = useQuery(() => store.grades.getGradingConfig(), [], { live: false })

  return (
    <>
      <PageHeader
        title="Grading policies"
        description="Configure the grading scale and the academic rules used to compute grades, GPA and standing."
        centered
      />
      {loading && !data ? (
        <PageSkeleton />
      ) : error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : (
        <div className="grid gap-6">
          <ScaleEditor key={`scale-${JSON.stringify(data.scale?.entries ?? null)}`} initial={data.scale?.entries ?? DEFAULT_GRADE_SCALE} onSaved={refetch} />
        </div>
      )}
    </>
  )
}

// ---------------- Grade scale ----------------
function ScaleEditor({ initial, onSaved }) {
  const [rows, setRows] = useState(() => withKeys([...initial].sort((a, b) => b.min - a.min)))
  const [editing, setEditing] = useState(null)
  const [confirm, setConfirm] = useState(false)
  const [save, saveState] = useMutation((entries) => store.grades.updateGradeScale(entries), { success: 'Grading scale saved.', onSuccess: () => onSaved() })

  const entries = useMemo(() => rows.map((r) => ({ letter: r.letter.trim(), min: Number(r.min), max: Number(r.max), points: Number(r.points) })), [rows])
  const blank = rows.some((r) => r.min === '' || r.max === '' || r.points === '')
  const errors = useMemo(() => {
    const list = validateGradeScale(entries)
    if (blank) list.unshift('Every row needs a minimum, maximum and grade points value.')
    if (entries.some((e) => [e.min, e.max, e.points].some((n) => Number.isNaN(n)))) list.unshift('Bounds and grade points must be numbers.')
    return [...new Set(list)]
  }, [entries, blank])
  const serverErrors = saveState.fieldErrors?.scale
  const dirty = JSON.stringify(entries) !== JSON.stringify([...initial].sort((a, b) => b.min - a.min).map((e) => ({ letter: e.letter, min: e.min, max: e.max, points: e.points })))

  const remove = (key) => setRows((list) => list.filter((r) => r.key !== key))
  const startAdd = () => setEditing({ key: null, letter: '', min: '', max: '', points: '' })
  const startEdit = (r) => setEditing({ key: r.key, letter: r.letter, min: r.min, max: r.max, points: r.points })
  const cancel = () => setEditing(null)
  const setField = (field) => (value) => setEditing((d) => ({ ...d, [field]: value }))
  const commit = () => {
    if (!editing) return
    const next = { letter: editing.letter, min: editing.min, max: editing.max, points: editing.points }
    if (editing.key == null) setRows((list) => [...list, ...withKeys([next])])
    else setRows((list) => list.map((r) => (r.key === editing.key ? { ...r, ...next } : r)))
    setEditing(null)
  }

  const editingFields = editing ? (
    <>
      <TableCell className="py-1.5">
        <Input type="number" step="0.01" min={0} max={100} value={editing.min} onChange={(e) => setField('min')(e.target.value)} aria-label="Minimum" className="h-8 w-24" />
      </TableCell>
      <TableCell className="py-1.5">
        <Input type="number" step="0.01" min={0} max={100} value={editing.max} onChange={(e) => setField('max')(e.target.value)} aria-label="Maximum" className="h-8 w-24" />
      </TableCell>
      <TableCell className="py-1.5">
        <Input value={editing.letter} onChange={(e) => setField('letter')(e.target.value)} aria-label="Letter" className="h-8 w-20" maxLength={3} />
      </TableCell>
      <TableCell className="py-1.5">
        <Input type="number" step="0.01" min={0} max={5} value={editing.points} onChange={(e) => setField('points')(e.target.value)} aria-label="Grade points" className="h-8 w-24" />
      </TableCell>
    </>
  ) : null

  const editingActions = (
    <>
      <Button variant="ghost" size="icon-sm" onClick={commit} aria-label="Save">
        <Check />
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={cancel} aria-label="Cancel">
        <X />
      </Button>
    </>
  )

  return (
    <Card>
      <CardContent className="grid gap-4">
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="outline" size="sm" onClick={startAdd} disabled={Boolean(editing)}>
            <Plus /> Add Grade
          </Button>
        </div>

        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-12">No</TableHead>
                <TableHead>MIN</TableHead>
                <TableHead>MAX</TableHead>
                <TableHead>Letter</TableHead>
                <TableHead>Grade point</TableHead>
                <TableHead className="w-24">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => {
                const isEditing = editing?.key === r.key
                return (
                  <TableRow key={r.key}>
                    <TableCell className="py-1.5 text-muted-foreground tabular">{i + 1}</TableCell>
                    {isEditing ? (
                      editingFields
                    ) : (
                      <>
                        <TableCell className="py-1.5 tabular">{r.min}</TableCell>
                        <TableCell className="py-1.5 tabular">{r.max}</TableCell>
                        <TableCell className="py-1.5 font-medium">{r.letter}</TableCell>
                        <TableCell className="py-1.5 tabular">{r.points}</TableCell>
                      </>
                    )}
                    <TableCell className="py-1.5">
                      <div className="flex justify-end gap-1">
                        {isEditing ? (
                          editingActions
                        ) : (
                          <>
                            <Button variant="ghost" size="icon-sm" onClick={() => startEdit(r)} aria-label={`Edit ${r.letter || `row ${i + 1}`}`}>
                              <Pencil />
                            </Button>
                            <Button variant="ghost" size="icon-sm" onClick={() => remove(r.key)} aria-label={`Delete ${r.letter || `row ${i + 1}`}`}>
                              <Trash2 />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
              {editing && editing.key == null && (
                <TableRow>
                  <TableCell className="py-1.5 text-muted-foreground tabular">—</TableCell>
                  {editingFields}
                  <TableCell className="py-1.5">
                    <div className="flex justify-end gap-1">{editingActions}</div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {(errors.length || serverErrors?.length) > 0 && (
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertTitle>The scale is not valid yet</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-4">
                {[...new Set([...errors, ...(serverErrors ?? [])])].map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter className="justify-end gap-2">
        {dirty && <span className="mr-auto text-xs text-muted-foreground">Unsaved changes</span>}
        <Button onClick={() => setConfirm(true)} disabled={errors.length > 0 || !dirty} loading={saveState.loading}>
          <Save /> Save scale
        </Button>
      </CardFooter>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Save the grading scale?"
        description="The new scale applies to all letter grades and GPA calculations computed from now on, including students' cumulative GPAs. Grades already submitted keep the letter they were given."
        confirmLabel="Save scale"
        onConfirm={async () => (await save(entries)).ok}
      />
    </Card>
  )
}

