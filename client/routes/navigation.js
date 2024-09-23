import {
  BookOpen,
  BookOpenCheck,
  CalendarClock,
  ClipboardCheck,
  ClipboardList,
  FileBarChart,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  NotebookPen,
  ScrollText,
  SlidersHorizontal,
  UserCheck,
  UserMinus,
  Users,
} from 'lucide-react'

/** Sidebar navigation per actor. Only the authenticated role's items are shown. */
export const NAVIGATION = {
  admin: [
    { section: 'Overview', items: [{ to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true }] },
    {
      section: 'People',
      items: [{ to: '/admin/users', label: 'Account Provision', icon: Users }],
    },
    {
      section: 'Academics',
      items: [
        { to: '/admin/courses', label: 'Courses', icon: BookOpen },
        { to: '/admin/assignments', label: 'Teacher Assignments', icon: UserCheck },
        {
          to: '/admin/semester-registration',
          label: 'Semester Registration Management',
          icon: CalendarClock,
          children: [
            { to: '/admin/semester-registration/periods', label: 'Registration Periods' },
            { to: '/admin/semester-registration/students', label: 'Student Registrations' },
          ],
        },
        { to: '/admin/withdrawals', label: 'Student Withdrawals', icon: UserMinus },
      ],
    },
    {
      section: 'Grading',
      items: [
        { to: '/admin/grading-policies', label: 'Grading Policies', icon: SlidersHorizontal },
        { to: '/admin/reports', label: 'Reports', icon: FileBarChart },
      ],
    },
    {
      section: 'System',
      items: [
        { to: '/admin/audit-logs', label: 'Audit Logs', icon: ScrollText },
      ],
    },
  ],
  dept_head: [
    { section: 'Overview', items: [{ to: '/dept-head', label: 'Dashboard', icon: LayoutDashboard, end: true }] },
    {
      section: 'People',
      items: [{ to: '/dept-head/account-provision', label: 'Account Provision', icon: Users }],
    },
    {
      section: 'Department',
      items: [
        { to: '/dept-head/courses', label: 'Department Courses', icon: BookOpen },
        { to: '/dept-head/students', label: 'Department Students', icon: GraduationCap },
        { to: '/dept-head/assignments', label: 'Teacher Assignments', icon: UserCheck },
      ],
    },
    {
      section: 'Grading',
      items: [
        { to: '/dept-head/approvals', label: 'Grade Approval', icon: ClipboardCheck },
        { to: '/dept-head/reports', label: 'Reports', icon: FileBarChart },
      ],
    },
  ],
  teacher: [
    { section: 'Overview', items: [{ to: '/teacher', label: 'Dashboard', icon: LayoutDashboard, end: true }] },
    {
      section: 'Teaching',
      items: [
        { to: '/teacher/courses', label: 'My Courses', icon: BookOpen },
        { to: '/teacher/students', label: 'Course Students', icon: GraduationCap },
        { to: '/teacher/assessments', label: 'Assessment Management', icon: ClipboardList },
      ],
    },
    {
      section: 'Grading',
      items: [
        { to: '/teacher/grade-sheet', label: 'Grade Sheet', icon: FileSpreadsheet },
        { to: '/teacher/entermark', label: 'Entermark', icon: NotebookPen },
        { to: '/teacher/grade-submission', label: 'Grade Submission', icon: ClipboardCheck },
      ],
    },
  ],
  student: [
    { section: 'Overview', items: [{ to: '/student', label: 'Dashboard', icon: LayoutDashboard, end: true }] },
    {
      section: 'Academics',
      items: [
        { to: '/student/registrations', label: 'Semester Registration', icon: UserCheck },
        { to: '/student/courses', label: 'My Courses', icon: BookOpen },
        { to: '/student/assessments', label: 'My Assessments', icon: ListChecks },
        { to: '/student/grades', label: 'My Grades', icon: BookOpenCheck },
        { to: '/student/grade-report', label: 'Grade Report', icon: FileBarChart },
        { to: '/student/transcript', label: 'Transcript', icon: FileText },
        { to: '/student/withdrawals', label: 'Withdrawal Request', icon: UserMinus },
      ],
    },
  ],
}

export const HOME_BY_ROLE = {
  admin: '/admin',
  dept_head: '/dept-head',
  teacher: '/teacher',
  student: '/student',
}
