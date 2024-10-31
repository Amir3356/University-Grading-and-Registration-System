import { useState, useMemo } from 'react'
import { Search, ChevronDown, CheckCircle2, XCircle, FileSpreadsheet, Trash2, UserCheck } from 'lucide-react'
import { toast } from 'sonner'
import { EmptyState } from '@/components/common/EmptyState'
import {
  listSemesterRegistrationsApi,
  getRegistrationSummaryApi,
  reviewSemesterRegistrationApi,
  updateSemesterRegistrationTypeApi,
  deleteSemesterRegistrationApi,
} from '@/api/registration'
import { useLookups } from '@/context/lookups-context'
import { useDebounce } from '@/hooks/useDebounce'
import { useQuery } from '@/hooks/useStore'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { RegistrationStats } from './RegistrationStats'
import { formatDate, TYPE_BADGE_CLASS, errorMessage } from './registration-utils'

const STUDENTS_PER_PAGE = 10

const STATUS_OPTIONS = [
  { value: 'registered', label: 'Registered' },
  { value: 'pending', label: 'Pending' },
  { value: 'rejected', label: 'Rejected' },
]

export function StudentRegistrationsPage() {
  const lookups = useLookups()
  const semesters = useMemo(() => lookups?.semesters ?? [], [lookups])
  const departments = useMemo(() => lookups?.departments ?? [], [lookups])
  const programs = useMemo(() => lookups?.programs ?? [], [lookups])
  const registrationTypes = useMemo(() => lookups?.registrationTypes ?? [], [lookups])
  const typeLabels = useMemo(
    () => Object.fromEntries(registrationTypes.map((t) => [t.id, t.label])),
    [registrationTypes]
  )

  const [studentSearch, setStudentSearch] = useState('')
  const debouncedSearch = useDebounce(studentSearch)
  const [studentSemFilter, setStudentSemFilter] = useState('')
  const [studentDeptFilter, setStudentDeptFilter] = useState('')
  const [studentProgFilter, setStudentProgFilter] = useState('')
  const [studentTypeFilter, setStudentTypeFilter] = useState('')
  const [studentStatusFilter, setStudentStatusFilter] = useState('')
  const [studentPage, setStudentPage] = useState(1)
  const [deleting, setDeleting] = useState(null)
  const [rejecting, setRejecting] = useState(null)


  const visiblePrograms = useMemo(
    () => (studentDeptFilter ? programs.filter((p) => p.department_id === studentDeptFilter) : programs),
    [programs, studentDeptFilter]
  )

  const listQuery = useQuery(
    () =>
      listSemesterRegistrationsApi({
        semesterId: studentSemFilter,
        departmentId: studentDeptFilter,
        programId: studentProgFilter,
        registrationTypeId: studentTypeFilter,
        status: studentStatusFilter,
        search: debouncedSearch.trim(),
        page: studentPage,
        pageSize: STUDENTS_PER_PAGE,
      }),
    [studentSemFilter, studentDeptFilter, studentProgFilter, studentTypeFilter, studentStatusFilter, debouncedSearch, studentPage],
    { live: false }
  )
  const summaryQuery = useQuery(() => getRegistrationSummaryApi({ semesterId: studentSemFilter }), [studentSemFilter], {
    live: false,
  })
  const rawItems = listQuery.data?.items || []
  // Without an explicit semester the API picks one (the semester whose registration is open),
  // so use the semester it reports for the Academic Year / Semester columns.
  const selectedSemesterId = studentSemFilter || listQuery.data?.semesterId || ''
  const selectedSemester = semesters.find((s) => s.id === selectedSemesterId)
  const students = useMemo(
    () => rawItems.filter((s) => s.registration && s.status !== 'not_registered'),
    [rawItems]
  )
  const total = students.length === 0 && rawItems.length > 0 ? 0 : listQuery.data?.total || 0
  const loading = listQuery.loading
  const summary = summaryQuery.data

  const totalStudentPages = Math.ceil(total / STUDENTS_PER_PAGE) || 1
  const studentStartCount = total === 0 ? 0 : (studentPage - 1) * STUDENTS_PER_PAGE + 1
  const studentEndCount = Math.min(studentPage * STUDENTS_PER_PAGE, total)

  const setFilter = (setter) => (e) => {
    setter(e.target.value)
    setStudentPage(1)
  }

  const runAction = async (action, successMessage, fallbackError) => {
    try {
      await action()
      toast.success(successMessage)
      listQuery.refetch()
      summaryQuery.refetch()
      return true
    } catch (err) {
      toast.error(errorMessage(err, fallbackError))
      return false
    }
  }

  const handleApprove = (student) =>
    runAction(
      () => reviewSemesterRegistrationApi(student.registration.id, { status: 'approved' }),
      `Registration approved for ${student.name}.`,
      'Failed to approve registration.'
    )

  const handleChangeType = (student, typeId) =>
    runAction(
      () => updateSemesterRegistrationTypeApi(student.registration.id, typeId),
      `Changed registration type to ${typeLabels[typeId] || typeId}.`,
      'Failed to change registration type.'
    )

  const renderStatusBadge = (status) => {
    switch (status) {
      case 'registered':
        return <span className="reg-badge reg-badge--registered">Registered</span>
      case 'pending':
        return <span className="reg-badge reg-badge--pending">Pending</span>
      case 'rejected':
        return <span className="reg-badge reg-badge--not-registered">Rejected</span>
      case 'cancelled':
        return <span className="reg-badge reg-badge--not-registered">Cancelled</span>
      default:
        return <span className="reg-badge reg-badge--not-registered">Not Registered</span>
    }
  }

  return (
    <div className="semester-reg-page">
      {/* Header */}
      <div className="semester-reg-header">
        <h1 className="semester-reg-header__title">Semester Registration Management</h1>
        <p className="semester-reg-header__subtitle">
          Configure registration periods, manage registration types and monitor student registrations for each semester.
        </p>
      </div>

      <RegistrationStats summary={summary} />

      {/* Student Registrations Card */}
      <section className="reg-card" style={{ marginTop: '0.25rem' }}>
        <div className="reg-card__header">
          <h2 className="reg-card__title">Student Registrations</h2>
        </div>

        {/* Filters Row */}
        <div className="reg-filters">
          <div className="reg-search-wrap">
            <Search aria-hidden="true" />
            <input
              type="text"
              placeholder="Search by student name or ID..."
              value={studentSearch}
              onChange={(e) => {
                setStudentSearch(e.target.value)
                setStudentPage(1)
              }}
              className="reg-search-input"
            />
          </div>

          <div className="reg-filter-select-box">
            <label className="reg-filter-select-label">Semester</label>
            <select value={studentSemFilter} onChange={setFilter(setStudentSemFilter)} className="reg-filter-select">
              <option value="">Open Registration Semester</option>
              {semesters.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="reg-filter-select-box">
            <label className="reg-filter-select-label">Department</label>
            <select
              value={studentDeptFilter}
              onChange={(e) => {
                setStudentDeptFilter(e.target.value)
                setStudentProgFilter('')
                setStudentPage(1)
              }}
              className="reg-filter-select"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div className="reg-filter-select-box">
            <label className="reg-filter-select-label">Program</label>
            <select value={studentProgFilter} onChange={setFilter(setStudentProgFilter)} className="reg-filter-select">
              <option value="">All Programs</option>
              {visiblePrograms.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="reg-filter-select-box">
            <label className="reg-filter-select-label">Registration Type</label>
            <select value={studentTypeFilter} onChange={setFilter(setStudentTypeFilter)} className="reg-filter-select">
              <option value="">All Types</option>
              {registrationTypes.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className="reg-filter-select-box">
            <label className="reg-filter-select-label">Status</label>
            <select value={studentStatusFilter} onChange={setFilter(setStudentStatusFilter)} className="reg-filter-select">
              <option value="">All Registrations</option>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '3.5rem 1.5rem', textAlign: 'center', color: 'var(--muted-foreground)' }}>
            Loading student registrations...
          </div>
        ) : listQuery.error ? (
          <div style={{ padding: '3.5rem 1.5rem', textAlign: 'center', color: 'var(--destructive, #ef4444)' }}>
            {errorMessage(listQuery.error, 'Failed to load student registrations.')}
          </div>
        ) : total === 0 ? (
          <div style={{ padding: '3.5rem 1.5rem', textAlign: 'center' }}>
            <EmptyState
              icon={UserCheck}
              title="No student registrations found"
              description={
                studentStatusFilter === 'not_registered'
                  ? 'All active students have registered for this semester.'
                  : 'No student registrations have been submitted for this semester yet.'
              }
            />
          </div>
        ) : (
          <>
            {/* Students Table */}
            <div className="reg-table-container">
              <table className="reg-table">
                <thead>
                  <tr>
                    <th>Student ID</th>
                    <th>Student Name</th>
                    <th>Academic Year</th>
                    <th>Semester</th>
                    <th>Registration Type</th>
                    <th>Status</th>
                    <th>Registration Date</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => {
                    const reg = student.registration
                    const typeId = reg?.registrationTypeId
                    return (
                      <tr key={student.student_id}>
                        <td style={{ fontWeight: 500, color: 'var(--foreground)' }}>{student.student_number}</td>
                        <td>{student.name}</td>
                        <td>{selectedSemester?.academic_year?.name || '—'}</td>
                        <td>{selectedSemester?.name || '—'}</td>
                        <td>
                          {typeId ? (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`reg-badge ${TYPE_BADGE_CLASS[typeId] || 'reg-badge--regular'}`}>
                                {typeLabels[typeId] || typeId}
                              </span>
                              {reg?.cafeStatus && (
                                <span className={`reg-badge ${reg.cafeStatus === 'cafe' ? 'reg-badge--cafe' : 'reg-badge--non-cafe'}`}>
                                  {reg.cafeStatus === 'cafe' ? 'Cafe' : 'Non-cafe'}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span>—</span>
                          )}
                        </td>
                        <td>{renderStatusBadge(student.status)}</td>
                        <td>{formatDate(reg?.submittedAt)}</td>
                        <td>
                          {reg ? (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button type="button" className="reg-action-trigger">
                                    <span>{student.status === 'pending' ? 'Review' : 'Manage'}</span>
                                    <ChevronDown size={14} aria-hidden="true" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56">
                                  <DropdownMenuLabel>
                                    {student.name} ({student.student_number})
                                  </DropdownMenuLabel>

                                  {student.status === 'pending' && (
                                    <>
                                      <DropdownMenuItem onClick={() => handleApprove(student)}>
                                        <CheckCircle2 size={14} className="mr-2 text-emerald-600" />
                                        Approve Registration
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => setRejecting(student)}>
                                        <XCircle size={14} className="mr-2 text-rose-600" />
                                        Reject Registration
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                    </>
                                  )}
                                  {registrationTypes
                                    .filter((t) => t.id !== typeId)
                                    .map((t) => (
                                      <DropdownMenuItem key={t.id} onClick={() => handleChangeType(student, t.id)}>
                                        <FileSpreadsheet size={14} className="mr-2" />
                                        Change to {t.label}
                                      </DropdownMenuItem>
                                    ))}
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-rose-600 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-950/40"
                                    onClick={() => setDeleting(student)}
                                  >
                                    <Trash2 size={14} className="mr-2 text-rose-600" />
                                    Delete Registration
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>

                              <button
                                type="button"
                                className="reg-action-delete"
                                title="Delete registration"
                                aria-label={`Delete registration record for ${student.name}`}
                                onClick={() => setDeleting(student)}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--muted-foreground)' }}>—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                  {students.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted-foreground)' }}
                      >
                        No student registrations found matching your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Students Pagination */}
            <div className="reg-pagination">
              <span className="reg-pagination__info">
                Showing {studentStartCount}–{studentEndCount} of {total} records
              </span>
              <div className="reg-pagination__controls">
                <button
                  type="button"
                  className="reg-page-btn"
                  disabled={studentPage <= 1}
                  onClick={() => setStudentPage((p) => Math.max(p - 1, 1))}
                  aria-label="Previous page"
                >
                  ‹
                </button>
                {Array.from({ length: totalStudentPages }, (_, i) => i + 1).map((pageNum) => (
                  <button
                    key={pageNum}
                    type="button"
                    className={`reg-page-btn ${studentPage === pageNum ? 'reg-page-btn--active' : ''}`}
                    onClick={() => setStudentPage(pageNum)}
                  >
                    {pageNum}
                  </button>
                ))}
                <button
                  type="button"
                  className="reg-page-btn"
                  disabled={studentPage >= totalStudentPages}
                  onClick={() => setStudentPage((p) => Math.min(p + 1, totalStudentPages))}
                  aria-label="Next page"
                >
                  ›
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(rejecting)}
        onOpenChange={(v) => !v && setRejecting(null)}
        title={`Reject registration for ${rejecting?.name ?? 'student'}?`}
        description="The student will be notified with the remarks you provide."
        confirmLabel="Reject registration"
        variant="destructive"
        reasonLabel="Remarks"
        reasonPlaceholder="Explain why the registration is rejected"
        onConfirm={async (remarks) => {
          const ok = await runAction(
            () => reviewSemesterRegistrationApi(rejecting.registration.id, { status: 'rejected', remarks }),
            `Registration rejected for ${rejecting.name}.`,
            'Failed to reject registration.'
          )
          return ok ? undefined : false
        }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={`Delete registration for ${deleting?.name ?? 'student'}?`}
        description="This permanently removes the student's registration record for this semester."
        confirmLabel="Delete registration"
        variant="destructive"
        onConfirm={async () => {
          const ok = await runAction(
            () => deleteSemesterRegistrationApi(deleting.registration.id),
            `Registration record for ${deleting.name} deleted.`,
            'Failed to delete registration.'
          )
          return ok ? undefined : false
        }}
      />
    </div>
  )
}
