import { AlertTriangle, BookOpen, CalendarClock, ClipboardList, Clock, History, Megaphone, PenLine, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartCard } from '@/components/charts/ChartCard'
import { GradeDistributionChart } from '@/components/charts/GradeDistributionChart'
import { axisProps, barRadius, gridProps, SERIES, tooltipProps } from '@/components/charts/chart-theme'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { PageSkeleton } from '@/components/common/Loading'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { GradeStatusBadge } from '@/components/common/StatusBadge'
import { useAuth } from '@/context/auth-context'
import { useQuery } from '@/hooks/useStore'
import { formatDate, formatPercent, timeAgo } from '@/lib/format'
import { store } from '@/store'
import { typeLabel } from '../lib'

function attentionReason(o, current) {
  if (o.gradeStatus === 'rejected') return { text: 'Returned by the registrar — corrections needed', tone: 'danger' }
  if (current && o.semester.order < current.order) return { text: 'Past semester — grades overdue', tone: 'warning' }
  if (o.gradeStatus === 'not_started') return { text: 'No marks entered yet', tone: 'muted' }
  return { text: 'Draft — not yet submitted', tone: 'secondary' }
}

export function TeacherDashboardPage() {
  const { user } = useAuth()
  const { data, loading, error, refetch } = useQuery(() => store.teacher.getTeacherDashboard(), [])
  const announcements = useQuery(() => store.notifications.listAnnouncements({ limit: 4 }), [])

  if (loading && !data) return <PageSkeleton />
  if (error) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <ErrorState error={error} onRetry={refetch} />
      </>
    )
  }

  const { stats, currentSemester, currentOfferings, pendingOfferings, coursePerformance, distribution, distributionSemester, recentActivity, upcoming } = data
  const perfMissing = new Map(coursePerformance.map((c) => [c.offeringId, c.missingMarks]))
  const distTotal = distribution.reduce((s, d) => s + d.count, 0)

  return (
    <>
      <PageHeader title={`Welcome back, ${user.firstName}`} description={`${currentSemester?.name ?? ''} · Your courses, grading tasks and class performance at a glance.`} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Current courses" value={stats.courses} icon={BookOpen} to="/teacher/courses" hint={currentSemester?.name} />
        <StatCard label="Enrolled students" value={stats.students} icon={Users} tone="teal" to="/teacher/students" hint="Active in current courses" />
        <StatCard
          label="Pending grade submissions"
          value={stats.pendingSubmissions}
          icon={ClipboardList}
          tone={stats.pendingSubmissions ? 'warning' : 'success'}
          to="/teacher/grade-entry"
          hint="Draft, not started or returned"
        />
        <StatCard label="Awaiting approval" value={stats.awaitingApproval} icon={Clock} to="/teacher/grade-submission" hint="Submitted to the registrar" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Current courses</CardTitle>
              <CardDescription className="mt-1">{currentSemester?.name}</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/teacher/courses">All courses</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {currentOfferings.length === 0 ? (
              <EmptyState compact icon={BookOpen} title="No courses this semester" description="Courses assigned to you by the registrar will appear here." />
            ) : (
              <ul className="divide-y rounded-md border">
                {currentOfferings.map((o) => (
                  <li key={o.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <Link to={`/teacher/courses/${o.id}`} className="font-medium hover:underline">
                        {o.course.code} — {o.course.title}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>Section {o.section}</span>
                        <span>{o.enrolledCount} enrolled</span>
                        {perfMissing.get(o.id) ? <span>{perfMissing.get(o.id)} marks missing</span> : null}
                        <GradeStatusBadge status={o.gradeStatus} />
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/teacher/grade-entry/${o.id}`}>
                          <PenLine /> Grades
                        </Link>
                      </Button>
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/teacher/assessments/${o.id}`}>Assessments</Link>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Needs attention</CardTitle>
              <CardDescription className="mt-1">Courses whose grades are not yet submitted.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {pendingOfferings.length === 0 ? (
              <EmptyState compact title="You're all caught up" description="Every course's grades have been submitted." />
            ) : (
              <ul className="space-y-2">
                {pendingOfferings.map((o) => {
                  const reason = attentionReason(o, currentSemester)
                  return (
                    <li key={o.id}>
                      <Link to={`/teacher/grade-entry/${o.id}`} className="block rounded-md border p-3 transition-colors hover:border-teal/50 hover:bg-muted/40">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {o.course.code} — {o.course.title}
                            </p>
                            <p className="text-xs text-muted-foreground">{o.semester.name}</p>
                          </div>
                          <GradeStatusBadge status={o.gradeStatus} />
                        </div>
                        <Badge variant={reason.tone} className="mt-2">
                          {reason.tone === 'danger' || reason.tone === 'warning' ? <AlertTriangle aria-hidden="true" /> : null}
                          {reason.text}
                        </Badge>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Course performance"
          description="Running class average (%) for each current course, based on marks entered so far."
          empty={!coursePerformance.some((c) => c.average != null)}
          emptyText="No marks have been entered for current courses yet."
          tableColumns={[
            { key: 'code', header: 'Course' },
            { key: 'students', header: 'Students' },
            { key: 'average', header: 'Running average', format: (v) => formatPercent(v) },
            { key: 'missingMarks', header: 'Missing marks' },
          ]}
          tableRows={coursePerformance}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={coursePerformance.map((c) => ({ ...c, average: c.average == null ? null : Number(c.average.toFixed(1)) }))} margin={{ top: 16, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="code" {...axisProps} />
              <YAxis domain={[0, 100]} {...axisProps} />
              <Tooltip {...tooltipProps} formatter={(v) => [`${v}%`, 'Running average']} labelFormatter={(l, p) => p?.[0]?.payload?.title ?? l} />
              <Bar dataKey="average" name="Running average" fill={SERIES[0]} radius={barRadius} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title={distributionSemester ? `Grade distribution — ${distributionSemester}` : 'Grade distribution'}
          description="Final letter grades in your most recently published semester."
          empty={!distTotal}
          emptyText="No published grades yet."
          tableColumns={[
            { key: 'letter', header: 'Grade' },
            { key: 'count', header: 'Students' },
          ]}
          tableRows={distribution}
        >
          <GradeDistributionChart data={distribution} />
        </ChartCard>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="size-4 text-muted-foreground" aria-hidden="true" /> Upcoming deadlines
            </CardTitle>
          </CardHeader>
          <CardContent>
            {upcoming.length === 0 ? (
              <EmptyState compact title="No upcoming assessments" />
            ) : (
              <ul className="divide-y">
                {upcoming.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <Link to={`/teacher/assessments/${a.offeringId}`} className="block truncate text-sm font-medium hover:underline">
                        {a.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {a.courseCode} · {typeLabel(a.type)} · {a.weight}%
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground tabular">{formatDate(a.dueDate, 'd MMM')}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="size-4 text-muted-foreground" aria-hidden="true" /> Recent activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <EmptyState compact title="No recent activity" />
            ) : (
              <ul className="space-y-3">
                {recentActivity.map((l) => (
                  <li key={l.id} className="text-sm">
                    <p className="leading-snug">{l.details}</p>
                    <p className="text-xs text-muted-foreground">{timeAgo(l.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="size-4 text-muted-foreground" aria-hidden="true" /> Announcements
            </CardTitle>
          </CardHeader>
          <CardContent>
            {announcements.loading && !announcements.data ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : announcements.error ? (
              <ErrorState error={announcements.error} onRetry={announcements.refetch} />
            ) : !announcements.data?.length ? (
              <EmptyState compact title="No announcements" />
            ) : (
              <ul className="space-y-4">
                {announcements.data.map((a) => (
                  <li key={a.id}>
                    <p className="text-sm font-medium">{a.title}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{a.body}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatDate(a.createdAt)}</p>
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
