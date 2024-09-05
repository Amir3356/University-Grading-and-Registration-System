import { useState } from 'react'
import { AlertTriangle, Award, BookOpen, ClipboardList, FileText, GraduationCap, LineChart, Percent, TrendingDown, Users } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ChartCard } from '@/components/charts/ChartCard'
import { GradeDistributionChart } from '@/components/charts/GradeDistributionChart'
import { SERIES, axisProps, barRadius, gridProps, legendProps, tooltipProps } from '@/components/charts/chart-theme'
import { DataTable } from '@/components/common/DataTable'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { ExportMenu } from '@/components/common/ExportMenu'
import { FilterSelect } from '@/components/common/FilterSelect'
import { PageSkeleton, TableSkeleton } from '@/components/common/Loading'
import { PageHeader } from '@/components/common/PageHeader'
import { Pagination } from '@/components/common/Pagination'
import { SearchInput } from '@/components/common/SearchInput'
import { StatCard } from '@/components/common/StatCard'
import { GradeStatusBadge } from '@/components/common/StatusBadge'
import { useLookups } from '@/context/lookups-context'
import { useQuery } from '@/hooks/useStore'
import { useDebounce } from '@/hooks/useDebounce'
import { formatDate, formatGpa, formatNumber, formatPercent, GRADE_STATUS_LABELS } from '@/lib/format'
import { store } from '@/store'
import { distributionColumns } from './grade-sheet-utils'

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'courses', label: 'Course results' },
  { value: 'gpa', label: 'GPA & standing' },
  { value: 'missing', label: 'Missing grades' },
  { value: 'transcripts', label: 'Transcripts' },
]

export function ReportsPage() {
  const lookups = useLookups()
  const [params, setParams] = useSearchParams()
  const tab = TABS.some((t) => t.value === params.get('tab')) ? params.get('tab') : 'overview'
  const [semesterId, setSemesterId] = useState('')
  const [departmentId, setDepartmentId] = useState('')

  if (!lookups) return <PageSkeleton />

  const semesterName = lookups.semesters.find((s) => s.id === semesterId)?.name ?? 'All semesters'
  const departmentName = lookups.departments.find((d) => d.id === departmentId)?.name ?? 'All departments'
  const usesSemester = ['overview', 'courses', 'missing'].includes(tab)
  const usesDepartment = ['overview', 'courses', 'gpa', 'transcripts'].includes(tab)
  const ctx = { semesterId, departmentId, university: lookups.university, semesterName, departmentName }

  return (
    <>
      <PageHeader title="Reports" description="Academic performance, results, GPA, missing grades and transcripts." />
      <Tabs
        value={tab}
        onValueChange={(v) => {
          const next = new URLSearchParams(params)
          next.set('tab', v)
          setParams(next, { replace: true })
        }}
        className="mb-4"
      >
        <TabsList>
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <FilterSelect
          value={semesterId}
          onChange={setSemesterId}
          options={lookups.semesters.map((s) => ({ value: s.id, label: s.name }))}
          allLabel="All semesters"
          label="Semester"
          className="sm:w-56"
        />
        <FilterSelect
          value={departmentId}
          onChange={setDepartmentId}
          options={lookups.departments.map((d) => ({ value: d.id, label: d.name }))}
          allLabel="All departments"
          label="Department"
          className="sm:w-60"
        />
        {(!usesSemester || !usesDepartment) && (
          <p className="text-xs text-muted-foreground">
            {!usesSemester ? 'The semester filter does not apply to this report.' : 'The department filter does not apply to this report.'}
          </p>
        )}
      </div>

      {tab === 'overview' && <OverviewTab {...ctx} />}
      {tab === 'courses' && <CoursesTab {...ctx} />}
      {tab === 'gpa' && <GpaTab {...ctx} />}
      {tab === 'missing' && <MissingTab {...ctx} />}
      {tab === 'transcripts' && <TranscriptsTab {...ctx} />}
    </>
  )
}

