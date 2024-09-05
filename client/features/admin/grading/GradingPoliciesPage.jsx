import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronDown, Info, Plus, RotateCcw, Save, Trash2, X } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { ErrorState } from '@/components/common/ErrorState'
import { FormField } from '@/components/common/FormField'
import { PageSkeleton } from '@/components/common/Loading'
import { PageHeader } from '@/components/common/PageHeader'
import { SearchInput } from '@/components/common/SearchInput'
import { useQuery, useMutation } from '@/hooks/useStore'
import { DEFAULT_GRADE_SCALE, validateGradeScale } from '@/lib/grading'
import { cn } from '@/lib/utils'
import { store } from '@/store'

let rowSeq = 0
const withKeys = (entries) => entries.map((e) => ({ key: `row-${++rowSeq}`, letter: e.letter, min: String(e.min), max: String(e.max), points: String(e.points) }))

export function GradingPoliciesPage() {
  const { data, loading, error, refetch } = useQuery(() => store.grades.getGradingConfig(), [], { live: false })

  return (
    <>
      <PageHeader title="Grading policies" description="Configure the grading scale and the academic rules used to compute grades, GPA and standing." />
      {loading && !data ? (
        <PageSkeleton />
      ) : error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : (
        <div className="grid gap-6">
          <ScaleEditor key={`scale-${JSON.stringify(data.scale?.entries ?? null)}`} initial={data.scale?.entries ?? DEFAULT_GRADE_SCALE} onSaved={refetch} />
          <PolicyForm key={`policy-${JSON.stringify(data.policy)}`} policy={data.policy} courses={data.courses} onSaved={refetch} />
          <RulesInfo />
        </div>
      )}
    </>
  )
}

