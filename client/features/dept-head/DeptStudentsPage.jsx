import { useEffect } from 'react'
import { GraduationCap } from 'lucide-react'
import { DataTable } from '@/components/common/DataTable'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge, ProgramTypeBadge } from '@/components/common/StatusBadge'
import { useAuth } from '@/context/auth-context'
import { useLookups } from '@/context/lookups-context'
import { useQuery } from '@/hooks/useStore'
import { formatYearOfStudy, getStudentCurrentYearOfStudy } from '@/lib/format'
import { onUserChange } from '@/lib/syncEvents'
import { useWebSocketEvent } from '@/lib/websocket'
import { store } from '@/store'

export function DeptStudentsPage() {
  const { user, profile } = useAuth()
  const lookups = useLookups()

  const headDeptId =
    profile?.departmentId ??
    profile?.department_id ??
    profile?.department?.id ??
    user?.departmentId ??
    user?.department_id

  const dept =
    (lookups?.departments ?? []).find(
      (d) =>
        (d.headTeacherId && d.headTeacherId === profile?.id) ||
        (d.head_teacher_id && d.head_teacher_id === profile?.id) ||
        d.id === headDeptId,
    ) ||
    (headDeptId ? (lookups?.departments ?? []).find((d) => d.id === headDeptId) : null) ||
    lookups?.departments?.find((d) => d.id === 'dep_cs') ||
    lookups?.departments?.[0]
  const deptId = dept?.id

  const { data, loading, error, refetch } = useQuery(
    () => store.users.listUsers({ departmentId: deptId, role: 'student', pageSize: 100 }),
    [deptId],
    { enabled: Boolean(deptId) },
  )

  useEffect(() => {
    return onUserChange(() => {
      refetch()
    })
  }, [refetch])

  useWebSocketEvent('USER_UPDATED', () => refetch())
  useWebSocketEvent('STUDENT_UPDATED', () => refetch())
  useWebSocketEvent('WITHDRAWAL_APPROVED', () => refetch())
  useWebSocketEvent('WITHDRAWAL_UPDATED', () => refetch())

  const columns = [
    { key: 'identifier', header: 'Student ID', cell: (s) => <span className="font-mono text-xs">{s.identifier || s.student_number || s.studentNumber}</span> },
    { key: 'name', header: 'Student Name', cell: (s) => <span className="font-semibold">{(s.name || `${s.firstName || s.first_name || ''} ${s.lastName || s.last_name || ''}`).trim()}</span> },
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
        title={`${dept?.name ?? 'Department'} — Students`}
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
