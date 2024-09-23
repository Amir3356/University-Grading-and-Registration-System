import { useState, useMemo } from 'react'
import {
  CalendarDays,
  CalendarCheck2,
  Users,
  UserX,
  Plus,
  Search,
  ChevronDown,
  Info,
  Save,
  X,
  Calendar,
  Eye,
  Clock,
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

const INITIAL_PERIODS = [
  {
    id: 'per-2026-1',
    academicYear: '2026',
    semester: 'First Semester',
    registrationTypes: ['Café', 'Non-Café'],
    startDate: 'Jan 05, 2026',
    deadline: 'Jan 20, 2026',
    rawStartDate: '2026-01-05',
    rawDeadline: '2026-01-20',
    status: 'Closed',
  },
  {
    id: 'per-2026-2',
    academicYear: '2026',
    semester: 'Second Semester',
    registrationTypes: ['Café', 'Non-Café'],
    startDate: 'Jun 01, 2026',
    deadline: 'Jun 15, 2026',
    rawStartDate: '2026-06-01',
    rawDeadline: '2026-06-15',
    status: 'Open',
  },
  {
    id: 'per-2027-1',
    academicYear: '2027',
    semester: 'First Semester',
    registrationTypes: ['Café', 'Non-Café'],
    startDate: '—',
    deadline: '—',
    rawStartDate: '',
    rawDeadline: '',
    status: 'Scheduled',
  },
  {
    id: 'per-2027-2',
    academicYear: '2027',
    semester: 'Second Semester',
    registrationTypes: ['Café', 'Non-Café'],
    startDate: '—',
    deadline: '—',
    rawStartDate: '',
    rawDeadline: '',
    status: 'Not Configured',
  },
]

export function RegistrationPeriodsPage() {
  const [periods, setPeriods] = useState(INITIAL_PERIODS)
  const [periodSearch, setPeriodSearch] = useState('')
  const [periodYearFilter, setPeriodYearFilter] = useState('All')
  const [periodSemFilter, setPeriodSemFilter] = useState('All')
  const [periodStatusFilter, setPeriodStatusFilter] = useState('All')

  // Right Drawer state: Open by default as in screenshot
  const [isDrawerOpen, setIsDrawerOpen] = useState(true)
  const [editingPeriodId, setEditingPeriodId] = useState('per-2026-2')
  const [formState, setFormState] = useState({
    academicYear: '2026',
    semester: 'First Semester',
    allowedTypes: {
      regular: true,
      nonRegular: true,
    },
    startDate: '2026-06-01',
    deadline: '2026-06-15',
    status: 'Scheduled',
  })

  // Summary Metrics
  const totalSemestersCount = 4
  const openPeriodsCount = useMemo(() => periods.filter((p) => p.status === 'Open').length, [periods])
  const registeredCount = 320
  const notRegisteredCount = 24

  // Filtered Periods
  const filteredPeriods = useMemo(() => {
    return periods.filter((p) => {
      const q = periodSearch.toLowerCase().trim()
      const matchSearch =
        !q ||
        p.academicYear.toLowerCase().includes(q) ||
        p.semester.toLowerCase().includes(q) ||
        p.status.toLowerCase().includes(q)

      const matchYear = periodYearFilter === 'All' || p.academicYear === periodYearFilter
      const matchSem = periodSemFilter === 'All' || p.semester.toLowerCase().includes(periodSemFilter.toLowerCase())
      const matchStatus = periodStatusFilter === 'All' || p.status.toLowerCase() === periodStatusFilter.toLowerCase()

      return matchSearch && matchYear && matchSem && matchStatus
    })
  }, [periods, periodSearch, periodYearFilter, periodSemFilter, periodStatusFilter])

  const handleOpenNewConfig = () => {
    setEditingPeriodId(null)
    setFormState({
      academicYear: '2026',
      semester: 'First Semester',
      allowedTypes: { regular: true, nonRegular: true },
      startDate: '2026-06-01',
      deadline: '2026-06-15',
      status: 'Scheduled',
    })
    setIsDrawerOpen(true)
  }

  const handleEditPeriod = (period) => {
    setEditingPeriodId(period.id)
    setFormState({
      academicYear: period.academicYear,
      semester: period.semester,
      allowedTypes: { regular: true, nonRegular: true },
      startDate: period.rawStartDate || '2026-06-01',
      deadline: period.rawDeadline || '2026-06-15',
      status: period.status === 'Not Configured' ? 'Scheduled' : period.status,
    })
    setIsDrawerOpen(true)
  }

  const handleSaveConfig = (e) => {
    e.preventDefault()

    const formatDateStr = (val) => {
      if (!val) return '—'
      try {
        const d = new Date(val + 'T00:00:00')
        return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
      } catch {
        return val
      }
    }

    const regTypes = []
    if (formState.allowedTypes.regular) regTypes.push('Café')
    if (formState.allowedTypes.nonRegular) regTypes.push('Non-Café')

    if (editingPeriodId) {
      setPeriods((prev) =>
        prev.map((p) => {
          if (p.id === editingPeriodId) {
            return {
              ...p,
              academicYear: formState.academicYear,
              semester: formState.semester,
              registrationTypes: regTypes.length > 0 ? regTypes : ['Café', 'Non-Café'],
              startDate: formatDateStr(formState.startDate),
              deadline: formatDateStr(formState.deadline),
              rawStartDate: formState.startDate,
              rawDeadline: formState.deadline,
              status: formState.status,
            }
          }
          return p
        })
      )
      toast.success(`Registration configuration for ${formState.academicYear} (${formState.semester}) saved.`)
    } else {
      const newPeriod = {
        id: `per-${Date.now()}`,
        academicYear: formState.academicYear,
        semester: formState.semester,
        registrationTypes: regTypes.length > 0 ? regTypes : ['Café', 'Non-Café'],
        startDate: formatDateStr(formState.startDate),
        deadline: formatDateStr(formState.deadline),
        rawStartDate: formState.startDate,
        rawDeadline: formState.deadline,
        status: formState.status,
      }
      setPeriods((prev) => [...prev, newPeriod])
      toast.success('New registration period created successfully.')
    }
  }

  const renderStatusBadge = (status) => {
    switch (status) {
      case 'Closed':
        return <span className="reg-badge reg-badge--closed">Closed</span>
      case 'Open':
        return <span className="reg-badge reg-badge--open">Open</span>
      case 'Scheduled':
        return <span className="reg-badge reg-badge--scheduled">Scheduled</span>
      case 'Not Configured':
        return <span className="reg-badge reg-badge--not-configured">Not Configured</span>
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

      {/* 4 Summary Stat Cards */}
      <div className="semester-reg-stats">
        <div className="reg-stat-card">
          <div className="reg-stat-card__icon reg-stat-card__icon--blue">
            <CalendarDays aria-hidden="true" />
          </div>
          <div className="reg-stat-card__content">
            <p className="reg-stat-card__label">Total Semesters</p>
            <p className="reg-stat-card__value reg-stat-card__value--blue">{totalSemestersCount}</p>
          </div>
        </div>

        <div className="reg-stat-card">
          <div className="reg-stat-card__icon reg-stat-card__icon--green">
            <CalendarCheck2 aria-hidden="true" />
          </div>
          <div className="reg-stat-card__content">
            <p className="reg-stat-card__label">Open Registration Periods</p>
            <p className="reg-stat-card__value reg-stat-card__value--green">{openPeriodsCount}</p>
          </div>
        </div>

        <div className="reg-stat-card">
          <div className="reg-stat-card__icon reg-stat-card__icon--purple">
            <Users aria-hidden="true" />
          </div>
          <div className="reg-stat-card__content">
            <p className="reg-stat-card__label">Registered Students</p>
            <p className="reg-stat-card__value reg-stat-card__value--purple">{registeredCount}</p>
          </div>
        </div>

        <div className="reg-stat-card">
          <div className="reg-stat-card__icon reg-stat-card__icon--orange">
            <UserX aria-hidden="true" />
          </div>
          <div className="reg-stat-card__content">
            <p className="reg-stat-card__label">Not Registered Students</p>
            <p className="reg-stat-card__value reg-stat-card__value--orange">{notRegisteredCount}</p>
          </div>
        </div>
      </div>

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

            {/* Filter Bar */}
            <div className="reg-filters">
              <div className="reg-search-wrap">
                <Search aria-hidden="true" />
                <input
                  type="text"
                  placeholder="Search by academic year or semester..."
                  value={periodSearch}
                  onChange={(e) => setPeriodSearch(e.target.value)}
                  className="reg-search-input"
                />
              </div>

              <div className="reg-filter-select-box">
                <label className="reg-filter-select-label">Academic Year</label>
                <select
                  value={periodYearFilter}
                  onChange={(e) => setPeriodYearFilter(e.target.value)}
                  className="reg-filter-select"
                >
                  <option value="All">All Years</option>
                  <option value="2026">2026</option>
                  <option value="2027">2027</option>
                </select>
              </div>

              <div className="reg-filter-select-box">
                <label className="reg-filter-select-label">Semester</label>
                <select
                  value={periodSemFilter}
                  onChange={(e) => setPeriodSemFilter(e.target.value)}
                  className="reg-filter-select"
                >
                  <option value="All">All Semesters</option>
                  <option value="First">First Semester</option>
                  <option value="Second">Second Semester</option>
                </select>
              </div>

              <div className="reg-filter-select-box">
                <label className="reg-filter-select-label">Status</label>
                <select
                  value={periodStatusFilter}
                  onChange={(e) => setPeriodStatusFilter(e.target.value)}
                  className="reg-filter-select"
                >
                  <option value="All">All Statuses</option>
                  <option value="Open">Open</option>
                  <option value="Closed">Closed</option>
                  <option value="Scheduled">Scheduled</option>
                  <option value="Not Configured">Not Configured</option>
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
                  {filteredPeriods.map((period) => (
                    <tr key={period.id}>
                      <td style={{ fontWeight: 500 }}>{period.academicYear}</td>
                      <td>{period.semester}</td>
                      <td>
                        <div className="reg-table-types">
                          {period.registrationTypes.map((type) => (
                            <span
                              key={type}
                              className={`reg-badge ${type === 'Café' ? 'reg-badge--cafe' : 'reg-badge--non-cafe'}`}
                            >
                              {type}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>{period.startDate}</td>
                      <td>{period.deadline}</td>
                      <td>{renderStatusBadge(period.status)}</td>
                      <td>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button type="button" className="reg-action-trigger">
                              <span>
                                {period.status === 'Open'
                                  ? 'Edit'
                                  : period.status === 'Closed'
                                    ? 'View'
                                    : 'Configure'}
                              </span>
                              <ChevronDown size={14} aria-hidden="true" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuLabel>Period Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleEditPeriod(period)}>
                              <Calendar size={14} className="mr-2" />
                              Configure Period
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setPeriods((prev) =>
                                  prev.map((p) =>
                                    p.id === period.id
                                      ? { ...p, status: p.status === 'Open' ? 'Closed' : 'Open' }
                                      : p
                                  )
                                )
                                toast.success(
                                  `Period status toggled to ${period.status === 'Open' ? 'Closed' : 'Open'}`
                                )
                              }}
                            >
                              <Clock size={14} className="mr-2" />
                              {period.status === 'Open' ? 'Close Period' : 'Open Period'}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() =>
                                toast.info(`Viewing full log for ${period.academicYear} - ${period.semester}`)
                              }
                            >
                              <Eye size={14} className="mr-2" />
                              View Audit Details
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                  {filteredPeriods.length === 0 && (
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
            <div className="reg-pagination">
              <span className="reg-pagination__info">
                Showing 1–{filteredPeriods.length} of {filteredPeriods.length} records
              </span>
              <div className="reg-pagination__controls">
                <button type="button" className="reg-page-btn" disabled aria-label="Previous page">
                  ‹
                </button>
                <button type="button" className="reg-page-btn reg-page-btn--active">
                  1
                </button>
                <button type="button" className="reg-page-btn" disabled aria-label="Next page">
                  ›
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Configure Registration Side Drawer */}
        {isDrawerOpen && (
          <aside className="semester-reg-drawer">
            <div className="reg-drawer-card">
              <div className="reg-drawer-header">
                <h3 className="reg-drawer-title">Configure Registration</h3>
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
                {/* Academic Year */}
                <div className="reg-form-group">
                  <label className="reg-form-label">
                    Academic Year <span className="reg-required">*</span>
                  </label>
                  <select
                    value={formState.academicYear}
                    onChange={(e) => setFormState((f) => ({ ...f, academicYear: e.target.value }))}
                    className="reg-form-select"
                    required
                  >
                    <option value="2026">2026</option>
                    <option value="2027">2027</option>
                    <option value="2028">2028</option>
                  </select>
                </div>

                {/* Semester */}
                <div className="reg-form-group">
                  <label className="reg-form-label">
                    Semester <span className="reg-required">*</span>
                  </label>
                  <div className="reg-radio-options">
                    <label className="reg-control-label">
                      <input
                        type="radio"
                        name="semester"
                        value="First Semester"
                        checked={formState.semester === 'First Semester'}
                        onChange={(e) => setFormState((f) => ({ ...f, semester: e.target.value }))}
                        className="reg-control-input"
                      />
                      <span>First Semester</span>
                    </label>
                    <label className="reg-control-label">
                      <input
                        type="radio"
                        name="semester"
                        value="Second Semester"
                        checked={formState.semester === 'Second Semester'}
                        onChange={(e) => setFormState((f) => ({ ...f, semester: e.target.value }))}
                        className="reg-control-input"
                      />
                      <span>Second Semester</span>
                    </label>
                  </div>
                </div>

                {/* Allowed Registration Types */}
                <div className="reg-form-group">
                  <label className="reg-form-label">
                    Allowed Registration Types <span className="reg-required">*</span>
                  </label>
                  <div className="reg-checkbox-options">
                    <label className="reg-control-label">
                      <input
                        type="checkbox"
                        checked={formState.allowedTypes.regular}
                        onChange={(e) =>
                          setFormState((f) => ({
                            ...f,
                            allowedTypes: { ...f.allowedTypes, regular: e.target.checked },
                          }))
                        }
                        className="reg-control-input"
                      />
                      <span>Regular (Café)</span>
                    </label>
                    <label className="reg-control-label">
                      <input
                        type="checkbox"
                        checked={formState.allowedTypes.nonRegular}
                        onChange={(e) =>
                          setFormState((f) => ({
                            ...f,
                            allowedTypes: { ...f.allowedTypes, nonRegular: e.target.checked },
                          }))
                        }
                        className="reg-control-input"
                      />
                      <span>Non-Regular (Non-Café)</span>
                    </label>
                  </div>
                </div>

                {/* Registration Start Date */}
                <div className="reg-form-group">
                  <label className="reg-form-label">
                    Registration Start Date <span className="reg-required">*</span>
                  </label>
                  <div className="reg-date-input-wrap">
                    <Calendar aria-hidden="true" />
                    <input
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
                  <label className="reg-form-label">
                    Registration Deadline <span className="reg-required">*</span>
                  </label>
                  <div className="reg-date-input-wrap">
                    <Calendar aria-hidden="true" />
                    <input
                      type="date"
                      value={formState.deadline}
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
                    <label className="reg-control-label">
                      <input
                        type="radio"
                        name="status"
                        value="Scheduled"
                        checked={formState.status === 'Scheduled'}
                        onChange={(e) => setFormState((f) => ({ ...f, status: e.target.value }))}
                        className="reg-control-input"
                      />
                      <span>Scheduled</span>
                    </label>
                    <label className="reg-control-label">
                      <input
                        type="radio"
                        name="status"
                        value="Open"
                        checked={formState.status === 'Open'}
                        onChange={(e) => setFormState((f) => ({ ...f, status: e.target.value }))}
                        className="reg-control-input"
                      />
                      <span>Open</span>
                    </label>
                    <label className="reg-control-label">
                      <input
                        type="radio"
                        name="status"
                        value="Closed"
                        checked={formState.status === 'Closed'}
                        onChange={(e) => setFormState((f) => ({ ...f, status: e.target.value }))}
                        className="reg-control-input"
                      />
                      <span>Closed</span>
                    </label>
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
                  <button type="submit" className="reg-save-btn">
                    <Save size={16} aria-hidden="true" />
                    Save Configuration
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
    </div>
  )
}
