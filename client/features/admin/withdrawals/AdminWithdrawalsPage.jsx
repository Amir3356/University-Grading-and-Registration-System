import { useMemo, useState } from 'react'
import {
  AlertCircle,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  FileText,
  UserMinus,
  X,
  XCircle,
} from 'lucide-react'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { PageHeader } from '@/components/common/PageHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { useWithdrawalRequests } from '@/store/withdrawalsStore'

export function AdminWithdrawalsPage() {
  const { requests, updateStatus } = useWithdrawalRequests()

  const [selectedRequest, setSelectedRequest] = useState(null)
  const [actionConfirm, setActionConfirm] = useState(null) // { request, action: 'approved' | 'rejected' }
  const [adminNoteInput, setAdminNoteInput] = useState('')

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = requests.length
    const pending = requests.filter((r) => r.status === 'pending').length
    const approved = requests.filter((r) => r.status === 'approved').length
    const rejected = requests.filter((r) => r.status === 'rejected').length
    return { total, pending, approved, rejected }
  }, [requests])

  const handleOpenConfirm = (request, action, e) => {
    e?.stopPropagation()
    setActionConfirm({ request, action })
    setAdminNoteInput(
      action === 'approved'
        ? `Official withdrawal approved by Registrar Administration.`
        : `Withdrawal request rejected by Registrar Administration.`
    )
  }

  const handleConfirmAction = () => {
    if (!actionConfirm) return
    const { request, action } = actionConfirm
    updateStatus(request.id, action, adminNoteInput.trim() || undefined)

    if (action === 'approved') {
      toast.success(`Withdrawal request for ${request.studentName} (${request.studentId}) approved.`)
    } else {
      toast.error(`Withdrawal request for ${request.studentName} (${request.studentId}) rejected.`)
    }

    setActionConfirm(null)
    setAdminNoteInput('')
  }

  const handleQuickAction = (request, action, e) => {
    e?.stopPropagation()
    updateStatus(
      request.id,
      action,
      action === 'approved'
        ? 'Official withdrawal approved by Registrar Administration.'
        : 'Withdrawal request rejected by Registrar Administration.'
    )
    if (action === 'approved') {
      toast.success(`Withdrawal request for ${request.studentName} (${request.studentId}) approved.`)
    } else {
      toast.error(`Withdrawal request for ${request.studentName} (${request.studentId}) rejected.`)
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Student Withdrawals"
        description="Review student withdrawal requests, verify reasons, and execute institutional approvals or rejections."
      />

      {/* KPI Stat Cards - Exact 2 by 2 Horizontal Flexbox Layout */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%', marginBottom: '1.25rem' }}>
        {/* Row 1: Total Requests & Pending Review */}
        <div style={{ display: 'flex', flexDirection: 'row', gap: '0.75rem', width: '100%' }}>
          {/* Total Requests */}
          <div
            className="border border-border/80 rounded-lg bg-card shadow-sm hover:border-border transition-all"
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.875rem 1.25rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="text-sm font-semibold text-foreground">
                Total Requests:
              </span>
              <span className="text-base font-bold text-foreground">
                {metrics.total}
              </span>
            </div>
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <UserMinus className="w-4 h-4" />
            </div>
          </div>

          {/* Pending Review */}
          <div
            className="border border-border/80 rounded-lg bg-card shadow-sm hover:border-border transition-all"
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.875rem 1.25rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="text-sm font-semibold text-foreground">
                Pending Review:
              </span>
              <span className="text-base font-bold text-amber-600 dark:text-amber-400">
                {metrics.pending}
              </span>
            </div>
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Row 2: Approved & Rejected */}
        <div style={{ display: 'flex', flexDirection: 'row', gap: '0.75rem', width: '100%' }}>
          {/* Approved */}
          <div
            className="border border-border/80 rounded-lg bg-card shadow-sm hover:border-border transition-all"
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.875rem 1.25rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="text-sm font-semibold text-foreground">
                Approved:
              </span>
              <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                {metrics.approved}
              </span>
            </div>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>

          {/* Rejected */}
          <div
            className="border border-border/80 rounded-lg bg-card shadow-sm hover:border-border transition-all"
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.875rem 1.25rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="text-sm font-semibold text-foreground">
                Rejected:
              </span>
              <span className="text-base font-bold text-rose-600 dark:text-rose-400">
                {metrics.rejected}
              </span>
            </div>
            <div className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Card */}
      <Card className="border border-border/80 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="w-[130px] font-semibold text-foreground">StudentID</TableHead>
                  <TableHead className="w-[170px] font-semibold text-foreground">Student Name</TableHead>
                  <TableHead className="w-[150px] font-semibold text-foreground">Department</TableHead>
                  <TableHead className="w-[130px] font-semibold text-foreground">Program type</TableHead>
                  <TableHead className="w-[140px] font-semibold text-foreground">
                    <div className="flex flex-col leading-tight">
                      <span>Academic Year</span>
                      <span className="text-[10px] font-normal text-muted-foreground">Relevant academic year</span>
                    </div>
                  </TableHead>
                  <TableHead className="w-[160px] font-semibold text-foreground">
                    <div className="flex flex-col leading-tight">
                      <span>Semester</span>
                      <span className="text-[10px] font-normal text-muted-foreground">Semester being withdrawn from</span>
                    </div>
                  </TableHead>
                  <TableHead className="w-[170px] font-semibold text-foreground">withdrawtype</TableHead>
                  <TableHead className="min-w-[240px] font-semibold text-foreground">Reason</TableHead>
                  <TableHead className="text-center w-[110px] font-semibold text-foreground">status</TableHead>
                  <TableHead className="text-center w-[190px] font-semibold text-foreground">Action</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {requests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <FileText className="w-8 h-8 text-muted-foreground/60 stroke-1" />
                        <p className="text-sm font-medium">No withdrawal requests found</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  requests.map((r) => {
                    const isUnivWithdrawal = r.withdrawalType === 'University Withdrawal'
                    const isPending = r.status === 'pending'
                    const isApproved = r.status === 'approved'
                    const isRejected = r.status === 'rejected'
                    const progType = r.programType || 'Regular'

                    return (
                      <TableRow
                        key={r.id}
                        onClick={() => setSelectedRequest(r)}
                        className="cursor-pointer hover:bg-muted/50 transition-colors group"
                      >
                        {/* StudentID */}
                        <TableCell className="font-mono text-xs font-semibold text-foreground">
                          {r.studentId}
                        </TableCell>

                        {/* Student Name */}
                        <TableCell className="font-medium text-foreground text-xs">
                          {r.studentName}
                        </TableCell>

                        {/* Department */}
                        <TableCell className="text-xs text-muted-foreground font-medium">
                          {r.department}
                        </TableCell>

                        {/* Program type */}
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-[11px] font-medium whitespace-nowrap ${
                              progType.toLowerCase() === 'regular'
                                ? 'border-blue-200 text-blue-700 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20'
                                : progType.toLowerCase().includes('ext')
                                ? 'border-purple-200 text-purple-700 dark:text-purple-400 bg-purple-50/50 dark:bg-purple-950/20'
                                : 'border-amber-200 text-amber-700 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20'
                            }`}
                          >
                            {progType}
                          </Badge>
                        </TableCell>

                        {/* Academic Year */}
                        <TableCell className="text-xs font-medium text-foreground whitespace-nowrap">
                          {r.academicYear}
                        </TableCell>

                        {/* Semester */}
                        <TableCell className="text-xs font-medium text-foreground whitespace-nowrap">
                          {r.semester}
                        </TableCell>

                        {/* withdrawtype */}
                        <TableCell>
                          <Badge
                            variant={isUnivWithdrawal ? 'secondary' : 'outline'}
                            className="text-[11px] font-medium gap-1 whitespace-nowrap"
                          >
                            {isUnivWithdrawal ? (
                              <Building2 className="w-3 h-3 text-purple-500" />
                            ) : (
                              <Calendar className="w-3 h-3 text-blue-500" />
                            )}
                            {r.withdrawalType}
                          </Badge>
                        </TableCell>

                        {/* Reason */}
                        <TableCell>
                          <div className="max-w-md">
                            <p
                              className="text-xs text-foreground line-clamp-2 leading-relaxed"
                              title={r.reason}
                            >
                              {r.reason}
                            </p>
                            {r.reasonCategory && (
                              <span className="inline-block mt-1 text-[10px] font-medium text-muted-foreground/90 bg-muted px-1.5 py-0.5 rounded">
                                {r.reasonCategory}
                              </span>
                            )}
                          </div>
                        </TableCell>

                        {/* status */}
                        <TableCell className="text-center">
                          <StatusBadge status={r.status} />
                        </TableCell>

                        {/* Action */}
                        <TableCell
                          className="text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Approve Button */}
                            <Button
                              size="sm"
                              variant={isApproved ? 'default' : 'outline'}
                              className={`h-7 px-2.5 text-xs font-medium transition-all ${
                                isApproved
                                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-transparent'
                                  : 'text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                              }`}
                              title={isApproved ? 'Currently Approved (Click to re-confirm)' : 'Approve withdrawal request'}
                              onClick={(e) => handleOpenConfirm(r, 'approved', e)}
                            >
                              <Check className="w-3 h-3 mr-1" />
                              Approve
                            </Button>

                            {/* Reject Button */}
                            <Button
                              size="sm"
                              variant={isRejected ? 'destructive' : 'outline'}
                              className={`h-7 px-2.5 text-xs font-medium transition-all ${
                                isRejected
                                  ? 'bg-rose-600 hover:bg-rose-700 text-white'
                                  : 'text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                              }`}
                              title={isRejected ? 'Currently Rejected (Click to re-confirm)' : 'Reject withdrawal request'}
                              onClick={(e) => handleOpenConfirm(r, 'rejected', e)}
                            >
                              <X className="w-3 h-3 mr-1" />
                              Reject
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* CONFIRMATION DIALOG FOR ACTION (APPROVE / REJECT) */}
      <Dialog open={!!actionConfirm} onOpenChange={(open) => !open && setActionConfirm(null)}>
        <DialogContent size="sm" className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {actionConfirm?.action === 'approved' ? (
                <>
                  <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <span>Approve Withdrawal Request</span>
                </>
              ) : (
                <>
                  <div className="w-8 h-8 rounded-full bg-rose-500/10 text-rose-600 flex items-center justify-center">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <span>Reject Withdrawal Request</span>
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs pt-1">
              {actionConfirm?.action === 'approved'
                ? `You are about to approve the withdrawal request for student ${actionConfirm?.request?.studentName} (${actionConfirm?.request?.studentId}).`
                : `You are about to reject the withdrawal request for student ${actionConfirm?.request?.studentName} (${actionConfirm?.request?.studentId}).`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="p-3 rounded-lg border bg-muted/30 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type:</span>
                <span className="font-medium text-foreground">{actionConfirm?.request?.withdrawalType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Department:</span>
                <span className="font-medium text-foreground">{actionConfirm?.request?.department}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Program Type:</span>
                <span className="font-medium text-foreground">{actionConfirm?.request?.programType || 'Regular'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Academic Term:</span>
                <span className="font-medium text-foreground">
                  {actionConfirm?.request?.academicYear} · {actionConfirm?.request?.semester}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">
                Administrative Notes / Remarks
              </label>
              <Textarea
                rows={3}
                className="text-xs"
                value={adminNoteInput}
                onChange={(e) => setAdminNoteInput(e.target.value)}
                placeholder="Enter review remarks or conditions for this decision..."
              />
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setActionConfirm(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              className={
                actionConfirm?.action === 'approved'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-rose-600 hover:bg-rose-700 text-white'
              }
              onClick={handleConfirmAction}
            >
              {actionConfirm?.action === 'approved' ? 'Confirm Approval' : 'Confirm Rejection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DETAILED INSPECTION MODAL */}
      <Dialog open={!!selectedRequest} onOpenChange={(open) => !open && setSelectedRequest(null)}>
        <DialogContent size="md" className="max-w-xl">
          {selectedRequest && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <DialogTitle className="text-lg font-bold text-foreground">
                      Withdrawal Request Details
                    </DialogTitle>
                    <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                      Request ID: {selectedRequest.requestId || selectedRequest.id} · Submitted {selectedRequest.requestDate}
                    </DialogDescription>
                  </div>
                  <StatusBadge status={selectedRequest.status} />
                </div>
              </DialogHeader>

              <div className="space-y-4 py-2 text-xs">
                {/* Student Info Box */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-3 rounded-lg border bg-muted/20">
                  <div>
                    <span className="text-muted-foreground block text-[11px] uppercase font-semibold">
                      StudentID
                    </span>
                    <span className="font-semibold text-foreground mt-0.5 block font-mono">
                      {selectedRequest.studentId}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px] uppercase font-semibold">
                      Student Name
                    </span>
                    <span className="font-semibold text-foreground mt-0.5 block">
                      {selectedRequest.studentName}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px] uppercase font-semibold">
                      Department
                    </span>
                    <span className="font-semibold text-foreground mt-0.5 block">
                      {selectedRequest.department}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px] uppercase font-semibold">
                      Program Type
                    </span>
                    <span className="font-semibold text-foreground mt-0.5 block">
                      {selectedRequest.programType || 'Regular'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px] uppercase font-semibold">
                      Term
                    </span>
                    <span className="font-semibold text-foreground mt-0.5 block">
                      {selectedRequest.academicYear} · {selectedRequest.semester}
                    </span>
                  </div>
                </div>

                {/* Stated Reason */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">
                      Reason for Withdrawal
                    </span>
                    {selectedRequest.reasonCategory && (
                      <span className="text-[11px] text-muted-foreground font-medium">
                        Category: {selectedRequest.reasonCategory}
                      </span>
                    )}
                  </div>
                  <div className="p-3 rounded-md border bg-card leading-relaxed text-foreground whitespace-pre-wrap">
                    {selectedRequest.reason}
                  </div>
                </div>

                {/* Admin Notes */}
                {selectedRequest.adminNotes && (
                  <div className="space-y-1">
                    <span className="font-semibold text-foreground">
                      Administrative Review Notes
                    </span>
                    <div className="p-2.5 rounded-md border bg-muted/30 text-muted-foreground italic">
                      {selectedRequest.adminNotes}
                    </div>
                  </div>
                )}

                {/* Clearance Progress if available */}
                {selectedRequest.clearance && (
                  <div className="space-y-2">
                    <span className="font-semibold text-foreground block">
                      Institutional Clearance Status
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
              </div>

              <DialogFooter className="gap-2 pt-2 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedRequest(null)}
                >
                  Close
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={(e) => {
                    handleOpenConfirm(selectedRequest, 'approved', e)
                    setSelectedRequest(null)
                  }}
                >
                  <Check className="w-3.5 h-3.5 mr-1" />
                  Approve Request
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="bg-rose-600 hover:bg-rose-700 text-white"
                  onClick={(e) => {
                    handleOpenConfirm(selectedRequest, 'rejected', e)
                    setSelectedRequest(null)
                  }}
                >
                  <X className="w-3.5 h-3.5 mr-1" />
                  Reject Request
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
export default AdminWithdrawalsPage
