import { lazy, Suspense } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { PageSkeleton, Spinner } from '@/components/common/Loading'
import { AppLayout } from '@/components/layout/AppLayout'
import { useAuth } from '@/context/auth-context'
import { LookupsProvider } from '@/context/LookupsProvider'
import { HOME_BY_ROLE } from './navigation'
import { ProtectedRoute } from './ProtectedRoute'

const page = (loader, name) => lazy(() => loader().then((m) => ({ default: m[name] ?? m.default })))

// Auth & shared
const LoginPage = page(() => import('@/features/auth/LoginPage'), 'LoginPage')
const ProfilePage = page(() => import('@/features/shared/ProfilePage'), 'ProfilePage')
const NotificationsPage = page(() => import('@/features/shared/NotificationsPage'), 'NotificationsPage')
const NotFoundPage = page(() => import('@/features/shared/NotFoundPage'), 'NotFoundPage')

// Admin
const AdminDashboardPage = page(() => import('@/features/admin/dashboard/AdminDashboardPage'), 'AdminDashboardPage')
const UsersPage = page(() => import('@/features/admin/users/UsersPage'), 'UsersPage')
const UserDetailPage = page(() => import('@/features/admin/users/UserDetailPage'), 'UserDetailPage')
const DepartmentsPage = page(() => import('@/features/admin/departments/DepartmentsPage'), 'DepartmentsPage')
const CoursesPage = page(() => import('@/features/admin/courses/CoursesPage'), 'CoursesPage')
const AcademicCalendarPage = page(() => import('@/features/admin/calendar/AcademicCalendarPage'), 'AcademicCalendarPage')
const EnrollmentPage = page(() => import('@/features/admin/enrollment/EnrollmentPage'), 'EnrollmentPage')
const AssignmentsPage = page(() => import('@/features/admin/assignments/AssignmentsPage'), 'AssignmentsPage')
const GradingPoliciesPage = page(() => import('@/features/admin/grading/GradingPoliciesPage'), 'GradingPoliciesPage')
const ApprovalsPage = page(() => import('@/features/admin/approvals/ApprovalsPage'), 'ApprovalsPage')
const ApprovalDetailPage = page(() => import('@/features/admin/approvals/ApprovalDetailPage'), 'ApprovalDetailPage')
const ReportsPage = page(() => import('@/features/admin/reports/ReportsPage'), 'ReportsPage')
const AdminTranscriptPage = page(() => import('@/features/admin/reports/AdminTranscriptPage'), 'AdminTranscriptPage')
const StudentReportPage = page(() => import('@/features/admin/reports/StudentReportPage'), 'StudentReportPage')
const GradeSheetPage = page(() => import('@/features/admin/reports/GradeSheetPage'), 'GradeSheetPage')
const AuditLogsPage = page(() => import('@/features/admin/audit/AuditLogsPage'), 'AuditLogsPage')
const SettingsPage = page(() => import('@/features/admin/settings/SettingsPage'), 'SettingsPage')

// Department Head
const DeptHeadDashboardPage = page(() => import('@/features/dept-head/DeptHeadDashboardPage'), 'DeptHeadDashboardPage')
const DeptCoursesPage = page(() => import('@/features/dept-head/DeptCoursesPage'), 'DeptCoursesPage')
const DeptTeachersPage = page(() => import('@/features/dept-head/DeptTeachersPage'), 'DeptTeachersPage')
const DeptStudentsPage = page(() => import('@/features/dept-head/DeptStudentsPage'), 'DeptStudentsPage')
const DeptApprovalsPage = page(() => import('@/features/dept-head/DeptApprovalsPage'), 'DeptApprovalsPage')
const DeptReportsPage = page(() => import('@/features/dept-head/DeptReportsPage'), 'DeptReportsPage')

// Teacher
const TeacherDashboardPage = page(() => import('@/features/teacher/dashboard/TeacherDashboardPage'), 'TeacherDashboardPage')
const TeacherCoursesPage = page(() => import('@/features/teacher/courses/MyCoursesPage'), 'MyCoursesPage')
const TeacherCourseDetailPage = page(() => import('@/features/teacher/courses/CourseDetailPage'), 'CourseDetailPage')
const TeacherStudentsPage = page(() => import('@/features/teacher/students/StudentsPage'), 'StudentsPage')
const TeacherStudentPerformancePage = page(() => import('@/features/teacher/students/StudentPerformancePage'), 'StudentPerformancePage')
const AssessmentsPage = page(() => import('@/features/teacher/assessments/AssessmentsPage'), 'AssessmentsPage')
const GradeEntryIndexPage = page(() => import('@/features/teacher/grade-entry/GradeEntryIndexPage'), 'GradeEntryIndexPage')
const GradeEntryPage = page(() => import('@/features/teacher/grade-entry/GradeEntryPage'), 'GradeEntryPage')
const GradeSubmissionPage = page(() => import('@/features/teacher/submission/GradeSubmissionPage'), 'GradeSubmissionPage')
const PerformanceReportsPage = page(() => import('@/features/teacher/reports/PerformanceReportsPage'), 'PerformanceReportsPage')

