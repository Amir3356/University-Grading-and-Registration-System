import { useState } from 'react'
import {
  AlertTriangle,
  BookOpen,
  Building2,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock,
  GraduationCap,
  Info,
  Megaphone,
  Plus,
  ScrollText,
  TrendingUp,
  UserPlus,
  Users,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ChartCard } from '@/components/charts/ChartCard'
import { axisProps, barRadius, gridProps, legendProps, lineCursor, SERIES, tooltipProps } from '@/components/charts/chart-theme'
import { GradeDistributionChart } from '@/components/charts/GradeDistributionChart'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { FormField } from '@/components/common/FormField'
import { PageSkeleton, TableSkeleton } from '@/components/common/Loading'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { useQuery, useMutation } from '@/hooks/useStore'
import { formatDate, formatDateTime, formatNumber, formatPercent, timeAgo } from '@/lib/format'
import { cn } from '@/lib/utils'
import { store } from '@/store'
import { SelectField } from '../users/SelectField'

const AUDIENCE = [
  { value: 'all', label: 'Everyone' },
  { value: 'student', label: 'Students' },
  { value: 'teacher', label: 'Teachers' },
]
const AUDIENCE_LABEL = Object.fromEntries(AUDIENCE.map((a) => [a.value, a.label]))

const ATTENTION_TONE = {
  danger: { icon: AlertTriangle, cls: 'bg-destructive/10 text-destructive', label: 'Urgent' },
  warning: { icon: Clock, cls: 'bg-warning/15 text-foreground', label: 'Action needed' },
  info: { icon: Info, cls: 'bg-primary/8 text-primary', label: 'Info' },
}

function AnnouncementForm({ onClose }) {
  const [form, setForm] = useState({ title: '', body: '', audience: 'all' })
  const [post, { loading, fieldErrors }] = useMutation((data) => store.notifications.createAnnouncement(data), { success: 'Announcement posted.', onSuccess: onClose })
  const fe = fieldErrors ?? {}
  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        post(form)
      }}
    >
      <FormField label="Title" required error={fe.title}>
        <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={120} />
      </FormField>
      <FormField label="Message" required error={fe.body}>
        <Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={4} />
      </FormField>
      <SelectField label="Audience" required value={form.audience} onChange={(v) => setForm({ ...form, audience: v })} options={AUDIENCE} error={fe.audience} hint="Recipients also receive an in-app notification." />
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" loading={loading}>
          <Megaphone /> Post announcement
        </Button>
      </DialogFooter>
    </form>
  )
}

