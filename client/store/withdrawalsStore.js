import { useEffect, useState, useCallback } from 'react';
import { getStoredUser } from '@/lib/storage';
import {
  listWithdrawalRequestsApi,
  listStudentWithdrawalRequestsApi,
  submitStudentWithdrawalApi,
  cancelStudentWithdrawalApi,
  approveWithdrawalApi,
  rejectWithdrawalApi,
  updateClearanceApi,
} from '@/api/withdrawals';

function formatWithdrawal(r) {
  const clearances = r.clearances || [];
  return {
    id: r.id,
    requestId: r.referenceNo || r.id,
    referenceNo: r.referenceNo,
    studentId: r.student?.studentNumber || r.studentNumber || '—',
    studentName: r.student?.name || r.name || '—',
    department: r.student?.department?.name || r.department || '—',
    departmentCode: r.student?.department?.code || r.departmentCode || '—',
    programType: r.student?.programType
      ? r.student.programType.charAt(0).toUpperCase() + r.student.programType.slice(1)
      : r.programType || 'Regular',
    withdrawalType:
      r.scope === 'course'
        ? 'Course Withdrawal'
        : r.scope === 'university'
        ? 'Complete University Withdrawal'
        : `${(r.semester?.academicYear?.name || String(new Date().getFullYear())).split('/')[0]} ${r.semester?.name || 'First Semester'}`,
    scope: r.scope,
    academicYear: r.semester?.academicYear?.name || String(new Date().getFullYear()),
    semester: r.semester?.name || 'First Semester',
    reasonCategory: r.reasonCategory?.label || r.reasonCategory || 'General',
    reason: r.reason,
    status: r.status,
    requestDate: r.submittedAt
      ? new Date(r.submittedAt).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      : 'Recent',
    adminNotes: r.adminNotes,
    clearance: {
      department: clearances.find((c) => c.office === 'department')?.status || 'pending',
      library: clearances.find((c) => c.office === 'library')?.status || 'pending',
      housing: clearances.find((c) => c.office === 'housing')?.status || 'pending',
      registrar: clearances.find((c) => c.office === 'registrar')?.status || 'pending',
    },
    raw: r,
  };
}

export function useWithdrawalRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = useCallback(async () => {
    try {
      const user = getStoredUser();
      let list = [];
      if (user?.roleId === 'student') {
        list = await listStudentWithdrawalRequestsApi();
      } else {
        const res = await listWithdrawalRequestsApi({ pageSize: 100 });
        list = res.items || res;
      }
      if (Array.isArray(list)) {
        setRequests(list.map(formatWithdrawal));
      }
    } catch (err) {
      console.error('Failed to fetch withdrawal requests:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const addRequest = async (newRecord) => {
    try {
      const scopeMap = {
        'Course Withdrawal': 'course',
        'Semester Withdrawal': 'semester',
        'University Withdrawal': 'university',
        'Complete University Withdrawal': 'university',
      };
      const isUniv = (newRecord.withdrawalType || '').toLowerCase().includes('university');
      const scope = isUniv ? 'university' : (scopeMap[newRecord.withdrawalType] || 'semester');
      const payload = {
        scope,
        semesterId: newRecord.semesterId || 'sem_2026_fall',
        reasonCategoryId: (newRecord.reasonCategory || 'personal').toLowerCase().includes('med')
          ? 'medical'
          : 'personal',
        reason: newRecord.reason,
        acknowledged: true,
      };
      await submitStudentWithdrawalApi(payload);
      await fetchRequests();
    } catch (err) {
      console.error('Failed to submit withdrawal:', err);
      throw err;
    }
  };

  const updateStatus = async (requestId, newStatus, adminNotes) => {
    const target = requests.find((r) => r.requestId === requestId || r.id === requestId);
    if (target?.status === 'approved' && newStatus === 'rejected') {
      console.warn('Cannot reject an already approved withdrawal request.');
      return;
    }

    // Optimistically update local state immediately so user sees status change without waiting
    setRequests((prev) =>
      prev.map((r) =>
        r.id === requestId || r.requestId === requestId
          ? {
              ...r,
              status: newStatus,
              adminNotes:
                adminNotes ||
                (newStatus === 'approved'
                  ? 'Official withdrawal approved by Registrar Administration.'
                  : 'Withdrawal request rejected by Registrar Administration.'),
              clearance:
                newStatus === 'approved'
                  ? {
                      department: 'approved',
                      library: 'approved',
                      housing: 'approved',
                      registrar: 'approved',
                    }
                  : r.clearance,
            }
          : r
      )
    );

    try {
      const match = requests.find((r) => r.requestId === requestId || r.id === requestId);
      const targetId = match ? match.id : requestId;

      if (newStatus === 'approved') {
        const clearances = ['department', 'library', 'housing', 'registrar'];
        for (const off of clearances) {
          try {
            await updateClearanceApi(targetId, off, { status: 'approved' });
          } catch {
            // ignore if already approved
          }
        }
        await approveWithdrawalApi(targetId, {
          adminNotes: adminNotes || 'Approved by Registrar.',
        });
      } else if (newStatus === 'rejected') {
        await rejectWithdrawalApi(targetId, {
          adminNotes: adminNotes || 'Rejected by Registrar.',
        });
      }
      await fetchRequests();
    } catch (err) {
      console.warn('API update failed, local optimistic state retained:', err);
    }
  };

  const updateRequest = async (updatedRecord) => {
    setRequests((prev) =>
      prev.map((r) =>
        r.id === updatedRecord.id || r.requestId === updatedRecord.requestId
          ? { ...r, ...updatedRecord }
          : r
      )
    );
  };

  const deleteRequest = async (requestId) => {
    const match = requests.find((r) => r.requestId === requestId || r.id === requestId);
    const targetId = match ? match.id : requestId;
    try {
      await cancelStudentWithdrawalApi(targetId);
      await fetchRequests();
    } catch (err) {
      console.warn('API cancel failed, updating local state:', err);
      setRequests((prev) =>
        prev.filter((r) => r.id !== targetId && r.requestId !== targetId && r.requestId !== requestId)
      );
    }
  };

  return {
    requests,
    loading,
    addRequest,
    updateRequest,
    updateStatus,
    deleteRequest,
    refetch: fetchRequests,
  };
}
