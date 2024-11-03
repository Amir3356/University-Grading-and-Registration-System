import { useMemo, useState } from 'react'
import { Building2, Calendar, FileText, Pencil, Plus, Trash2, UserMinus } from 'lucide-react'
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
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { FormField } from '@/components/common/FormField'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { useAuth } from '@/context/auth-context'
import { useWithdrawalRequests } from '@/store/withdrawalsStore'

export function WithdrawalRequestsPage() {
  const { user } = useAuth()
  const {
    requests: allRequests,
    addRequest,
    updateRequest,
    deleteRequest,
  } = useWithdrawalRequests()
  const [isSubmitOpen, setIsSubmitOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editingRequest, setEditingRequest] = useState(null)
  const [requestToDelete, setRequestToDelete] = useState(null)

  // Show requests relevant to the student (or initial student requests)
  const requests = useMemo(() => {
    // If student user is logged in, show their requests or all matching requests
    const myId = user?.studentNumber || 'UGR/24/0001'
    const studentSpecific = allRequests.filter(
      (r) => r.studentId === myId || r.requestId === 'WR-001' || r.requestId === 'WR-002'
    )
    return studentSpecific.length > 0 ? studentSpecific : allRequests.slice(0, 3)
  }, [allRequests, user])

  const currentYear = String(new Date().getFullYear())
  const academicYearOptions = useMemo(() => [currentYear], [currentYear])
  const withdrawalTypeOptions = useMemo(
    () => [
      'Complete University Withdrawal',
      `${currentYear} First Semester`,
      `${currentYear} Second Semester`,
    ],
    [currentYear]
  )

  // Form State
  const [newRequest, setNewRequest] = useState({
    withdrawalType: 'Complete University Withdrawal',
    academicYear: currentYear,
    semester: 'First Semester',
    programType: 'Regular',
    reasonCategory: 'Medical / Health',
    reason: '',
  })
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleOpenSubmit = () => {
    setNewRequest({
      withdrawalType: 'Complete University Withdrawal',
      academicYear: currentYear,
      semester: 'First Semester',
      programType: 'Regular',
      reasonCategory: 'Medical / Health',
      reason: '',
    })
    setFormError('')
    setIsSubmitOpen(true)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!newRequest.reason.trim()) {
      setFormError('Please enter a reason for withdrawal.')
      return
    }

    setSubmitting(true)
    setTimeout(() => {
      const nextNum = allRequests.length + 1
      const createdRecord = {
        id: `WR-${String(nextNum).padStart(3, '0')}`,
        requestId: `WR-${String(nextNum).padStart(3, '0')}`,
        studentId: user?.studentNumber || 'UGR/24/0001',
        studentName: user ? `${user.firstName} ${user.lastName}` : 'Abebe Kebede',
        department: 'Computer Science',
        departmentCode: 'CS',
        withdrawalType: newRequest.withdrawalType,
        programType: newRequest.programType || 'Regular',
        academicYear: newRequest.academicYear,
        semester: newRequest.semester,
        requestDate: new Date().toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
        status: 'pending',
        reasonCategory: newRequest.reasonCategory,
        reason: newRequest.reason.trim(),
        adminNotes: 'Submitted by student. Under initial departmental review.',
        clearance: {
          department: 'pending',
          library: 'pending',
          housing: 'pending',
          registrar: 'pending',
        },
      }

      addRequest(createdRecord)
      setSubmitting(false)
      setIsSubmitOpen(false)
      toast.success(`Withdrawal request ${createdRecord.requestId} submitted successfully.`)
    }, 350)
  }

  const [editForm, setEditForm] = useState({
    withdrawalType: 'Complete University Withdrawal',
    academicYear: currentYear,
    semester: 'First Semester',
    programType: 'Regular',
    reasonCategory: 'Medical / Health',
    reason: '',
  })
  const [editFormError, setEditFormError] = useState('')

  const handleOpenEdit = (req) => {
    setEditingRequest(req)
    setEditForm({
      withdrawalType: req.withdrawalType || 'Complete University Withdrawal',
      academicYear: req.academicYear || currentYear,
      semester: req.semester || 'First Semester',
      programType: req.programType || 'Regular',
      reasonCategory: req.reasonCategory || 'Medical / Health',
      reason: req.reason || '',
    })
    setEditFormError('')
    setIsEditOpen(true)
  }

  const handleEditSubmit = (e) => {
    e.preventDefault()
    if (!editForm.reason.trim()) {
      setEditFormError('Please enter a reason for withdrawal.')
      return
    }

    const updatedRecord = {
      ...editingRequest,
      withdrawalType: editForm.withdrawalType,
      academicYear: editForm.academicYear,
      semester: editForm.semester,
      programType: editForm.programType,
      reasonCategory: editForm.reasonCategory,
      reason: editForm.reason.trim(),
    }

    updateRequest(updatedRecord)
    setIsEditOpen(false)
    setEditingRequest(null)
    toast.success(`Withdrawal request ${editingRequest.requestId} updated successfully.`)
  }

  return (
    <div className="space-y-6">
      {/* Centered Page Header with Action Button */}
      <PageHeader
        centered
        title="My Withdrawal Requests"
        description="Official withdrawal request records submitted to the university registrar."
        actions={
          <Button size="sm" onClick={handleOpenSubmit} className="gap-1.5 shadow-sm">
            <Plus className="w-3.5 h-3.5" />
            Submit Request
          </Button>
        }
      />

      {/* Main Content Card containing the table */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Withdrawal Type</TableHead>
                <TableHead className="w-[120px]">Program Type</TableHead>
                <TableHead className="w-[130px]">Academic Year</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="w-[130px]">Request Date</TableHead>
                <TableHead className="text-center w-[120px]">Status</TableHead>
                <TableHead className="text-center w-[100px]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <FileText className="w-8 h-8 text-muted-foreground/60 stroke-1" />
                      <p className="text-sm font-medium">No withdrawal requests found</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                requests.map((r) => {
                  const isUnivWithdrawal =
                    r.withdrawalType === 'University Withdrawal' ||
                    r.withdrawalType === 'Complete University Withdrawal' ||
                    r.withdrawalType?.toLowerCase().includes('university')
                  return (
                    <TableRow
                      key={r.requestId}
                      className="hover:bg-muted/50 transition-colors"
                    >
                      {/* Withdrawal Type */}
                      <TableCell>
                        <Badge
                          variant={isUnivWithdrawal ? 'secondary' : 'default'}
                          className="font-medium gap-1"
                        >
                          {isUnivWithdrawal ? (
                            <Building2 className="w-3 h-3" />
                          ) : (
                            <Calendar className="w-3 h-3" />
                          )}
                          {r.withdrawalType}
                        </Badge>
                      </TableCell>

                      {/* Program Type */}
                      <TableCell className="font-medium text-xs text-muted-foreground">
                        {r.programType || 'Regular'}
                      </TableCell>

                      {/* Academic Year */}
                      <TableCell className="font-medium text-foreground">
                        {r.academicYear}
                      </TableCell>

                      {/* Reason */}
                      <TableCell className="max-w-[280px]">
                        <div className="space-y-0.5">
                          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                            {r.reasonCategory}
                          </span>
                          <p className="text-xs text-foreground line-clamp-2 leading-relaxed" title={r.reason}>
                            {r.reason}
                          </p>
                        </div>
                      </TableCell>

                      {/* Request Date */}
                      <TableCell className="text-muted-foreground">
                        {r.requestDate}
                      </TableCell>

                      {/* Status */}
                      <TableCell className="text-center">
                        <StatusBadge status={r.status} />
                      </TableCell>

                      {/* Action */}
                      <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Edit withdrawal request"
                            title="Edit withdrawal request"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleOpenEdit(r)
                            }}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            aria-label="Delete withdrawal request"
                            title="Delete withdrawal request"
                            onClick={(e) => {
                              e.stopPropagation()
                              setRequestToDelete(r)
                            }}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* SUBMIT REQUEST MODAL */}
      <Dialog open={isSubmitOpen} onOpenChange={setIsSubmitOpen}>
        <DialogContent size="md" className="max-w-xl">
          <DialogTitle className="sr-only">Submit Withdrawal Request</DialogTitle>

          <form
            onSubmit={handleSubmit}
            className="withdrawal-form"
            style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingTop: '1rem' }}
          >
            {/* Withdrawal Type Dropdown */}
            <FormField label="Withdrawal Type" required>
              <Select
                value={newRequest.withdrawalType}
                onValueChange={(val) =>
                  setNewRequest((prev) => {
                    const updated = { ...prev, withdrawalType: val }
                    if (val.includes('First Semester')) {
                      updated.semester = 'First Semester'
                      updated.academicYear = currentYear
                    } else if (val.includes('Second Semester')) {
                      updated.semester = 'Second Semester'
                      updated.academicYear = currentYear
                    } else {
                      updated.semester = 'Full Year'
                    }
                    return updated
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Withdrawal Type" />
                </SelectTrigger>
                <SelectContent>
                  {withdrawalTypeOptions.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            {/* Academic Year Dropdown */}
            <FormField label="Academic Year" required>
              <Select
                value={newRequest.academicYear}
                onValueChange={(val) =>
                  setNewRequest((prev) => {
                    const updated = { ...prev, academicYear: val }
                    if (prev.withdrawalType.includes('First Semester')) {
                      updated.withdrawalType = `${val} First Semester`
                    } else if (prev.withdrawalType.includes('Second Semester')) {
                      updated.withdrawalType = `${val} Second Semester`
                    }
                    return updated
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Year" />
                </SelectTrigger>
                <SelectContent>
                  {academicYearOptions.map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            {/* Program Type Dropdown */}
            <FormField label="Program Type" required>
              <Select
                value={newRequest.programType}
                onValueChange={(val) =>
                  setNewRequest((prev) => ({ ...prev, programType: val }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Program Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Regular">Regular</SelectItem>
                  <SelectItem value="Extension">Extension</SelectItem>
                  <SelectItem value="Weekend">Weekend</SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            {/* Reason Text Input Field */}
            <FormField label="Reason" required error={formError}>
              <Textarea
                rows={4}
                value={newRequest.reason}
                onChange={(e) => {
                  setNewRequest((prev) => ({ ...prev, reason: e.target.value }))
                  if (formError) setFormError('')
                }}
                placeholder="Enter the reason why you are requesting withdrawal in detail..."
              />
            </FormField>

            <DialogFooter className="pt-2 gap-2" style={{ marginTop: '0.5rem' }}>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsSubmitOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" loading={submitting}>
                Submit Request
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT REQUEST MODAL */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent size="md" className="max-w-xl">
          <DialogTitle className="text-lg font-semibold">Edit Withdrawal Request</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Update your withdrawal request details.
          </DialogDescription>

          <form
            onSubmit={handleEditSubmit}
            className="withdrawal-form"
            style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingTop: '1rem' }}
          >
            {/* Withdrawal Type Dropdown */}
            <FormField label="Withdrawal Type" required>
              <Select
                value={editForm.withdrawalType}
                onValueChange={(val) =>
                  setEditForm((prev) => {
                    const updated = { ...prev, withdrawalType: val }
                    if (val.includes('First Semester')) {
                      updated.semester = 'First Semester'
                      updated.academicYear = currentYear
                    } else if (val.includes('Second Semester')) {
                      updated.semester = 'Second Semester'
                      updated.academicYear = currentYear
                    } else {
                      updated.semester = 'Full Year'
                    }
                    return updated
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Withdrawal Type" />
                </SelectTrigger>
                <SelectContent>
                  {withdrawalTypeOptions.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            {/* Academic Year Dropdown */}
            <FormField label="Academic Year" required>
              <Select
                value={editForm.academicYear}
                onValueChange={(val) =>
                  setEditForm((prev) => {
                    const updated = { ...prev, academicYear: val }
                    if (prev.withdrawalType.includes('First Semester')) {
                      updated.withdrawalType = `${val} First Semester`
                    } else if (prev.withdrawalType.includes('Second Semester')) {
                      updated.withdrawalType = `${val} Second Semester`
                    }
                    return updated
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Year" />
                </SelectTrigger>
                <SelectContent>
                  {academicYearOptions.map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            {/* Program Type Dropdown */}
            <FormField label="Program Type" required>
              <Select
                value={editForm.programType}
                onValueChange={(val) =>
                  setEditForm((prev) => ({ ...prev, programType: val }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Program Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Regular">Regular</SelectItem>
                  <SelectItem value="Extension">Extension</SelectItem>
                  <SelectItem value="Weekend">Weekend</SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            {/* Reason Text Input Field */}
            <FormField label="Reason" required error={editFormError}>
              <Textarea
                rows={4}
                value={editForm.reason}
                onChange={(e) => {
                  setEditForm((prev) => ({ ...prev, reason: e.target.value }))
                  if (editFormError) setEditFormError('')
                }}
                placeholder="Enter the reason why you are requesting withdrawal in detail..."
              />
            </FormField>

            <DialogFooter className="pt-2 gap-2" style={{ marginTop: '0.5rem' }}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsEditOpen(false)
                  setEditingRequest(null)
                }}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm">
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRMATION DIALOG */}
      <ConfirmDialog
        open={Boolean(requestToDelete)}
        onOpenChange={(open) => !open && setRequestToDelete(null)}
        title="Delete Withdrawal Request"
        description={`Are you sure you want to delete withdrawal request ${requestToDelete?.requestId || ''}? This action cannot be undone.`}
        confirmLabel="Delete Request"
        variant="destructive"
        onConfirm={async () => {
          if (!requestToDelete) return
          try {
            await deleteRequest(requestToDelete.requestId || requestToDelete.id)
            toast.success(`Withdrawal request ${requestToDelete.requestId} deleted successfully.`)
          } catch {
            toast.error('Failed to delete withdrawal request.')
          }
          setRequestToDelete(null)
        }}
      />
    </div>
  )
}

export default WithdrawalRequestsPage
