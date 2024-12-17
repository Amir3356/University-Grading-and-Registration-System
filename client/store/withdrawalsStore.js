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
  updateStudentWithdrawalApi,
} from '@/api/withdrawals';
import { wsClient } from '@/lib/websocket';

function formatWithdrawal(r) {
  const clearances = r.clearances || [];
  return {
    id: r.id,
    requestId: r.referenceNo || r.reference_no || r.id,
    referenceNo: r.referenceNo || r.reference_no,
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
    semesterId: r.semester?.id || r.semesterId,
    reasonCategory: r.reasonCategory?.label || r.reason_category?.label || r.reasonCategory || 'General',
    reasonCategoryId: r.reasonCategory?.id || r.reason_category?.id || r.reasonCategoryId || 'other',
    reason: r.reason,
    status: r.status,
    requestDate: r.submittedAt || r.submitted_at
      ? new Date(r.submittedAt || r.submitted_at).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      : 'Recent',
    adminNotes: r.adminNotes || r.admin_notes,
    clearance: {
      department: clearances.find((c) => c.office === 'department')?.status || 'pending',
      library: clearances.find((c) => c.office === 'library')?.status || 'pending',
      housing: clearances.find((c) => c.office === 'housing')?.status || 'pending',
      registrar: clearances.find((c) => c.office === 'registrar')?.status || 'pending',
    },
    raw: r,
  };
}

function resolveReasonCategoryId(catId, catLabel) {
  if (catId && [
    'medical',
    'financial',
    'personal_family',
    'relocation_transfer',
    'employment',
    'academic',
    'personal_emergency',
    'other',
  ].includes(catId.toLowerCase())) {
    return catId.toLowerCase();
  }
  const str = (catLabel || catId || '').toLowerCase();
  if (str.includes('med')) return 'medical';
  if (str.includes('finan')) return 'financial';
  if (str.includes('reloc') || str.includes('trans')) return 'relocation_transfer';
  if (str.includes('employ') || str.includes('job') || str.includes('work')) return 'employment';
  if (str.includes('acad')) return 'academic';
  if (str.includes('emerg')) return 'personal_emergency';
  if (str.includes('fam') || str.includes('person')) return 'personal_family';
  return 'other';
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
        const res = await listWithdrawalRequestsApi({ pageSize: 'all' });
        list = res?.items || res || [];
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

  // Initial load
  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // WebSocket real-time reactive sync and window focus listener
  useEffect(() => {
    const unsubChanged = wsClient?.subscribe?.('WITHDRAWAL_CHANGED', () => {
      fetchRequests();
    });
    const unsubApproved = wsClient?.subscribe?.('WITHDRAWAL_APPROVED', () => {
      fetchRequests();
    });
    const unsubUpdated = wsClient?.subscribe?.('WITHDRAWAL_UPDATED', () => {
      fetchRequests();
    });

    const handleFocus = () => fetchRequests();
    window.addEventListener('focus', handleFocus);

    return () => {
      unsubChanged?.();
      unsubApproved?.();
      unsubUpdated?.();
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchRequests]);

  const addRequest = async (newRecord) => {
    try {
      const isUniv =
        (newRecord.withdrawalType || '').toLowerCase().includes('university') ||
        newRecord.scope === 'university';
      const isCourse =
        (newRecord.withdrawalType || '').toLowerCase().includes('course') ||
        newRecord.scope === 'course';
      const scope = isUniv ? 'university' : isCourse ? 'course' : 'semester';

      const reasonCategoryId = resolveReasonCategoryId(
        newRecord.reasonCategoryId,
        newRecord.reasonCategory
      );

      const payload = {
        scope,
        semesterId: scope === 'university' ? null : (newRecord.semesterId || 'sem_2026_fall'),
        enrollmentId: newRecord.enrollmentId || null,
        reasonCategoryId,
        reason: (newRecord.reason || '').trim(),
        acknowledged: true,
      };

      const res = await submitStudentWithdrawalApi(payload);
      await fetchRequests();
      return res;
    } catch (err) {
      console.error('Failed to submit withdrawal:', err);
      throw err;
    }
  };

  const updateStatus = async (requestId, newStatus, adminNotes) => {
    const target = requests.find((r) => r.requestId === requestId || r.id === requestId);
    if (target?.status === 'approved' && newStatus === 'rejected') {
      throw new Error('Approved withdrawal requests cannot be rejected.');
    }

    const targetId = target ? target.id : requestId;
    const defaultNote =
      newStatus === 'approved'
        ? 'Official withdrawal approved by Registrar Administration.'
        : 'Withdrawal request rejected by Registrar Administration.';
    const finalNote = (adminNotes && String(adminNotes).trim()) || defaultNote;

    try {
      if (newStatus === 'approved') {
        await approveWithdrawalApi(targetId, { adminNotes: finalNote });
      } else if (newStatus === 'rejected') {
        await rejectWithdrawalApi(targetId, { adminNotes: finalNote });
      }
      await fetchRequests();
    } catch (err) {
      console.error('API update status failed:', err);
      await fetchRequests();
      throw err;
    }
  };

  const updateRequest = async (updatedRecord) => {
    const match = requests.find(
      (r) => r.requestId === updatedRecord.requestId || r.id === updatedRecord.id
    );
    const targetId = match ? match.id : updatedRecord.id;

    const reasonCategoryId = resolveReasonCategoryId(
      updatedRecord.reasonCategoryId,
      updatedRecord.reasonCategory
    );

    try {
      await updateStudentWithdrawalApi(targetId, {
        reason: (updatedRecord.reason || '').trim(),
        reasonCategoryId,
      });
      await fetchRequests();
    } catch (err) {
      console.error('API update failed:', err);
      await fetchRequests();
      throw err;
    }
  };

  const deleteRequest = async (requestId) => {
    const match = requests.find((r) => r.requestId === requestId || r.id === requestId);
    const targetId = match ? match.id : requestId;
    try {
      await cancelStudentWithdrawalApi(targetId);
      await fetchRequests();
    } catch (err) {
      console.error('API cancel failed:', err);
      await fetchRequests();
      throw err;
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
