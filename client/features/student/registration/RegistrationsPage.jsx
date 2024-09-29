import { useState } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { FormField } from '@/components/common/FormField'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { useAuth } from '@/context/auth-context'

const INITIAL_REGISTRATION_RECORDS = [
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
  const { user } = useAuth()
  const [records, setRecords] = useState(INITIAL_REGISTRATION_RECORDS)
  const [isRegisterOpen, setIsRegisterOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [formData, setFormData] = useState({
    academicYear: '2027',
    semester: 'Second',
    type: 'Regular (Café)',
  })

  const handleRegisterSubmit = (e) => {
    e.preventDefault()

    // Check if duplicate registration exists
    const duplicate = records.some(
      (r) => r.academicYear === formData.academicYear && r.semester === formData.semester
    )
    if (duplicate) {
      toast.error(`You have already registered for ${formData.academicYear} ${formData.semester} Semester.`)
      return
    }

    setSubmitting(true)
    setTimeout(() => {
      const newRecord = {
        id: `reg-${Date.now()}`,
        studentId: user?.studentNumber || 'STU001',
        academicYear: formData.academicYear,
        semester: formData.semester,
        type: formData.type,
        status: 'registered',
      }
      setRecords((prev) => [newRecord, ...prev])
      setSubmitting(false)
      setIsRegisterOpen(false)
      toast.success(`Successfully registered for ${formData.academicYear} ${formData.semester} Semester!`)
    }, 400)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        centered
        title="Semester Registration"
        description="Register for upcoming academic semesters and view your official registration records."
        actions={
          <Button onClick={() => setIsRegisterOpen(true)}>
            <Plus className="icon" /> Register for Semester
          </Button>
        }
      />

      {/* Registration Records Table */}
      <Card className="overflow-hidden">
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
              {records.map((r) => (
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

      {/* Registration Modal Dialog */}
      <Dialog open={isRegisterOpen} onOpenChange={setIsRegisterOpen}>
        <DialogContent size="md" className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Register for Semester</DialogTitle>
            <DialogDescription>
              Select your academic year, semester, and registration type to submit your semester registration.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRegisterSubmit} className="stack stack--md pt-2">
            <FormField label="Student ID">
              <input
                type="text"
                value={user?.studentNumber || 'STU001'}
                disabled
                className="input cursor-not-allowed bg-muted text-muted-foreground w-full"
              />
            </FormField>

            <FormField label="Academic Year" required>
              <Select
                value={formData.academicYear}
                onValueChange={(val) => setFormData((prev) => ({ ...prev, academicYear: val }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select Academic Year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2027">2027</SelectItem>
                  <SelectItem value="2026">2026</SelectItem>
                  <SelectItem value="2025">2025</SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Semester" required>
              <Select
                value={formData.semester}
                onValueChange={(val) => setFormData((prev) => ({ ...prev, semester: val }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select Semester" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="First">First Semester</SelectItem>
                  <SelectItem value="Second">Second Semester</SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Registration Type" required>
              <Select
                value={formData.type}
                onValueChange={(val) => setFormData((prev) => ({ ...prev, type: val }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select Registration Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Regular (Café)">Regular (Café)</SelectItem>
                  <SelectItem value="Non-Regular (Non-Café)">Non-Regular (Non-Café)</SelectItem>
                  <SelectItem value="Extension">Extension</SelectItem>
                  <SelectItem value="Weekend">Weekend</SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            <DialogFooter className="pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setIsRegisterOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit Registration'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default RegistrationsPage
