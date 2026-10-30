import { lazy } from 'react';
import { Navigate, Route } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';

const page = (loader, name) =>
  lazy(() => loader().then((m) => ({ default: m[name] ?? m.default })));

// Student Pages
const RegistrationsPage = page(() => import('@/features/student/registration/RegistrationsPage'), 'RegistrationsPage');
const StudentCoursesPage = page(() => import('@/features/student/courses/MyCoursesPage'), 'MyCoursesPage');
const MyAssessmentsPage = page(() => import('@/features/student/assessments/MyAssessmentsPage'), 'MyAssessmentsPage');
const MyGradesPage = page(() => import('@/features/student/grades/MyGradesPage'), 'MyGradesPage');
const ProgressPage = page(() => import('@/features/student/progress/ProgressPage'), 'ProgressPage');
const GradeReportPage = page(() => import('@/features/student/reports/GradeReportPage'), 'GradeReportPage');
const TranscriptPage = page(() => import('@/features/student/transcript/TranscriptPage'), 'TranscriptPage');
const WithdrawalRequestsPage = page(() => import('@/features/student/withdrawals/WithdrawalRequestsPage'), 'WithdrawalRequestsPage');
const ComplaintsPage = page(() => import('@/features/student/complaints/ComplaintsPage'), 'ComplaintsPage');

export const studentRoutes = (
  <Route element={<ProtectedRoute roles={['student']} />}>
    <Route path="/student" element={<Navigate to="/student/registrations" replace />} />
    <Route path="/student/registrations" element={<RegistrationsPage />} />
    <Route path="/student/registration" element={<RegistrationsPage />} />
    <Route path="/student/courses" element={<StudentCoursesPage />} />
    <Route path="/student/assessments" element={<MyAssessmentsPage />} />
    <Route path="/student/grades" element={<MyGradesPage />} />
    <Route path="/student/grade-report" element={<GradeReportPage />} />
    <Route path="/student/reports" element={<GradeReportPage />} />
    <Route path="/student/report" element={<GradeReportPage />} />
    <Route path="/student/progress" element={<ProgressPage />} />
    <Route path="/student/transcript" element={<TranscriptPage />} />
    <Route path="/student/withdrawals" element={<WithdrawalRequestsPage />} />
    <Route path="/student/withdrawal-requests" element={<WithdrawalRequestsPage />} />
    <Route path="/student/complaints" element={<ComplaintsPage />} />
    <Route path="/student/complain" element={<ComplaintsPage />} />
  </Route>
);