// Student
const StudentDashboardPage = page(() => import('@/features/student/dashboard/StudentDashboardPage'), 'StudentDashboardPage')
const StudentCoursesPage = page(() => import('@/features/student/courses/MyCoursesPage'), 'MyCoursesPage')
const StudentCourseDetailPage = page(() => import('@/features/student/courses/CourseDetailPage'), 'CourseDetailPage')
const MyAssessmentsPage = page(() => import('@/features/student/assessments/MyAssessmentsPage'), 'MyAssessmentsPage')
const MyGradesPage = page(() => import('@/features/student/grades/MyGradesPage'), 'MyGradesPage')
const ProgressPage = page(() => import('@/features/student/progress/ProgressPage'), 'ProgressPage')
const TranscriptPage = page(() => import('@/features/student/transcript/TranscriptPage'), 'TranscriptPage')

function HomeRedirect() {
  const { user, loading } = useAuth()
  if (loading) return <Spinner />
  return <Navigate to={user ? HOME_BY_ROLE[user.roleId] : '/login'} replace />
}

function AuthenticatedShell() {
  return (
    <LookupsProvider>
      <AppLayout />
    </LookupsProvider>
  )
}

export function AppRouter() {
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<HomeRedirect />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AuthenticatedShell />}>
            <Route element={<SuspenseOutlet />}>
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/notifications" element={<NotificationsPage />} />

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
                <Route path="/admin/audit-logs" element={<AuditLogsPage />} />
                <Route path="/admin/settings" element={<SettingsPage />} />
              </Route>

              <Route element={<ProtectedRoute roles={['dept_head']} />}>
                <Route path="/dept-head" element={<DeptHeadDashboardPage />} />
                <Route path="/dept-head/courses" element={<DeptCoursesPage />} />
                <Route path="/dept-head/teachers" element={<DeptTeachersPage />} />
                <Route path="/dept-head/students" element={<DeptStudentsPage />} />
                <Route path="/dept-head/assignments" element={<AssignmentsPage />} />
                <Route path="/dept-head/approvals" element={<DeptApprovalsPage />} />
                <Route path="/dept-head/approvals/:requestId" element={<ApprovalDetailPage />} />
                <Route path="/dept-head/reports" element={<DeptReportsPage />} />
                <Route path="/dept-head/reports/grade-sheet/:offeringId" element={<GradeSheetPage />} />
              </Route>

              <Route element={<ProtectedRoute roles={['teacher']} />}>
                <Route path="/teacher" element={<TeacherDashboardPage />} />
                <Route path="/teacher/courses" element={<TeacherCoursesPage />} />
                <Route path="/teacher/courses/:offeringId" element={<TeacherCourseDetailPage />} />
                <Route path="/teacher/courses/:offeringId/students/:enrollmentId" element={<TeacherStudentPerformancePage />} />
                <Route path="/teacher/students" element={<TeacherStudentsPage />} />
                <Route path="/teacher/assessments" element={<AssessmentsPage />} />
                <Route path="/teacher/assessments/:offeringId" element={<AssessmentsPage />} />
                <Route path="/teacher/grade-entry" element={<GradeEntryIndexPage />} />
                <Route path="/teacher/grade-entry/:offeringId" element={<GradeEntryPage />} />
                <Route path="/teacher/grade-submission" element={<GradeSubmissionPage />} />
                <Route path="/teacher/reports" element={<PerformanceReportsPage />} />
                <Route path="/teacher/reports/:offeringId" element={<PerformanceReportsPage />} />
              </Route>

              <Route element={<ProtectedRoute roles={['student']} />}>
                <Route path="/student" element={<StudentDashboardPage />} />
                <Route path="/student/courses" element={<StudentCoursesPage />} />
                <Route path="/student/courses/:enrollmentId" element={<StudentCourseDetailPage />} />
                <Route path="/student/assessments" element={<MyAssessmentsPage />} />
                <Route path="/student/grades" element={<MyGradesPage />} />
                <Route path="/student/progress" element={<ProgressPage />} />
                <Route path="/student/transcript" element={<TranscriptPage />} />
              </Route>

              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </Suspense>
  )
}

/** Keeps the shell visible while a lazily-loaded page is fetched. */
function SuspenseOutlet() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Outlet />
    </Suspense>
  )
}

