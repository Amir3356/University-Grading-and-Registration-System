import { lazy } from 'react';
import { Route } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';

const page = (loader, name) =>
  lazy(() => loader().then((m) => ({ default: m[name] ?? m.default })));

// Department Head Pages
const DeptHeadDashboardPage = page(() => import('@/features/dept-head/DeptHeadDashboardPage'), 'DeptHeadDashboardPage');
const DeptAccountProvisionPage = page(() => import('@/features/dept-head/DeptAccountProvisionPage'), 'DeptAccountProvisionPage');
const DeptCoursesPage = page(() => import('@/features/dept-head/DeptCoursesPage'), 'DeptCoursesPage');
const DeptTeachersPage = page(() => import('@/features/dept-head/DeptTeachersPage'), 'DeptTeachersPage');
const DeptStudentsPage = page(() => import('@/features/dept-head/DeptStudentsPage'), 'DeptStudentsPage');
const AssignmentsPage = page(() => import('@/features/admin/assignments/AssignmentsPage'), 'AssignmentsPage');
const DeptApprovalsPage = page(() => import('@/features/dept-head/DeptApprovalsPage'), 'DeptApprovalsPage');
const ApprovalDetailPage = page(() => import('@/features/admin/approvals/ApprovalDetailPage'), 'ApprovalDetailPage');
const DeptReportsPage = page(() => import('@/features/dept-head/DeptReportsPage'), 'DeptReportsPage');
const GradeSheetPage = page(() => import('@/features/admin/reports/GradeSheetPage'), 'GradeSheetPage');

export const deptHeadRoutes = (
  <Route element={<ProtectedRoute roles={['dept_head']} />}>
    <Route path="/dept-head" element={<DeptHeadDashboardPage />} />
    <Route path="/dept-head/account-provision" element={<DeptAccountProvisionPage />} />
    <Route path="/dept-head/users" element={<DeptAccountProvisionPage />} />
    <Route path="/dept-head/courses" element={<DeptCoursesPage />} />
    <Route path="/dept-head/teachers" element={<DeptTeachersPage />} />
    <Route path="/dept-head/students" element={<DeptStudentsPage />} />
    <Route path="/dept-head/assignments" element={<AssignmentsPage />} />
    <Route path="/dept-head/approvals" element={<DeptApprovalsPage />} />
    <Route path="/dept-head/grade-approval" element={<DeptApprovalsPage />} />
    <Route path="/dept-head/grade-approvals" element={<DeptApprovalsPage />} />
    <Route path="/dept-head/approvals/:requestId" element={<ApprovalDetailPage />} />
    <Route path="/dept-head/reports" element={<DeptReportsPage />} />
    <Route path="/dept-head/reports/grade-sheet/:offeringId" element={<GradeSheetPage />} />
  </Route>
);
