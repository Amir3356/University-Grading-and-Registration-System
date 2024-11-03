import { useState, useMemo } from 'react'
import {
  AlertCircle,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  FileText,
  RotateCcw,
  X,
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
import { SearchInput } from '@/components/common/SearchInput'
import { FilterSelect } from '@/components/common/FilterSelect'
import { useWithdrawalRequests } from '@/store/withdrawalsStore'

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

const PROGRAM_OPTIONS = [
  { value: 'regular', label: 'Regular' },
  { value: 'extension', label: 'Extension' },
  { value: 'summer', label: 'Summer' },
]

export function AdminWithdrawalsPage() {
  const { requests, updateStatus } = useWithdrawalRequests()

  const [selectedRequest, setSelectedRequest] = useState(null)
  const [actionConfirm, setActionConfirm] = useState(null) // { request, action: 'approved' | 'rejected' }
  const [adminNoteInput, setAdminNoteInput] = useState('')

  // Filter States
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [programFilter, setProgramFilter] = useState('')
  const [yearFilter, setYearFilter] = useState('')

  const currentYear = String(new Date().getFullYear())

  // Dynamic Options
  const withdrawalTypeOptions = useMemo(() => {
    const types = new Set()
    requests.forEach((r) => {
      if (r.withdrawalType) types.add(r.withdrawalType)
    })
    types.add('Complete University Withdrawal')
    types.add(`${currentYear} First Semester`)
    types.add(`${currentYear} Second Semester`)
    return Array.from(types).map((t) => ({ value: t, label: t }))
  }, [requests, currentYear])

  const academicYearOptions = useMemo(() => {
    const years = new Set()
    requests.forEach((r) => {
      if (r.academicYear) years.add(String(r.academicYear))
    })
    years.add(currentYear)
    return Array.from(years).map((y) => ({ value: y, label: y }))
  }, [requests, currentYear])

  const isFiltered = Boolean(search || statusFilter || typeFilter || programFilter || yearFilter)

  const resetFilters = () => {
    setSearch('')
    setStatusFilter('')
    setTypeFilter('')
    setProgramFilter('')
    setYearFilter('')
  }

  // Filtered List
  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      if (statusFilter && r.status !== statusFilter) return false
      if (typeFilter && r.withdrawalType !== typeFilter) return false
      if (
        programFilter &&
        (r.programType || 'Regular').toLowerCase() !== programFilter.toLowerCase()
      )
        return false
      if (yearFilter && String(r.academicYear) !== String(yearFilter)) return false

      if (search.trim()) {
        const q = search.trim().toLowerCase()
        const sId = (r.studentId || '').toLowerCase()
        const sName = (r.studentName || '').toLowerCase()
        const wType = (r.withdrawalType || '').toLowerCase()
        const pType = (r.programType || '').toLowerCase()
        const aYear = String(r.academicYear || '').toLowerCase()
        const reason = (r.reason || '').toLowerCase()
        const status = (r.status || '').toLowerCase()

        const match =
          sId.includes(q) ||
          sName.includes(q) ||
          wType.includes(q) ||
          pType.includes(q) ||
          aYear.includes(q) ||
          reason.includes(q) ||
          status.includes(q)

        if (!match) return false
      }

      return true
    })
  }, [requests, search, statusFilter, typeFilter, programFilter, yearFilter])

  const handleOpenConfirm = (request, action, e) => {
    e?.stopPropagation()
    if (action === 'rejected' && request.status === 'approved') {
      toast.error('Approved withdrawal requests cannot be rejected.')
      return
    }
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
    if (action === 'rejected' && request.status === 'approved') {
      toast.error('Approved withdrawal requests cannot be rejected.')
      setActionConfirm(null)
      return
    }
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
    if (action === 'rejected' && request.status === 'approved') {
      toast.error('Approved withdrawal requests cannot be rejected.')
      return
    }
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
        centered
        title="Student Withdrawals"
        description="Review student withdrawal requests, verify reasons, and execute institutional approvals or rejections."
      />

      {/* Search & Dropdown Filter Toolbar */}
      <div className="space-y-2">
        <div className="toolbar--split">
          <div className="toolbar--split__left">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search by student ID, name, reason..."
            />
          </div>
          <div className="toolbar--split__right">
            <FilterSelect
              value={statusFilter}
              onChange={setStatusFilter}
              options={STATUS_OPTIONS}
              allLabel="All statuses"
              label="Status"
              className="sm:w-36"
            />
            <FilterSelect
              value={typeFilter}
              onChange={setTypeFilter}
              options={withdrawalTypeOptions}
              allLabel="All withdraw types"
              label="Withdraw Type"
              className="sm:w-52"
            />
            <FilterSelect
              value={programFilter}
              onChange={setProgramFilter}
              options={PROGRAM_OPTIONS}
              allLabel="All programs"
              label="Program"
              className="sm:w-36"
            />
            <FilterSelect
              value={yearFilter}
              onChange={setYearFilter}
              options={academicYearOptions}
              allLabel="All academic years"
              label="Academic Year"
              className="sm:w-40"
            />
            {isFiltered && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1"
                title="Reset all filters"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </Button>
            )}
          </div>
        </div>

        {isFiltered && (
          <div className="flex items-center justify-between text-xs text-muted-foreground px-0.5">
            <span>
              Showing <strong className="text-foreground">{filteredRequests.length}</strong> of{' '}
              <strong>{requests.length}</strong> withdrawal requests
            </span>
            <button
              type="button"
              onClick={resetFilters}
              className="text-primary hover:underline font-medium"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Main Content Card */}
      <Card className="border border-border/80 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="w-[130px] font-semibold text-foreground">Student ID</TableHead>
                  <TableHead className="w-[170px] font-semibold text-foreground">Student Name</TableHead>
                  <TableHead className="w-[170px] font-semibold text-foreground">Withdraw Type</TableHead>
                  <TableHead className="w-[130px] font-semibold text-foreground">Program Type</TableHead>
                  <TableHead className="w-[140px] font-semibold text-foreground">Academic Year</TableHead>
                  <TableHead className="min-w-[240px] font-semibold text-foreground">Reason</TableHead>
                  <TableHead className="text-center w-[110px] font-semibold text-foreground">Status</TableHead>
                  <TableHead className="text-center w-[190px] font-semibold text-foreground">Action</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {filteredRequests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <FileText className="w-8 h-8 text-muted-foreground/60 stroke-1" />
                        <p className="text-sm font-medium">
                          {requests.length === 0
                            ? 'No withdrawal requests found'
                            : 'No matching withdrawal requests found'}
                        </p>
                        {isFiltered && (
                          <div className="flex flex-col items-center gap-2 mt-1">
                            <p className="text-xs text-muted-foreground">
                              Try adjusting your search keywords or clear the active dropdown filters.
                            </p>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={resetFilters}
                              className="mt-1 text-xs gap-1.5"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              Reset Filters
                            </Button>
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRequests.map((r) => {
                    const isUnivWithdrawal =
                      r.withdrawalType === 'University Withdrawal' ||
                      r.withdrawalType?.toLowerCase().includes('university')
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
                        {/* Student ID */}
                        <TableCell className="font-mono text-xs font-semibold text-foreground">
                          {r.studentId}
                        </TableCell>

                        {/* Student Name */}
                        <TableCell className="font-medium text-foreground text-xs">
                          {r.studentName}
                        </TableCell>

                        {/* Withdraw Type */}
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

                        {/* Program Type */}
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

                        {/* Status */}
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
                              disabled={isApproved}
                              className={`h-7 px-2.5 text-xs font-medium transition-all ${
                                isApproved
                                  ? 'bg-emerald-600 hover:bg-emerald-600 text-white border-transparent cursor-default opacity-95 disabled:opacity-95'
                                  : 'text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                              }`}
                              title={isApproved ? 'Approved' : 'Approve withdrawal request'}
                              onClick={(e) => {
                                if (isApproved) return
                                handleQuickAction(r, 'approved', e)
                              }}
                            >
                              <Check className="w-3 h-3 mr-1" />
                              {isApproved ? 'Approved' : 'Approve'}
                            </Button>

                            {/* Reject Button - automatically removed once Approved */}
                            {!isApproved && (
                              <Button
                                size="sm"
                                variant={isRejected ? 'destructive' : 'outline'}
                                disabled={isRejected}
                                className={`h-7 px-2.5 text-xs font-medium transition-all ${
                                  isRejected
                                    ? 'bg-rose-600 hover:bg-rose-600 text-white cursor-default'
                                    : 'text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                                }`}
                                title={isRejected ? 'Rejected' : 'Reject withdrawal request'}
                                onClick={(e) => {
                                  if (isRejected) return
                                  handleOpenConfirm(r, 'rejected', e)
                                }}
                              >
                                <X className="w-3 h-3 mr-1" />
                                {isRejected ? 'Rejected' : 'Reject'}
                              </Button>
                            )}
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
                {selectedRequest.status !== 'approved' && (
                  <Button
                    type="button"
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={(e) => {
                      handleQuickAction(selectedRequest, 'approved', e)
                      setSelectedRequest((prev) => ({ ...prev, status: 'approved' }))
                    }}
                  >
                    <Check className="w-3.5 h-3.5 mr-1" />
                    Approve Request
                  </Button>
                )}
                {selectedRequest.status !== 'approved' && (
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
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
export default AdminWithdrawalsPage
