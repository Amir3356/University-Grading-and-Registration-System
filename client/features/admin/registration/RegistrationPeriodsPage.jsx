import { useState, useMemo } from 'react'
import {
  listRegistrationPeriodsApi,
  createRegistrationPeriodApi,
  updateRegistrationPeriodApi,
  deleteRegistrationPeriodApi,
  toggleRegistrationPeriodApi,
  getRegistrationSummaryApi,
} from '@/api/registration'
import { useLookups } from '@/context/lookups-context'
import { useQuery } from '@/hooks/useStore'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { EmptyState } from '@/components/common/EmptyState'
import { RegistrationStats } from './RegistrationStats'
import { toDateInput, formatDate, TERM_LABELS, TYPE_BADGE_CLASS, errorMessage } from './registration-utils'

import {
  Plus,
  Search,
  ChevronDown,
  Info,
  Save,
  X,
  Calendar,
  Clock,
  Trash2,
  CalendarClock,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const PERIODS_PER_PAGE = 10

const STATUS_LABELS = { scheduled: 'Scheduled', open: 'Open', closed: 'Closed' }

const EMPTY_FORM = {
  semesterId: '',
  registrationTypeIds: [],
  startDate: '',
  deadline: '',
  status: 'scheduled',
}

function mapPeriod(p) {
  return {
    id: p.id,
    semesterId: p.semester_id,
    academicYear: p.semester?.academicYear?.name || '—',
    semester: p.semester?.name || '—',
    term: p.semester?.term || '',
    registrationTypes: p.registration_types || [],
    startDate: toDateInput(p.start_date),
    deadline: toDateInput(p.deadline),
    status: p.status,
    registeredCount: Number(p.registered_count || 0),
    pendingCount: Number(p.pending_count || 0),
  }
}

export function RegistrationPeriodsPage() {
  const lookups = useLookups()
  const semesters = useMemo(() => lookups?.semesters ?? [], [lookups])
  const registrationTypes = useMemo(() => lookups?.registrationTypes ?? [], [lookups])

  const periodsQuery = useQuery(() => listRegistrationPeriodsApi({ pageSize: 'all' }), [], { live: false })
  const summaryQuery = useQuery(() => getRegistrationSummaryApi(), [], { live: false })
  const periods = useMemo(
    () => (periodsQuery.data?.items || []).filter((p) => !/^per_\d{4}_/.test(p.id)).map(mapPeriod),
    [periodsQuery.data]
  )
  const summary = summaryQuery.data
  const loading = periodsQuery.loading
  const [periodSearch, setPeriodSearch] = useState('')
  const [periodYearFilter, setPeriodYearFilter] = useState('All')
  const [periodSemFilter, setPeriodSemFilter] = useState('All')
  const [periodStatusFilter, setPeriodStatusFilter] = useState('All')
  const [page, setPage] = useState(1)

  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [editingPeriodId, setEditingPeriodId] = useState(null)
  const [formState, setFormState] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(null)

  const reload = () => {
    periodsQuery.refetch()
    summaryQuery.refetch()
  }

  const yearOptions = useMemo(
    () => [...new Set(periods.map((p) => p.academicYear))].sort(),
    [periods]
  )

  // A semester can only have one registration period.
  const availableSemesters = useMemo(() => {
    const used = new Set(periods.map((p) => p.semesterId))
    return semesters.filter((s) => !used.has(s.id) || s.id === formState.semesterId)
  }, [semesters, periods, formState.semesterId])

  const filteredPeriods = useMemo(() => {
    const q = periodSearch.toLowerCase().trim()
    return periods.filter((p) => {
      const matchSearch =
        !q ||
        p.academicYear.toLowerCase().includes(q) ||
        p.semester.toLowerCase().includes(q) ||
        p.status.toLowerCase().includes(q)

      const matchYear = periodYearFilter === 'All' || p.academicYear === periodYearFilter
      const matchSem = periodSemFilter === 'All' || p.term === periodSemFilter
      const matchStatus = periodStatusFilter === 'All' || p.status === periodStatusFilter

      return matchSearch && matchYear && matchSem && matchStatus
    })
  }, [periods, periodSearch, periodYearFilter, periodSemFilter, periodStatusFilter])

  const totalPages = Math.ceil(filteredPeriods.length / PERIODS_PER_PAGE) || 1
  const currentPage = Math.min(page, totalPages)
  const paginatedPeriods = filteredPeriods.slice(
    (currentPage - 1) * PERIODS_PER_PAGE,
    currentPage * PERIODS_PER_PAGE
  )
  const startCount = filteredPeriods.length === 0 ? 0 : (currentPage - 1) * PERIODS_PER_PAGE + 1
  const endCount = Math.min(currentPage * PERIODS_PER_PAGE, filteredPeriods.length)

  const setFilter = (setter) => (e) => {
    setter(e.target.value)
    setPage(1)
  }

  const handleOpenNewConfig = () => {
    setEditingPeriodId(null)
    setFormState({ ...EMPTY_FORM, registrationTypeIds: registrationTypes.map((t) => t.id) })
    setIsDrawerOpen(true)
  }

  const handleEditPeriod = (period) => {
    setEditingPeriodId(period.id)
    setFormState({
      semesterId: period.semesterId,
      registrationTypeIds: period.registrationTypes.map((t) => t.id),
      startDate: period.startDate,
      deadline: period.deadline,
      status: period.status,
    })
    setIsDrawerOpen(true)
  }

  const toggleType = (typeId, checked) => {
    setFormState((f) => ({
      ...f,
      registrationTypeIds: checked
        ? [...f.registrationTypeIds, typeId]
        : f.registrationTypeIds.filter((id) => id !== typeId),
    }))
  }

  const handleSaveConfig = async (e) => {
    e.preventDefault()

    if (!formState.semesterId) {
      toast.error('Please select a semester.')
      return
    }
    if (formState.registrationTypeIds.length === 0) {
      toast.error('Select at least one registration type.')
      return
    }
    if (formState.deadline < formState.startDate) {
      toast.error('Registration deadline cannot be before the start date.')
      return
    }

    const payload = {
      startDate: formState.startDate,
      deadline: formState.deadline,
      status: formState.status,
      registrationTypeIds: formState.registrationTypeIds,
    }

    setSaving(true)
    try {
      if (editingPeriodId) {
        await updateRegistrationPeriodApi(editingPeriodId, payload)
        toast.success('Registration period updated.')
      } else {
        await createRegistrationPeriodApi({ ...payload, semesterId: formState.semesterId })
        toast.success('New registration period created successfully.')
      }
      setIsDrawerOpen(false)
      reload()
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to save registration period.'))
    } finally {
      setSaving(false)
    }
  }

  const handleTogglePeriod = async (period) => {
    try {
      await toggleRegistrationPeriodApi(period.id)
      toast.success(
        period.status === 'open'
          ? `Registration for ${period.semester} closed.`
          : `Registration for ${period.semester} opened.`
      )
      reload()
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to change period status.'))
    }
  }

  const handleDeletePeriod = async () => {
    try {
      await deleteRegistrationPeriodApi(deleting.id)
      toast.success(`Registration period for ${deleting.semester} deleted.`)
      if (editingPeriodId === deleting.id) setIsDrawerOpen(false)
      reload()
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to delete registration period.'))
      return false
    }
  }

  const renderStatusBadge = (status) => {
    switch (status) {
      case 'closed':
        return <span className="reg-badge reg-badge--closed">Closed</span>
      case 'open':
        return <span className="reg-badge reg-badge--open">Open</span>
      case 'scheduled':
        return <span className="reg-badge reg-badge--scheduled">Scheduled</span>
      default:
        return <span className="reg-badge">{status}</span>
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

      {/* Main Workspace Layout */}
      <div className="semester-reg-layout">
        {/* Left Column: Semester Registration Periods Table */}
        <div className="semester-reg-main">
          <section className="reg-card">
            <div className="reg-card__header">
              <h2 className="reg-card__title">Semester Registration Periods</h2>
              <button
                type="button"
                className="reg-btn-primary"
                onClick={handleOpenNewConfig}
              >
                <Plus size={16} aria-hidden="true" />
                Configure Registration
              </button>
            </div>

            {loading ? (
              <div style={{ padding: '3.5rem 1.5rem', textAlign: 'center', color: 'var(--muted-foreground)' }}>
                Loading registration periods...
              </div>
            ) : periodsQuery.error ? (
              <div style={{ padding: '3.5rem 1.5rem', textAlign: 'center', color: 'var(--destructive, #ef4444)' }}>
                {errorMessage(periodsQuery.error, 'Failed to load registration periods.')}
              </div>
            ) : periods.length === 0 ? (
              <div style={{ padding: '3.5rem 1.5rem', textAlign: 'center' }}>
                <EmptyState
                  icon={CalendarClock}
                  title="No registration periods configured"
                  description="There are currently no registration periods configured. Click 'Configure Registration' to set up a registration period for a semester."
                  action={
                    <button
                      type="button"
                      className="reg-btn-primary"
                      onClick={handleOpenNewConfig}
                      style={{ marginTop: '0.5rem' }}
                    >
                      <Plus size={16} aria-hidden="true" />
                      Configure Registration
                    </button>
                  }
                />
              </div>
            ) : (
              <>
                {/* Filter Bar */}
                <div className="reg-filters">
                  <div className="reg-search-wrap">
                    <Search aria-hidden="true" />
                    <input
                      type="text"
                      placeholder="Search by academic year or semester..."
                      value={periodSearch}
                      onChange={setFilter(setPeriodSearch)}
                      className="reg-search-input"
                    />
                  </div>

                  <div className="reg-filter-select-box">
                    <label className="reg-filter-select-label">Academic Year</label>
                    <select
                      value={periodYearFilter}
                      onChange={setFilter(setPeriodYearFilter)}
                      className="reg-filter-select"
                    >
                      <option value="All">All Years</option>
                      {yearOptions.map((year) => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </div>

                  <div className="reg-filter-select-box">
                    <label className="reg-filter-select-label">Semester</label>
                    <select
                      value={periodSemFilter}
                      onChange={setFilter(setPeriodSemFilter)}
                      className="reg-filter-select"
                    >
                      <option value="All">All Semesters</option>
                      {Object.entries(TERM_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="reg-filter-select-box">
                    <label className="reg-filter-select-label">Status</label>
                    <select
                      value={periodStatusFilter}
                      onChange={setFilter(setPeriodStatusFilter)}
                      className="reg-filter-select"
                    >
                      <option value="All">All Statuses</option>
                      {Object.entries(STATUS_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Periods Table */}
                <div className="reg-table-container">
                  <table className="reg-table">
                    <thead>
                      <tr>
                        <th>Academic Year</th>
                        <th>Semester</th>
                        <th>Registration Types</th>
                        <th>Start Date</th>
                        <th>Deadline</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedPeriods.map((period) => (
                        <tr key={period.id}>
                          <td style={{ fontWeight: 500 }}>{period.academicYear}</td>
                          <td>{period.semester}</td>
                          <td>
                            <div className="reg-table-types">
                              {period.registrationTypes.map((type) => (
                                <span key={type.id} className={`reg-badge ${TYPE_BADGE_CLASS[type.id] || 'reg-badge--non-cafe'}`}>
                                  {type.label}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td>{formatDate(period.startDate + 'T00:00:00')}</td>
                          <td>{formatDate(period.deadline + 'T00:00:00')}</td>
                          <td>{renderStatusBadge(period.status)}</td>
                          <td>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button type="button" className="reg-action-trigger">
                                    <span>{period.status === 'closed' ? 'View' : 'Edit'}</span>
                                    <ChevronDown size={14} aria-hidden="true" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-44">
                                  <DropdownMenuLabel>Period Actions</DropdownMenuLabel>
                                  <DropdownMenuItem onClick={() => handleEditPeriod(period)}>
                                    <Calendar size={14} className="mr-2" />
                                    Configure Period
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleTogglePeriod(period)}>
                                    <Clock size={14} className="mr-2" />
                                    {period.status === 'open' ? 'Close Period' : 'Open Period'}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-rose-600 focus:text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-950/40"
                                    onClick={() => setDeleting(period)}
                                  >
                                    <Trash2 size={14} className="mr-2 text-rose-600" />
                                    Delete Period
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>

                              <button
                                type="button"
                                className="reg-action-delete"
                                title="Delete period"
                                aria-label={`Delete registration period for ${period.semester}`}
                                onClick={() => setDeleting(period)}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {paginatedPeriods.length === 0 && (
                        <tr>
                          <td
                            colSpan={7}
                            style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted-foreground)' }}
                          >
                            No semester registration periods found matching your criteria.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {filteredPeriods.length > 0 && (
                  <div className="reg-pagination">
                    <span className="reg-pagination__info">
                      Showing {startCount}–{endCount} of {filteredPeriods.length} records
                    </span>
                    <div className="reg-pagination__controls">
                      <button
                        type="button"
                        className="reg-page-btn"
                        disabled={currentPage <= 1}
                        onClick={() => setPage(currentPage - 1)}
                        aria-label="Previous page"
                      >
                        ‹
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                        <button
                          key={pageNum}
                          type="button"
                          className={`reg-page-btn ${currentPage === pageNum ? 'reg-page-btn--active' : ''}`}
                          onClick={() => setPage(pageNum)}
                        >
                          {pageNum}
                        </button>
                      ))}
                      <button
                        type="button"
                        className="reg-page-btn"
                        disabled={currentPage >= totalPages}
                        onClick={() => setPage(currentPage + 1)}
                        aria-label="Next page"
                      >
                        ›
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        </div>

        {/* Right Column: Configure Registration Side Drawer */}
        {isDrawerOpen && (
          <aside className="semester-reg-drawer">
            <div className="reg-drawer-card">
              <div className="reg-drawer-header">
                <h3 className="reg-drawer-title">
                  {editingPeriodId ? 'Edit Registration Period' : 'Configure Registration'}
                </h3>
                <button
                  type="button"
                  className="reg-drawer-close"
                  onClick={() => setIsDrawerOpen(false)}
                  aria-label="Close configuration panel"
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </div>

              <form onSubmit={handleSaveConfig} className="reg-form">
                {/* Semester */}
                <div className="reg-form-group">
                  <label className="reg-form-label" htmlFor="reg-semester">
                    Semester <span className="reg-required">*</span>
                  </label>
                  <select
                    id="reg-semester"
                    value={formState.semesterId}
                    onChange={(e) => setFormState((f) => ({ ...f, semesterId: e.target.value }))}
                    className="reg-form-select"
                    disabled={Boolean(editingPeriodId)}
                    required
                  >
                    <option value="" disabled>
                      {availableSemesters.length ? 'Select a semester' : 'All semesters already have a period'}
                    </option>
                    {availableSemesters.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                        {s.academic_year?.name ? ` (${s.academic_year.name})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Allowed Registration Types */}
                <div className="reg-form-group">
                  <label className="reg-form-label">
                    Allowed Registration Types <span className="reg-required">*</span>
                  </label>
                  <div className="reg-checkbox-options">
                    {registrationTypes.map((type) => (
                      <label key={type.id} className="reg-control-label">
                        <input
                          type="checkbox"
                          checked={formState.registrationTypeIds.includes(type.id)}
                          onChange={(e) => toggleType(type.id, e.target.checked)}
                          className="reg-control-input"
                        />
                        <span>{type.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Registration Start Date */}
                <div className="reg-form-group">
                  <label className="reg-form-label" htmlFor="reg-start-date">
                    Registration Start Date <span className="reg-required">*</span>
                  </label>
                  <div className="reg-date-input-wrap">
                    <Calendar aria-hidden="true" />
                    <input
                      id="reg-start-date"
                      type="date"
                      value={formState.startDate}
                      onChange={(e) => setFormState((f) => ({ ...f, startDate: e.target.value }))}
                      className="reg-date-input"
                      required
                    />
                  </div>
                </div>

                {/* Registration Deadline */}
                <div className="reg-form-group">
                  <label className="reg-form-label" htmlFor="reg-deadline">
                    Registration Deadline <span className="reg-required">*</span>
                  </label>
                  <div className="reg-date-input-wrap">
                    <Calendar aria-hidden="true" />
                    <input
                      id="reg-deadline"
                      type="date"
                      value={formState.deadline}
                      min={formState.startDate || undefined}
                      onChange={(e) => setFormState((f) => ({ ...f, deadline: e.target.value }))}
                      className="reg-date-input"
                      required
                    />
                  </div>
                </div>

                {/* Registration Status */}
                <div className="reg-form-group">
                  <label className="reg-form-label">
                    Registration Status <span className="reg-required">*</span>
                  </label>
                  <div className="reg-radio-options">
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <label key={value} className="reg-control-label">
                        <input
                          type="radio"
                          name="status"
                          value={value}
                          checked={formState.status === value}
                          onChange={(e) => setFormState((f) => ({ ...f, status: e.target.value }))}
                          className="reg-control-input"
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Informative Callout */}
                <div className="reg-info-callout">
                  <Info className="reg-info-callout__icon" aria-hidden="true" />
                  <p className="reg-info-callout__text">
                    Students will be able to register for the selected semester within the specified period. The system
                    will automatically allow or block registration based on the status and dates.
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="reg-drawer-actions">
                  <button type="submit" className="reg-save-btn" disabled={saving}>
                    <Save size={16} aria-hidden="true" />
                    {saving ? 'Saving...' : 'Save Configuration'}
                  </button>
                  <button
                    type="button"
                    className="reg-cancel-btn"
                    onClick={() => setIsDrawerOpen(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </aside>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={`Delete registration period for ${deleting?.semester ?? 'this semester'}?`}
        description="Periods that already have student registrations cannot be deleted. Close the period instead."
        confirmLabel="Delete period"
        variant="destructive"
        onConfirm={handleDeletePeriod}
      />
    </div>
  )
}
