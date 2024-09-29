import { CheckCircle2, CircleDashed, Clock, FileEdit, Globe, Undo2, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { GRADE_STATUS_LABELS } from '@/lib/format'
import { cn } from '@/lib/utils'

const GRADE_STATUS = {
  not_started: { variant: 'muted', icon: CircleDashed },
  draft: { variant: 'secondary', icon: FileEdit },
  submitted: { variant: 'warning', icon: Clock },
  approved: { variant: 'info', icon: CheckCircle2 },
  rejected: { variant: 'danger', icon: Undo2 },
  published: { variant: 'success', icon: Globe },
}

/** Grade workflow status for a course offering. */
export function GradeStatusBadge({ status, className }) {
  const cfg = GRADE_STATUS[status] ?? GRADE_STATUS.not_started
  const Icon = cfg.icon
  return (
    <Badge variant={cfg.variant} className={className}>
      <Icon aria-hidden="true" />
      {GRADE_STATUS_LABELS[status] ?? status}
    </Badge>
  )
}

const GENERIC = {
  active: ['success', 'Active'],
  inactive: ['muted', 'Inactive'],
  archived: ['muted', 'Archived'],
  suspended: ['danger', 'Suspended'],
  enrolled: ['info', 'Enrolled'],
  registered: ['success', 'Registered'],
  completed: ['secondary', 'Completed'],
  withdrawn: ['muted', 'Withdrawn'],
  dropped: ['danger', 'Dropped'],
  pending: ['warning', 'Pending'],
  approved: ['success', 'Approved'],
  rejected: ['danger', 'Rejected'],
  closed: ['muted', 'Closed'],
  upcoming: ['secondary', 'Upcoming'],
  published: ['success', 'Published'],
  in_progress: ['info', 'In progress'],
}

/** Generic status badge for users, enrollments, approval requests, semesters. */
export function StatusBadge({ status, label, className }) {
  const [variant, text] = GENERIC[status] ?? ['outline', status]
  return (
    <Badge variant={variant} className={className}>
      {label ?? text}
    </Badge>
  )
}

/** Letter grade chip. Pass/fail is conveyed by text, not color alone. */
export function GradeBadge({ letter, passed, className }) {
  if (!letter) return <span className="text-muted">—</span>
  const special = letter === 'W' || letter === 'I'
  const fail = letter === 'F' || passed === false
  return (
    <span
      className={cn('grade-chip', special ? 'grade-chip--special' : fail && 'grade-chip--fail', className)}
      title={letter === 'W' ? 'Withdrawn' : letter === 'I' ? 'Incomplete' : fail ? 'Dropped' : 'Pass'}
    >
      {letter}
    </span>
  )
}

export function PassFailBadge({ passed }) {
  if (passed == null) return <span className="text-muted">—</span>
  return passed ? (
    <Badge variant="success">
      <CheckCircle2 aria-hidden="true" /> Pass
    </Badge>
  ) : (
    <Badge variant="danger">
      <XCircle aria-hidden="true" /> Dropped
    </Badge>
  )
}
