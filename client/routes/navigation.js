import {
  BookOpen,
  BookOpenCheck,
  ClipboardCheck,
  ClipboardList,
  FileBarChart,
  FileText,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  NotebookPen,
  ScrollText,
  SlidersHorizontal,
  TrendingUp,
  UserCheck,
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
        { to: '/dept-head/teachers', label: 'Department Teachers', icon: Users },
        { to: '/dept-head/students', label: 'Department Students', icon: GraduationCap },
        { to: '/dept-head/assignments', label: 'Teacher Assignments', icon: UserCheck },
      ],
    },
    {
      section: 'Grading',
      items: [
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
        { to: '/teacher/students', label: 'Students', icon: GraduationCap },
        { to: '/teacher/assessments', label: 'Assessments', icon: ClipboardList },
      ],
    },
    {
      section: 'Grading',
      items: [
        { to: '/teacher/grade-entry', label: 'Grade Entry', icon: NotebookPen },
        { to: '/teacher/grade-submission', label: 'Grade Submission', icon: ClipboardCheck },
      ],
    },
  ],
  student: [
    { section: 'Overview', items: [{ to: '/student', label: 'Dashboard', icon: LayoutDashboard, end: true }] },
    {
      section: 'Academics',
      items: [
        { to: '/student/courses', label: 'My Courses', icon: BookOpen },
        { to: '/student/assessments', label: 'My Assessments', icon: ListChecks },
        { to: '/student/grades', label: 'My Grades', icon: BookOpenCheck },
        { to: '/student/progress', label: 'GPA & Academic Progress', icon: TrendingUp },
        { to: '/student/transcript', label: 'Transcript', icon: FileText },
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
