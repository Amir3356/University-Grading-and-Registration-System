import { useState, useEffect } from 'react'
import { Plus, UserCheck } from 'lucide-react'
import { toast } from 'sonner'
import { onPeriodChange } from '@/lib/syncEvents'
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

function RegistrationStatus({ status }) {
  return <StatusBadge status={status} label={status === 'cancelled' ? 'Cancelled' : undefined} />
}

/** Open / upcoming / closed banner for the student's registration window. */
function PeriodBanner({ currentPeriod, upcomingPeriod, isAllowedForStudent, programLabel }) {
  if (currentPeriod) {
    const mine = currentPeriod.myRegistration
    return (
      <Card>
        <CardContent className="stack stack--sm py-4 text-center">
          <p className="font-semibold text-foreground text-center">
            Registration is open for {currentPeriod.semester_name} ({currentPeriod.academic_year_name})
          </p>
          <p className="text-sm text-muted-foreground text-center">
            {formatDate(currentPeriod.start_date)} – {formatDate(currentPeriod.deadline)} ·{' '}
            {currentPeriod.daysLeft === 0 ? 'Last day to register' : `${currentPeriod.daysLeft} day(s) left`}
          </p>

          {!isAllowedForStudent && (
            <div className="mt-2 inline-flex items-center justify-center gap-2 rounded-md bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-amber-700 dark:text-amber-400 text-sm font-medium">
              Registration for <strong>{programLabel}</strong> cohort is not currently open for this semester window.
            </div>
          )}

          {mine && mine.status !== 'cancelled' && (
            <p className="text-sm text-center">
              Your registration: <RegistrationStatus status={mine.status} />
              {mine.status === 'rejected' && mine.remarks ? ` — ${mine.remarks}` : ''}
            </p>
          )}
        </CardContent>
      </Card>
    )
  }

  if (upcomingPeriod) {
    return (
      <Card>
        <CardContent className="stack stack--sm py-4 text-center">
          <p className="font-semibold text-foreground text-center">
            Upcoming Registration: {upcomingPeriod.semester_name} ({upcomingPeriod.academic_year_name})
          </p>
          <p className="text-sm text-muted-foreground text-center">
            Opens on {formatDate(upcomingPeriod.start_date)} · Closes on {formatDate(upcomingPeriod.deadline)}
          </p>
        </CardContent>
      </Card>
    )
  }

  return null
}

export function RegistrationsPage() {
  const { user, profile } = useAuth()
  // The Student ID is the one the department entered in Account Provision. Load it fresh
  // (it may have been edited since login) and fall back to the profile cached at login.
  const { data: me } = useQuery(getProfileApi, [], { live: false, enabled: Boolean(user) })
  const studentId = me?.profile?.student_number ?? profile?.student_number ?? user?.studentNumber ?? ''

  const { data, loading, error, refetch } = useQuery(getStudentRegistrationsApi, [], { live: false, enabled: Boolean(user) })
  const currentPeriod = data?.currentPeriod ?? null
  const upcomingPeriod = data?.upcomingPeriod ?? null
  const history = data?.history ?? []

  const [isRegisterOpen, setIsRegisterOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [cancellingId, setCancellingId] = useState(null)

  // Enforce student's assigned program type (RBAC assigned by Department Head)
  const studentProgramType = (
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
    ? (currentPeriod.isAllowedForStudent ?? currentPeriod.allowed_types?.some((t) => t.id === studentProgramType))
    : false

  const myRegistration = currentPeriod?.myRegistration
  const canRegister = Boolean(currentPeriod) && isAllowedForStudent && (!myRegistration || myRegistration.status === 'cancelled')

  // Real-time WebSocket event listener: server pushes PERIOD_CHANGED instantly
  useWebSocketEvent('PERIOD_CHANGED', () => {
    refetch()
  })

  // Instant event notification across tabs in the same browser
  useEffect(() => {
    const unsubscribe = onPeriodChange(() => {
      refetch()
    })
    const handleFocus = () => refetch()
    window.addEventListener('focus', handleFocus)

    return () => {
      unsubscribe?.()
      window.removeEventListener('focus', handleFocus)
    }
  }, [refetch])

  // Automatically dismiss registration dialog if period is removed while open
  useEffect(() => {
    if (!currentPeriod && isRegisterOpen) {
      setIsRegisterOpen(false)
    }
  }, [currentPeriod, isRegisterOpen])

  const openRegister = () => {
    if (!currentPeriod) {
      toast.error('Semester registration is currently closed. Please check back later.')
      return
    }
    if (!isAllowedForStudent) {
      toast.error(`Registration for ${programLabel} students is not open for this period.`)
      return
    }
    if (myRegistration && myRegistration.status !== 'cancelled') {
      const statusCap = myRegistration.status.charAt(0).toUpperCase() + myRegistration.status.slice(1)
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
            variant={canRegister ? 'default' : 'outline'}
            className={!canRegister ? 'opacity-80' : ''}
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
                        <TableCell>{r.type_label}</TableCell>
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