function Announcements() {
  const [open, setOpen] = useState(false)
  const { data, loading, error, refetch } = useQuery(() => store.notifications.listAnnouncements({ limit: 5 }), [])
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Announcements</CardTitle>
          <CardDescription className="mt-1">Latest messages to students and staff.</CardDescription>
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Plus /> Post
        </Button>
      </CardHeader>
      <CardContent>
        {loading && !data ? (
          <TableSkeleton rows={3} cols={1} />
        ) : error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : !data.length ? (
          <EmptyState compact icon={Megaphone} title="No announcements yet" />
        ) : (
          <ul className="divide-y">
            {data.map((a) => (
              <li key={a.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{a.title}</p>
                  <Badge variant="outline" className="font-normal">
                    {AUDIENCE_LABEL[a.audience] ?? a.audience}
                  </Badge>
                </div>
                <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{a.body}</p>
                <time className="mt-1 block text-xs text-muted-foreground" dateTime={a.createdAt} title={formatDateTime(a.createdAt)}>
                  {formatDate(a.createdAt)}
                </time>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Post announcement</DialogTitle>
            <DialogDescription>Share news with everyone, or only students or teachers.</DialogDescription>
          </DialogHeader>
          <AnnouncementForm onClose={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </Card>
  )
}

export function AdminDashboardPage() {
  const { data, loading, error, refetch } = useQuery(() => store.reports.getAdminDashboard(), [])

  if (loading && !data) return <PageSkeleton />
  if (error)
    return (
      <>
        <PageHeader title="Dashboard" />
        <ErrorState error={error} onRetry={refetch} />
      </>
    )

  const { stats, currentSemester } = data
  const perfHasData = data.performanceTrend.some((p) => p.average != null || p.passRate != null)
  const deptHasData = data.departmentPerformance.some((d) => d.average != null)
  const distTotal = data.distribution.reduce((s, d) => s + d.count, 0)
  const activity = [...data.recentActivity].sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={currentSemester ? `Current semester: ${currentSemester.name} · grade deadline ${formatDate(currentSemester.gradeSubmissionDeadline)}` : 'University overview'}
        actions={
          <Button variant="outline" asChild>
            <Link to="/admin/reports">
              <TrendingUp /> Reports
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active students" value={formatNumber(stats.students)} icon={GraduationCap} to="/admin/users?role=student" />
        <StatCard label="Active teachers" value={formatNumber(stats.teachers)} icon={Users} to="/admin/users?role=teacher" />
        <StatCard label="Departments" value={formatNumber(stats.departments)} icon={Building2} to="/admin/departments" />
        <StatCard label="Active courses" value={formatNumber(stats.courses)} icon={BookOpen} to="/admin/courses" hint={`${formatNumber(stats.currentOfferings)} offered this semester`} />
        <StatCard
          label="Pending approvals"
          value={formatNumber(stats.pendingApprovals)}
          icon={ClipboardCheck}
          tone={stats.pendingApprovals ? 'warning' : 'default'}
          to="/admin/grade-approvals"
          hint={stats.approvedUnpublished ? `${stats.approvedUnpublished} approved, awaiting publication` : 'Grade submissions to review'}
        />
        <StatCard
          label="Overdue grades"
          value={formatNumber(stats.overdueGrades)}
          icon={AlertTriangle}
          tone={stats.overdueGrades ? 'danger' : 'success'}
          to="/admin/reports?tab=missing"
          hint="Past offerings missing final grades"
        />
        <StatCard label="Pass rate" value={formatPercent(stats.passRate)} icon={CheckCircle2} tone="teal" hint={`Average score ${formatPercent(stats.averageScore)} · published grades`} to="/admin/reports" />
        <StatCard label="Current enrollments" value={formatNumber(stats.currentEnrollments)} icon={UserPlus} to="/admin/enrollment" hint={currentSemester?.name} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Needs attention</CardTitle>
              <CardDescription className="mt-1">Items that require an administrator.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {data.attention.length ? (
              <ul className="flex flex-col gap-2">
                {data.attention.map((item) => {
                  const tone = ATTENTION_TONE[item.tone] ?? ATTENTION_TONE.info
                  const Icon = tone.icon
                  return (
                    <li key={item.id}>
                      <Link to={item.link} className="flex items-center gap-3 rounded-md border px-3 py-2.5 hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
                        <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-md', tone.cls)}>
                          <Icon className="size-4" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1 text-sm">
                          <span className="sr-only">{tone.label}: </span>
                          {item.title}
                        </span>
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      </Link>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <EmptyState compact icon={CheckCircle2} title="All clear" description="No pending approvals, unpublished results or overdue grades." />
            )}
          </CardContent>
        </Card>

        <Announcements />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Enrollment trend"
          description="Course enrollments per semester"
          empty={!data.enrollmentTrend.length}
          tableColumns={[
            { key: 'semester', header: 'Semester' },
            { key: 'enrollments', header: 'Enrollments' },
            { key: 'students', header: 'Unique students' },
          ]}
          tableRows={data.enrollmentTrend}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.enrollmentTrend} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="semester" {...axisProps} interval="preserveStartEnd" />
              <YAxis allowDecimals={false} {...axisProps} />
              <Tooltip {...tooltipProps} />
              <Bar dataKey="enrollments" name="Enrollments" fill={SERIES[0]} radius={barRadius} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Academic performance trend"
          description="Average score and pass rate of published grades (%)"
          empty={!perfHasData}
          tableColumns={[
            { key: 'semester', header: 'Semester' },
            { key: 'average', header: 'Average score', format: (v) => formatPercent(v) },
            { key: 'passRate', header: 'Pass rate', format: (v) => formatPercent(v) },
          ]}
          tableRows={data.performanceTrend}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.performanceTrend} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="semester" {...axisProps} interval="preserveStartEnd" />
              <YAxis domain={[0, 100]} {...axisProps} unit="%" />
              <Tooltip {...tooltipProps} cursor={lineCursor} formatter={(v) => formatPercent(v)} />
              <Legend {...legendProps} />
              <Line type="monotone" dataKey="average" name="Average score" stroke={SERIES[0]} strokeWidth={2} dot={{ r: 4 }} connectNulls />
              <Line type="monotone" dataKey="passRate" name="Pass rate" stroke={SERIES[1]} strokeWidth={2} dot={{ r: 4 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Grade distribution"
          description="All published letter grades"
          empty={!distTotal}
          tableColumns={[
            { key: 'letter', header: 'Grade' },
            { key: 'count', header: 'Students' },
          ]}
          tableRows={data.distribution}
        >
          <GradeDistributionChart data={data.distribution} />
        </ChartCard>

        <ChartCard
          title="Department performance"
          description="Average score of published grades by department (%)"
          empty={!deptHasData}
          tableColumns={[
            { key: 'name', header: 'Department' },
            { key: 'average', header: 'Average score', format: (v) => formatPercent(v) },
            { key: 'gpa', header: 'Average grade point', format: (v) => (v == null ? '—' : v.toFixed(2)) },
          ]}
          tableRows={data.departmentPerformance}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.departmentPerformance} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="department" {...axisProps} />
              <YAxis domain={[0, 100]} {...axisProps} />
              <Tooltip {...tooltipProps} labelFormatter={(_l, p) => p?.[0]?.payload?.name ?? _l} formatter={(v) => [formatPercent(v), 'Average score']} />
              <Bar dataKey="average" name="Average score" fill={SERIES[0]} radius={barRadius} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <div>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription className="mt-1">Latest changes across the system.</CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin/audit-logs">
              <ScrollText /> Audit logs
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {activity.length ? (
            <ul className="divide-y">
              {activity.map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <p className="min-w-0 text-sm">
                    <span className="font-medium">{a.userName}</span> <span className="text-muted-foreground">·</span> {a.details}
                  </p>
                  <time className="shrink-0 text-xs text-muted-foreground" dateTime={a.createdAt} title={formatDateTime(a.createdAt)}>
                    {timeAgo(a.createdAt)}
                  </time>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact icon={ScrollText} title="No recent activity" />
          )}
        </CardContent>
      </Card>
    </>
  )
}
