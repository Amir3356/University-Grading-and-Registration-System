import { useState, useMemo } from 'react'
import {
  listRegistrationPeriodsApi,
  createRegistrationPeriodApi,
  updateRegistrationPeriodApi,
  deleteRegistrationPeriodApi,
  getRegistrationSummaryApi,
} from '@/api/registration'
import { useLookups } from '@/context/lookups-context'
import { useQuery } from '@/hooks/useStore'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { DateInput } from '@/components/common/DateInput'
import { EmptyState } from '@/components/common/EmptyState'
import { RegistrationStats } from './RegistrationStats'
import { RegistrationCountdown } from '@/components/registration/RegistrationCountdown'
import { toDateInput, formatDate, TERM_LABELS, TYPE_BADGE_CLASS, errorMessage } from './registration-utils'
import { notifyPeriodChange } from '@/lib/syncEvents'
import { useWebSocketEvent } from '@/lib/websocket'

import {
  Plus,
  Search,
  Save,
  X,
  Calendar,
  Trash2,
  CalendarClock,
  Pencil,
  Eye,
} from 'lucide-react'
import { toast } from 'sonner'

const PERIODS_PER_PAGE = 10

const STATUS_LABELS = { scheduled: 'Scheduled', open: 'Open', closed: 'Closed' }

const EMPTY_FORM = {
  semesterId: '',
  registrationTypeIds: [],
  startDate: '',
  deadline: '',
  status: 'scheduled',
}

/**
 * What students actually experience: a non-closed period accepts registrations while today
 * is within its dates (so 'scheduled' opens automatically) and stops after the deadline.
 */
function effectiveStatus(period) {
  if (period.status === 'closed' || !period.startDate || !period.deadline) return period.status
  const today = toDateInput(new Date())
  if (today > period.deadline) return 'closed'
  if (today >= period.startDate) return 'open'
  return 'scheduled'
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
  const registrationTypes = useMemo(() => {
    const list = lookups?.registrationTypes ?? []
    if (list.length > 0) return list
    return [
      { id: 'regular', label: 'Regular' },
      { id: 'extension', label: 'Extension' },
      { id: 'weekend', label: 'Weekend' },
    ]
  }, [lookups])

  const periodsQuery = useQuery(() => listRegistrationPeriodsApi({ pageSize: 'all' }), [], { live: false })
  const summaryQuery = useQuery(() => getRegistrationSummaryApi(), [], { live: false })
  const periods = useMemo(
    () => (periodsQuery.data?.items || []).map(mapPeriod),
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

  // Real-time WebSocket sync across all admin and user clients
  useWebSocketEvent('PERIOD_CHANGED', reload)
  useWebSocketEvent('REGISTRATION_CHANGED', reload)

  const yearOptions = useMemo(
    () => [...new Set(periods.map((p) => p.academicYear))].sort(),
    [periods]
  )

  const activeOrUpcomingPeriod = useMemo(() => {
    const open = periods.find((p) => effectiveStatus(p) === 'open')
    if (open) return open
    const scheduled = periods.find((p) => effectiveStatus(p) === 'scheduled')
    return scheduled || null
  }, [periods])

  // A semester can only have one registration period.
  // Dynamically increments for every year: displays only the current arrived year's semesters
  // (e.g. 2026 First Semester and 2026 Second Semester in 2026; 2027 First and Second in 2027).
  const availableSemesters = useMemo(() => {
    const currentYear = new Date().getFullYear()
    const used = new Set(periods.map((p) => p.semesterId))
    return semesters
      .filter((s) => {
        if (s.id === formState.semesterId) return true
        if (used.has(s.id)) return false
        if (s.status === 'closed') return false

        // Extract year from semester name (e.g. "2026 First Semester" -> 2026)
        const yearMatch = (s.name || '').match(/\b(20\d{2})\b/) || (s.academic_year?.name || '').match(/\b(20\d{2})\b/)
        if (yearMatch) {
          const semYear = parseInt(yearMatch[1], 10)
          // Display ONLY the current arrived year's semesters (e.g. 2027 First/Second in 2027)
          if (semYear !== currentYear) return false
        }
        return true
      })
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
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
      const matchStatus = periodStatusFilter === 'All' || effectiveStatus(p) === periodStatusFilter

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
      notifyPeriodChange()
      setIsDrawerOpen(false)
      reload()
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to save registration period.'))
    } finally {
      setSaving(false)
    }
  }


  const handleDeletePeriod = async () => {
    try {
      await deleteRegistrationPeriodApi(deleting.id)
      notifyPeriodChange()
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

      <RegistrationStats summary={summary} showPending={false} />

      {activeOrUpcomingPeriod && (
        <RegistrationCountdown
          startDate={activeOrUpcomingPeriod.startDate}
          deadline={activeOrUpcomingPeriod.deadline}
          semesterName={activeOrUpcomingPeriod.semester}
          academicYearName={activeOrUpcomingPeriod.academicYear}
        />
      )}

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
                  description="There are currently no registration periods configured."
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
                                <span key={type.id} className={`reg-badge ${TYPE_BADGE_CLASS[type.id] || 'reg-badge--regular'}`}>
                                  {type.label}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td>{formatDate(period.startDate + 'T00:00:00')}</td>
                          <td>
                            <div className="flex flex-col gap-1 items-start">
                              <span>{formatDate(period.deadline + 'T00:00:00')}</span>
                              {effectiveStatus(period) !== 'closed' && (
                                <RegistrationCountdown
                                  startDate={period.startDate}
                                  deadline={period.deadline}
                                  variant="compact"
                                />
                              )}
                            </div>
                          </td>
                          <td>{renderStatusBadge(effectiveStatus(period))}</td>
                          <td>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
                              <button
                                type="button"
                                className="reg-action-trigger"
                                onClick={() => handleEditPeriod(period)}
                                title={effectiveStatus(period) === 'closed' ? 'View period configuration' : 'Edit period configuration'}
                              >
                                {effectiveStatus(period) === 'closed' ? (
                                  <>
                                    <Eye size={13} aria-hidden="true" />
                                    <span>View</span>
                                  </>
                                ) : (
                                  <>
                                    <Pencil size={13} aria-hidden="true" />
                                    <span>Edit</span>
                                  </>
                                )}
                              </button>

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
                    <DateInput
                      id="reg-start-date"
                      value={formState.startDate}
                      onChange={(startDate) => setFormState((f) => ({ ...f, startDate }))}
                      inputClassName="reg-date-input"
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
                    <DateInput
                      id="reg-deadline"
                      value={formState.deadline}
                      min={formState.startDate || undefined}
                      onChange={(deadline) => setFormState((f) => ({ ...f, deadline }))}
                      inputClassName="reg-date-input"
                      required
                    />
                  </div>
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
