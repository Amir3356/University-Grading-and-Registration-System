import { Award, BookOpen, CalendarDays, CheckCircle2, GraduationCap, Megaphone, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { PageSkeleton } from '@/components/common/Loading'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { GradeBadge } from '@/components/common/StatusBadge'
import { useQuery } from '@/hooks/useStore'
import { formatDate, formatGpa, formatPercent, timeAgo } from '@/lib/format'
import { store } from '@/store'
import { GpaTrendChart, StandingBadge } from '../components/StudentWidgets'
import { typeLabel } from '../components/policy'

export function StudentDashboardPage() {
  const { data, loading, error, refetch } = useQuery(() => store.student.getStudentDashboard(), [])
  const announcements = useQuery(() => store.notifications.listAnnouncements({ limit: 4 }), [])
  const progress = useQuery(() => store.student.getMyProgress(), [])

  if (error) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <ErrorState error={error} onRetry={refetch} />
      </>
    )
  }
  if (loading || !data) return <PageSkeleton />

  const sem = data.currentSemester
  const activeCourses = data.currentCourses.filter((c) => c.status !== 'withdrawn')
  const trend = data.trend.map((t) => ({ label: t.term, name: t.semester, gpa: t.gpa, cgpa: t.cgpa }))
  const firstName = data.student.user?.firstName ?? data.student.name

  return (
    <>
      <PageHeader title={`Welcome back, ${firstName}`} description={`${data.student.program} · ${data.student.studentNumber}`} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Courses this semester" value={activeCourses.length} icon={BookOpen} hint={sem?.name} to="/student/courses" />
        <StatCard label="Current semester" value={sem?.term ?? '—'} icon={CalendarDays} tone="teal" hint={sem ? `${sem.name} · ${formatDate(sem.startDate)} – ${formatDate(sem.endDate)}` : null} />
        <StatCard label="Latest semester GPA" value={formatGpa(data.gpa)} icon={TrendingUp} hint={data.gpaSemester ?? 'No published semester yet'} to="/student/grades" />
        <StatCard label="Cumulative GPA" value={formatGpa(data.cgpa)} icon={Award} tone="success" hint={<StandingBadge standing={data.standing} />} to="/student/progress" />
        <StatCard
          label="Credits earned"
          value={data.earnedCredits}
          icon={GraduationCap}
          hint={progress.data ? `of ${progress.data.requiredCredits} programme credits` : 'From passed, published courses'}
          to="/student/progress"
        />
        <StatCard label="Published results" value={data.publishedCount} icon={CheckCircle2} hint="Course results released to you" to="/student/grades" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <GpaTrendChart data={trend} title="Performance across semesters" className="lg:col-span-2" />
        <ProgressMiniCard progress={progress} earned={data.earnedCredits} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Current courses</CardTitle>
              <CardDescription className="mt-1">{sem?.name}</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/student/courses">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {data.currentCourses.length === 0 ? (
              <EmptyState compact icon={BookOpen} title="No courses this semester" description="Courses you are enrolled in for the current semester appear here." />
            ) : (
              <ul className="-my-2 divide-y">
                {data.currentCourses.map((c) => (
                  <li key={c.enrollmentId}>
                    <Link to={`/student/courses/${c.enrollmentId}`} className="flex items-start justify-between gap-3 rounded-md py-2.5 hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {c.course.code} <span className="font-normal text-muted-foreground">· {c.course.title}</span>
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{c.teacher?.name ?? 'Teacher not assigned'}</p>
                      </div>
                      <div className="shrink-0 text-right text-xs text-muted-foreground">
                        <p className="tabular">{c.course.creditHours} cr</p>
                        {c.status === 'withdrawn' && <p>Withdrawn</p>}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Recently released marks</CardTitle>
              <CardDescription className="mt-1">Assessment marks your teachers have released this semester.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/student/assessments">All assessments</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {data.releasedMarks.length === 0 ? (
              <EmptyState compact title="No marks released yet" description="Marks appear here as soon as your teachers release them." />
            ) : (
              <ul className="-my-2 divide-y">
                {data.releasedMarks.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{a.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.courseCode} · {typeLabel(a.type)} · {a.weight}% weight
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="tabular text-sm font-semibold">
                        {a.marks}/{a.maxMarks}
                      </p>
                      <p className="tabular text-xs text-muted-foreground">{formatPercent((a.marks / a.maxMarks) * 100)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Recent results</CardTitle>
              <CardDescription className="mt-1">Latest published course grades.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/student/grades">My grades</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {data.recentResults.length === 0 ? (
              <EmptyState compact icon={Award} title="No published results yet" description="Final grades appear here once they are approved and published." />
            ) : (
              <ul className="-my-2 divide-y">
                {data.recentResults.map((c) => (
                  <li key={c.enrollmentId}>
                    <Link to={`/student/courses/${c.enrollmentId}`} className="flex items-center justify-between gap-3 rounded-md py-2.5 hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {c.course.code} <span className="font-normal text-muted-foreground">· {c.course.title}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {c.semester.name} · published {timeAgo(c.finalGrade.publishedAt)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="tabular text-xs text-muted-foreground">{c.finalGrade.totalScore}</span>
                        <GradeBadge letter={c.finalGrade.letter} passed={c.finalGrade.passed} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Announcements</CardTitle>
          </CardHeader>
          <CardContent>
            {announcements.error ? (
              <ErrorState error={announcements.error} onRetry={announcements.refetch} />
            ) : announcements.loading || !announcements.data ? (
              <div className="space-y-3">
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
              </div>
            ) : announcements.data.length === 0 ? (
              <EmptyState compact icon={Megaphone} title="No announcements" />
            ) : (
              <ul className="-my-2 divide-y">
                {announcements.data.map((a) => (
                  <li key={a.id} className="py-2.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-sm font-medium">{a.title}</p>
                      <span className="shrink-0 text-xs text-muted-foreground">{formatDate(a.createdAt)}</span>
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">{a.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}

function ProgressMiniCard({ progress, earned }) {
  const p = progress.data
  const pct = p?.requiredCredits ? Math.min(100, (earned / p.requiredCredits) * 100) : 0
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Academic progress</CardTitle>
          <CardDescription className="mt-1">Credits earned towards your programme.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        {progress.error ? (
          <ErrorState error={progress.error} onRetry={progress.refetch} />
        ) : progress.loading || !p ? (
          <Skeleton className="h-28" />
        ) : (
          <>
            <div>
              <div className="flex items-baseline justify-between gap-2">
                <p className="tabular text-2xl font-semibold">
                  {earned} <span className="text-sm font-normal text-muted-foreground">/ {p.requiredCredits} credits</span>
                </p>
                <span className="tabular text-sm text-muted-foreground">{formatPercent(pct, 0)}</span>
              </div>
              <Progress value={pct} className="mt-2" aria-label="Credits earned towards programme" />
            </div>
            <dl className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md border px-2 py-2">
                <dt className="text-xs text-muted-foreground">Completed</dt>
                <dd className="tabular font-semibold">{p.completed.length}</dd>
              </div>
              <div className="rounded-md border px-2 py-2">
                <dt className="text-xs text-muted-foreground">In progress</dt>
                <dd className="tabular font-semibold">{p.inProgress.length}</dd>
              </div>
              <div className="rounded-md border px-2 py-2">
                <dt className="text-xs text-muted-foreground">Remaining</dt>
                <dd className="tabular font-semibold">{p.remaining.length}</dd>
              </div>
            </dl>
            {p.failed.length > 0 && (
              <p className="text-xs text-destructive">
                {p.failed.length} course{p.failed.length === 1 ? '' : 's'} to repeat.
              </p>
            )}
            <Button variant="outline" size="sm" className="mt-auto" asChild>
              <Link to="/student/progress">View progress details</Link>
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
