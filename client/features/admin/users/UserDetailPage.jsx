import { useState } from 'react'
import { Activity, BookOpen, FileBarChart, FileText, KeyRound, Pencil, UserCheck, UserX } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { PageSkeleton } from '@/components/common/Loading'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCard } from '@/components/common/StatCard'
import { GradeStatusBadge, StatusBadge } from '@/components/common/StatusBadge'
import { useQuery } from '@/hooks/useStore'
import { formatDate, formatDateTime, formatGpa, formatNumber, ROLE_LABELS, timeAgo } from '@/lib/format'
import { initials } from '@/lib/utils'
import { store } from '@/store'
import { UserActionDialogs } from './UserActionDialogs'
import { UserFormDialog } from './UserFormDialog'

function Detail({ label, value }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium">{value || '—'}</dd>
    </div>
  )
}

export function UserDetailPage() {
  const { userId } = useParams()
  const { data: user, loading, error, refetch } = useQuery(() => store.users.getUser(userId), [userId])
  const [editOpen, setEditOpen] = useState(false)
  const [action, setAction] = useState(null)

  if (loading && !user) return <PageSkeleton />
  if (error)
    return (
      <>
        <PageHeader title="User" backTo="/admin/users" backLabel="Users" />
        <ErrorState error={error} onRetry={refetch} />
      </>
    )

  const p = user.profile
  const isStudent = user.roleId === 'student'
  const isTeacher = user.roleId === 'teacher'
  const displayName = isTeacher && p?.title ? `${p.title} ${user.name}` : user.name
  const target = { id: user.id, name: user.name }

  return (
    <>
      <PageHeader
        title={displayName}
        description={`${ROLE_LABELS[user.roleId]} account`}
        backTo="/admin/users"
        backLabel="Users"
        actions={
          <>
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil /> Edit
            </Button>
            <Button variant="outline" onClick={() => setAction({ type: 'reset', user: target })}>
              <KeyRound /> Reset password
            </Button>
            {user.status === 'active' ? (
              <Button variant="destructive" onClick={() => setAction({ type: 'deactivate', user: target })}>
                <UserX /> Deactivate
              </Button>
            ) : (
              <Button variant="teal" onClick={() => setAction({ type: 'activate', user: target })}>
                <UserCheck /> Activate
              </Button>
            )}
          </>
        }
      />

      {user.status !== 'active' && (
        <Alert variant="warning" className="mb-6">
          <UserX />
          <AlertDescription>This account is inactive. The user cannot sign in until it is activated again.</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <Card>
          <CardContent className="flex flex-col gap-5">
            <div className="flex items-center gap-4">
              <Avatar className="size-14">
                <AvatarFallback className="text-base">{initials(user)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold">{displayName}</p>
                <p className="truncate text-sm text-muted-foreground">
                  @{user.username} · {user.email}
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <Badge variant="info">{ROLE_LABELS[user.roleId]}</Badge>
                  <StatusBadge status={user.status} />
                  {user.mustChangePassword && (
                    <Badge variant="outline" className="font-normal">
                      <KeyRound aria-hidden="true" /> Temporary password
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-4">
              {isStudent && (
                <>
                  <Detail label="Student ID" value={p?.studentNumber} />
                  <Detail label="Department" value={p?.department?.name} />
                  <Detail label="Programme" value={p?.program} />
                  <Detail label="Admission year" value={p?.admissionYear} />
                  <Detail label="Academic status" value={p?.status} />
                  <Detail label="Date of birth" value={p?.dateOfBirth ? formatDate(p.dateOfBirth) : null} />
                </>
              )}
              {isTeacher && (
                <>
                  <Detail label="Employee ID" value={p?.employeeNumber} />
                  <Detail label="Department" value={p?.department?.name} />
                  <Detail label="Specialization" value={p?.specialization} />
                  <Detail label="Office" value={p?.officeRoom} />
                  <Detail label="Hire date" value={p?.hireDate ? formatDate(p.hireDate) : null} />
                </>
              )}
              <Detail label="Phone" value={user.phone} />
              <Detail label="Member since" value={formatDate(user.createdAt)} />
              <Detail label="Last sign-in" value={user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'Never'} />
            </dl>
          </CardContent>
        </Card>

        <div className="flex min-w-0 flex-col gap-6">
          {isStudent && user.summary && (
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Academic summary</CardTitle>
                  <CardDescription className="mt-1">Based on published results.</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/admin/reports/transcripts/${p.id}`}>
                      <FileText /> Transcript
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/admin/reports/students/${p.id}`}>
                      <FileBarChart /> Performance report
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-3">
                <StatCard label="CGPA" value={formatGpa(user.summary.cgpa)} className="shadow-none" />
                <StatCard label="Earned credits" value={formatNumber(user.summary.earnedCredits)} className="shadow-none" />
                <StatCard label="Enrollments" value={formatNumber(user.summary.enrollments)} className="shadow-none" />
              </CardContent>
            </Card>
          )}

          {isTeacher && (
            <Card className="pb-0">
              <CardHeader>
                <div>
                  <CardTitle>Course assignments</CardTitle>
                  <CardDescription className="mt-1">All offerings taught by this teacher.</CardDescription>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/admin/assignments">Manage assignments</Link>
                </Button>
              </CardHeader>
              {user.offerings?.length ? (
                <div className="border-t">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Course</TableHead>
                        <TableHead>Semester</TableHead>
                        <TableHead className="text-right">Enrolled</TableHead>
                        <TableHead>Grades</TableHead>
                        <TableHead>
                          <span className="sr-only">Grade sheet</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...user.offerings]
                        .sort((a, b) => b.semester.order - a.semester.order || a.course.code.localeCompare(b.course.code))
                        .map((o) => (
                          <TableRow key={o.id}>
                            <TableCell>
                              <p className="font-medium">
                                {o.course.code} · {o.section}
                              </p>
                              <p className="text-xs text-muted-foreground">{o.course.title}</p>
                            </TableCell>
                            <TableCell>{o.semester.name}</TableCell>
                            <TableCell className="tabular text-right">
                              {o.enrolledCount}/{o.capacity}
                            </TableCell>
                            <TableCell>
                              <GradeStatusBadge status={o.gradeStatus} />
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="link" size="sm" asChild>
                                <Link to={`/admin/reports/grade-sheet/${o.id}`}>Grade sheet</Link>
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <CardContent className="pb-5">
                  <EmptyState compact icon={BookOpen} title="No course assignments" description="Assign this teacher to an offering from Teacher Assignments." />
                </CardContent>
              )}
            </Card>
          )}

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Recent activity</CardTitle>
                <CardDescription className="mt-1">Actions performed by this user.</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to={`/admin/audit-logs?search=${encodeURIComponent(user.name)}`}>View audit log</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {user.recentActivity?.length ? (
                <ul className="divide-y">
                  {[...user.recentActivity].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((a) => (
                    <li key={a.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="text-sm">{a.details}</p>
                        <p className="mt-0.5 font-mono text-xs text-muted-foreground">{a.action}</p>
                      </div>
                      <time className="shrink-0 text-xs text-muted-foreground" dateTime={a.createdAt} title={formatDateTime(a.createdAt)}>
                        {timeAgo(a.createdAt)}
                      </time>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState compact icon={Activity} title="No recorded activity" />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <UserFormDialog open={editOpen} onOpenChange={setEditOpen} userId={user.id} />
      <UserActionDialogs action={action} onClose={() => setAction(null)} />
    </>
  )
}