const filterSubtitle = ({ semesterName, departmentName }) => `${semesterName} · ${departmentName}`

// ---------------- Overview ----------------
function OverviewTab({ semesterId, departmentId, university, semesterName, departmentName }) {
  const dept = useQuery(() => store.reports.getDepartmentReport({ semesterId: semesterId || undefined }), [semesterId])
  const dist = useQuery(() => store.reports.getGradeDistributionReport({ semesterId: semesterId || undefined, departmentId: departmentId || undefined }), [semesterId, departmentId])

  if ((dept.loading && !dept.data) || (dist.loading && !dist.data)) return <PageSkeleton />
  if (dept.error) return <ErrorState error={dept.error} onRetry={dept.refetch} />
  if (dist.error) return <ErrorState error={dist.error} onRetry={dist.refetch} />

  const rows = dept.data.filter((d) => !departmentId || d.departmentId === departmentId)
  const chartRows = rows.map((d) => ({ department: d.code, name: d.name, passRate: d.passRate, averageScore: d.averageScore }))
  const d = dist.data

  const columns = [
    { key: 'code', header: 'Code', cell: (r) => <span className="font-medium">{r.code}</span> },
    { key: 'name', header: 'Department' },
    { key: 'students', header: 'Students', align: 'right' },
    { key: 'grades', header: 'Graded results', align: 'right' },
    { key: 'averageScore', header: 'Average score', align: 'right', cell: (r) => formatNumber(r.averageScore, 1) },
    { key: 'averageGradePoint', header: 'Avg grade point', align: 'right', cell: (r) => formatGpa(r.averageGradePoint) },
    { key: 'passRate', header: 'Pass rate', align: 'right', cell: (r) => formatPercent(r.passRate) },
    { key: 'passed', header: 'Passed', align: 'right' },
    { key: 'failed', header: 'Failed', align: 'right' },
    { key: 'averageCgpa', header: 'Avg CGPA', align: 'right', cell: (r) => formatGpa(r.averageCgpa) },
  ]

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Published results" value={formatNumber(d.total)} icon={ClipboardList} hint={filterSubtitle({ semesterName, departmentName })} />
        <StatCard label="Average score" value={formatNumber(d.averageScore, 1)} icon={Award} tone="teal" />
        <StatCard label="Withdrawals (W)" value={formatNumber(d.withdrawn)} icon={TrendingDown} />
        <StatCard label="Incompletes (I)" value={formatNumber(d.incomplete)} icon={AlertTriangle} tone={d.incomplete ? 'warning' : 'default'} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Department performance"
          description="Pass rate and average score (%) of published results."
          tableColumns={[
            { key: 'department', header: 'Department' },
            { key: 'passRate', header: 'Pass rate', format: (v) => formatPercent(v) },
            { key: 'averageScore', header: 'Average score', format: (v) => formatNumber(v, 1) },
          ]}
          tableRows={chartRows}
          empty={!chartRows.some((r) => r.passRate != null)}
          emptyText="No published results for this selection."
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartRows} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barCategoryGap="24%">
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="department" {...axisProps} />
              <YAxis domain={[0, 100]} {...axisProps} />
              <Tooltip {...tooltipProps} formatter={(v, n) => [n === 'Pass rate' ? formatPercent(v) : formatNumber(v, 1), n]} labelFormatter={(l, p) => p?.[0]?.payload?.name ?? l} />
              <Legend {...legendProps} />
              <Bar dataKey="passRate" name="Pass rate" fill={SERIES[0]} radius={barRadius} maxBarSize={32} />
              <Bar dataKey="averageScore" name="Average score" fill={SERIES[1]} radius={barRadius} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard
          title="Grade distribution"
          description={`Published letter grades · ${filterSubtitle({ semesterName, departmentName })}`}
          tableColumns={distributionColumns}
          tableRows={d.distribution}
          empty={!d.total}
          emptyText="No published grades for this selection."
        >
          <GradeDistributionChart data={d.distribution} />
        </ChartCard>
      </div>
      <Card className="py-4">
        <CardContent>
          <h2 className="mb-3 text-base font-semibold">Department summary</h2>
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(r) => r.departmentId}
            exportName="department_performance"
            exportTitle="Department performance report"
            exportSubtitle={filterSubtitle({ semesterName, departmentName })}
            university={university}
            paginate={false}
            searchPlaceholder="Search departments…"
          />
        </CardContent>
      </Card>
    </div>
  )
}

