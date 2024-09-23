import { useMemo, useState } from 'react'
import { Building2, Calendar, FileText, Plus, UserMinus } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { FormField } from '@/components/common/FormField'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { useAuth } from '@/context/auth-context'
import { useWithdrawalRequests } from '@/store/withdrawalsStore'

export function WithdrawalRequestsPage() {
  const { user } = useAuth()
  const { requests: allRequests, addRequest } = useWithdrawalRequests()
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [isSubmitOpen, setIsSubmitOpen] = useState(false)

  // Show requests relevant to the student (or initial student requests)
  const requests = useMemo(() => {
    // If student user is logged in, show their requests or all matching requests
    const myId = user?.studentNumber || 'UGR/24/0001'
    const studentSpecific = allRequests.filter(
      (r) => r.studentId === myId || r.requestId === 'WR-001' || r.requestId === 'WR-002'
    )
    return studentSpecific.length > 0 ? studentSpecific : allRequests.slice(0, 3)
  }, [allRequests, user])

  // Form State
  const [newRequest, setNewRequest] = useState({
    withdrawalType: 'Semester Withdrawal',
    academicYear: '2026',
    semester: 'First Semester',
    programType: 'Regular',
    reasonCategory: 'Medical / Health',
    reason: '',
  })
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleOpenSubmit = () => {
    setNewRequest({
      withdrawalType: 'Semester Withdrawal',
      academicYear: '2026',
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

  return (
    <div className="space-y-6">
      {/* Centered Page Header */}
      <PageHeader
        centered
        title="My Withdrawal Requests"
        description="Official withdrawal request records submitted to the university registrar."
      />

      {/* Main Content Card containing the table */}
      <Card className="overflow-hidden">
        <CardHeader
          className="p-5 pb-4 border-b relative"
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ textAlign: 'center', width: '100%' }}>
            <CardTitle className="text-base font-semibold" style={{ textAlign: 'center' }}>
              My Withdrawal Requests
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5" style={{ textAlign: 'center' }}>
              Official withdrawal request records submitted to the university registrar.
            </CardDescription>
          </div>
          <div
            style={{
              position: 'absolute',
              right: '1.25rem',
              top: '50%',
              transform: 'translateY(-50%)',
            }}
          >
            <Button size="sm" onClick={handleOpenSubmit} className="gap-1.5 shadow-sm">
              <Plus className="w-3.5 h-3.5" />
              Submit Request
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Withdrawal Type</TableHead>
                <TableHead className="w-[120px]">Program Type</TableHead>
                <TableHead className="w-[130px]">Academic Year</TableHead>
                <TableHead className="w-[140px]">Semester</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="w-[130px]">Request Date</TableHead>
                <TableHead className="text-center w-[120px]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((r) => {
                const isUnivWithdrawal = r.withdrawalType === 'University Withdrawal'
                return (
                  <TableRow
                    key={r.requestId}
                    onClick={() => setSelectedRequest(r)}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
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

                    {/* Semester */}
                    <TableCell className="font-medium text-foreground">
                      {r.semester}
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
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* VIEW DETAILS MODAL */}
      <Dialog
        open={Boolean(selectedRequest)}
        onOpenChange={(open) => !open && setSelectedRequest(null)}
      >
        <DialogContent size="md" className="max-w-xl">
          {selectedRequest && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between pr-6">
                  <div className="flex items-center gap-2">
                    <DialogTitle className="text-base font-semibold">
                      Withdrawal Request Details
                    </DialogTitle>
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground font-semibold">
                      {selectedRequest.requestId}
                    </span>
                  </div>
                  <StatusBadge status={selectedRequest.status} />
                </div>
                <DialogDescription className="text-xs text-muted-foreground mt-1">
                  Submitted on {selectedRequest.requestDate}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {/* Information Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-lg border bg-muted/20 text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[11px] uppercase font-semibold">
                      Request ID
                    </span>
                    <span className="font-semibold text-foreground mt-0.5 block">
                      {selectedRequest.requestId}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px] uppercase font-semibold">
                      Withdrawal Type
                    </span>
                    <span className="font-semibold text-foreground mt-0.5 block">
                      {selectedRequest.withdrawalType}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px] uppercase font-semibold">
                      Academic Year
                    </span>
                    <span className="font-semibold text-foreground mt-0.5 block">
                      {selectedRequest.academicYear}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px] uppercase font-semibold">
                      Semester
                    </span>
                    <span className="font-semibold text-foreground mt-0.5 block">
                      {selectedRequest.semester}
                    </span>
                  </div>
                </div>

                {/* Stated Reason */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">
                      Reason for Withdrawal
                    </span>
                    {selectedRequest.reasonCategory && (
                      <span className="text-[11px] text-muted-foreground font-medium">
                        Category: {selectedRequest.reasonCategory}
                      </span>
                    )}
                  </div>
                  <div className="p-3 rounded-md border bg-card text-xs leading-relaxed text-foreground whitespace-pre-wrap">
                    {selectedRequest.reason}
                  </div>
                </div>

                {/* Institutional Clearance Tracker */}
                {selectedRequest.clearance && (
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-foreground block">
                      Institutional Clearance Progress
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="p-2.5 rounded-md border bg-muted/30 text-center">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">
                          Department
                        </span>
                        <StatusBadge status={selectedRequest.clearance.department} />
                      </div>
                      <div className="p-2.5 rounded-md border bg-muted/30 text-center">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">
                          Library
                        </span>
                        <StatusBadge status={selectedRequest.clearance.library} />
                      </div>
                      <div className="p-2.5 rounded-md border bg-muted/30 text-center">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">
                          Housing / Dorm
                        </span>
                        <StatusBadge status={selectedRequest.clearance.housing} />
                      </div>
                      <div className="p-2.5 rounded-md border bg-muted/30 text-center">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold block mb-1">
                          Registrar
                        </span>
                        <StatusBadge status={selectedRequest.clearance.registrar} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Administration Remarks */}
                {selectedRequest.adminNotes && (
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-foreground block">
                      Administrative Review Remarks
                    </span>
                    <div className="p-3 rounded-md border bg-muted/40 text-xs text-muted-foreground leading-relaxed">
                      {selectedRequest.adminNotes}
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter className="pt-2">
                <Button variant="outline" size="sm" onClick={() => setSelectedRequest(null)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

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
                  setNewRequest((prev) => ({ ...prev, withdrawalType: val }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Withdrawal Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Semester Withdrawal">Semester Withdrawal</SelectItem>
                  <SelectItem value="University Withdrawal">University Withdrawal</SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            {/* Academic Year Dropdown */}
            <FormField label="Academic Year" required>
              <Select
                value={newRequest.academicYear}
                onValueChange={(val) =>
                  setNewRequest((prev) => ({ ...prev, academicYear: val }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2026">2026</SelectItem>
                  <SelectItem value="2025">2025</SelectItem>
                  <SelectItem value="2024">2024</SelectItem>
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

            {/* Semester Dropdown */}
            <FormField label="Semester" required>
              <Select
                value={newRequest.semester}
                onValueChange={(val) =>
                  setNewRequest((prev) => ({ ...prev, semester: val }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Semester" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="First Semester">First Semester</SelectItem>
                  <SelectItem value="Second Semester">Second Semester</SelectItem>
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
    </div>
  )
}

export default WithdrawalRequestsPage
