import { ClipboardList, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { PageSkeleton } from '@/components/common/Loading'
import { PageHeader } from '@/components/common/PageHeader'
import { useQuery } from '@/hooks/useStore'
import { store } from '@/store'
import { typeLabel } from '../lib'

export function AssessmentsPage() {
  const { data: offerings, loading, error, refetch } = useQuery(() => store.teacher.listMyOfferings({}), [])

  if (loading && !offerings) return <PageSkeleton />
  if (error) {
    return (
      <>
        <PageHeader title="Assessments" />
        <ErrorState error={error} onRetry={refetch} />
      </>
    )
  }

  const offering = offerings?.[0] ?? null

  return (
    <>
      <PageHeader
        title="Assessments"
        actions={
          <Button disabled={!offering}>
            <Plus /> Create Assessment
          </Button>
        }
      />
      {offerings.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No courses assigned" description="You need an assigned course before you can create assessments." />
      ) : !offering ? (
        <EmptyState icon={ClipboardList} title="No offering selected" description="No offerings available." />
      ) : (
        <AssessmentsTable offering={offering} />
      )}
    </>
  )
}

function AssessmentsTable({ offering }) {
  const { data: assessments, loading, error, refetch } = useQuery(() => store.grades.listAssessments(offering.id), [offering.id])

  if (loading && !assessments) return <PageSkeleton />
  if (error) return <ErrorState error={error} onRetry={refetch} />

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Assessment Type</TableHead>
            <TableHead>Course</TableHead>
            <TableHead className="tabular">Total Marks</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(assessments ?? []).length === 0 ? (
            <TableRow>
              <TableCell colSpan={4}>
                <EmptyState
                  icon={ClipboardList}
                  title="No assessments created"
                  description="Create an assessment to get started."
                  className="py-6"
                />
              </TableCell>
            </TableRow>
          ) : (
            (assessments ?? []).map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{typeLabel(a.type)}</TableCell>
                <TableCell>{offering.course.code} — {offering.course.title}</TableCell>
                <TableCell className="tabular">{a.maxMarks}</TableCell>
                <TableCell className="text-right">
                  <div className="cluster cluster--xs cluster--nowrap justify-end">
                    <Button variant="ghost" size="icon-sm" title="Edit">
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      title="Delete"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
