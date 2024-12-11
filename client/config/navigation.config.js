import {
  BookOpen,
  BookOpenCheck,
  CalendarClock,
  ClipboardCheck,
  ClipboardList,
  FileBarChart,
  FileText,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  MessageSquareWarning,
  NotebookPen,
  ShieldCheck,
  SlidersHorizontal,
  UserCheck,
  UserMinus,
  Users,
} from 'lucide-react';

/** Sidebar navigation per actor. Only the authenticated role's items are shown. */
export const NAVIGATION = {
  admin: [
    {
      section: 'People',
      items: [{ to: '/admin/users', label: 'Account Provision', icon: Users }],
    },
    {
      section: 'Academics',
      items: [
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
      ],
    },
    {
      section: 'Reports',
      items: [
        { to: '/admin/reports', label: 'Reports', icon: FileBarChart },
      ],
    },
    {
      section: 'Governance',
      items: [
        { to: '/admin/audit', label: 'Audit Trail', icon: ShieldCheck },
      ],
    },
  ],

  dept_head: [
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
        { to: '/teacher/assessments', label: 'Assessment Management', icon: ClipboardList },
      ],
    },
    {
      section: 'Grading',
      items: [
        { to: '/teacher/entermark', label: 'Entermark', icon: NotebookPen },
        { to: '/teacher/reports', label: 'Report', icon: FileBarChart },
        { to: '/teacher/complaints', label: 'Complain', icon: MessageSquareWarning },
      ],
    },
  ],

  student: [
    {
      section: 'Academics',
      items: [
        { to: '/student/registrations', label: 'Semester Registration', icon: UserCheck },
        { to: '/student/courses', label: 'My Courses', icon: BookOpen },
        { to: '/student/assessments', label: 'Teacher Assessment', icon: ListChecks },
        { to: '/student/grades', label: 'My Grades', icon: BookOpenCheck },
        { to: '/student/grade-report', label: 'Report', icon: FileBarChart },
        { to: '/student/transcript', label: 'Transcript', icon: FileText },
        { to: '/student/withdrawals', label: 'Withdrawal Request', icon: UserMinus },
        { to: '/student/complaints', label: 'Complain', icon: MessageSquareWarning },
      ],
    },
  ],
};

export const HOME_BY_ROLE = {
  admin: '/admin/reports',
  dept_head: '/dept-head/reports',
  teacher: '/teacher',
  student: '/student/registrations',
};
