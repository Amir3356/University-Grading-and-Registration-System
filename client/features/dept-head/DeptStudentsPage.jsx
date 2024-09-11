import { GraduationCap } from 'lucide-react'
import { DataTable } from '@/components/common/DataTable'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { useAuth } from '@/context/auth-context'
import { useLookups } from '@/context/lookups-context'
import { useQuery } from '@/hooks/useStore'
import { store } from '@/store'

export function DeptStudentsPage() {
  const { profile } = useAuth()
  const lookups = useLookups()
  const dept =
    (lookups?.departments ?? []).find((d) => d.headTeacherId === profile?.id || d.id === profile?.departmentId) ||
    lookups?.departments?.[0]
  const deptId = dept?.id

  const { data, loading, error, refetch } = useQuery(
    () => store.users.listUsers({ departmentId: deptId, role: 'student', pageSize: 100 }),
    [deptId],
    { enabled: Boolean(deptId) },
  )

  const columns = [
    { key: 'identifier', header: 'Student ID', cell: (s) => <span className="font-mono text-xs">{s.identifier}</span> },
    { key: 'name', header: 'Student Name', cell: (s) => <span className="font-semibold">{s.name}</span> },
    { key: 'email', header: 'Email' },
    { key: 'program', header: 'Program' },
    { key: 'status', header: 'Status', cell: (s) => <StatusBadge status={s.status} /> },
  ]

  return (
    <>
      <PageHeader
        title={`${dept?.name ?? 'Department'} — Students`}
        description="Students currently enrolled and studying in this department."
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