// ---------------- Course results ----------------
function CoursesTab({ semesterId, departmentId, university, semesterName, departmentName }) {
  const navigate = useNavigate()
  const { data, loading, error, refetch } = useQuery(
    () => store.reports.getCourseResultsReport({ semesterId: semesterId || undefined, departmentId: departmentId || undefined }),
    [semesterId, departmentId],
  )
  const graded = (data ?? []).filter((r) => r.passRate != null)
  const totalPassed = graded.reduce((s, r) => s + r.passed, 0)
  const totalFailed = graded.reduce((s, r) => s + r.failed, 0)

  const columns = [
    {
      key: 'courseCode',
      header: 'Course',
      value: (r) => `${r.courseCode} — ${r.courseTitle}`,
      cell: (r) => (
        <div>
          <div className="font-medium">{r.courseCode}</div>
          <div className="max-w-56 truncate text-xs text-muted-foreground">{r.courseTitle}</div>
        </div>
      ),
    },
    { key: 'semesterName', header: 'Semester', value: (r) => r.semesterName, cell: (r) => <span className="whitespace-nowrap">{r.semesterName}</span> },
    { key: 'teacherName', header: 'Teacher', cell: (r) => <span className="whitespace-nowrap">{r.teacherName ?? '—'}</span> },
    { key: 'gradeStatus', header: 'Grade status', value: (r) => GRADE_STATUS_LABELS[r.gradeStatus] ?? r.gradeStatus, cell: (r) => <GradeStatusBadge status={r.gradeStatus} /> },
    { key: 'students', header: 'Students', align: 'right' },
    { key: 'average', header: 'Average', align: 'right', cell: (r) => formatNumber(r.average, 1) },
    { key: 'passRate', header: 'Pass rate', align: 'right', cell: (r) => formatPercent(r.passRate) },
    { key: 'passed', header: 'Passed', align: 'right' },
    { key: 'failed', header: 'Failed', align: 'right' },
    { key: 'highest', header: 'Highest', align: 'right', cell: (r) => formatNumber(r.highest, 1) },
    { key: 'lowest', header: 'Lowest', align: 'right', cell: (r) => formatNumber(r.lowest, 1) },
  ]

  return (
    <div className="grid gap-6">
      {data && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Course offerings" value={formatNumber(data.length)} icon={BookOpen} hint={filterSubtitle({ semesterName, departmentName })} />
          <StatCard label="With complete results" value={formatNumber(graded.length)} icon={ClipboardList} tone="teal" />
          <StatCard label="Overall pass rate" value={totalPassed + totalFailed ? formatPercent((totalPassed / (totalPassed + totalFailed)) * 100) : '—'} icon={Percent} tone="success" />
          <StatCard label="Students failed" value={formatNumber(totalFailed)} icon={TrendingDown} tone={totalFailed ? 'warning' : 'default'} />
        </div>
      )}
      <DataTable
        columns={columns}
        rows={data}
        loading={loading}
        error={error}
        onRetry={refetch}
        rowKey={(r) => r.offeringId}
        onRowClick={(r) => navigate(`/admin/reports/grade-sheet/${r.offeringId}`)}
        exportName="course_results"
        exportTitle="Course results — pass / fail rates"
        exportSubtitle={filterSubtitle({ semesterName, departmentName })}
        university={university}
        searchPlaceholder="Search course or teacher…"
        emptyTitle="No course offerings"
        emptyDescription="No offerings match the selected semester and department."
      />
      <p className="-mt-3 text-xs text-muted-foreground">Select a course to open its full grade sheet.</p>
    </div>
  )
}

