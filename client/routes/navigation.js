import {
  Bell,
  BookOpen,
  BookOpenCheck,
  Building2,
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  FileBarChart,
  FileCheck2,
  FileText,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  NotebookPen,
  ScrollText,
  Settings,
  SlidersHorizontal,
  TrendingUp,
  UserCheck,
  UserCircle,
  UserPlus,
  Users,
} from 'lucide-react'

/** Sidebar navigation per actor. Only the authenticated role's items are shown. */
export const NAVIGATION = {
  admin: [
    { section: 'Overview', items: [{ to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true }] },
    {
      section: 'People',
      items: [{ to: '/admin/users', label: 'Users', icon: Users }],
    },
    {
      section: 'Academics',
      items: [
        { to: '/admin/departments', label: 'Departments', icon: Building2 },
        { to: '/admin/courses', label: 'Courses', icon: BookOpen },
        { to: '/admin/academic-calendar', label: 'Academic Years & Semesters', icon: CalendarRange },
        { to: '/admin/enrollment', label: 'Student Enrollment', icon: UserPlus },
        { to: '/admin/assignments', label: 'Teacher Assignments', icon: UserCheck },
      ],
    },
    {
      section: 'Grading',
      items: [
        { to: '/admin/grading-policies', label: 'Grading Policies', icon: SlidersHorizontal },
        { to: '/admin/grade-approvals', label: 'Grade Approvals', icon: FileCheck2, badgeKey: 'pendingApprovals' },
        { to: '/admin/reports', label: 'Reports & Transcripts', icon: FileBarChart },
      ],
    },
    {
      section: 'System',
      items: [
        { to: '/admin/audit-logs', label: 'Audit Logs', icon: ScrollText },
        { to: '/admin/settings', label: 'Settings', icon: Settings },
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
        { to: '/teacher/reports', label: 'Performance Reports', icon: TrendingUp },
      ],
    },
    {
      section: 'Account',
      items: [
        { to: '/notifications', label: 'Notifications', icon: Bell, badgeKey: 'unread' },
        { to: '/profile', label: 'Profile', icon: UserCircle },
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
    {
      section: 'Account',
      items: [
        { to: '/notifications', label: 'Notifications', icon: Bell, badgeKey: 'unread' },
        { to: '/profile', label: 'Profile', icon: UserCircle },
      ],
    },
  ],
}

export const HOME_BY_ROLE = { admin: '/admin', teacher: '/teacher', student: '/student' }