// ---------------- Grade scale ----------------
function ScaleEditor({ initial, onSaved }) {
  const [rows, setRows] = useState(() => withKeys([...initial].sort((a, b) => b.min - a.min)))
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

  const update = (key, field, value) => setRows((list) => list.map((r) => (r.key === key ? { ...r, [field]: value } : r)))
  const remove = (key) => setRows((list) => list.filter((r) => r.key !== key))
  const add = () => setRows((list) => [...list, ...withKeys([{ letter: '', min: '', max: '', points: '' }])])

  const segments = [...entries].filter((e) => !Number.isNaN(e.min) && !Number.isNaN(e.max) && e.max >= e.min).sort((a, b) => a.min - b.min)

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Grading scale</CardTitle>
          <CardDescription className="mt-1">Maps a weighted total out of 100 to a letter grade and grade points. Ranges must cover 0–100 without gaps or overlaps.</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => setRows(withKeys(DEFAULT_GRADE_SCALE))}>
          <RotateCcw /> Reset to default
        </Button>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div>
          <p className="mb-1.5 text-xs text-muted-foreground">Coverage of 0–100</p>
          <div className="relative h-7 overflow-hidden rounded-md border bg-muted" role="img" aria-label={`Scale coverage: ${segments.map((s) => `${s.letter || '?'} ${s.min}–${s.max}`).join(', ')}`}>
            {segments.map((s, i) => (
              <div
                key={`${s.letter}-${i}`}
                className={cn('absolute inset-y-0 flex items-center justify-center overflow-hidden border-r border-card text-[10px] font-semibold', i % 2 ? 'bg-primary/70 text-primary-foreground' : 'bg-primary text-primary-foreground')}
                style={{ left: `${Math.max(0, s.min)}%`, width: `${Math.max(0.5, Math.min(100, s.max) - Math.max(0, s.min))}%` }}
                title={`${s.letter || '?'}: ${s.min}–${s.max}`}
              >
                {s.max - s.min >= 4 ? s.letter : ''}
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular">
            <span>0</span>
            <span>50</span>
            <span>100</span>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Letter</TableHead>
                <TableHead>Min %</TableHead>
                <TableHead>Max %</TableHead>
                <TableHead>Grade points</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={r.key}>
                  <TableCell className="py-1.5">
                    <Input value={r.letter} onChange={(e) => update(r.key, 'letter', e.target.value)} aria-label={`Letter for row ${i + 1}`} className="h-8 w-20" maxLength={3} />
                  </TableCell>
                  <TableCell className="py-1.5">
                    <Input type="number" step="0.01" min={0} max={100} value={r.min} onChange={(e) => update(r.key, 'min', e.target.value)} aria-label={`Minimum for ${r.letter || `row ${i + 1}`}`} className="h-8 w-24" />
                  </TableCell>
                  <TableCell className="py-1.5">
                    <Input type="number" step="0.01" min={0} max={100} value={r.max} onChange={(e) => update(r.key, 'max', e.target.value)} aria-label={`Maximum for ${r.letter || `row ${i + 1}`}`} className="h-8 w-24" />
                  </TableCell>
                  <TableCell className="py-1.5">
                    <Input type="number" step="0.01" min={0} max={5} value={r.points} onChange={(e) => update(r.key, 'points', e.target.value)} aria-label={`Grade points for ${r.letter || `row ${i + 1}`}`} className="h-8 w-24" />
                  </TableCell>
                  <TableCell className="py-1.5 text-right">
                    <Button variant="ghost" size="icon-sm" onClick={() => remove(r.key)} disabled={rows.length <= 1} aria-label={`Remove ${r.letter || `row ${i + 1}`}`}>
                      <Trash2 />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div>
          <Button variant="outline" size="sm" onClick={add}>
            <Plus /> Add grade
          </Button>
        </div>

        {errors.length || serverErrors?.length ? (
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
        ) : (
          <Alert variant="success">
            <CheckCircle2 />
            <AlertDescription>The scale is valid: {entries.length} grades covering 0–100.</AlertDescription>
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

// ---------------- Academic policy ----------------
const REPEAT_OPTIONS = [
  { value: 'latest', label: 'Latest attempt counts' },
  { value: 'highest', label: 'Highest attempt counts' },
  { value: 'all', label: 'All attempts count' },
]
const SPECIAL_OPTIONS = [
  { value: 'exclude', label: 'Exclude from GPA' },
  { value: 'as_fail', label: 'Count as a failing grade' },
]

function OptionSelect({ value, onChange, options, ...props }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full" {...props}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function PolicyForm({ policy, courses, onSaved }) {
  const [form, setForm] = useState(() => ({
    passMark: String(policy.passMark),
    approvalWorkflowEnabled: Boolean(policy.approvalWorkflowEnabled),
    repeatPolicy: policy.repeatPolicy,
    incompletePolicy: policy.incompletePolicy,
    withdrawalPolicy: policy.withdrawalPolicy,
    probationGpa: String(policy.probationGpa),
    honorsGpa: String(policy.honorsGpa),
    excludedCourseIds: policy.excludedCourseIds ?? [],
  }))
  const [confirm, setConfirm] = useState(false)
  const [save, state] = useMutation((data) => store.grades.updatePolicy(data), { success: 'Academic policy saved.', onSuccess: () => onSaved() })
  const fe = state.fieldErrors ?? {}
  const set = (field) => (value) => setForm((f) => ({ ...f, [field]: value }))

  const submit = (e) => {
    e.preventDefault()
    setConfirm(true)
  }

  return (
    <Card>
      <form onSubmit={submit} className="contents" noValidate>
        <CardHeader>
          <div>
            <CardTitle>Academic policy</CardTitle>
            <CardDescription className="mt-1">Rules for passing, approval, repeated courses, special grades and academic standing.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
            <div>
              <Label htmlFor="approval-workflow">Grade approval workflow</Label>
              <p className="mt-1 text-sm text-muted-foreground">
                {form.approvalWorkflowEnabled
                  ? 'On: grades submitted by teachers must be approved by an administrator before they are published to students.'
                  : 'Off: when a teacher submits final grades they are published to students immediately, without review.'}
              </p>
            </div>
            <Switch id="approval-workflow" checked={form.approvalWorkflowEnabled} onCheckedChange={set('approvalWorkflowEnabled')} />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="Pass mark (%)" required error={fe.passMark} hint="Minimum weighted total to pass a course.">
              <Input type="number" min={0} max={100} step="0.5" value={form.passMark} onChange={(e) => set('passMark')(e.target.value)} />
            </FormField>
            <FormField label="Probation below CGPA" required error={fe.probationGpa} hint="Students below this CGPA are on academic probation.">
              <Input type="number" min={0} max={4} step="0.01" value={form.probationGpa} onChange={(e) => set('probationGpa')(e.target.value)} />
            </FormField>
            <FormField label="Dean's list from CGPA" required error={fe.honorsGpa} hint="Students at or above this CGPA earn honors.">
              <Input type="number" min={0} max={4} step="0.01" value={form.honorsGpa} onChange={(e) => set('honorsGpa')(e.target.value)} />
            </FormField>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="Repeated courses" error={fe.repeatPolicy} hint="Which attempts count toward the cumulative GPA.">
              <OptionSelect value={form.repeatPolicy} onChange={set('repeatPolicy')} options={REPEAT_OPTIONS} />
            </FormField>
            <FormField label="Incomplete (I) grades" error={fe.incompletePolicy}>
              <OptionSelect value={form.incompletePolicy} onChange={set('incompletePolicy')} options={SPECIAL_OPTIONS} />
            </FormField>
            <FormField label="Withdrawal (W) grades" error={fe.withdrawalPolicy}>
              <OptionSelect value={form.withdrawalPolicy} onChange={set('withdrawalPolicy')} options={SPECIAL_OPTIONS} />
            </FormField>
          </div>

          <CourseMultiSelect courses={courses} value={form.excludedCourseIds} onChange={set('excludedCourseIds')} />
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" loading={state.loading}>
            <Save /> Save policy
          </Button>
        </CardFooter>
      </form>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Save academic policy?"
        description="Changes to the pass mark, repeat, incomplete, withdrawal and exclusion rules immediately change how GPA, CGPA and academic standing are calculated for every student."
        confirmLabel="Save policy"
        onConfirm={async () => (await save(form)).ok}
      />
    </Card>
  )
}

function CourseMultiSelect({ courses, value, onChange }) {
  const [search, setSearch] = useState('')
  const selected = new Set(value)
  const q = search.trim().toLowerCase()
  const visible = courses.filter((c) => !q || c.code.toLowerCase().includes(q) || c.title.toLowerCase().includes(q))
  const toggle = (id, on) => onChange(on ? [...value, id] : value.filter((x) => x !== id))
  const byId = new Map(courses.map((c) => [c.id, c]))

  return (
    <div className="grid gap-2">
      <Label>Courses excluded from GPA</Label>
      <p className="text-sm text-muted-foreground">Results in these courses appear on transcripts but do not count toward GPA or CGPA (e.g. pass/fail or remedial courses).</p>
      <div className="flex flex-wrap items-center gap-2">
        {value.map((id) => (
          <Badge key={id} variant="secondary" className="gap-1 pr-1">
            {byId.get(id)?.code ?? id}
            <button type="button" onClick={() => toggle(id, false)} className="rounded p-0.5 hover:bg-muted-foreground/20" aria-label={`Remove ${byId.get(id)?.code ?? id}`}>
              <X className="size-3" />
            </button>
          </Badge>
        ))}
        {!value.length && <span className="text-sm text-muted-foreground">No courses excluded.</span>}
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              <Plus /> Choose courses <ChevronDown className="opacity-60" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 p-2">
            <SearchInput value={search} onChange={setSearch} placeholder="Search courses…" label="Search courses" className="sm:w-full" />
            <ul className="mt-2 max-h-64 overflow-y-auto">
              {visible.map((c) => {
                const id = `excl-${c.id}`
                return (
                  <li key={c.id}>
                    <label htmlFor={id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted">
                      <Checkbox id={id} checked={selected.has(c.id)} onCheckedChange={(v) => toggle(c.id, v === true)} />
                      <span className="font-medium">{c.code}</span>
                      <span className="truncate text-muted-foreground">{c.title}</span>
                    </label>
                  </li>
                )
              })}
              {!visible.length && <li className="px-2 py-4 text-center text-sm text-muted-foreground">No courses match.</li>}
            </ul>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}

function RulesInfo() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>How grades and GPA are calculated</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm md:grid-cols-2">
        <div className="grid gap-2">
          <p className="font-medium">Course total</p>
          <p className="text-muted-foreground">Each assessment contributes (marks ÷ max marks) × weight. Assessment weights in a course must total exactly 100% before final grades can be submitted.</p>
          <code className="rounded-md bg-muted px-3 py-2 text-xs">Total = Σ (marks / max marks × weight)</code>
        </div>
        <div className="grid gap-2">
          <p className="font-medium">GPA and CGPA</p>
          <p className="text-muted-foreground">The total maps to a letter and grade points via the scale above. GPA is the credit-weighted average of grade points for a semester; CGPA covers all counted attempts.</p>
          <code className="rounded-md bg-muted px-3 py-2 text-xs">GPA = Σ (grade points × credit hours) / Σ credit hours</code>
        </div>
        <Alert variant="info" className="md:col-span-2">
          <Info />
          <AlertDescription>The "weights must total 100%" rule is always enforced and cannot be disabled. Only published grades count toward GPA.</AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  )
}
