import { useState, useEffect } from 'react'
import { Plus, UserCheck, Pencil, Trash2 } from 'lucide-react'
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
import { useAuth } from '@/context/auth-context'
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

  const [freshStudentOverride, setFreshStudentOverride] = useState(null)

  const currentPeriod = data?.currentPeriod ?? null
  const upcomingPeriod = data?.upcomingPeriod ?? null
  const history = data?.history ?? []

  const [isRegisterOpen, setIsRegisterOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [cafeStatus, setCafeStatus] = useState('cafe')
  const [editingRegistration, setEditingRegistration] = useState(null)
  const [deleteConfirmRegistration, setDeleteConfirmRegistration] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)

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

  const cd = useRegistrationCountdown(currentPeriod?.start_date, currentPeriod?.deadline)
  const isPeriodClosed = cd.status === 'ended' || cd.status === 'expired'

  const myRegistration = currentPeriod?.myRegistration
  const canRegister = Boolean(currentPeriod) && !isPeriodClosed && isAllowedForStudent && (!myRegistration || myRegistration.status === 'cancelled')

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

  // Automatically dismiss registration dialog if period is removed or student is not allowed
  useEffect(() => {
    if ((!currentPeriod || !isAllowedForStudent) && isRegisterOpen && !editingRegistration) {
      setIsRegisterOpen(false)
    }
  }, [currentPeriod, isAllowedForStudent, isRegisterOpen, editingRegistration])

  const openRegister = () => {
    if (!currentPeriod || isPeriodClosed) {
      toast.error('The registration deadline has passed. Semester registration is closed.')
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
    setEditingRegistration(null)
    setCafeStatus('cafe')
    setIsRegisterOpen(true)
  }

  const handleOpenEdit = (registration) => {
    if (isPeriodClosed) {
      toast.error('The registration deadline has passed. Registration details can no longer be edited.')
      return
    }
    setEditingRegistration(registration)
    setCafeStatus(registration.cafe_status === 'non_cafe' || registration.cafe_status === 'non-cafe' ? 'non-cafe' : 'cafe')
    setIsRegisterOpen(true)
  }

  const handleRegisterSubmit = async (e) => {
    e.preventDefault()
    if (isPeriodClosed) {
      toast.error('The registration deadline has passed. Registration is closed.')
      setIsRegisterOpen(false)
      return
    }
    setSubmitting(true)
    try {
      if (editingRegistration) {
        await updateStudentRegistrationApi(editingRegistration.id, {
          cafeStatus,
        })
        toast.success(`Registration updated for ${editingRegistration.semester_name}.`)
      } else {
        if (!currentPeriod) {
          toast.error('Semester registration is closed.')
          return
        }
        if (!isAllowedForStudent) {
          toast.error(`Registration for ${programLabel} students is not open for this period.`)
          return
        }
        await submitStudentRegistrationApi({
          semesterId: currentPeriod.semester_id,
          registrationTypeId: studentProgramType,
          cafeStatus,
        })
        toast.success(`Registration submitted for ${currentPeriod.semester_name}. It is now pending approval.`)
      }
      setIsRegisterOpen(false)
      setEditingRegistration(null)
      refetch()
    } catch (err) {
      toast.error(err?.message || (editingRegistration ? 'Failed to update registration.' : 'Failed to submit registration.'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteConfirmRegistration) return
    if (isPeriodClosed) {
      toast.error('The registration deadline has passed. Registration can no longer be deleted.')
      setDeleteConfirmRegistration(null)
      return
    }
    setIsDeleting(true)
    try {
      await deleteStudentRegistrationApi(deleteConfirmRegistration.id)
      toast.success('Registration deleted.')
      refetch()
      setDeleteConfirmRegistration(null)
    } catch (err) {
      try {
        await cancelStudentRegistrationApi(deleteConfirmRegistration.id)
        toast.success('Registration cancelled.')
        refetch()
        setDeleteConfirmRegistration(null)
      } catch (cancelErr) {
        toast.error(err?.message || cancelErr?.message || 'Failed to delete registration.')
      }
    } finally {
      setIsDeleting(false)
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
                      <TableHead className="text-right w-[110px]">Actions</TableHead>
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
                            <div className="flex items-center justify-end gap-1">
                              {!isPeriodClosed ? (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    className="text-primary hover:text-primary hover:bg-primary/10"
                                    title="Edit registration"
                                    aria-label={`Edit registration for ${r.semester_name}`}
                                    onClick={() => handleOpenEdit(r)}
                                  >
                                    <Pencil className="size-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                    title="Delete registration"
                                    aria-label={`Delete registration for ${r.semester_name}`}
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
                ? `Update your meal service choice for ${editingRegistration.semester_name}. Other fields are locked.`
                : 'Confirm your registration for the active semester. Your program is automatically applied based on your account enrollment.'}
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
                  editingRegistration
                    ? `${editingRegistration.semester_name} (${editingRegistration.academic_year_name})`
                    : currentPeriod
                    ? `${currentPeriod.semester_name} (${currentPeriod.academic_year_name})`
                    : ''
                }
                disabled
                className="input cursor-not-allowed bg-muted text-muted-foreground w-full"
              />
            </FormField>

            <FormField label="Assigned Program / Registration Type">
              <input
                type="text"
                value={editingRegistration ? editingRegistration.type_label : programLabel}
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
              <Button type="submit" disabled={submitting}>
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
            ? `Are you sure you want to delete your pending registration for ${deleteConfirmRegistration.semester_name}? You can re-register anytime while the semester registration period is open.`
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

