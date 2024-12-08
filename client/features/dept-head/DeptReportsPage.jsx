import { useAuth } from '@/context/auth-context'
import { useLookups } from '@/context/lookups-context'
import { DeptGradeResultsReport } from './DeptGradeResultsReport'

export function DeptReportsPage() {
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
    lookups?.departments?.[0]
  const deptName = dept?.name ?? 'My Department'

  return <DeptGradeResultsReport department={deptName} university={lookups?.university} />
}

export default DeptReportsPage
