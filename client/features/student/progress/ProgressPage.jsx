import { AlertTriangle, Award, BookCheck, Calculator, GraduationCap, Hourglass, ListTodo, RotateCcw } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ChartCard } from '@/components/charts/ChartCard'
import { SERIES, axisProps, barRadius, gridProps, tooltipProps } from '@/components/charts/chart-theme'
import { DataTable } from '@/components/common/DataTable'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { PageSkeleton } from '@/components/common/Loading'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { GradeBadge } from '@/components/common/StatusBadge'
import { useQuery } from '@/hooks/useStore'
import { formatGpa, formatNumber, formatPercent } from '@/lib/format'
import { store } from '@/store'
import { GpaTrendChart, ResultStatus, StandingBadge } from '../components/StudentWidgets'
import { incompletePolicyText, repeatPolicyText, withdrawalPolicyText } from '../components/policy'

export function ProgressPage() {
  const navigate = useNavigate()
  const { data, loading, error, refetch } = useQuery(() => store.student.getMyProgress(), [])

  if (error) {
    return (
      <>
        <PageHeader title="Academic progress" />
        <ErrorState error={error} onRetry={refetch} />
      </>
    )
  }
  if (loading || !data) return <PageSkeleton />

  const p = data
  const pct = p.requiredCredits ? Math.min(100, (p.earnedCredits / p.requiredCredits) * 100) : 0
  const trend = p.semesters.map((s) => ({ label: s.name.replace(/ (\d{2})(\d{2})\/\d{2}(\d{2})$/, ' $2/$3'), name: s.name, gpa: s.gpa, cgpa: s.cgpa }))
  const credits = p.semesters.map((s) => ({ label: trend.find((t) => t.name === s.name)?.label ?? s.name, name: s.name, credits: s.credits }))
  const inProgressCredits = p.inProgress.reduce((s, c) => s + c.course.creditHours, 0)
  const remainingCredits = p.remaining.reduce((s, c) => s + c.creditHours, 0)
  const policy = p.policy

  return (
    <>
      <PageHeader title="Academic progress" description={`${p.student.program} · ${p.student.department?.name ?? ''}`} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Cumulative GPA" value={formatGpa(p.cgpa)} icon={Award} tone="success" hint={<StandingBadge standing={p.standing} />} />
        <StatCard label="Credits earned" value={p.earnedCredits} icon={GraduationCap} hint={`of ${p.requiredCredits} programme credits`} />
        <StatCard label="Courses in progress" value={p.inProgress.length} icon={Hourglass} tone="teal" hint={`${inProgressCredits} credits awaiting results`} />
        <StatCard label="Courses to repeat" value={p.failed.length} icon={RotateCcw} tone={p.failed.length ? 'danger' : 'default'} hint={p.failed.length ? 'Failed and not yet passed' : 'No failed courses'} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Degree progress</CardTitle>
              <CardDescription className="mt-1">Credits earned versus programme requirement.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-baseline justify-between gap-2">
                <p className="tabular text-2xl font-semibold">
                  {p.earnedCredits} <span className="text-sm font-normal text-muted-foreground">/ {p.requiredCredits} credits</span>
                </p>
                <span className="tabular text-sm text-muted-foreground">{formatPercent(pct, 0)}</span>
              </div>
              <Progress value={pct} className="mt-2" aria-label="Credits earned towards programme" />
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Attempted credits</dt>
              <dd className="tabular text-right">{p.attemptedCredits}</dd>
              <dt className="text-muted-foreground">In progress</dt>
              <dd className="tabular text-right">{inProgressCredits}</dd>
              <dt className="text-muted-foreground">Not yet taken</dt>
              <dd className="tabular text-right">{remainingCredits}</dd>
            </dl>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>Academic standing</CardTitle>
              <CardDescription className="mt-1">Based on your cumulative GPA.</CardDescription>
            </div>
            <StandingBadge standing={p.standing} />
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <ul className="grid gap-2 sm:grid-cols-3">
              <li className="rounded-md border px-3 py-2">
                <p className="font-medium">Dean&apos;s List</p>
                <p className="text-muted-foreground">CGPA of {formatGpa(policy.honorsGpa)} or higher</p>
              </li>
              <li className="rounded-md border px-3 py-2">
                <p className="font-medium">Good Standing</p>
                <p className="text-muted-foreground">
                  CGPA from {formatGpa(policy.probationGpa)} to below {formatGpa(policy.honorsGpa)}
                </p>
              </li>
              <li className="rounded-md border px-3 py-2">
                <p className="font-medium">Academic Probation</p>
                <p className="text-muted-foreground">CGPA below {formatGpa(policy.probationGpa)}</p>
              </li>
            </ul>
            {p.standing.tone === 'danger' && (
              <Alert variant="destructive">
                <AlertTriangle aria-hidden="true" />
                <AlertTitle>You are on academic probation</AlertTitle>
                <AlertDescription>Raise your CGPA to at least {formatGpa(policy.probationGpa)} to return to good standing. Repeating failed courses is usually the fastest way.</AlertDescription>
              </Alert>
            )}
            <p className="text-muted-foreground">A course is passed with a total of {policy.passMark} or more out of 100.</p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <GpaTrendChart data={trend} />
        <ChartCard
          title="Credits per semester"
          description="Credit hours counted in each semester's GPA."
          empty={!credits.length}
          emptyText="No published results yet."
          tableColumns={[
            { key: 'name', header: 'Semester' },
            { key: 'credits', header: 'GPA credits' },
          ]}
          tableRows={credits}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={credits} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" />
              <YAxis allowDecimals={false} {...axisProps} />
              <Tooltip {...tooltipProps} labelFormatter={(label, payload) => payload?.[0]?.payload?.name ?? label} />
              <Bar dataKey="credits" name="Credits" fill={SERIES[0]} radius={barRadius} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <Tabs defaultValue="completed" className="mt-6">
        <TabsList>
          <TabsTrigger value="completed">
            <BookCheck aria-hidden="true" /> Completed ({p.completed.length})
          </TabsTrigger>
          <TabsTrigger value="failed">
            <RotateCcw aria-hidden="true" /> Failed ({p.failed.length})
          </TabsTrigger>
          <TabsTrigger value="in-progress">
            <Hourglass aria-hidden="true" /> In progress ({p.inProgress.length})
          </TabsTrigger>
          <TabsTrigger value="remaining">
            <ListTodo aria-hidden="true" /> Remaining ({p.remaining.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="completed">
          <DataTable
            rows={p.completed}
            rowKey={(r) => r.enrollmentId}
            onRowClick={(r) => navigate(`/student/courses/${r.enrollmentId}`)}
            initialSort={{ key: 'semester', dir: 'asc' }}
            emptyTitle="No completed courses yet"
            emptyDescription="Courses you pass appear here once results are published."
            columns={[
              { key: 'courseCode', header: 'Code', className: 'font-medium' },
              { key: 'courseTitle', header: 'Course', className: 'whitespace-normal' },
              { key: 'semester', header: 'Semester', value: (r) => r.semesterOrder, cell: (r) => r.semesterName },
              { key: 'creditHours', header: 'Credits', align: 'right' },
              { key: 'totalScore', header: 'Score', align: 'right', cell: (r) => formatNumber(r.totalScore, 2) },
              { key: 'letter', header: 'Grade', align: 'center', cell: (r) => <GradeBadge letter={r.letter} passed={r.passed} /> },
              { key: 'gradePoints', header: 'Points', align: 'right', cell: (r) => formatGpa(r.gradePoints) },
            ]}
          />
        </TabsContent>

        <TabsContent value="failed">
          {p.failed.length === 0 ? (
            <Card>
              <EmptyState icon={BookCheck} title="No failed courses" description="Well done — every course you have attempted has been passed or is still in progress." />
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {p.failed.map((f) => (
                <Card key={f.course.id}>
                  <CardHeader>
                    <div>
                      <CardTitle>
                        {f.course.code} · {f.course.title}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {f.course.creditHours} credit hours · {f.attempts.length} attempt{f.attempts.length === 1 ? '' : 's'}
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <ul className="divide-y rounded-md border">
                      {f.attempts.map((a) => (
                        <li key={a.enrollmentId} className="flex items-center justify-between gap-3 px-3 py-2">
                          <Link to={`/student/courses/${a.enrollmentId}`} className="text-primary underline-offset-4 hover:underline">
                            {a.semesterName}
                          </Link>
                          <span className="flex items-center gap-2">
                            <span className="tabular text-muted-foreground">{a.special ? '—' : formatNumber(a.totalScore, 2)}</span>
                            <GradeBadge letter={a.letter} passed={a.passed} />
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="text-muted-foreground">
                      {p.inProgress.some((c) => c.course.id === f.course.id)
                        ? 'You are retaking this course now — your new result will replace the failed attempt according to the repeat policy below.'
                        : `Register for ${f.course.code} again to earn its ${f.course.creditHours} credits. ${repeatPolicyText(policy.repeatPolicy)}`}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="in-progress">
          <DataTable
            rows={p.inProgress}
            rowKey={(r) => r.enrollmentId}
            onRowClick={(r) => navigate(`/student/courses/${r.enrollmentId}`)}
            emptyTitle="No courses in progress"
            columns={[
              { key: 'code', header: 'Code', value: (r) => r.course.code, className: 'font-medium' },
              { key: 'title', header: 'Course', value: (r) => r.course.title, className: 'whitespace-normal' },
              { key: 'semester', header: 'Semester', value: (r) => r.semester.name },
              { key: 'credits', header: 'Credits', align: 'right', value: (r) => r.course.creditHours },
              { key: 'teacher', header: 'Teacher', value: (r) => r.teacher?.name },
              { key: 'result', header: 'Result', value: (r) => r.resultStatus, cell: (r) => <ResultStatus course={r} /> },
            ]}
          />
        </TabsContent>

        <TabsContent value="remaining">
          <DataTable
            rows={p.remaining}
            emptyTitle="Nothing left to take"
            emptyDescription="You have passed or are taking every course in your programme."
            initialSort={{ key: 'level', dir: 'asc' }}
            columns={[
              { key: 'code', header: 'Code', className: 'font-medium' },
              { key: 'title', header: 'Course', className: 'whitespace-normal' },
              { key: 'level', header: 'Level', align: 'right' },
              { key: 'creditHours', header: 'Credits', align: 'right' },
            ]}
          />
        </TabsContent>
      </Tabs>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calculator className="size-4 text-muted-foreground" aria-hidden="true" />
              <CardTitle>How your GPA is calculated</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="rounded-md bg-muted px-3 py-2 text-center font-medium">GPA = Σ (grade points × credit hours) ÷ Σ credit hours</p>
            <p className="text-muted-foreground">
              Each published course gives grade points for its letter grade (for example A = 4.00). Multiply them by the course&apos;s credit hours to get quality points, add these up and divide by
              the credit hours counted. Your semester GPA uses that semester&apos;s courses; your cumulative GPA (CGPA) uses all of them.
            </p>
            <p className="tabular">
              Your CGPA: {formatNumber(p.qualityPoints, 2)} quality points ÷ {p.gpaCredits} credit hours = <span className="font-semibold">{formatGpa(p.cgpa)}</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Repeats, incompletes and withdrawals</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              <li>{repeatPolicyText(policy.repeatPolicy)}</li>
              <li>{incompletePolicyText(policy.incompletePolicy)}</li>
              <li>{withdrawalPolicyText(policy.withdrawalPolicy)}</li>
              <li>Credits are earned once, the first time you pass a course; only published results count.</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