// ---------------- GPA ----------------
const STANDINGS = ["Dean's List", 'Good Standing', 'Academic Probation', 'No GPA yet'].map((s) => ({ value: s, label: s }))
const SORTS = [
  { value: 'cgpa:desc', label: 'CGPA (high → low)' },
  { value: 'cgpa:asc', label: 'CGPA (low → high)' },
  { value: 'semesterGpa:desc', label: 'Latest GPA (high → low)' },
  { value: 'name:asc', label: 'Name (A → Z)' },
  { value: 'earnedCredits:desc', label: 'Credits earned' },
]
const standingVariant = (tone) => (tone === 'danger' ? 'danger' : tone === 'success' ? 'success' : tone === 'muted' ? 'muted' : 'secondary')

const gpaExportColumns = [
  { header: 'Student ID', value: (r) => r.studentNumber },
  { header: 'Name', value: (r) => r.name },
  { header: 'Department', value: (r) => r.department },
  { header: 'Programme', value: (r) => r.program },
  { header: 'Admission year', value: (r) => r.admissionYear },
  { header: 'Latest semester', value: (r) => r.semesterName ?? '' },
  { header: 'Semester GPA', value: (r) => formatGpa(r.semesterGpa) },
  { header: 'CGPA', value: (r) => formatGpa(r.cgpa) },
  { header: 'Credits earned', value: (r) => r.earnedCredits },
  { header: 'Standing', value: (r) => r.standing },
]

