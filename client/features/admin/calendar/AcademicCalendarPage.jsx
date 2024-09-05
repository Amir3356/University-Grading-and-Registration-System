import { useState } from 'react'
import { CalendarCheck, CalendarPlus, CalendarRange, MoreHorizontal, Pencil, Plus, Star, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { FormField } from '@/components/common/FormField'
import { PageSkeleton } from '@/components/common/Loading'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { useQuery, useMutation } from '@/hooks/useStore'
import { formatDate } from '@/lib/format'
import { store } from '@/store'
import { SelectField } from '../users/SelectField'

const TERMS = ['Fall', 'Spring', 'Summer'].map((t) => ({ value: t, label: t }))
const SEMESTER_STATUS = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'active', label: 'Active' },
  { value: 'closed', label: 'Closed' },
]

function FormActions({ onClose, loading, label }) {
  return (
    <DialogFooter>
      <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
        Cancel
      </Button>
      <Button type="submit" loading={loading}>
        {label}
      </Button>
    </DialogFooter>
  )
}

function YearForm({ year, onClose }) {
  const isEdit = Boolean(year)
  const nextYear = new Date().getFullYear() + 1
  const [form, setForm] = useState({
    name: year?.name ?? `${nextYear}/${nextYear + 1}`,
    startDate: year?.startDate ?? `${nextYear}-09-01`,
    endDate: year?.endDate ?? `${nextYear + 1}-06-30`,
  })
  const [save, { loading, fieldErrors }] = useMutation(
    (data) => (isEdit ? store.academics.updateAcademicYear(year.id, data) : store.academics.createAcademicYear(data)),
    { success: isEdit ? 'Academic year updated.' : 'Academic year created.', onSuccess: onClose },
  )
  const fe = fieldErrors ?? {}
  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        save(form)
      }}
    >
      <FormField label="Name" required error={fe.name} hint={isEdit ? 'The name cannot be changed.' : 'Format: 2027/2028'}>
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} disabled={isEdit} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Start date" required error={fe.startDate}>
          <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
        </FormField>
        <FormField label="End date" required error={fe.endDate}>
          <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
        </FormField>
      </div>
      <FormActions onClose={onClose} loading={loading} label={isEdit ? 'Save changes' : 'Create academic year'} />
    </form>
  )
}

function SemesterForm({ year, semester, onClose }) {
  const isEdit = Boolean(semester)
  const usedTerms = new Set(year.semesters.map((s) => s.term))
  const [form, setForm] = useState({
    term: semester?.term ?? TERMS.find((t) => !usedTerms.has(t.value))?.value ?? '',
    startDate: semester?.startDate ?? '',
    endDate: semester?.endDate ?? '',
    gradeSubmissionDeadline: semester?.gradeSubmissionDeadline ?? '',
    status: semester?.status ?? 'upcoming',
  })
  const [save, { loading, fieldErrors }] = useMutation(
    (data) =>
      isEdit
        ? store.academics.updateSemester(semester.id, { startDate: data.startDate, endDate: data.endDate, gradeSubmissionDeadline: data.gradeSubmissionDeadline, status: data.status })
        : store.academics.createSemester({ academicYearId: year.id, term: data.term, startDate: data.startDate, endDate: data.endDate, gradeSubmissionDeadline: data.gradeSubmissionDeadline }),
    { success: isEdit ? 'Semester updated.' : 'Semester added.', onSuccess: onClose },
  )
  const fe = fieldErrors ?? {}
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }))
  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        save(form)
      }}
    >
      {isEdit ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Term">
            <Input value={semester.term} disabled />
          </FormField>
          <SelectField label="Status" value={form.status} onChange={set('status')} options={SEMESTER_STATUS} error={fe.status} />
        </div>
      ) : (
        <SelectField
          label="Term"
          required
          value={form.term}
          onChange={set('term')}
          options={TERMS.map((t) => ({ ...t, disabled: usedTerms.has(t.value) }))}
          error={fe.term}
          placeholder="Choose a term"
        />
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Start date" required error={fe.startDate} hint={`Within ${formatDate(year.startDate)} – ${formatDate(year.endDate)}`}>
          <Input type="date" value={form.startDate} min={year.startDate} max={year.endDate} onChange={set('startDate')} />
        </FormField>
        <FormField label="End date" required error={fe.endDate}>
          <Input type="date" value={form.endDate} min={form.startDate || undefined} onChange={set('endDate')} />
        </FormField>
      </div>
      <FormField label="Grade submission deadline" required error={fe.gradeSubmissionDeadline} hint="On or after the semester end date.">
        <Input type="date" value={form.gradeSubmissionDeadline} min={form.endDate || undefined} onChange={set('gradeSubmissionDeadline')} />
      </FormField>
      <FormActions onClose={onClose} loading={loading} label={isEdit ? 'Save changes' : 'Add semester'} />
    </form>
  )
}

