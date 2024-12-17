import { useMemo, useState } from 'react'
import { Building2, Calendar, FileText, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { FormField } from '@/components/common/FormField'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { useAuth } from '@/context/auth-context'
import { useLookups } from '@/context/lookups-context'
import { useWithdrawalRequests } from '@/store/withdrawalsStore'

const DEFAULT_REASON_CATEGORIES = [
  { id: 'medical', label: 'Medical / Health' },
  { id: 'financial', label: 'Financial Hardship' },
  { id: 'personal_family', label: 'Personal / Family' },
  { id: 'relocation_transfer', label: 'Relocation / Transfer' },
  { id: 'employment', label: 'Employment' },
  { id: 'academic', label: 'Academic Difficulty' },
  { id: 'personal_emergency', label: 'Personal Emergency' },
  { id: 'other', label: 'Other' },
]

export function WithdrawalRequestsPage() {
  const { user } = useAuth()
  const lookups = useLookups()
  const {
    requests,
    loading,
    addRequest,
    updateRequest,
    deleteRequest,
  } = useWithdrawalRequests()
  const [isSubmitOpen, setIsSubmitOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editingRequest, setEditingRequest] = useState(null)
  const [requestToDelete, setRequestToDelete] = useState(null)

  const reasonCategoryOptions = useMemo(() => {
    const list = lookups?.withdrawalReasonCategories ?? []
    return list.length > 0 ? list : DEFAULT_REASON_CATEGORIES
  }, [lookups])

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
    reasonCategoryId: 'medical',
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
      reasonCategoryId: 'medical',
      reasonCategory: 'Medical / Health',
      reason: '',
    })
    setFormError('')
    setIsSubmitOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!newRequest.reason.trim()) {
      setFormError('Please enter a reason for withdrawal.')
      return
    }

    setSubmitting(true)
    setFormError('')
    try {
      let semesterId = null
      if (newRequest.withdrawalType !== 'Complete University Withdrawal') {
        const found = lookups?.semesters?.find(
          (s) =>
            newRequest.withdrawalType.includes(s.name) ||
            (newRequest.semester && s.name.includes(newRequest.semester))
        )
        semesterId = found?.id || lookups?.currentSemester?.id || 'sem_2026_fall'
      }

      await addRequest({
        withdrawalType: newRequest.withdrawalType,
        semesterId,
        programType: newRequest.programType,
        academicYear: newRequest.academicYear,
        semester: newRequest.semester,
        reasonCategoryId: newRequest.reasonCategoryId,
        reasonCategory: newRequest.reasonCategory,
        reason: newRequest.reason.trim(),
      })

      setIsSubmitOpen(false)
      toast.success('Withdrawal request submitted successfully.')
    } catch (err) {
      const msg = err?.message || 'Failed to submit withdrawal request.'
      setFormError(msg)
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  const [editForm, setEditForm] = useState({
    withdrawalType: 'Complete University Withdrawal',
    academicYear: currentYear,
    semester: 'First Semester',
    programType: 'Regular',
    reasonCategoryId: 'medical',
    reasonCategory: 'Medical / Health',
    reason: '',
  })
  const [editFormError, setEditFormError] = useState('')
  const [updating, setUpdating] = useState(false)

  const handleOpenEdit = (req) => {
    setEditingRequest(req)
    setEditForm({
      withdrawalType: req.withdrawalType || 'Complete University Withdrawal',
      academicYear: req.academicYear || currentYear,
      semester: req.semester || 'First Semester',
      programType: req.programType || 'Regular',
      reasonCategoryId: req.reasonCategoryId || 'medical',
      reasonCategory: req.reasonCategory || 'Medical / Health',
      reason: req.reason || '',
    })
    setEditFormError('')
    setIsEditOpen(true)
  }

  const handleEditSubmit = async (e) => {
    e.preventDefault()
    if (!editForm.reason.trim()) {
      setEditFormError('Please enter a reason for withdrawal.')
      return
    }

    setUpdating(true)
    setEditFormError('')
    try {
      await updateRequest({
        ...editingRequest,
        reasonCategory: editForm.reasonCategory,
        reasonCategoryId: editForm.reasonCategoryId,
        reason: editForm.reason.trim(),
      })
      setIsEditOpen(false)
      setEditingRequest(null)
      toast.success(`Withdrawal request updated successfully.`)
    } catch (err) {
      const msg = err?.message || 'Failed to update withdrawal request.'
      setEditFormError(msg)
      toast.error(msg)
    } finally {
      setUpdating(false)
    }
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
                        {r.status === 'pending' ? (
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
                              aria-label="Cancel withdrawal request"
                              title="Cancel withdrawal request"
                              onClick={(e) => {
                                e.stopPropagation()
                                setRequestToDelete(r)
                              }}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
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

            {/* Reason Category Dropdown */}
            <FormField label="Reason Category" required>
              <Select
                value={newRequest.reasonCategoryId}
                onValueChange={(val) => {
                  const found = reasonCategoryOptions.find((c) => c.id === val)
                  setNewRequest((prev) => ({
                    ...prev,
                    reasonCategoryId: val,
                    reasonCategory: found?.label || 'Other',
                  }))
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Reason Category" />
                </SelectTrigger>
                <SelectContent>
                  {reasonCategoryOptions.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.label}
                    </SelectItem>
                  ))}
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

            {/* Reason Category Dropdown */}
            <FormField label="Reason Category" required>
              <Select
                value={editForm.reasonCategoryId}
                onValueChange={(val) => {
                  const found = reasonCategoryOptions.find((c) => c.id === val)
                  setEditForm((prev) => ({
                    ...prev,
                    reasonCategoryId: val,
                    reasonCategory: found?.label || 'Other',
                  }))
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Reason Category" />
                </SelectTrigger>
                <SelectContent>
                  {reasonCategoryOptions.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.label}
                    </SelectItem>
                  ))}
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
                disabled={updating}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" loading={updating}>
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
