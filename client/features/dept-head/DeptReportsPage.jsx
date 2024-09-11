import { useState } from 'react'
import { FileBarChart, FileText, CheckCircle2, Clock, Users, BookOpen } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { FilterSelect } from '@/components/common/FilterSelect'
import { TableSkeleton } from '@/components/common/Loading'
import { PageHeader } from '@/components/common/PageHeader'
import { GradeStatusBadge } from '@/components/common/StatusBadge'
import { useAuth } from '@/context/auth-context'
import { useLookups } from '@/context/lookups-context'
import { useQuery } from '@/hooks/useStore'
import { store } from '@/store'

export function DeptReportsPage() {
  const { profile } = useAuth()
  const lookups = useLookups()
  const deptId = profile?.departmentId
  const [semesterId, setSemesterId] = useState('')

  const semesterOptions = (lookups?.semesters ?? []).map((s) => ({
    value: s.id,
    label: s.isCurrent ? `${s.name} (current)` : s.name,
  }))

  const effectiveSemesterId = semesterId || lookups?.currentSemester?.id || ''

  const { data, loading, error, refetch } = useQuery(
    () => store.academics.listOfferings({ semesterId: effectiveSemesterId || undefined, pageSize: 100 }),
    [effectiveSemesterId],
    { enabled: true }
  )

  // Filter offerings to those belonging to this department
  const offerings = (data?.items ?? []).filter((o) => !deptId || o.course?.departmentId === deptId)

  const totalOfferings = offerings.length
  const totalEnrolled = offerings.reduce((acc, o) => acc + (o.enrolledCount || 0), 0)
  const approvedCount = offerings.filter((o) => o.gradeStatus === 'approved' || o.gradeStatus === 'published').length
  const submittedCount = offerings.filter((o) => o.gradeStatus === 'submitted').length
  const pendingCount = offerings.filter((o) => o.gradeStatus === 'in_progress' || o.gradeStatus === 'not_started').length

  return (
    <>
      <PageHeader
        title="Department Academic Reports"
        description="Comprehensive grade reports, submission progress, and printable grade sheets for your department."
        actions={
          <FilterSelect
            value={effectiveSemesterId}
            onChange={(v) => setSemesterId(v)}
            options={semesterOptions}
            label="Semester"
            className="w-56"
          />
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Offered Courses</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOfferings}</div>
            <p className="text-xs text-muted-foreground">Sections active in selected semester</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Enrollments</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEnrolled}</div>
            <p className="text-xs text-muted-foreground">Department student seats</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved / Published</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{approvedCount}</div>
            <p className="text-xs text-muted-foreground">Finalized course grade books</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Awaiting Submission</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{pendingCount + submittedCount}</div>
            <p className="text-xs text-muted-foreground">{submittedCount} submitted, {pendingCount} in progress</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Course Grade Reports & Verification</CardTitle>
          <CardDescription>Select a course section below to inspect detailed assessment breakdowns and export official grade sheets.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading && !data ? (
            <TableSkeleton cols={6} />
          ) : error ? (
            <ErrorState error={error} onRetry={refetch} />
          ) : !offerings.length ? (
            <EmptyState
              icon={FileBarChart}
              title="No course offerings found"
              description="No offerings exist for your department in the chosen semester."
            />
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Course Code</TableHead>
                    <TableHead>Course Title</TableHead>
                    <TableHead>Section</TableHead>
                    <TableHead>Instructor</TableHead>
                    <TableHead className="text-right">Enrolled</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {offerings.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-semibold">{o.course.code}</TableCell>
                      <TableCell className="max-w-xs truncate">{o.course.title}</TableCell>
                      <TableCell>{o.section}</TableCell>
                      <TableCell>{o.teacher?.name ?? 'Unassigned'}</TableCell>
                      <TableCell className="text-right tabular">{o.enrolledCount}</TableCell>
                      <TableCell>
                        <GradeStatusBadge status={o.gradeStatus} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" asChild>
                          <Link to={`/dept-head/reports/grade-sheet/${o.id}`}>
                            <FileText className="mr-1.5 h-3.5 w-3.5" /> Grade Sheet
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}
