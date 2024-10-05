import { useEffect, useState, useCallback } from 'react'
import { api, getStoredUser } from '@/api/client'

function formatWithdrawal(r) {
  const clearances = r.clearances || []
  return {
    id: r.id,
    requestId: r.referenceNo || r.id,
    referenceNo: r.referenceNo,
    studentId: r.student?.studentNumber || r.studentNumber || '—',
    studentName: r.student?.name || r.name || '—',
    department: r.student?.department?.name || r.department || '—',
    departmentCode: r.student?.department?.code || r.departmentCode || '—',
    programType: r.student?.programType ? r.student.programType.charAt(0).toUpperCase() + r.student.programType.slice(1) : (r.programType || 'Regular'),
    withdrawalType: r.scope === 'course' ? 'Course Withdrawal' : r.scope === 'university' ? 'University Withdrawal' : 'Semester Withdrawal',
    scope: r.scope,
    academicYear: r.semester?.academicYear?.name || '2026/2027',
    semester: r.semester?.name || 'First Semester',
    reasonCategory: r.reasonCategory?.label || r.reasonCategory || 'General',
    reason: r.reason,
    status: r.status,
    requestDate: r.submittedAt ? new Date(r.submittedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Recent',
    adminNotes: r.adminNotes,
    clearance: {
      department: clearances.find((c) => c.office === 'department')?.status || 'pending',
      library: clearances.find((c) => c.office === 'library')?.status || 'pending',
      housing: clearances.find((c) => c.office === 'housing')?.status || 'pending',
      registrar: clearances.find((c) => c.office === 'registrar')?.status || 'pending',
    },
    raw: r,
  }
}

export function useWithdrawalRequests() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchRequests = useCallback(async () => {
    try {
      const user = getStoredUser()
      let list = []
      if (user?.roleId === 'student') {
        list = await api.get('/student/withdrawal-requests')
      } else {
        const res = await api.get('/withdrawal-requests', { pageSize: 100 })
        list = res.items || res
      }
      if (Array.isArray(list)) {
        setRequests(list.map(formatWithdrawal))
      }
    } catch (err) {
      console.error('Failed to fetch withdrawal requests:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRequests()
  }, [fetchRequests])

  const addRequest = async (newRecord) => {
    try {
      const scopeMap = {
        'Course Withdrawal': 'course',
        'Semester Withdrawal': 'semester',
        'University Withdrawal': 'university',
      }
      const scope = scopeMap[newRecord.withdrawalType] || 'semester'
      const payload = {
        scope,
        semesterId: newRecord.semesterId || 'sem_2026_fall',
        reasonCategoryId: (newRecord.reasonCategory || 'personal').toLowerCase().includes('med') ? 'medical' : 'personal',
        reason: newRecord.reason,
        acknowledged: true,
      }
      await api.post('/student/withdrawal-requests', payload)
      await fetchRequests()
    } catch (err) {
      console.error('Failed to submit withdrawal:', err)
      throw err
    }
  }

  const updateStatus = async (requestId, newStatus, adminNotes) => {
    try {
      const match = requests.find((r) => r.requestId === requestId || r.id === requestId)
      const targetId = match ? match.id : requestId

      if (newStatus === 'approved') {
        // Approve any pending clearances first if admin
        const clearances = ['department', 'library', 'housing', 'registrar']
        for (const off of clearances) {
          try {
            await api.patch(`/withdrawal-requests/${targetId}/clearances/${off}`, { status: 'approved' })
          } catch {
            // ignore if already approved
          }
        }
        await api.post(`/withdrawal-requests/${targetId}/approve`, { adminNotes: adminNotes || 'Approved by Registrar.' })
      } else if (newStatus === 'rejected') {
        await api.post(`/withdrawal-requests/${targetId}/reject`, { adminNotes: adminNotes || 'Rejected by Registrar.' })
      }
      await fetchRequests()
    } catch (err) {
      console.error('Failed to update withdrawal status:', err)
      throw err
    }
  }

  const deleteRequest = async (requestId) => {
    const match = requests.find((r) => r.requestId === requestId || r.id === requestId)
    const targetId = match ? match.id : requestId
    try {
      await api.post(`/student/withdrawal-requests/${targetId}/cancel`)
      await fetchRequests()
    } catch (err) {
      console.error('Failed to cancel withdrawal:', err)
      throw err
    }
  }

  return {
    requests,
    loading,
    addRequest,
    updateStatus,
    deleteRequest,
    refetch: fetchRequests,
  }
}
