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
  submitted: ['warning', 'Submitted to Dept Head'],
  submitted_to_dept_head: ['warning', 'Submitted to Dept Head'],
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
      title={letter === 'W' ? 'Withdrawn' : letter === 'I' ? 'Incomplete' : fail ? 'Fail' : 'Pass'}
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
      <XCircle aria-hidden="true" /> Fail
    </Badge>
  )
}

const PROGRAM_OPTIONS = [
  { value: 'regular', label: 'Regular' },
  { value: 'weekend', label: 'Weekend' },
  { value: 'extension', label: 'Extension' },
]

const PROGRAM_BADGE_CLASS = {
  regular: 'border-blue-200 text-blue-700 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20',
  extension: 'border-purple-200 text-purple-700 dark:text-purple-400 bg-purple-50/50 dark:bg-purple-950/20',
  weekend: 'border-amber-200 text-amber-700 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20',
}

/** Program type badge (Regular, Extension, Weekend) */
export function ProgramTypeBadge({ programType, className }) {
  if (!programType) return <span className="text-muted-foreground">—</span>
  const key = String(programType).toLowerCase()
  const label = PROGRAM_OPTIONS.find((o) => o.value === key)?.label ?? programType
  return (
    <Badge
      variant="outline"
      className={cn('text-[11px] font-medium whitespace-nowrap', PROGRAM_BADGE_CLASS[key] ?? PROGRAM_BADGE_CLASS.weekend, className)}
    >
      {label}
    </Badge>
  )
}

