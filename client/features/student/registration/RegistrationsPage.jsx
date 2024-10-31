import { useState, useEffect } from 'react'
import { Plus, UserCheck } from 'lucide-react'
import { toast } from 'sonner'
import { onPeriodChange, onUserChange } from '@/lib/syncEvents'
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
import { useAuth } from '@/context/auth-context'
import { useQuery } from '@/hooks/useStore'
import { getProfileApi } from '@/api/auth'
import {
  getStudentRegistrationsApi,
  submitStudentRegistrationApi,
  cancelStudentRegistrationApi,
} from '@/api/registration'
import { formatDate } from '@/features/admin/registration/registration-utils'
import { RegistrationCountdown } from '@/components/registration/RegistrationCountdown'

function RegistrationStatus({ status }) {
  return <StatusBadge status={status} label={status === 'cancelled' ? 'Cancelled' : undefined} />
}

/** Open / upcoming / closed banner for the student's registration window with live running countdown timer. */
function PeriodBanner({ currentPeriod, upcomingPeriod, isAllowedForStudent, programLabel }) {
  if (currentPeriod) {
    const mine = currentPeriod.myRegistration
    return (
      <div className="space-y-3">
        <RegistrationCountdown
          startDate={currentPeriod.start_date}
          deadline={currentPeriod.deadline}
          semesterName={currentPeriod.semester_name}
          academicYearName={currentPeriod.academic_year_name}
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
            {mine.cafe_status && (
              <span className={`reg-badge ${mine.cafe_status === 'cafe' ? 'reg-badge--cafe' : 'reg-badge--non-cafe'}`}>
                {mine.cafe_status === 'cafe' ? 'Cafe' : 'Non-cafe'}
              </span>
            )}
            {mine.status === 'rejected' && mine.remarks ? (
              <span className="text-destructive font-medium">— {mine.remarks}</span>
            ) : null}
          </div>
        )}
      </div>
    )
  }

  if (upcomingPeriod) {
    return (
      <RegistrationCountdown
        startDate={upcomingPeriod.start_date}
        deadline={upcomingPeriod.deadline}
        semesterName={upcomingPeriod.semester_name}
        academicYearName={upcomingPeriod.academic_year_name}
      />
    )
  }

  return null
}

