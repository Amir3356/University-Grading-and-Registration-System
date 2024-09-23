import { useState } from 'react'
import { CalendarClock, Info, LogOut, Mail, MapPin, User } from 'lucide-react'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { PageSkeleton } from '@/components/common/Loading'
import { PageHeader } from '@/components/common/PageHeader'
import { GradeBadge, PassFailBadge, StatusBadge } from '@/components/common/StatusBadge'
import { useQuery } from '@/hooks/useStore'
import { formatDate, formatGpa, formatNumber, formatPercent } from '@/lib/format'
import { store } from '@/store'
import { RESULT_STATUS_LABELS, todayIso, typeLabel } from '../components/policy'

export function CourseDetailPage() {
  const { enrollmentId } = useParams()
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false)
  const [withdrawReason, setWithdrawReason] = useState('')
  const [withdrawalPending, setWithdrawalPending] = useState(false)
  const { data, loading, error, refetch } = useQuery(() => store.student.getMyCourse(enrollmentId), [enrollmentId])

  if (error) {
    return (
      <>
        <PageHeader title="Course" backTo="/student/courses" backLabel="My courses" />
        <ErrorState error={error} onRetry={refetch} />
      </>
    )
  }
  if (loading || !data) return <PageSkeleton />

  const c = data
  const today = todayIso()
  const assessedWeight = c.assessments.filter((a) => a.marks != null).reduce((s, a) => s + Number(a.weight), 0)

  const handleWithdrawSubmit = (e) => {
    e.preventDefault()
    if (!withdrawReason.trim()) {
      toast.error('Please enter a reason for withdrawal.')
      return
    }
    setWithdrawalPending(true)
    setIsWithdrawOpen(false)
    toast.success(`Withdrawal request submitted for ${c.course.code}. Awaiting staff approval.`)
  }

  return (
    <>
      <PageHeader
        title={`${c.course.code} · ${c.course.title}`}
        description={`${c.semester.name} · Section ${c.section} · ${c.course.creditHours} credit hours`}
        backTo="/student/courses"
        backLabel="My courses"
        actions={
          c.status !== 'withdrawn' && (
            <div className="flex items-center gap-2">
              {withdrawalPending ? (
                <Badge variant="warning">Withdrawal Pending</Badge>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setIsWithdrawOpen(true)}
                >
                  Request Withdrawal
                </Button>
              )}
            </div>
          )
        }
      >
        <div className="mt-2 flex flex-wrap gap-2">
          <StatusBadge status={c.status} />
          {c.isRepeat && <Badge variant="outline">Repeat attempt</Badge>}
        </div>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Course information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {c.course.description && <p className="text-muted-foreground">{c.course.description}</p>}
            <dl className="space-y-2">
              <Row icon={CalendarClock} label="Schedule" value={c.schedule} />
              <Row icon={MapPin} label="Room" value={c.room} />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Teacher</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {c.teacher ? (
              <dl className="space-y-2">
                <Row icon={User} label="Name" value={c.teacher.name} />
                <div className="flex items-start gap-2">
                  <Mail className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <dt className="sr-only">Email</dt>
                  <dd className="min-w-0 break-all">
                    {c.teacher.email ? (
                      <a href={`mailto:${c.teacher.email}`} className="text-primary underline-offset-4 hover:underline">
                        {c.teacher.email}
                      </a>
                    ) : (
                      '—'
                    )}
                  </dd>
                </div>
                <Row icon={MapPin} label="Office" value={c.teacher.officeRoom ? `Office ${c.teacher.officeRoom}` : null} />
              </dl>
            ) : (
              <p className="text-muted-foreground">No teacher assigned yet.</p>
            )}
          </CardContent>
        </Card>

        <FinalGradeCard course={c} />
      </div>

      <Card className="mt-6 gap-3 pb-0">
        <CardHeader>
          <div>
            <CardTitle>Assessment components</CardTitle>
            <CardDescription className="mt-1">Weights are always visible. Marks appear once your teacher releases them.</CardDescription>
          </div>
        </CardHeader>
        {c.assessments.length === 0 ? (
          <EmptyState compact title="No assessments defined yet" description="Your teacher has not set up the assessment components for this course." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Assessment</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Weight</TableHead>
                <TableHead className="text-right">Max marks</TableHead>
                <TableHead>Due date</TableHead>
                <TableHead className="text-right">Mark</TableHead>
                <TableHead className="text-right">Percent</TableHead>
                <TableHead className="text-right">Weighted points</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {c.assessments.map((a) => {
                const has = a.marks != null
                const pct = has ? (a.marks / a.maxMarks) * 100 : null
                return (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell>{typeLabel(a.type)}</TableCell>
                    <TableCell className="tabular text-right">{formatNumber(a.weight, 0)}%</TableCell>
                    <TableCell className="tabular text-right">{a.maxMarks}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-2">
                        {formatDate(a.dueDate)}
                        {a.dueDate >= today && !has && <Badge variant="info">Upcoming</Badge>}
                      </span>
                    </TableCell>
                    <TableCell className="tabular text-right">
                      {has ? (
                        <span className="font-medium">
                          {a.marks}/{a.maxMarks}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">{a.isReleased ? 'No mark' : 'Not released'}</span>
                      )}
                    </TableCell>
                    <TableCell className="tabular text-right">{formatPercent(pct)}</TableCell>
                    <TableCell className="tabular text-right">{has ? formatNumber((pct / 100) * a.weight, 2) : '—'}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
            <TableFooter>
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={2}>Total</TableCell>
                <TableCell className="tabular text-right">{formatNumber(c.weightTotal, 0)}%</TableCell>
                <TableCell colSpan={4} />
                <TableCell className="tabular text-right">{formatNumber(c.earnedWeighted, 2)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        )}
      </Card>

      {c.assessments.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Your standing so far</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <Metric label="Weighted points earned" value={formatNumber(c.earnedWeighted, 2)} hint={`out of ${formatNumber(assessedWeight, 0)} assessed so far (of ${formatNumber(c.weightTotal, 0)})`} />
            <Metric label="Running percentage" value={formatPercent(c.runningPercent)} hint="Your score on the work marked so far" />
            <Metric label="Weight still to come" value={`${formatNumber(Math.max(0, c.weightTotal - assessedWeight), 0)}%`} hint="Assessments not yet marked or released" />
            <p className="text-sm text-muted-foreground sm:col-span-3">
              Each assessment contributes <span className="font-medium text-foreground">(mark ÷ max marks) × weight</span> points to your course total out of 100. The running percentage divides the points
              you have earned by the weight assessed so far, so it shows how you are doing on released work only. It is an estimate — your official grade is the published final result.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Course Withdrawal Request Dialog */}
      <Dialog open={isWithdrawOpen} onOpenChange={setIsWithdrawOpen}>
        <DialogContent size="md">
          <form onSubmit={handleWithdrawSubmit}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <LogOut className="h-5 w-5" />
                Request Course Withdrawal
              </DialogTitle>
              <DialogDescription>
                Request to withdraw from {c.course.code} — {c.course.title}.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-3">
              <Alert variant="destructive" className="text-xs">
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Withdrawing from this course requires authorized university approval. Upon approval, your status will reflect as Withdrawn.
                </AlertDescription>
              </Alert>

              <div className="space-y-1.5">
                <label htmlFor="course-withdraw-reason" className="text-xs font-semibold text-foreground">
                  Reason for Course Withdrawal <span className="text-destructive">*</span>
                </label>
                <Textarea
                  id="course-withdraw-reason"
                  placeholder="Explain why you wish to withdraw from this course..."
                  value={withdrawReason}
                  onChange={(e) => setWithdrawReason(e.target.value)}
                  rows={4}
                  required
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsWithdrawOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive">
                Submit Course Withdrawal
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

function FinalGradeCard({ course: c }) {
  const fg = c.finalGrade
  return (
    <Card>
      <CardHeader>
        <CardTitle>Final grade</CardTitle>
      </CardHeader>
      <CardContent>
        {fg ? (
          <div className="space-y-3">
            <div className="flex items-center gap-4">
              <GradeBadge letter={fg.letter} passed={fg.passed} className="min-w-14 px-3 py-1.5 text-lg" />
              <div>
                <p className="tabular text-2xl font-semibold">{fg.special ? '—' : formatNumber(fg.totalScore, 2)}</p>
                <p className="text-xs text-muted-foreground">Total score out of 100</p>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Grade points</dt>
                <dd className="tabular font-medium">{fg.special ? '—' : formatGpa(fg.gradePoints)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Result</dt>
                <dd>{fg.special ? <Badge variant="muted">{fg.special === 'W' ? 'Withdrawn' : 'Incomplete'}</Badge> : <PassFailBadge passed={fg.passed} />}</dd>
              </div>
            </dl>
            <p className="text-xs text-muted-foreground">Published {formatDate(fg.publishedAt)}</p>
          </div>
        ) : (
          <Alert variant="info">
            <Info aria-hidden="true" />
            <AlertTitle>{RESULT_STATUS_LABELS[c.resultStatus]}</AlertTitle>
            <AlertDescription>
              {c.resultStatus === 'withdrawn' ? 'You withdrew from this course.' : 'Your final grade will appear here once it has been approved and published.'}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}

function Row({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <dt className="sr-only">{label}</dt>
      <dd className="min-w-0">{value || '—'}</dd>
    </div>
  )
}

function Metric({ label, value, hint }) {
  return (
    <div className="rounded-md border px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="tabular mt-1 text-xl font-semibold">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
