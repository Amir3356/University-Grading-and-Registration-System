import { Navigate } from 'react-router-dom'

export function AdminDashboardPage() {
  return <Navigate to="/admin/reports" replace />
}

export default AdminDashboardPage
