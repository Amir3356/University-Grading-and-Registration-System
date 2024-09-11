import { BookOpen, CheckCircle2, Clock, FileBarChart, GraduationCap, LayoutDashboard, UserCheck, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/common/EmptyState'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { TableSkeleton } from '@/components/common/Loading'
import { useAuth } from '@/context/auth-context'
import { useLookups } from '@/context/lookups-context'
import { useQuery } from '@/hooks/useStore'
import { formatNumber } from '@/lib/format'
import { store } from '@/store'

export function DeptHeadDashboardPage() {
  const { user, profile } = useAuth()
  const lookups = useLookups()

  // Find department belonging to this head
  const dept =
    (lookups?.departments ?? []).find((d) => d.headTeacherId === profile?.id || d.id === profile?.departmentId) ||
    lookups?.departments?.[0]

  const deptId = dept?.id

  const { data: approvalsData, loading: approvalsLoading } = useQuery(
    () => store.grades.listApprovalRequests({ status: 'pending', pageSize: 5 }),
    [],
  )

  const { data: coursesData } = useQuery(
    () => store.academics.listCourses({ departmentId: deptId, pageSize: 100 }),
    [deptId],
    { enabled: Boolean(deptId) },
  )

  const { data: teachersData } = useQuery(
    () => store.academics.listTeachers({ departmentId: deptId }),
    [deptId],
    { enabled: Boolean(deptId) },
  )

  const { data: studentsData } = useQuery(
    () => store.users.listUsers({ departmentId: deptId, role: 'student', pageSize: 100 }),
    [deptId],
    { enabled: Boolean(deptId) },
  )

  const pendingApprovals = approvalsData?.items ?? []
  const pendingCount = approvalsData?.pendingCount ?? pendingApprovals.length
  const totalCourses = coursesData?.items?.length ?? 0
  const totalTeachers = teachersData?.length ?? 0
  const totalStudents = studentsData?.total ?? studentsData?.items?.length ?? 0

  return (
    <>
      <PageHeader
        title={`${dept?.name ?? 'Department'} — Head Dashboard`}
        description={`Welcome back, ${profile?.name || user?.username}. Supervising department courses, faculty, students and grade approvals.`}
        actions={
          <Button asChild>
            <Link to="/dept-head/approvals">
              <Clock /> Review pending grades ({pendingCount})
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Department students"
          value={formatNumber(totalStudents)}
          icon={GraduationCap}
          tone="teal"
          to="/dept-head/students"
          hint="Enrolled in department programs"
        />
        <StatCard
          label="Department teachers"
          value={formatNumber(totalTeachers)}
          icon={Users}
          tone="slate"
          to="/dept-head/teachers"
          hint="Faculty members"
        />
        <StatCard
          label="Active courses"
          value={formatNumber(totalCourses)}
          icon={BookOpen}
          tone="indigo"
          to="/dept-head/courses"
          hint="Curriculum courses"
        />
        <StatCard
          label="Pending approvals"
          value={formatNumber(pendingCount)}
          icon={Clock}
          tone={pendingCount > 0 ? 'amber' : 'teal'}
          to="/dept-head/approvals"
          hint={pendingCount > 0 ? 'Action required' : 'All submitted grades reviewed'}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Pending Grade Approvals</CardTitle>
              <CardDescription className="mt-1">
                Final grade submissions submitted by department teachers awaiting your review.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/dept-head/approvals">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {approvalsLoading ? (
              <TableSkeleton rows={3} cols={3} />
            ) : pendingApprovals.length === 0 ? (
              <EmptyState
                compact
                icon={CheckCircle2}
                title="No pending grade submissions"
                description="All submitted course grades have been reviewed."
              />
            ) : (
              <ul className="divide-y">
                {pendingApprovals.map((req) => (
                  <li key={req.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {req.offering?.course?.code} — {req.offering?.course?.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Section {req.offering?.section} · Instructor: {req.submitterName} · {req.studentCount} students
                      </p>
                    </div>
                    <Button size="sm" asChild>
                      <Link to={`/dept-head/approvals/${req.id}`}>Review & Approve</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Department Navigation</CardTitle>
              <CardDescription className="mt-1">Quick access to department academic management.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              <Link
                to="/dept-head/courses"
                className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted"
              >
                <div className="flex size-9 items-center justify-center rounded-md bg-muted">
                  <BookOpen className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">Department Courses</p>
                  <p className="text-xs text-muted-foreground">View and review department course catalogue</p>
                </div>
              </Link>
              <Link
                to="/dept-head/teachers"
                className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted"
              >
                <div className="flex size-9 items-center justify-center rounded-md bg-muted">
                  <Users className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">Department Teachers</p>
                  <p className="text-xs text-muted-foreground">Faculty members, assignments & workload</p>
                </div>
              </Link>
              <Link
                to="/dept-head/students"
                className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted"
              >
                <div className="flex size-9 items-center justify-center rounded-md bg-muted">
                  <GraduationCap className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">Department Students</p>
                  <p className="text-xs text-muted-foreground">Registered department majors and progress</p>
                </div>
              </Link>
              <Link
                to="/dept-head/assignments"
                className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted"
              >
                <div className="flex size-9 items-center justify-center rounded-md bg-muted">
                  <UserCheck className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">Teacher Assignments</p>
                  <p className="text-xs text-muted-foreground">Course offerings and instructor allocations</p>
                </div>
              </Link>
              <Link
                to="/dept-head/reports"
                className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted"
              >
                <div className="flex size-9 items-center justify-center rounded-md bg-muted">
                  <FileBarChart className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">Performance Reports</p>
                  <p className="text-xs text-muted-foreground">Department pass rates and grade statistics</p>
                </div>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
