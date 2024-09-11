import { BookOpen } from 'lucide-react'
import { DataTable } from '@/components/common/DataTable'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { useAuth } from '@/context/auth-context'
import { useLookups } from '@/context/lookups-context'
import { useQuery } from '@/hooks/useStore'
import { store } from '@/store'

export function DeptCoursesPage() {
  const { profile } = useAuth()
  const lookups = useLookups()
  const dept =
    (lookups?.departments ?? []).find((d) => d.headTeacherId === profile?.id || d.id === profile?.departmentId) ||
    lookups?.departments?.[0]
  const deptId = dept?.id

  const { data, loading, error, refetch } = useQuery(
    () => store.academics.listCourses({ departmentId: deptId, pageSize: 100 }),
    [deptId],
    { enabled: Boolean(deptId) },
  )

  const columns = [
    { key: 'code', header: 'Course Code', cell: (c) => <span className="font-medium">{c.code}</span> },
    { key: 'title', header: 'Course Title', cell: (c) => <span className="font-semibold">{c.title}</span> },
    { key: 'creditHours', header: 'Credits', align: 'right' },
    { key: 'level', header: 'Level', align: 'right' },
    { key: 'offeringCount', header: 'Offerings', align: 'right' },
    { key: 'status', header: 'Status', cell: (c) => <StatusBadge status={c.status} /> },
  ]

  return (
    <>
      <PageHeader
        title={`${dept?.name ?? 'Department'} — Courses`}
        description="Courses offered and curriculum catalogue for this department."
      />
      <DataTable
        columns={columns}
        rows={data?.items}
        loading={loading}
        error={error}
        onRetry={refetch}
        searchPlaceholder="Search course code or title…"
        initialSort={{ key: 'code', dir: 'asc' }}
        emptyIcon={BookOpen}
        emptyTitle="No courses found"
        emptyDescription="No courses found in this department catalogue."
      />
    </>
  )
}