function YearCard({ year, onEditYear, onAddSemester, onEditSemester, onSetCurrent, onDelete }) {
  return (
    <Card className="pb-0">
      <CardHeader>
        <div className="min-w-0">
          <CardTitle className="flex flex-wrap items-center gap-2">
            Academic year {year.name}
            {year.isCurrent && (
              <Badge variant="success">
                <Star aria-hidden="true" /> Current
              </Badge>
            )}
          </CardTitle>
          <CardDescription className="mt-1">
            {formatDate(year.startDate)} – {formatDate(year.endDate)} · {year.semesters.length} semester(s)
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={onEditYear}>
            <Pencil /> Edit dates
          </Button>
          <Button variant="outline" size="sm" onClick={onAddSemester} disabled={year.semesters.length >= 3}>
            <CalendarPlus /> Add semester
          </Button>
        </div>
      </CardHeader>
      {year.semesters.length ? (
        <div className="border-t">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Semester</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Grade deadline</TableHead>
                <TableHead className="text-right">Offerings</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {year.semesters.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <span className="flex items-center gap-2 font-medium">
                      {s.name}
                      {s.isCurrent && (
                        <Badge variant="info">
                          <Star aria-hidden="true" /> Current
                        </Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={s.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(s.startDate)} – {formatDate(s.endDate)}
                  </TableCell>
                  <TableCell>{formatDate(s.gradeSubmissionDeadline)}</TableCell>
                  <TableCell className="tabular text-right">{s.offeringCount}</TableCell>
                  <TableCell className="w-10 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${s.name}`}>
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => onEditSemester(s)}>
                          <Pencil /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => onSetCurrent(s)} disabled={s.isCurrent}>
                          <CalendarCheck /> Set as current
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={() => onDelete(s)} disabled={s.isCurrent}>
                          <Trash2 /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <CardContent className="pb-5">
          <EmptyState compact icon={CalendarRange} title="No semesters yet" description="Add the Fall, Spring or Summer semester for this academic year." />
        </CardContent>
      )}
    </Card>
  )
}

export function AcademicCalendarPage() {
  const { data, loading, error, refetch } = useQuery(() => store.academics.listAcademicCalendar(), [])
  // dialog: { kind: 'year' | 'semester', year, semester } | null
  const [dialog, setDialog] = useState(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [confirm, setConfirm] = useState(null) // { kind: 'current' | 'delete', semester }
  const [setCurrent] = useMutation((id) => store.academics.setCurrentSemester(id), { success: (s) => `${s.name} is now the current semester.` })
  const [remove] = useMutation((id) => store.academics.deleteSemester(id), { success: 'Semester deleted.' })

  const openDialog = (d) => {
    setDialog(d)
    setDialogOpen(true)
  }
  const close = () => setDialogOpen(false)

  if (loading && !data) return <PageSkeleton />

  const title =
    dialog?.kind === 'year'
      ? dialog.year
        ? `Edit academic year ${dialog.year.name}`
        : 'New academic year'
      : dialog?.semester
        ? `Edit ${dialog.semester.name}`
        : `Add semester to ${dialog?.year?.name ?? ''}`

  return (
    <>
      <PageHeader
        title="Academic Years & Semesters"
        description="Define the academic calendar, grade submission deadlines and the current semester."
        actions={
          <Button onClick={() => openDialog({ kind: 'year' })}>
            <Plus /> New academic year
          </Button>
        }
      />
      {error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : !data.length ? (
        <Card>
          <EmptyState icon={CalendarRange} title="No academic years yet" description="Create an academic year, then add its semesters." />
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {data.map((y) => (
            <YearCard
              key={y.id}
              year={y}
              onEditYear={() => openDialog({ kind: 'year', year: y })}
              onAddSemester={() => openDialog({ kind: 'semester', year: y })}
              onEditSemester={(s) => openDialog({ kind: 'semester', year: y, semester: s })}
              onSetCurrent={(s) => setConfirm({ kind: 'current', semester: s })}
              onDelete={(s) => setConfirm({ kind: 'delete', semester: s })}
            />
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              {dialog?.kind === 'year' ? 'Academic years usually run from September to June.' : 'Semester dates must fall within the academic year.'}
            </DialogDescription>
          </DialogHeader>
          {dialog?.kind === 'year' && <YearForm key={dialog.year?.id ?? 'new'} year={dialog.year} onClose={close} />}
          {dialog?.kind === 'semester' && <SemesterForm key={dialog.semester?.id ?? `new-${dialog.year.id}`} year={dialog.year} semester={dialog.semester} onClose={close} />}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirm?.kind === 'current'}
        onOpenChange={(v) => !v && setConfirm(null)}
        title={`Set ${confirm?.semester?.name ?? ''} as current?`}
        description="Earlier semesters will be marked closed and later ones upcoming. Dashboards, enrollment and grade deadlines across the system will use this semester."
        confirmLabel="Set as current"
        onConfirm={async () => {
          const res = await setCurrent(confirm.semester.id)
          return res.ok ? undefined : false
        }}
      />
      <ConfirmDialog
        open={confirm?.kind === 'delete'}
        onOpenChange={(v) => !v && setConfirm(null)}
        title={`Delete ${confirm?.semester?.name ?? 'semester'}?`}
        description="Semesters with course offerings cannot be deleted. This cannot be undone."
        confirmLabel="Delete semester"
        variant="destructive"
        onConfirm={async () => {
          const res = await remove(confirm.semester.id)
          return res.ok ? undefined : false
        }}
      />
    </>
  )
}
