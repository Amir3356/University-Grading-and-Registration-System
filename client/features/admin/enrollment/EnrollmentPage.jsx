import { useState } from 'react'
import { ExternalLink, Lock, MoreHorizontal, Repeat, Trash2, UserMinus, UserPlus, Users } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Progress } from '@/components/ui/progress'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { DataTable } from '@/components/common/DataTable'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { FilterSelect } from '@/components/common/FilterSelect'
import { Spinner, TableSkeleton } from '@/components/common/Loading'
import { PageHeader } from '@/components/common/PageHeader'
import { SearchInput } from '@/components/common/SearchInput'
import { GradeStatusBadge, StatusBadge } from '@/components/common/StatusBadge'
import { useLookups } from '@/context/lookups-context'
import { useQuery, useMutation } from '@/hooks/useStore'
import { useDebounce } from '@/hooks/useDebounce'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { store } from '@/store'
import { SelectField } from '../users/SelectField'

const LOCKED_STATUSES = ['submitted', 'approved', 'published']

function Detail({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium">{children || '—'}</dd>
    </div>
  )
}

function EnrollStudentsForm({ offering, onClose }) {
  const lookups = useLookups()
  const [search, setSearch] = useState('')
  const [departmentId, setDepartmentId] = useState(offering.course.departmentId ?? '')
  const [selected, setSelected] = useState(() => new Set())
  const debounced = useDebounce(search, 250)
  const { data, loading, error, refetch } = useQuery(
    () => store.academics.listEligibleStudents(offering.id, { search: debounced, departmentId }),
    [offering.id, debounced, departmentId],
    { live: false },
  )
  const [enroll, { loading: saving }] = useMutation((ids) => store.academics.enrollStudents(offering.id, ids), {
    success: (r) => `Enrolled ${r.enrolled} student(s).`,
    onSuccess: onClose,
  })

  const remaining = Math.max(0, offering.capacity - offering.enrolledCount)
  const visible = data ?? []
  const allVisibleSelected = visible.length > 0 && visible.every((s) => selected.has(s.id))
  const someVisibleSelected = visible.some((s) => selected.has(s.id))
  const over = selected.size > remaining

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (allVisibleSelected) visible.forEach((s) => next.delete(s.id))
      else visible.forEach((s) => next.add(s.id))
      return next
    })

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <SearchInput value={search} onChange={setSearch} placeholder="Search name or student ID…" className="sm:flex-1" label="Search students" />
        <FilterSelect
          value={departmentId}
          onChange={setDepartmentId}
          options={(lookups?.departments ?? []).map((d) => ({ value: d.id, label: d.name }))}
          allLabel="All departments"
          label="Filter students by department"
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <label className="flex items-center gap-2">
          <Checkbox
            checked={allVisibleSelected ? true : someVisibleSelected ? 'indeterminate' : false}
            onCheckedChange={toggleAll}
            disabled={!visible.length}
            aria-label="Select all visible students"
          />
          Select all visible ({visible.length})
        </label>
        <span className={cn('tabular', over ? 'font-medium text-destructive' : 'text-muted-foreground')}>
          {selected.size} selected · {remaining} seat(s) remaining
        </span>
      </div>
      <div className="max-h-[45vh] min-h-40 overflow-y-auto rounded-md border">
        {loading && !data ? (
          <Spinner label="Loading students…" />
        ) : error ? (
          <div className="p-3">
            <ErrorState error={error} onRetry={refetch} />
          </div>
        ) : !visible.length ? (
          <EmptyState compact icon={Users} title="No eligible students" description="All matching active students are already enrolled, or none match your search." />
        ) : (
          <ul className="divide-y">
            {visible.map((s) => (
              <li key={s.id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/50">
                  <Checkbox checked={selected.has(s.id)} onCheckedChange={() => toggle(s.id)} aria-label={`Select ${s.name}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{s.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {s.studentNumber} · {s.department?.code ?? '—'} · {s.program}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
      {visible.length >= 200 && <p className="text-xs text-muted-foreground">Showing the first 200 matches. Refine your search to find more students.</p>}
      {over && (
        <Alert variant="destructive">
          <AlertDescription>
            Only {remaining} seat(s) remain. Deselect {selected.size - remaining} student(s) or increase the offering capacity.
          </AlertDescription>
        </Alert>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={() => enroll([...selected])} loading={saving} disabled={!selected.size || over}>
          <UserPlus /> Enroll {selected.size || ''} student(s)
        </Button>
      </DialogFooter>
    </div>
  )
}

export function EnrollmentPage() {
  const lookups = useLookups()
  const [params, setParams] = useSearchParams()
  const offeringId = params.get('offering') ?? ''
  const [semesterChoice, setSemesterChoice] = useState(null)
  const [enrollOpen, setEnrollOpen] = useState(false)
  const [confirm, setConfirm] = useState(null) // { kind: 'withdraw' | 'remove', enrollment }

  const offeringQuery = useQuery(() => store.academics.getOfferingAdmin(offeringId), [offeringId], { enabled: Boolean(offeringId) })
  const offering = offeringId && offeringQuery.data?.id === offeringId ? offeringQuery.data : null
  const semesterId = semesterChoice ?? offering?.semesterId ?? lookups?.currentSemester?.id ?? ''

  const offeringsQuery = useQuery(() => store.academics.listOfferings({ semesterId, pageSize: 100 }), [semesterId], { enabled: Boolean(semesterId) })
  const enrollmentsQuery = useQuery(() => store.academics.listOfferingEnrollments(offeringId), [offeringId], { enabled: Boolean(offeringId) })
  const enrollments = offering ? enrollmentsQuery.data : undefined

  const [withdraw] = useMutation((id, reason) => store.academics.withdrawEnrollment(id, { reason }), { success: 'Student withdrawn.' })
  const [remove] = useMutation((id) => store.academics.removeEnrollment(id), { success: 'Enrollment removed.' })

  const semesterOptions = (lookups?.semesters ?? []).map((s) => ({ value: s.id, label: s.isCurrent ? `${s.name} (current)` : s.name }))
  const offeringOptions = (offeringsQuery.data?.items ?? []).map((o) => ({
    value: o.id,
    label: `${o.course.code} ${o.section} — ${o.course.title} (${o.enrolledCount}/${o.capacity})`,
  }))
  if (offering && !offeringOptions.some((o) => o.value === offering.id)) {
    offeringOptions.unshift({ value: offering.id, label: `${offering.course.code} ${offering.section} — ${offering.course.title}` })
  }

  const lockedReason = !offering
    ? null
    : offering.semester?.status === 'closed'
      ? 'Enrollment is closed because this semester has ended.'
      : LOCKED_STATUSES.includes(offering.gradeStatus)
        ? 'Grades for this offering have been submitted, so enrollment is locked.'
        : null
  const full = offering && offering.enrolledCount >= offering.capacity
  const usedPct = offering ? (offering.enrolledCount / Math.max(1, offering.capacity)) * 100 : 0

  const columns = [
    {
      key: 'name',
      header: 'Student',
      value: (e) => e.student.name,
      cell: (e) => (
        <div>
          <p className="font-medium">{e.student.name}</p>
          <p className="text-xs text-muted-foreground">{e.student.email}</p>
        </div>
      ),
    },
    { key: 'studentNumber', header: 'Student ID', value: (e) => e.student.studentNumber },
    { key: 'department', header: 'Department', value: (e) => e.student.department?.code ?? '' },
    { key: 'status', header: 'Status', cell: (e) => <StatusBadge status={e.status} /> },
    {
      key: 'isRepeat',
      header: 'Attempt',
      value: (e) => (e.isRepeat ? 'Repeat' : 'First'),
      cell: (e) =>
        e.isRepeat ? (
          <Badge variant="warning">
            <Repeat aria-hidden="true" /> Repeat
          </Badge>
        ) : (
          <span className="text-muted-foreground">First</span>
        ),
    },
    { key: 'enrolledAt', header: 'Enrolled', value: (e) => e.enrolledAt, cell: (e) => formatDate(e.enrolledAt) },
    {
      key: 'actions',
      header: '',
      sortable: false,
      searchable: false,
      export: false,
      align: 'right',
      cell: (e) => {
        const canWithdraw = e.status !== 'withdrawn' && offering?.gradeStatus !== 'published'
        const canRemove = !e.hasScores
        if (!canWithdraw && !canRemove) return null
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${e.student.name}`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canWithdraw && (
                <DropdownMenuItem onSelect={() => setConfirm({ kind: 'withdraw', enrollment: e })}>
                  <UserMinus /> Withdraw
                </DropdownMenuItem>
              )}
              {canRemove && (
                <DropdownMenuItem variant="destructive" onSelect={() => setConfirm({ kind: 'remove', enrollment: e })}>
                  <Trash2 /> Remove (created in error)
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]

  return (
    <>
      <PageHeader
        title="Student Enrollment"
        description="Enroll students in course offerings, withdraw them or correct mistakes."
        actions={
          offering && (
            <Button onClick={() => setEnrollOpen(true)} disabled={Boolean(lockedReason) || full}>
              <UserPlus /> Enroll students
            </Button>
          )
        }
      />

      <Card className="mb-6">
        <CardContent className="grid gap-4 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
          <SelectField
            label="Semester"
            value={semesterId}
            onChange={(v) => {
              setSemesterChoice(v)
              setParams({}, { replace: true })
            }}
            options={semesterOptions}
            placeholder="Choose a semester"
          />
          <SelectField
            label="Course offering"
            value={offeringId}
            onChange={(v) => setParams({ offering: v }, { replace: true })}
            options={offeringOptions}
            placeholder={offeringsQuery.loading && !offeringsQuery.data ? 'Loading offerings…' : offeringOptions.length ? 'Choose an offering' : 'No offerings in this semester'}
            disabled={!offeringOptions.length}
          />
        </CardContent>
      </Card>

      {!offeringId ? (
        <Card>
          <EmptyState
            icon={Users}
            title="Choose a course offering"
            description="Select a semester and course offering to view and manage its enrolled students."
            action={
              <Button variant="outline" asChild>
                <Link to="/admin/assignments">Manage course offerings</Link>
              </Button>
            }
          />
        </Card>
      ) : offeringQuery.error ? (
        <ErrorState error={offeringQuery.error} onRetry={offeringQuery.refetch} />
      ) : !offering ? (
        <TableSkeleton />
      ) : (
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <div className="min-w-0">
                <CardTitle>
                  {offering.course.code} · Section {offering.section} — {offering.course.title}
                </CardTitle>
                <CardDescription className="mt-1">
                  {offering.semester.name} · {offering.course.creditHours} credit hours
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <GradeStatusBadge status={offering.gradeStatus} />
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/admin/reports/grade-sheet/${offering.id}`}>
                    <ExternalLink /> Grade sheet
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <Detail label="Teacher">{offering.teacher?.name}</Detail>
                <Detail label="Room">{offering.room}</Detail>
                <Detail label="Schedule">{offering.schedule}</Detail>
                <Detail label="Withdrawn">{String(offering.withdrawnCount)}</Detail>
              </dl>
              <div>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Capacity used</span>
                  <span className="tabular font-medium">
                    {offering.enrolledCount} / {offering.capacity}
                    {full && <span className="ml-1.5 text-muted-foreground">(full)</span>}
                  </span>
                </div>
                <Progress value={usedPct} aria-label={`${offering.enrolledCount} of ${offering.capacity} seats used`} />
              </div>
              {lockedReason && (
                <Alert variant="info">
                  <Lock />
                  <AlertDescription>{lockedReason}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          <DataTable
            columns={columns}
            rows={enrollments}
            loading={enrollmentsQuery.loading}
            error={enrollmentsQuery.error}
            onRetry={enrollmentsQuery.refetch}
            searchPlaceholder="Search enrolled students…"
            exportName={`enrollment_${offering.course.code}_${offering.section}`}
            exportTitle={`Enrolled students — ${offering.course.code} ${offering.section} (${offering.semester.name})`}
            university={lookups?.university}
            emptyIcon={Users}
            emptyTitle="No students enrolled yet"
            emptyDescription={lockedReason ?? 'Use “Enroll students” to add students to this offering.'}
          />
        </div>
      )}

      <Dialog open={enrollOpen} onOpenChange={setEnrollOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Enroll students</DialogTitle>
            <DialogDescription>
              {offering ? `${offering.course.code} ${offering.section} · ${offering.semester.name}. Only active students who are not already enrolled are listed.` : ''}
            </DialogDescription>
          </DialogHeader>
          {offering && <EnrollStudentsForm key={offering.id} offering={offering} onClose={() => setEnrollOpen(false)} />}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirm?.kind === 'withdraw'}
        onOpenChange={(v) => !v && setConfirm(null)}
        title={`Withdraw ${confirm?.enrollment?.student?.name ?? 'student'}?`}
        description="The enrollment is kept and recorded as withdrawn (W). The student is notified."
        confirmLabel="Withdraw student"
        variant="destructive"
        reasonLabel="Reason"
        reasonPlaceholder="e.g. Student request approved by the registrar"
        onConfirm={async (reason) => {
          const res = await withdraw(confirm.enrollment.id, reason)
          return res.ok ? undefined : false
        }}
      />
      <ConfirmDialog
        open={confirm?.kind === 'remove'}
        onOpenChange={(v) => !v && setConfirm(null)}
        title={`Remove ${confirm?.enrollment?.student?.name ?? 'student'}?`}
        description="Use this only for enrollments created in error. The record is deleted entirely; it is not possible once marks have been entered."
        confirmLabel="Remove enrollment"
        variant="destructive"
        onConfirm={async () => {
          const res = await remove(confirm.enrollment.id)
          return res.ok ? undefined : false
        }}
      />
    </>
  )
}
