import { useEffect } from 'react'
import { GraduationCap } from 'lucide-react'
import { DataTable } from '@/components/common/DataTable'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge, ProgramTypeBadge } from '@/components/common/StatusBadge'
import { useAuth } from '@/context/auth-context'
import { useLookups } from '@/context/lookups-context'
import { useQuery } from '@/hooks/useStore'
import { getStudentCurrentYearOfStudy } from '@/lib/format'
import { onUserChange } from '@/lib/syncEvents'
import { useWebSocketEvent } from '@/lib/websocket'
import { store } from '@/store'
import { getDepartmentName } from '@/features/admin/users/UserFormDialog'

export function DeptStudentsPage() {
  const { user, profile } = useAuth()
  const lookups = useLookups()

  // Resolve department head's own profile to reliably get the department assigned during Account Provision
  const { data: self, refetch: refetchSelf } = useQuery(
    () => (user?.id ? store.users.getUser(user.id).catch(() => null) : Promise.resolve(null)),
    [user?.id],
    {
      enabled: Boolean(user?.id),
      live: false,
    },
  )

  const headDeptId =
    self?.departmentId ??
    self?.department_id ??
    self?.profile?.departmentId ??
    self?.profile?.department_id ??
    profile?.departmentId ??
    profile?.department_id ??
    profile?.department?.id ??
    user?.departmentId ??
    user?.department_id ??
    (lookups?.departments ?? []).find(
      (d) =>
        (d.headTeacherId && (d.headTeacherId === profile?.id || d.headTeacherId === user?.id || d.headTeacherId === self?.id)) ||
        (d.head_teacher_id && (d.head_teacher_id === profile?.id || d.head_teacher_id === user?.id || d.head_teacher_id === self?.id))
    )?.id ??
    (lookups?.teachers ?? []).find(
      (t) => (t.userId && t.userId === user?.id) || (t.user_id && t.user_id === user?.id) || t.id === profile?.id
    )?.departmentId ??
    'dep_cs'

  const dept =
    (lookups?.departments ?? []).find(
      (d) =>
        d.id === headDeptId ||
        (d.headTeacherId && (d.headTeacherId === profile?.id || d.headTeacherId === user?.id || d.headTeacherId === self?.id)) ||
        (d.head_teacher_id && (d.head_teacher_id === profile?.id || d.head_teacher_id === user?.id || d.head_teacher_id === self?.id)),
    ) ||
    (headDeptId ? (lookups?.departments ?? []).find((d) => d.id === headDeptId) : null) ||
    (self?.departmentName ? { id: headDeptId, name: self.departmentName } : null) ||
    lookups?.departments?.find((d) => d.id === 'dep_cs') ||
    lookups?.departments?.[0]

  const deptId = dept?.id || headDeptId
  const deptName =
    self?.departmentName ||
    self?.department_name ||
    dept?.name ||
    getDepartmentName(deptId) ||
    'Department'

  const { data, loading, error, refetch } = useQuery(
    () => store.users.listUsers({ departmentId: deptId, role: 'student', pageSize: 100 }),
    [deptId],
    { enabled: Boolean(deptId) },
  )

  useEffect(() => {
    return onUserChange(() => {
      refetchSelf()
      refetch()
    })
  }, [refetchSelf, refetch])

  useWebSocketEvent('USER_UPDATED', () => {
    refetchSelf()
    refetch()
  })
  useWebSocketEvent('USER_DELETED', () => {
    refetchSelf()
    refetch()
  })
  useWebSocketEvent('STUDENT_UPDATED', () => refetch())
  useWebSocketEvent('WITHDRAWAL_APPROVED', () => refetch())
  useWebSocketEvent('WITHDRAWAL_UPDATED', () => refetch())

  const columns = [
    { key: 'identifier', header: 'Student ID', cell: (s) => <span className="font-mono text-xs">{s.identifier || s.student_number || s.studentNumber}</span> },
    { key: 'name', header: 'Student Name', cell: (s) => <span className="font-semibold">{(s.name || `${s.firstName || s.first_name || ''} ${s.lastName || s.last_name || ''}`).trim()}</span> },
    {
      key: 'department',
      header: 'Department',
      value: (s) =>
        (s.departmentName && s.departmentName !== '—' ? s.departmentName : null) ||
        (s.departmentId ? getDepartmentName(s.departmentId) : null) ||
        deptName ||
        '—',
      cell: (s) => {
        const dName =
          (s.departmentName && s.departmentName !== '—' ? s.departmentName : null) ||
          (s.departmentId ? getDepartmentName(s.departmentId) : null) ||
          deptName ||
          '—'
        return <span className="font-medium text-foreground">{dName}</span>
      },
    },
    {
      key: 'yearOfStudy',
      header: 'Current Year',
      value: (s) => getStudentCurrentYearOfStudy(s),
      cell: (s) => {
        const isWithdrawn =
          String(s.status || '').toLowerCase() === 'withdrawn' ||
          String(s.academicStatus || s.academic_status || '').toLowerCase() === 'withdrawn' ||
          Boolean(s.withdrawn) ||
          Boolean(s.isWithdrawn)
        const yearText = getStudentCurrentYearOfStudy(s)

        return (
          <span className="font-semibold text-foreground">
            {yearText}
            {isWithdrawn && (
              <span className="ml-1.5 text-xs text-muted-foreground font-normal">
                (Withdrawn)
              </span>
            )}
          </span>
        )
      },
    },
    {
      key: 'programType',
      header: 'Program Type',
      value: (s) => s.programType || s.program_type || 'regular',
      cell: (s) => <ProgramTypeBadge programType={s.programType || s.program_type || 'regular'} />,
    },
    { key: 'status', header: 'Status', cell: (s) => <StatusBadge status={s.status} /> },
  ]

  return (
    <>
      <PageHeader
        title={`${deptName} — Students`}
        description="Students currently enrolled and studying in this department."
        centered
      />
      <DataTable
        columns={columns}
        rows={data?.items}
        loading={loading}
        error={error}
        onRetry={refetch}
        searchPlaceholder="Search student by name or ID…"
        initialSort={{ key: 'name', dir: 'asc' }}
        emptyIcon={GraduationCap}
        emptyTitle="No students found"
        emptyDescription="No students registered under this department."
      />
    </>
  )
}
