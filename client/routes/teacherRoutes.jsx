import { lazy } from 'react';
import { Route } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';

const page = (loader, name) =>
  lazy(() => loader().then((m) => ({ default: m[name] ?? m.default })));

// Teacher Pages
const TeacherDashboardPage = page(() => import('@/features/teacher/dashboard/TeacherDashboardPage'), 'TeacherDashboardPage');
const TeacherCoursesPage = page(() => import('@/features/teacher/courses/MyCoursesPage'), 'MyCoursesPage');
const TeacherCourseDetailPage = page(() => import('@/features/teacher/courses/CourseDetailPage'), 'CourseDetailPage');
const TeacherStudentPerformancePage = page(() => import('@/features/teacher/students/StudentPerformancePage'), 'StudentPerformancePage');
const TeacherStudentsPage = page(() => import('@/features/teacher/students/StudentsPage'), 'StudentsPage');
const AssessmentsPage = page(() => import('@/features/teacher/assessments/AssessmentsPage'), 'AssessmentsPage');
const EntermarkPage = page(() => import('@/features/teacher/grade-entry/EntermarkPage'), 'EntermarkPage');
const GradeEntryIndexPage = page(() => import('@/features/teacher/grade-entry/GradeEntryIndexPage'), 'GradeEntryIndexPage');
const GradeEntryPage = page(() => import('@/features/teacher/grade-entry/GradeEntryPage'), 'GradeEntryPage');
const TeacherGradeSheetPage = page(() => import('@/features/teacher/grade-sheet/GradeSheetPage'), 'GradeSheetPage');
const GradeSubmissionPage = page(() => import('@/features/teacher/submission/GradeSubmissionPage'), 'GradeSubmissionPage');
const PerformanceReportsPage = page(() => import('@/features/teacher/reports/PerformanceReportsPage'), 'PerformanceReportsPage');

export const teacherRoutes = (
  <Route element={<ProtectedRoute roles={['teacher']} />}>
    <Route path="/teacher" element={<TeacherDashboardPage />} />
    <Route path="/teacher/courses" element={<TeacherCoursesPage />} />
    <Route path="/teacher/courses/:offeringId" element={<TeacherCourseDetailPage />} />
    <Route path="/teacher/courses/:offeringId/students/:enrollmentId" element={<TeacherStudentPerformancePage />} />
    <Route path="/teacher/students" element={<TeacherStudentsPage />} />
    <Route path="/teacher/assessments" element={<AssessmentsPage />} />
    <Route path="/teacher/assessments/:offeringId" element={<AssessmentsPage />} />
    <Route path="/teacher/entermark" element={<EntermarkPage />} />
    <Route path="/teacher/entermark/:offeringId" element={<EntermarkPage />} />
    <Route path="/teacher/grade-entry" element={<GradeEntryIndexPage />} />
    <Route path="/teacher/grade-entry/:offeringId" element={<GradeEntryPage />} />
    <Route path="/teacher/grade-sheet" element={<TeacherGradeSheetPage />} />
    <Route path="/teacher/grade-submission" element={<GradeSubmissionPage />} />
    <Route path="/teacher/reports" element={<PerformanceReportsPage />} />
    <Route path="/teacher/reports/:offeringId" element={<PerformanceReportsPage />} />
  </Route>
);