function GpaTab({ departmentId, university, departmentName }) {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [standing, setStanding] = useState('')
  const [sort, setSort] = useState('cgpa:desc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const q = useDebounce(search, 300)
  const [key, dir] = sort.split(':')
  const { data, loading, error, refetch } = useQuery(
    () => store.reports.getGpaReport({ departmentId: departmentId || undefined, search: q, standing: standing || undefined, page, pageSize, sort: { key, dir } }),
    [departmentId, q, standing, page, pageSize, key, dir],
  )
  const reset = (fn) => (v) => {
    fn(v)
    setPage(1)
  }

  return (
    <div className="grid gap-6">
      {data && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Students" value={formatNumber(data.total)} icon={Users} hint={departmentName} />
          <StatCard label="Average CGPA" value={formatGpa(data.summary.averageCgpa)} icon={GraduationCap} tone="teal" />
          <StatCard label="Dean's list" value={formatNumber(data.summary.deansList)} icon={Award} tone="success" />
          <StatCard label="On probation" value={formatNumber(data.summary.probation)} icon={AlertTriangle} tone={data.summary.probation ? 'danger' : 'default'} />
        </div>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchInput value={search} onChange={reset(setSearch)} placeholder="Search name or student ID…" />
        <FilterSelect value={standing} onChange={reset(setStanding)} options={STANDINGS} allLabel="All standings" label="Academic standing" />
        <FilterSelect value={sort} onChange={reset(setSort)} options={SORTS} includeAll={false} label="Sort by" className="sm:w-52" />
        <div className="sm:ml-auto">
          <ExportMenu
            filename="gpa_report"
            title="GPA & academic standing report"
            subtitle={`${departmentName}${standing ? ` · ${standing}` : ''}`}
            columns={gpaExportColumns}
            rows={data?.all ?? []}
            university={university}
            disabled={!data?.all?.length}
          />
        </div>
      </div>
      {loading && !data ? (
        <TableSkeleton cols={6} />
      ) : error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : !data.items.length ? (
        <Card>
          <EmptyState icon={GraduationCap} title="No students found" description="Try a different search, standing or department." />
        </Card>
      ) : (
        <div>
          <div className="overflow-hidden rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Student</TableHead>
                  <TableHead>Dept.</TableHead>
                  <TableHead>Latest semester</TableHead>
                  <TableHead className="text-right">Sem. GPA</TableHead>
                  <TableHead className="text-right">CGPA</TableHead>
                  <TableHead className="text-right">Credits</TableHead>
                  <TableHead>Standing</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((r) => (
                  <TableRow
                    key={r.studentId}
                    tabIndex={0}
                    className="cursor-pointer focus-visible:bg-muted focus-visible:outline-none"
                    onClick={() => navigate(`/admin/reports/students/${r.studentId}`)}
                    onKeyDown={(e) => e.key === 'Enter' && navigate(`/admin/reports/students/${r.studentId}`)}
                  >
                    <TableCell>
                      <div className="font-medium whitespace-nowrap">{r.name}</div>
                      <div className="text-xs text-muted-foreground tabular">{r.studentNumber}</div>
                    </TableCell>
                    <TableCell>{r.department}</TableCell>
                    <TableCell className="whitespace-nowrap">{r.semesterName ?? '—'}</TableCell>
                    <TableCell className="text-right tabular">{formatGpa(r.semesterGpa)}</TableCell>
                    <TableCell className="text-right font-semibold tabular">{formatGpa(r.cgpa)}</TableCell>
                    <TableCell className="text-right tabular">{r.earnedCredits}</TableCell>
                    <TableCell>
                      <Badge variant={standingVariant(r.standingTone)}>{r.standing}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} onPageSizeChange={reset(setPageSize)} pageSizes={[10, 20, 50, 100]} />
        </div>
      )}
    </div>
  )
}

// ---------------- Missing grades ----------------
function MissingTab({ semesterId, university, semesterName }) {
  const navigate = useNavigate()
  const { data, loading, error, refetch } = useQuery(() => store.reports.getMissingGradesReport({ semesterId: semesterId || undefined }), [semesterId])
  const overdue = (data ?? []).filter((r) => r.overdue).length
  const missing = (data ?? []).reduce((s, r) => s + r.missingMarks, 0)
  const badWeights = (data ?? []).filter((r) => r.weightTotal !== 100).length

  const columns = [
    {
      key: 'courseCode',
      header: 'Course',
      value: (r) => `${r.courseCode} — ${r.courseTitle}`,
      cell: (r) => (
        <div>
          <div className="font-medium">{r.courseCode}</div>
          <div className="max-w-56 truncate text-xs text-muted-foreground">{r.courseTitle}</div>
        </div>
      ),
    },
    { key: 'semesterName', header: 'Semester', value: (r) => r.semesterName, cell: (r) => <span className="whitespace-nowrap">{r.semesterName}</span> },
    { key: 'teacherName', header: 'Teacher', cell: (r) => <span className="whitespace-nowrap">{r.teacherName ?? '—'}</span> },
    { key: 'gradeStatus', header: 'Grade status', value: (r) => GRADE_STATUS_LABELS[r.gradeStatus] ?? r.gradeStatus, cell: (r) => <GradeStatusBadge status={r.gradeStatus} /> },
    { key: 'students', header: 'Students', align: 'right' },
    { key: 'incompleteStudents', header: 'Incomplete students', align: 'right' },
    { key: 'missingMarks', header: 'Missing marks', align: 'right' },
    {
      key: 'weightTotal',
      header: 'Weights total',
      align: 'right',
      value: (r) => r.weightTotal,
      cell: (r) => (r.weightTotal === 100 ? `${r.weightTotal}%` : <Badge variant="warning">{r.weightTotal}% · not 100</Badge>),
    },
    { key: 'deadline', header: 'Deadline', value: (r) => formatDate(r.deadline), cell: (r) => <span className="whitespace-nowrap">{formatDate(r.deadline)}</span> },
    {
      key: 'overdue',
      header: 'Overdue',
      value: (r) => (r.overdue ? 'Overdue' : 'No'),
      cell: (r) =>
        r.overdue ? (
          <Badge variant="danger">
            <AlertTriangle aria-hidden="true" /> Overdue
          </Badge>
        ) : (
          <span className="text-muted-foreground">No</span>
        ),
    },
  ]

  return (
    <div className="grid gap-6">
      {data && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Unpublished offerings" value={formatNumber(data.length)} icon={ClipboardList} hint={semesterName} />
          <StatCard label="Overdue" value={formatNumber(overdue)} icon={AlertTriangle} tone={overdue ? 'danger' : 'default'} hint="Past semesters still without final grades" />
          <StatCard label="Missing marks" value={formatNumber(missing)} icon={TrendingDown} tone={missing ? 'warning' : 'default'} />
          <StatCard label="Weights not 100%" value={formatNumber(badWeights)} icon={Percent} tone={badWeights ? 'warning' : 'default'} />
        </div>
      )}
      <DataTable
        columns={columns}
        rows={data}
        loading={loading}
        error={error}
        onRetry={refetch}
        rowKey={(r) => r.offeringId}
        onRowClick={(r) => navigate(`/admin/reports/grade-sheet/${r.offeringId}`)}
        exportName="missing_grades"
        exportTitle="Missing and unpublished grades"
        exportSubtitle={semesterName}
        university={university}
        searchPlaceholder="Search course or teacher…"
        emptyTitle="All grades are published"
        emptyDescription="There are no missing or unpublished grades for this selection."
      />
    </div>
  )
}

// ---------------- Transcripts ----------------
const studentExportColumns = [
  { header: 'Student ID', value: (s) => s.studentNumber },
  { header: 'Name', value: (s) => s.name },
  { header: 'Email', value: (s) => s.email },
  { header: 'Department', value: (s) => s.department?.name },
  { header: 'Programme', value: (s) => s.program },
  { header: 'Admission year', value: (s) => s.admissionYear },
  { header: 'Status', value: (s) => s.status },
]

function TranscriptsTab({ departmentId, university, departmentName }) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const q = useDebounce(search, 300)
  const { data, loading, error, refetch } = useQuery(
    () => store.users.searchStudents({ search: q, departmentId: departmentId || undefined, page, pageSize }),
    [q, departmentId, page, pageSize],
  )

  const exportAll = async () => {
    const all = []
    for (let p = 1; ; p++) {
      const res = await store.users.searchStudents({ search: q, departmentId: departmentId || undefined, page: p, pageSize: 100 })
      all.push(...res.items)
      if (p >= res.pageCount) break
    }
    return all
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Student transcripts & performance</CardTitle>
          <CardDescription className="mt-1">Find a student to view or download an official transcript, or review their performance.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchInput
            value={search}
            onChange={(v) => {
              setSearch(v)
              setPage(1)
            }}
            placeholder="Search name, student ID or email…"
            className="sm:w-80"
          />
          <div className="sm:ml-auto">
            <ExportMenu filename="students" title="Student list" subtitle={departmentName} columns={studentExportColumns} rows={exportAll} university={university} disabled={!data?.total} />
          </div>
        </div>
        {loading && !data ? (
          <TableSkeleton cols={4} />
        ) : error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : !data.items.length ? (
          <EmptyState icon={Users} title="No students found" description="Try another name, student ID or department." />
        ) : (
          <div>
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Student</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Programme</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <div className="font-medium whitespace-nowrap">{s.name}</div>
                        <div className="text-xs text-muted-foreground tabular">{s.studentNumber}</div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{s.department?.code ?? '—'}</TableCell>
                      <TableCell className="whitespace-nowrap">{s.program}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" asChild>
                            <Link to={`/admin/reports/transcripts/${s.id}`} aria-label={`View transcript for ${s.name}`}>
                              <FileText /> Transcript
                            </Link>
                          </Button>
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={`/admin/reports/students/${s.id}`} aria-label={`Performance report for ${s.name}`}>
                              <LineChart /> Performance
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Pagination
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              onPageChange={setPage}
              onPageSizeChange={(s) => {
                setPageSize(s)
                setPage(1)
              }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
