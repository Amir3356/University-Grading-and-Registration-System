import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'

const REGISTRATION_RECORDS = [
  {
    id: 'reg-001',
    studentId: 'STU001',
    academicYear: '2026',
    semester: 'First',
    type: 'Regular (Café)',
    status: 'registered',
  },
  {
    id: 'reg-002',
    studentId: 'STU001',
    academicYear: '2026',
    semester: 'Second',
    type: 'Non-Regular (Non-Café)',
    status: 'registered',
  },
  {
    id: 'reg-003',
    studentId: 'STU001',
    academicYear: '2027',
    semester: 'First',
    type: 'Regular (Café)',
    status: 'pending',
  },
]

export function RegistrationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        centered
        title="Semester Registration Management"
        description="Configure each semester's registration opening date, deadline, registration types, and status."
      />

      {/* My Semester Registration Records */}
      <Card className="overflow-hidden">
        <CardHeader className="p-5 pb-3 border-b">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base font-semibold">My Semester Registration Records</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Each student has a separate registration record for every semester.
              </CardDescription>
            </div>
            <span className="text-xs italic text-muted-foreground">Example records only.</span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">Student ID</TableHead>
                <TableHead className="w-[140px]">Academic Year</TableHead>
                <TableHead className="w-[140px]">Semester</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-center w-[140px]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {REGISTRATION_RECORDS.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-semibold text-foreground">
                    {r.studentId}
                  </TableCell>
                  <TableCell className="font-medium text-foreground">
                    {r.academicYear}
                  </TableCell>
                  <TableCell className="font-medium text-foreground">
                    {r.semester}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={r.type.startsWith('Regular') ? 'default' : 'secondary'}
                      className="font-medium"
                    >
                      {r.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <StatusBadge status={r.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

export default RegistrationsPage
