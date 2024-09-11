import { Users } from 'lucide-react'
import { DataTable } from '@/components/common/DataTable'
import { PageHeader } from '@/components/common/PageHeader'
import { useAuth } from '@/context/auth-context'
import { useLookups } from '@/context/lookups-context'
import { useQuery } from '@/hooks/useStore'
import { store } from '@/store'

export function DeptTeachersPage() {
  const { profile } = useAuth()
  const lookups = useLookups()
  const dept =
    (lookups?.departments ?? []).find((d) => d.headTeacherId === profile?.id || d.id === profile?.departmentId) ||
    lookups?.departments?.[0]
  const deptId = dept?.id

  const { data, loading, error, refetch } = useQuery(
    () => store.academics.listTeachers({ departmentId: deptId }),
    [deptId],
    { enabled: Boolean(deptId) },
  )

  const columns = [
    { key: 'employeeNumber', header: 'Employee ID', cell: (t) => <span className="font-mono text-xs">{t.employeeNumber}</span> },
    { key: 'name', header: 'Teacher Name', cell: (t) => <span className="font-semibold">{t.name}</span> },
    { key: 'specialization', header: 'Specialization' },
    { key: 'officeRoom', header: 'Office' },
    { key: 'offeringCount', header: 'Current Offerings', align: 'right' },
  ]

  return (
    <>
      <PageHeader
        title={`${dept?.name ?? 'Department'} — Teachers`}
        description="Faculty members, specializations, and office details for this department."
      />
      <DataTable
        columns={columns}
        rows={data}
        loading={loading}
        error={error}
        onRetry={refetch}
        searchPlaceholder="Search teacher name or ID…"
        initialSort={{ key: 'name', dir: 'asc' }}
        emptyIcon={Users}
        emptyTitle="No teachers found"
        emptyDescription="No teachers assigned to this department."
      />
    </>
  )
}