export function RegistrationsPage() {
  const { user, profile } = useAuth()
  // The Student ID is the one the department entered in Account Provision. Load it fresh
  // (it may have been edited since login) and fall back to the profile cached at login.
  const { data: me, refetch: refetchProfile } = useQuery(getProfileApi, [], { live: false, enabled: Boolean(user) })
  const { data, loading, error, refetch } = useQuery(getStudentRegistrationsApi, [], { live: false, enabled: Boolean(user) })

  const [openingRegister, setOpeningRegister] = useState(false)
  const [freshStudentOverride, setFreshStudentOverride] = useState(null)

  const currentPeriod = data?.currentPeriod ?? null
  const upcomingPeriod = data?.upcomingPeriod ?? null
  const history = data?.history ?? []

  const [isRegisterOpen, setIsRegisterOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [cancellingId, setCancellingId] = useState(null)
  const [cafeStatus, setCafeStatus] = useState('cafe')

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

  const isAllowedForStudent = currentPeriod
    ? (currentPeriod.isAllowedForStudent ?? currentPeriod.allowed_types?.some((t) => (t.id || '').toLowerCase() === studentProgramType.toLowerCase()))
    : false

  const myRegistration = currentPeriod?.myRegistration
  const canRegister = Boolean(currentPeriod) && isAllowedForStudent && (!myRegistration || myRegistration.status === 'cancelled')

  // Real-time WebSocket event listener: server pushes PERIOD_CHANGED instantly
  useWebSocketEvent('PERIOD_CHANGED', () => {
    refetch()
  })

  // Real-time WebSocket event listener: server pushes USER_UPDATED / STUDENT_UPDATED instantly
  useWebSocketEvent('USER_UPDATED', (payload) => {
    if (!payload?.userId || payload.userId === user?.id) {
      refetchProfile?.()
      refetch?.()
      getProfileApi().then((fresh) => {
        if (fresh?.profile) {
          setStoredSession(null, null, fresh.user, fresh.profile)
          setFreshStudentOverride({
            studentNumber: fresh.profile.student_number,
            programType: fresh.profile.program_type,
          })
        }
      }).catch(() => {})
    }
  })

  useWebSocketEvent('STUDENT_UPDATED', () => {
    refetchProfile?.()
    refetch?.()
    getProfileApi().then((fresh) => {
      if (fresh?.profile) {
        setStoredSession(null, null, fresh.user, fresh.profile)
        setFreshStudentOverride({
          studentNumber: fresh.profile.student_number,
          programType: fresh.profile.program_type,
        })
      }
    }).catch(() => {})
  })

  // Instant event notification across tabs in the same browser
  useEffect(() => {
    const unsubPeriod = onPeriodChange(() => {
      refetch()
    })
    const unsubUser = onUserChange((payload) => {
      if (!payload?.userId || payload.userId === user?.id) {
        refetchProfile?.()
        refetch?.()
        getProfileApi().then((fresh) => {
          if (fresh?.profile) {
            setStoredSession(null, null, fresh.user, fresh.profile)
            setFreshStudentOverride({
              studentNumber: fresh.profile.student_number,
              programType: fresh.profile.program_type,
            })
          }
        }).catch(() => {})
      }
    })
    const handleFocus = () => {
      refetch()
      refetchProfile?.()
      getProfileApi().then((fresh) => {
        if (fresh?.profile) {
          setStoredSession(null, null, fresh.user, fresh.profile)
          setFreshStudentOverride({
            studentNumber: fresh.profile.student_number,
            programType: fresh.profile.program_type,
          })
        }
      }).catch(() => {})
    }
    window.addEventListener('focus', handleFocus)

    return () => {
      unsubPeriod?.()
      unsubUser?.()
      window.removeEventListener('focus', handleFocus)
    }
  }, [refetch, refetchProfile, user?.id])

  // Automatically dismiss registration dialog if period is removed or student is not allowed
  useEffect(() => {
    if ((!currentPeriod || !isAllowedForStudent) && isRegisterOpen) {
      setIsRegisterOpen(false)
    }
  }, [currentPeriod, isAllowedForStudent, isRegisterOpen])

  const openRegister = async () => {
    setOpeningRegister(true)
    let freshPeriod = currentPeriod
    let effectiveProgramType = studentProgramType
    let effectiveStudentId = studentId

    try {
      // Concurrently fetch the freshest student details and registration state from the server
      const [profileRes, regRes] = await Promise.all([
        getProfileApi().catch(() => null),
        getStudentRegistrationsApi().catch(() => null),
      ])

      if (profileRes?.profile) {
        setStoredSession(null, null, profileRes.user, profileRes.profile)
        effectiveStudentId = profileRes.profile.student_number || effectiveStudentId
        effectiveProgramType = (profileRes.profile.program_type || effectiveProgramType).toLowerCase()
        setFreshStudentOverride({
          studentNumber: effectiveStudentId,
          programType: effectiveProgramType,
        })
      } else if (regRes?.student) {
        effectiveStudentId = regRes.student.studentNumber || effectiveStudentId
        effectiveProgramType = (regRes.student.programType || effectiveProgramType).toLowerCase()
        setFreshStudentOverride({
          studentNumber: effectiveStudentId,
          programType: effectiveProgramType,
        })
      }

      refetchProfile?.()
      refetch?.()

      if (regRes?.currentPeriod) {
        freshPeriod = regRes.currentPeriod
      }
    } catch {
      // Fallback to existing state if network issue
    } finally {
      setOpeningRegister(false)
    }

    if (!freshPeriod) {
      toast.error('Semester registration is currently closed. Please check back later.')
      return
    }

    const progLabel =
      effectiveProgramType === 'regular'
        ? 'Regular'
        : effectiveProgramType === 'extension'
        ? 'Extension'
        : effectiveProgramType === 'weekend'
        ? 'Weekend'
        : effectiveProgramType.charAt(0).toUpperCase() + effectiveProgramType.slice(1)

    const allowed = freshPeriod.isAllowedForStudent ?? freshPeriod.allowed_types?.some((t) => (t.id || '').toLowerCase() === effectiveProgramType)
    if (!allowed) {
      toast.error(`Registration for ${progLabel} students is not open for this period.`)
      return
    }

    const myReg = freshPeriod.myRegistration
    if (myReg && myReg.status !== 'cancelled') {
      const statusCap = myReg.status.charAt(0).toUpperCase() + myReg.status.slice(1)
      toast.info(`You have already registered for this semester (Status: ${statusCap}).`)
      return
    }

    setIsRegisterOpen(true)
  }

  const handleRegisterSubmit = async (e) => {
    e.preventDefault()
    if (!currentPeriod) {
      toast.error('Semester registration is closed.')
      return
    }
    if (!isAllowedForStudent) {
      toast.error(`Registration for ${programLabel} students is not open for this period.`)
      return
    }
    setSubmitting(true)
    try {
      await submitStudentRegistrationApi({
        semesterId: currentPeriod.semester_id,
        registrationTypeId: studentProgramType,
        cafeStatus,
      })
      toast.success(`Registration submitted for ${currentPeriod.semester_name}. It is now pending approval.`)
      setIsRegisterOpen(false)
      refetch()
    } catch (err) {
      toast.error(err?.message || 'Failed to submit registration.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = async (registration) => {
    setCancellingId(registration.id)
    try {
      await cancelStudentRegistrationApi(registration.id)
      toast.success('Registration cancelled.')
      refetch()
    } catch (err) {
      toast.error(err?.message || 'Failed to cancel registration.')
    } finally {
      setCancellingId(null)
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
            loading={openingRegister}
            variant={canRegister ? 'default' : 'outline'}
            className={!canRegister ? 'opacity-60 cursor-not-allowed' : ''}
            title={
              !currentPeriod
                ? 'Registration is currently closed'
                : !isAllowedForStudent
                  ? `Registration for ${programLabel} cohort is not open`
                  : myRegistration && myRegistration.status !== 'cancelled'
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
            <CardContent className="p-0">
              {history.length === 0 ? (
                <div className="py-12 px-4 text-center">
                  <EmptyState
                    icon={UserCheck}
                    title="No registration records"
                    description="You have not registered for any semesters yet."
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
                      <TableHead className="text-right w-[110px]">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-semibold text-foreground">{studentId || '—'}</TableCell>
                        <TableCell className="font-medium text-foreground">{r.academic_year_name}</TableCell>
                        <TableCell className="font-medium text-foreground">{r.semester_name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-medium text-foreground">{r.type_label}</span>
                            {r.cafe_status && (
                              <span className={`reg-badge ${r.cafe_status === 'cafe' ? 'reg-badge--cafe' : 'reg-badge--non-cafe'}`}>
                                {r.cafe_status === 'cafe' ? 'Cafe' : 'Non-cafe'}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{formatDate(r.submitted_at)}</TableCell>
                        <TableCell className="text-center">
                          <RegistrationStatus status={r.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          {r.status === 'pending' ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCancel(r)}
                              loading={cancellingId === r.id}
                            >
                              Cancel
                            </Button>
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
      <Dialog open={isRegisterOpen} onOpenChange={setIsRegisterOpen}>
        <DialogContent size="md" className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Register for Semester</DialogTitle>
            <DialogDescription>
              Confirm your registration for the active semester. Your program is automatically applied based on your account enrollment.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRegisterSubmit} className="stack stack--md pt-2">
            <FormField label="Student ID">
              <input
                type="text"
                value={studentId}
                placeholder="Loading…"
                disabled
                className="input cursor-not-allowed bg-muted text-muted-foreground w-full"
              />
            </FormField>

            <FormField label="Semester">
              <input
                type="text"
                value={
                  currentPeriod ? `${currentPeriod.semester_name} (${currentPeriod.academic_year_name})` : ''
                }
                disabled
                className="input cursor-not-allowed bg-muted text-muted-foreground w-full"
              />
            </FormField>

            <FormField label="Assigned Program / Registration Type">
              <input
                type="text"
                value={programLabel}
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
              <Button type="button" variant="outline" onClick={() => setIsRegisterOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit Registration'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default RegistrationsPage

