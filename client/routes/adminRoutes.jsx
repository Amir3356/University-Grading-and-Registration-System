import { lazy } from 'react';
import { Route } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';

const page = (loader, name) =>
  lazy(() => loader().then((m) => ({ default: m[name] ?? m.default })));

// Admin Pages
const AdminDashboardPage = page(() => import('@/features/admin/dashboard/AdminDashboardPage'), 'AdminDashboardPage');
const UsersPage = page(() => import('@/features/admin/users/UsersPage'), 'UsersPage');
const UserDetailPage = page(() => import('@/features/admin/users/UserDetailPage'), 'UserDetailPage');
const DepartmentsPage = page(() => import('@/features/admin/departments/DepartmentsPage'), 'DepartmentsPage');
const CoursesPage = page(() => import('@/features/admin/courses/CoursesPage'), 'CoursesPage');
const AcademicCalendarPage = page(() => import('@/features/admin/calendar/AcademicCalendarPage'), 'AcademicCalendarPage');
const EnrollmentPage = page(() => import('@/features/admin/enrollment/EnrollmentPage'), 'EnrollmentPage');
const AssignmentsPage = page(() => import('@/features/admin/assignments/AssignmentsPage'), 'AssignmentsPage');
const GradingPoliciesPage = page(() => import('@/features/admin/grading/GradingPoliciesPage'), 'GradingPoliciesPage');
const ApprovalsPage = page(() => import('@/features/admin/approvals/ApprovalsPage'), 'ApprovalsPage');
const ApprovalDetailPage = page(() => import('@/features/admin/approvals/ApprovalDetailPage'), 'ApprovalDetailPage');
const ReportsPage = page(() => import('@/features/admin/reports/ReportsPage'), 'ReportsPage');
const AdminTranscriptPage = page(() => import('@/features/admin/reports/AdminTranscriptPage'), 'AdminTranscriptPage');
const StudentReportPage = page(() => import('@/features/admin/reports/StudentReportPage'), 'StudentReportPage');
const GradeSheetPage = page(() => import('@/features/admin/reports/GradeSheetPage'), 'GradeSheetPage');
const SettingsPage = page(() => import('@/features/admin/settings/SettingsPage'), 'SettingsPage');
const RegistrationPeriodsPage = page(() => import('@/features/admin/registration/RegistrationPeriodsPage'), 'RegistrationPeriodsPage');
const StudentRegistrationsPage = page(() => import('@/features/admin/registration/StudentRegistrationsPage'), 'StudentRegistrationsPage');
const AdminWithdrawalsPage = page(() => import('@/features/admin/withdrawals/AdminWithdrawalsPage'), 'AdminWithdrawalsPage');

export const adminRoutes = (
  <Route element={<ProtectedRoute roles={['admin']} />}>
    <Route path="/admin" element={<AdminDashboardPage />} />
    <Route path="/admin/users" element={<UsersPage />} />
    <Route path="/admin/users/:userId" element={<UserDetailPage />} />
    <Route path="/admin/departments" element={<DepartmentsPage />} />
    <Route path="/admin/courses" element={<CoursesPage />} />
    <Route path="/admin/academic-calendar" element={<AcademicCalendarPage />} />
    <Route path="/admin/enrollment" element={<EnrollmentPage />} />
    <Route path="/admin/assignments" element={<AssignmentsPage />} />
    <Route path="/admin/grading-policies" element={<GradingPoliciesPage />} />
    <Route path="/admin/grade-approvals" element={<ApprovalsPage />} />
    <Route path="/admin/grade-approvals/:requestId" element={<ApprovalDetailPage />} />
    <Route path="/admin/reports" element={<ReportsPage />} />
    <Route path="/admin/reports/transcripts/:studentId" element={<AdminTranscriptPage />} />
    <Route path="/admin/reports/students/:studentId" element={<StudentReportPage />} />
    <Route path="/admin/reports/grade-sheet/:offeringId" element={<GradeSheetPage />} />
    <Route path="/admin/settings" element={<SettingsPage />} />

    <Route path="/admin/semester-registration" element={<RegistrationPeriodsPage />} />
    <Route path="/admin/semester-registration/periods" element={<RegistrationPeriodsPage />} />
    <Route path="/admin/semester-registration/students" element={<StudentRegistrationsPage />} />
    <Route path="/admin/registration-management" element={<RegistrationPeriodsPage />} />
    <Route path="/admin/withdrawals" element={<AdminWithdrawalsPage />} />
  </Route>
);
