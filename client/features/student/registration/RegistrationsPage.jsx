import { useState, useEffect, useRef, useMemo } from 'react'
import { Plus, UserCheck, Pencil, Trash2, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { onPeriodChange, onUserChange, onRegistrationChange } from '@/lib/syncEvents'
import { setStoredSession } from '@/lib/storage'
import { useWebSocketEvent } from '@/lib/websocket'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { FormField } from '@/components/common/FormField'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { Spinner } from '@/components/common/Loading'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { SearchInput } from '@/components/common/SearchInput'
import { FilterSelect } from '@/components/common/FilterSelect'
import { useAuth } from '@/context/auth-context'
import { useLookups } from '@/context/lookups-context'
import { useQuery } from '@/hooks/useStore'
import { getProfileApi } from '@/api/auth'
import {
  getStudentRegistrationsApi,
  submitStudentRegistrationApi,
  updateStudentRegistrationApi,
  deleteStudentRegistrationApi,
  cancelStudentRegistrationApi,
} from '@/api/registration'
import { formatDate } from '@/features/admin/registration/registration-utils'
import { RegistrationCountdown, useRegistrationCountdown } from '@/components/registration/RegistrationCountdown'

function RegistrationStatus({ status }) {
  return <StatusBadge status={status} label={status === 'cancelled' ? 'Cancelled' : undefined} />
}

/** Open / upcoming / closed banner for the student's registration window with live running countdown timer. */
function PeriodBanner({ currentPeriod, upcomingPeriod, isAllowedForStudent, programLabel }) {
  if (currentPeriod) {
    const mine = currentPeriod.myRegistration
    const startDate = currentPeriod.startDate ?? currentPeriod.start_date
    const deadline = currentPeriod.deadline
    const semesterName = currentPeriod.semesterName ?? currentPeriod.semester_name
    const academicYearName = currentPeriod.academicYearName ?? currentPeriod.academic_year_name
    const cafeStatusVal = mine?.cafeStatus ?? mine?.cafe_status

    return (
      <div className="space-y-3">
        <RegistrationCountdown
          startDate={startDate}
          deadline={deadline}
          semesterName={semesterName}
          academicYearName={academicYearName}
        />

        {!isAllowedForStudent && (
          <div className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/30 px-4 py-3 text-amber-700 dark:text-amber-400 text-sm font-medium">
            Registration for <strong>{programLabel}</strong> cohort is not currently open for this semester window.
          </div>
        )}

        {mine && mine.status !== 'cancelled' && (
          <div className="rounded-lg border bg-card p-3 text-sm text-center text-foreground flex items-center justify-center gap-2 flex-wrap">
            <span>Your registration status:</span>
            <RegistrationStatus status={mine.status} />
            {cafeStatusVal && (
              <span className={`reg-badge ${cafeStatusVal === 'cafe' ? 'reg-badge--cafe' : 'reg-badge--non-cafe'}`}>
                {cafeStatusVal === 'cafe' ? 'Cafe' : 'Non-cafe'}
              </span>
            )}
            {mine.status === 'rejected' ? (
              <span className="text-destructive font-medium">
                {mine.remarks ? `— ${mine.remarks}. ` : '— Rejected. '}
                You can submit a revised registration while the registration window is open.
              </span>
            ) : null}
          </div>
        )}
      </div>
    )
  }

  if (upcomingPeriod) {
    const startDate = upcomingPeriod.startDate ?? upcomingPeriod.start_date
    const deadline = upcomingPeriod.deadline
    const semesterName = upcomingPeriod.semesterName ?? upcomingPeriod.semester_name
    const academicYearName = upcomingPeriod.academicYearName ?? upcomingPeriod.academic_year_name

    return (
      <RegistrationCountdown
        startDate={startDate}
        deadline={deadline}
        semesterName={semesterName}
        academicYearName={academicYearName}
      />
    )
  }

  return null
}

export function RegistrationsPage() {
  const { user, profile } = useAuth()
  const lookups = useLookups()
  const semesters = useMemo(() => lookups?.semesters ?? [], [lookups])

  // The Student ID is the one the department entered in Account Provision. Load it fresh
  // (it may have been edited since login) and fall back to the profile cached at login.
  const { data: me } = useQuery(getProfileApi, [], { live: false, enabled: Boolean(user) })
  const { data, loading, error, refetch } = useQuery(getStudentRegistrationsApi, [], { live: false, enabled: Boolean(user) })

  const [freshStudentOverride, setFreshStudentOverride] = useState(null)

  const currentPeriod = data?.currentPeriod ?? null
  const activePeriods = data?.activePeriods ?? (currentPeriod ? [currentPeriod] : [])
  const upcomingPeriod = data?.upcomingPeriod ?? null
  const history = data?.history ?? []

  const [isRegisterOpen, setIsRegisterOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const [cafeStatus, setCafeStatus] = useState('cafe')
  const [selectedSemesterId, setSelectedSemesterId] = useState('')
  const [editingRegistration, setEditingRegistration] = useState(null)
  const [deleteConfirmRegistration, setDeleteConfirmRegistration] = useState(null)

  const currentYear = new Date().getFullYear()

  // Auto-incrementing semester options:
  // Dynamically discovers or generates semesters for the current reached year
  // (e.g., 2026 First Semester, 2026 Second Semester; 2027 First/Second in 2027, etc.)
  const semesterOptions = useMemo(() => {
    // 1. From reference lookups, find semesters matching the reached year
    const matchingSemesters = semesters.filter((s) => {
      const yearMatch = (s.name || '').match(/\b(20\d{2})\b/) || (s.academic_year?.name || '').match(/\b(20\d{2})\b/)
      return yearMatch ? parseInt(yearMatch[1], 10) === currentYear : false
    })

    let options = matchingSemesters.map((s) => ({
      id: s.id,
      name: s.name,
      term: s.term,
      sortOrder: s.sort_order ?? s.sortOrder ?? 0,
    }))

    // 2. If lookups is still loading or doesn't have the current year yet, generate guaranteed options for currentYear
    if (options.length === 0) {
      options = [
        { id: `sem_${currentYear}_fall`, name: `${currentYear} First Semester`, term: 'first', sortOrder: 1 },
        { id: `sem_${currentYear + 1}_spring`, name: `${currentYear} Second Semester`, term: 'second', sortOrder: 2 },
      ]
    }

    // 3. Sort term 1 first, then term 2
    options.sort((a, b) => {
      const termA = (a.term || '').toLowerCase()
      const termB = (b.term || '').toLowerCase()
      if (termA === 'first' && termB !== 'first') return -1
      if (termA !== 'first' && termB === 'first') return 1
      return (a.name || '').localeCompare(b.name || '')
    })

    // 4. Ensure the current active period's semester is in the list
    const activeSemId = currentPeriod?.semesterId || currentPeriod?.semester_id
    const activeSemName = currentPeriod?.semesterName || currentPeriod?.semester_name
    if (activeSemId && !options.some((s) => s.id === activeSemId)) {
      options.unshift({
        id: activeSemId,
        name: activeSemName || `${currentYear} First Semester`,
        term: 'first',
        sortOrder: 0,
      })
    }

    // 5. Ensure editing registration's semester is included if editing
    if (editingRegistration) {
      const editSemId = editingRegistration.semesterId || editingRegistration.semester_id
      const editSemName = editingRegistration.semesterName || editingRegistration.semester_name
      if (editSemId && !options.some((s) => s.id === editSemId)) {
        options.unshift({
          id: editSemId,
          name: editSemName || 'Selected Semester',
          term: 'first',
          sortOrder: 0,
        })
      }
    }

    return options
  }, [semesters, currentYear, currentPeriod, editingRegistration])

  // Synchronize default selected semester with current active period
  useEffect(() => {
    if (!selectedSemesterId) {
      const defaultId = currentPeriod?.semesterId || currentPeriod?.semester_id || semesterOptions[0]?.id || ''
      if (defaultId) setSelectedSemesterId(defaultId)
    }
  }, [currentPeriod, semesterOptions, selectedSemesterId])

  // Resolve active period matching selected semester
  const selectedPeriod = useMemo(() => {
    if (!selectedSemesterId) return currentPeriod
    return (
      activePeriods.find((p) => (p.semesterId || p.semester_id) === selectedSemesterId) ||
      ((currentPeriod?.semesterId || currentPeriod?.semester_id) === selectedSemesterId ? currentPeriod : null)
    )
  }, [activePeriods, currentPeriod, selectedSemesterId])

  // Resolve student's latest Student ID
  const studentId =
    freshStudentOverride?.studentNumber ??
    data?.student?.studentNumber ??
    currentPeriod?.studentNumber ??
    me?.profile?.student_number ??
    profile?.student_number ??
    user?.studentNumber ??
    ''

  // Enforce student's assigned program type (RBAC assigned by Department Head)
  const studentProgramType = (
    freshStudentOverride?.programType ??
    data?.student?.programType ??
    currentPeriod?.studentProgramType ??
    me?.profile?.program_type ??
    profile?.program_type ??
    user?.programType ??
    'regular'
  ).toLowerCase()

  const programLabel =
    studentProgramType === 'regular'
      ? 'Regular'
      : studentProgramType === 'extension'
      ? 'Extension'
      : studentProgramType === 'weekend'
      ? 'Weekend'
      : studentProgramType.charAt(0).toUpperCase() + studentProgramType.slice(1)

  // Search box and dropfilters state
  const [search, setSearch] = useState('')
  const [statusChoice, setStatusChoice] = useState('all')
  const [semesterChoice, setSemesterChoice] = useState('all')

  const statusOptions = [
    { value: 'all', label: 'Status' },
    { value: 'pending', label: 'Pending' },
    { value: 'registered', label: 'Registered' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'cancelled', label: 'Cancelled' },
  ]

  // Auto-increments dynamically with the current year (e.g. 2026 First Semester, 2026 Second Semester; 2027 in 2027)
  const semesterFilterOptions = useMemo(() => {
    const matchingSemesters = semesters.filter((s) => {
      const yearMatch = (s.name || '').match(/\b(20\d{2})\b/) || (s.academic_year?.name || '').match(/\b(20\d{2})\b/)
      return yearMatch ? parseInt(yearMatch[1], 10) === currentYear : false
    })

    let list = matchingSemesters.map((s) => ({
      value: s.name,
      label: s.name,
      term: s.term,
    }))

    if (list.length === 0) {
      list = [
        { value: `${currentYear} First Semester`, label: `${currentYear} First Semester`, term: 'first' },
        { value: `${currentYear} Second Semester`, label: `${currentYear} Second Semester`, term: 'second' },
      ]
    }

    list.sort((a, b) => {
      const termA = (a.term || '').toLowerCase()
      const termB = (b.term || '').toLowerCase()
      if (termA === 'first' && termB !== 'first') return -1
      if (termA !== 'first' && termB === 'first') return 1
      return (a.label || '').localeCompare(b.label || '')
    })

    return [
      { value: 'all', label: 'Semester' },
      ...list.map((item) => ({ value: item.value, label: item.label })),
    ]
  }, [semesters, currentYear])

  const isFiltered = search.trim() !== '' || statusChoice !== 'all' || semesterChoice !== 'all'

  const handleResetFilters = () => {
    setSearch('')
    setStatusChoice('all')
    setSemesterChoice('all')
  }

  const filteredHistory = useMemo(() => {
    return history.filter((r) => {
      const semName = (r.semesterName ?? r.semester_name ?? '').toLowerCase()
      const ayName = (r.academicYearName ?? r.academic_year_name ?? '').toLowerCase()
      const typeLab = (r.typeLabel ?? r.type_label ?? '').toLowerCase()
      const cafeVal = (r.cafeStatus ?? r.cafe_status ?? '').toLowerCase()
      const statusVal = (r.status ?? '').toLowerCase()
      const idVal = (studentId || '').toLowerCase()

      // Search box filter
      if (search.trim()) {
        const q = search.trim().toLowerCase()
        const matches =
          semName.includes(q) ||
          ayName.includes(q) ||
          typeLab.includes(q) ||
          cafeVal.includes(q) ||
          statusVal.includes(q) ||
          idVal.includes(q)
        if (!matches) return false
      }

      // Status dropfilter
      if (statusChoice !== 'all' && statusVal !== statusChoice.toLowerCase()) {
        return false
      }

      // Semester dropfilter (with auto-incrementing year, e.g. 2026 First Semester)
      if (semesterChoice !== 'all') {
        const choiceLower = semesterChoice.toLowerCase()
        const exactMatch = semName.includes(choiceLower) || choiceLower.includes(semName)
        if (!exactMatch) {
          const termMatch = choiceLower.includes('first') ? 'first' : choiceLower.includes('second') ? 'second' : ''
          const yearMatch = choiceLower.match(/\b(20\d{2})\b/)?.[1]
          if (termMatch && !semName.includes(termMatch)) return false
          if (yearMatch && !semName.includes(yearMatch) && !ayName.includes(yearMatch)) return false
        }
      }

      return true
    })
  }, [history, search, statusChoice, semesterChoice, studentId])

  const isAllowedForStudent = currentPeriod
    ? (currentPeriod.isAllowedForStudent ?? (currentPeriod.allowedTypes || currentPeriod.allowed_types)?.some((t) => (t.id || '').toLowerCase() === studentProgramType.toLowerCase()))
    : false

  const cd = useRegistrationCountdown(currentPeriod?.startDate ?? currentPeriod?.start_date, currentPeriod?.deadline)
  const isPeriodClosed = cd.status === 'ended' || cd.status === 'expired'

  const myRegistration = currentPeriod?.myRegistration
  const canRegister =
    Boolean(currentPeriod) &&
    !isPeriodClosed &&
    isAllowedForStudent &&
    (!myRegistration || myRegistration.status === 'cancelled' || myRegistration.status === 'rejected')

  // Real-time WebSocket event listener: server pushes PERIOD_CHANGED & REGISTRATION_CHANGED instantly
  useWebSocketEvent('PERIOD_CHANGED', () => {
    refetch()
  })

  useWebSocketEvent('REGISTRATION_CHANGED', () => {
    refetch()
  })

  // Real-time WebSocket event listener: server pushes STUDENT_UPDATED / USER_UPDATED instantly with updated payload
  useWebSocketEvent('STUDENT_UPDATED', (payload) => {
    if (!payload?.userId || payload.userId === user?.id) {
      if (payload.studentNumber || payload.programType) {
        setFreshStudentOverride((prev) => ({
          studentNumber: payload.studentNumber || prev?.studentNumber,
          programType: payload.programType ? payload.programType.toLowerCase() : prev?.programType,
        }))
      }
      if (payload.profile) {
        setStoredSession(null, null, payload.user, payload.profile)
      }
    }
  })

  useWebSocketEvent('USER_UPDATED', (payload) => {
    if (!payload?.userId || payload.userId === user?.id) {
      if (payload.studentNumber || payload.programType) {
        setFreshStudentOverride((prev) => ({
          studentNumber: payload.studentNumber || prev?.studentNumber,
          programType: payload.programType ? payload.programType.toLowerCase() : prev?.programType,
        }))
      }
      if (payload.profile) {
        setStoredSession(null, null, payload.user, payload.profile)
      }
    }
  })

  // Instant event notification across tabs in the same browser (HTML5 BroadcastChannel)
  useEffect(() => {
    const unsubPeriod = onPeriodChange(() => {
      refetch()
    })
    const unsubRegistration = onRegistrationChange(() => {
      refetch()
    })
    const unsubUser = onUserChange((payload) => {
      if (!payload?.userId || payload.userId === user?.id) {
        if (payload?.studentNumber || payload?.programType) {
          setFreshStudentOverride((prev) => ({
            studentNumber: payload.studentNumber || prev?.studentNumber,
            programType: payload.programType ? payload.programType.toLowerCase() : prev?.programType,
          }))
        }
        if (payload?.profile) {
          setStoredSession(null, null, payload.user, payload.profile)
        }
      }
    })

    return () => {
      unsubPeriod?.()
      unsubRegistration?.()
      unsubUser?.()
    }
  }, [refetch, user?.id])

  // Automatically dismiss registration dialog if registration cannot be performed (when not editing)
  useEffect(() => {
    if (!canRegister && isRegisterOpen && !editingRegistration) {
      setIsRegisterOpen(false)
    }
  }, [canRegister, isRegisterOpen, editingRegistration])

  const openRegister = () => {
    if (!currentPeriod || isPeriodClosed) {
      if (upcomingPeriod) {
        const uSem = upcomingPeriod.semesterName ?? upcomingPeriod.semester_name
        const uStart = upcomingPeriod.startDate ?? upcomingPeriod.start_date
        toast.info(`Registration for ${uSem} opens on ${formatDate(uStart)}.`)
      } else {
        toast.error('The registration deadline has passed. Semester registration is closed.')
      }
      return
    }
    if (!isAllowedForStudent) {
      toast.error(`Registration for ${programLabel} students is not open for this period.`)
      return
    }
    if (myRegistration && myRegistration.status !== 'cancelled' && myRegistration.status !== 'rejected') {
      const statusCap = myRegistration.status.charAt(0).toUpperCase() + myRegistration.status.slice(1)
      toast.info(`You have already registered for this semester (Status: ${statusCap}).`)
      return
    }
    setEditingRegistration(null)
    const activeSemId = currentPeriod?.semesterId || currentPeriod?.semester_id || semesterOptions[0]?.id || ''
    setSelectedSemesterId(activeSemId)
    const cafeVal = myRegistration?.cafeStatus ?? myRegistration?.cafe_status
    setCafeStatus(cafeVal === 'non_cafe' || cafeVal === 'non-cafe' ? 'non-cafe' : 'cafe')
    setIsRegisterOpen(true)
  }

  const handleOpenEdit = (registration) => {
    if (isPeriodClosed) {
      toast.error('The registration deadline has passed. Registration details can no longer be edited.')
      return
    }
    setEditingRegistration(registration)
    setSelectedSemesterId(registration.semesterId ?? registration.semester_id ?? '')
    const cafeVal = registration.cafeStatus ?? registration.cafe_status
    setCafeStatus(cafeVal === 'non_cafe' || cafeVal === 'non-cafe' ? 'non-cafe' : 'cafe')
    setIsRegisterOpen(true)
  }

  const handleRegisterSubmit = async (e) => {
    e.preventDefault()
    if (submittingRef.current || submitting) return
    if (isPeriodClosed) {
      toast.error('The registration deadline has passed. Registration is closed.')
      setIsRegisterOpen(false)
      return
    }
    submittingRef.current = true
    setSubmitting(true)
    try {
      if (editingRegistration) {
        await updateStudentRegistrationApi(editingRegistration.id, {
          cafeStatus,
        })
        const semName = editingRegistration.semesterName ?? editingRegistration.semester_name
        toast.success(`Registration updated for ${semName}.`)
      } else {
        const semIdToSubmit = selectedSemesterId || currentPeriod?.semesterId || currentPeriod?.semester_id
        if (!semIdToSubmit) {
          toast.error('Please select a semester.')
          return
        }
        if (!currentPeriod && !selectedPeriod) {
          toast.error('Registration is currently closed for this semester.')
          setIsRegisterOpen(false)
          return
        }
        if (!isAllowedForStudent) {
          toast.error(`Registration for ${programLabel} students is not open for this period.`)
          setIsRegisterOpen(false)
          return
        }
        await submitStudentRegistrationApi({
          semesterId: semIdToSubmit,
          registrationTypeId: studentProgramType,
          cafeStatus,
        })
        const semLabel =
          semesterOptions.find((s) => s.id === semIdToSubmit)?.name ||
          currentPeriod?.semesterName ||
          currentPeriod?.semester_name ||
          'semester'
        toast.success(`Registration submitted for ${semLabel}. It is now pending approval.`)
      }
      setIsRegisterOpen(false)
      setEditingRegistration(null)
      refetch()
    } catch (err) {
      const errMsg = err?.message || (editingRegistration ? 'Failed to update registration.' : 'Failed to submit registration.')
      toast.error(errMsg)
      // Auto-close modal and refresh state if duplicate or already registered
      if (err?.kind === 'conflict' || err?.status === 409 || errMsg.toLowerCase().includes('already registered')) {
        setIsRegisterOpen(false)
        setEditingRegistration(null)
      }
      refetch()
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteConfirmRegistration) return
    const id = deleteConfirmRegistration.id
    if (isPeriodClosed) {
      toast.error('The registration deadline has passed. Registration can no longer be deleted.')
      setDeleteConfirmRegistration(null)
      return
    }
    try {
      await deleteStudentRegistrationApi(id)
      toast.success('Registration deleted.')
    } catch {
      try {
        await cancelStudentRegistrationApi(id)
        toast.success('Registration cancelled.')
      } catch (cancelErr) {
        toast.error(cancelErr?.message || 'Failed to delete registration.')
      }
    } finally {
      setDeleteConfirmRegistration(null)
      refetch()
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        centered
        title="Semester Registration"
        description="Register for upcoming academic semesters and view your official registration records."
        actions={
          <Button
            onClick={openRegister}
            variant={canRegister ? 'default' : 'outline'}
            className={!canRegister ? 'opacity-60 cursor-not-allowed' : ''}
            disabled={!canRegister}
            title={
              !currentPeriod
                ? 'Registration is currently closed'
                : isPeriodClosed
                  ? 'Registration deadline has passed'
                  : !isAllowedForStudent
                    ? `Registration for ${programLabel} cohort is not open`
                    : myRegistration && myRegistration.status !== 'cancelled' && myRegistration.status !== 'rejected'
                      ? `Already registered (${myRegistration.status})`
                      : 'Register for open semester'
            }
          >
            <Plus className="icon" /> Register for Semester
          </Button>
        }
      />

      {loading && !data ? (
        <Spinner label="Loading registration…" />
      ) : error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : (
        <>
          <PeriodBanner
            currentPeriod={currentPeriod}
            upcomingPeriod={upcomingPeriod}
            isAllowedForStudent={isAllowedForStudent}
            programLabel={programLabel}
          />

          {/* Registration Records Table */}
          <Card className="overflow-hidden">
            {/* Controls Toolbar: Search Box & Dropfilters */}
            <div className="p-4 border-b border-border bg-card/50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="w-full sm:w-72">
                <SearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder="Search registrations…"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="w-36 sm:w-40">
                  <FilterSelect
                    value={statusChoice}
                    onChange={setStatusChoice}
                    options={statusOptions}
                    placeholder="Status"
                    includeAll={false}
                  />
                </div>

                <div className="w-48 sm:w-56">
                  <FilterSelect
                    value={semesterChoice}
                    onChange={setSemesterChoice}
                    options={semesterFilterOptions}
                    placeholder="Semester"
                    includeAll={false}
                  />
                </div>

                {isFiltered && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleResetFilters}
                    className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <RotateCcw className="size-3.5 mr-1" />
                    Reset
                  </Button>
                )}
              </div>
            </div>

            <CardContent className="p-0">
              {history.length === 0 ? (
                <div className="py-12 px-4 text-center">
                  <EmptyState
                    icon={UserCheck}
                    title="No registration records"
                    description="You have not registered for any semesters yet."
                  />
                </div>
              ) : filteredHistory.length === 0 ? (
                <div className="py-12 px-4 text-center">
                  <EmptyState
                    icon={UserCheck}
                    title="No matching records found"
                    description="No registration records match your search or filter criteria. Try clearing filters."
                  />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[140px]">Student ID</TableHead>
                      <TableHead className="w-[140px]">Academic Year</TableHead>
                      <TableHead>Semester</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="w-[130px]">Submitted</TableHead>
                      <TableHead className="text-center w-[130px]">Status</TableHead>
                      <TableHead className="text-right w-[110px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredHistory.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-semibold text-foreground">{studentId || '—'}</TableCell>
                        <TableCell className="font-medium text-foreground">{r.academicYearName ?? r.academic_year_name}</TableCell>
                        <TableCell className="font-medium text-foreground">{r.semesterName ?? r.semester_name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-medium text-foreground">{r.typeLabel ?? r.type_label}</span>
                            {(r.cafeStatus || r.cafe_status) && (
                              <span className={`reg-badge ${(r.cafeStatus || r.cafe_status) === 'cafe' ? 'reg-badge--cafe' : 'reg-badge--non-cafe'}`}>
                                {(r.cafeStatus || r.cafe_status) === 'cafe' ? 'Cafe' : 'Non-cafe'}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{formatDate(r.submittedAt ?? r.submitted_at)}</TableCell>
                        <TableCell className="text-center">
                          <RegistrationStatus status={r.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          {r.status === 'pending' ? (
                            <div className="flex items-center justify-end gap-1">
                              {!isPeriodClosed ? (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    className="text-primary hover:text-primary hover:bg-primary/10"
                                    title="Edit registration"
                                    aria-label={`Edit registration for ${r.semesterName ?? r.semester_name}`}
                                    onClick={() => handleOpenEdit(r)}
                                  >
                                    <Pencil className="size-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                    title="Delete registration"
                                    aria-label={`Delete registration for ${r.semesterName ?? r.semester_name}`}
                                    onClick={() => setDeleteConfirmRegistration(r)}
                                  >
                                    <Trash2 className="size-4" />
                                  </Button>
                                </>
                              ) : (
                                <span className="text-xs text-muted-foreground font-medium">Closed</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Registration Modal Dialog */}
      <Dialog
        open={isRegisterOpen}
        onOpenChange={(open) => {
          setIsRegisterOpen(open)
          if (!open) setEditingRegistration(null)
        }}
      >
        <DialogContent size="md" className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingRegistration ? 'Edit Registration' : 'Register for Semester'}</DialogTitle>
            <DialogDescription>
              {editingRegistration
                ? `Update your meal service choice for ${editingRegistration.semesterName ?? editingRegistration.semester_name}. Other fields are locked.`
                : 'Confirm your registration for the active semester. Your program is automatically applied based on your account enrollment.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRegisterSubmit} className="stack stack--md pt-2">
            <FormField label="Student ID">
              <input
                type="text"
                value={studentId || ''}
                placeholder="Loading…"
                disabled
                className="input cursor-not-allowed bg-muted text-muted-foreground w-full"
              />
            </FormField>

            <FormField label="Semester" required>
              {editingRegistration ? (
                <input
                  type="text"
                  value={editingRegistration.semesterName ?? editingRegistration.semester_name ?? ''}
                  disabled
                  className="input cursor-not-allowed bg-muted text-muted-foreground w-full"
                />
              ) : (
                <Select
                  value={selectedSemesterId}
                  onValueChange={setSelectedSemesterId}
                >
                  <SelectTrigger id="student-semester-select" className="w-full">
                    <SelectValue placeholder="Select semester" />
                  </SelectTrigger>
                  <SelectContent>
                    {semesterOptions.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {selectedPeriod ? (
                <p className="text-xs text-emerald-500 dark:text-emerald-400 mt-1">
                  Registration window is open and accepting submissions.
                </p>
              ) : !editingRegistration ? (
                <p className="text-xs text-amber-500 mt-1">
                  Registration window for this semester has not opened yet.
                </p>
              ) : null}
            </FormField>

            <FormField label="Assigned Program / Registration Type">
              <input
                type="text"
                value={editingRegistration ? (editingRegistration.typeLabel ?? editingRegistration.type_label ?? '') : (programLabel || '')}
                disabled
                className="input cursor-not-allowed bg-muted text-foreground font-semibold w-full"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Auto-locked to your enrolled program assigned by the Department Head.
              </p>
            </FormField>

            <FormField label="Cafeteria / Meal Service" required>
              <Select value={cafeStatus} onValueChange={setCafeStatus}>
                <SelectTrigger id="student-cafe-status" className="w-full">
                  <SelectValue placeholder="Select Cafe or Non-cafe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cafe">Cafe</SelectItem>
                  <SelectItem value="non-cafe">Non-cafe</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Select your campus cafeteria meal service status (Cafe or Non-cafe).
              </p>
            </FormField>

            <DialogFooter className="pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsRegisterOpen(false)
                  setEditingRegistration(null)
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || (!editingRegistration && !selectedPeriod)}>
                {submitting
                  ? (editingRegistration ? 'Saving...' : 'Submitting...')
                  : (editingRegistration ? 'Save Changes' : 'Submit Registration')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteConfirmRegistration)}
        onOpenChange={(open) => !open && setDeleteConfirmRegistration(null)}
        title="Delete Registration"
        description={
          deleteConfirmRegistration
            ? `Are you sure you want to delete your pending registration for ${deleteConfirmRegistration.semesterName ?? deleteConfirmRegistration.semester_name}? You can re-register anytime while the semester registration period is open.`
            : ''
        }
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  )
}

export default RegistrationsPage

