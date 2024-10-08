import * as withdrawalsApi from '@/api/withdrawals';
import { getStoredUser } from '@/lib/storage';
import { validateForm, withdrawalFormSchema } from '@/lib/validators';
import { bumpVersion } from '@/store/db';

/**
 * Frontend Withdrawal Service
 * Handles withdrawal requests, multi-office clearance tracking, and student cancellation workflows.
 */

export function formatWithdrawalRecord(r) {
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
        ? 'University Withdrawal'
        : 'Semester Withdrawal',
    scope: r.scope,
    academicYear: r.semester?.academicYear?.name || '2026/2027',
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

export async function fetchWithdrawalRequests() {
  const user = getStoredUser();
  let list = [];
  if (user?.roleId === 'student') {
    list = await withdrawalsApi.listStudentWithdrawalRequests();
  } else {
    const res = await withdrawalsApi.listWithdrawalRequests({ pageSize: 100 });
    list = res.items || res;
  }
  return Array.isArray(list) ? list.map(formatWithdrawalRecord) : [];
}

export async function submitWithdrawalRequest(formInput) {
  const scopeMap = {
    'Course Withdrawal': 'course',
    'Semester Withdrawal': 'semester',
    'University Withdrawal': 'university',
  };
  const scope = scopeMap[formInput.withdrawalType] || formInput.scope || 'semester';
  const payload = {
    scope,
    semesterId: formInput.semesterId || 'sem_2026_fall',
    reasonCategory: formInput.reasonCategory || 'personal',
    reasonCategoryId: (formInput.reasonCategory || 'personal').toLowerCase().includes('med')
      ? 'medical'
      : 'personal',
    reason: formInput.reason,
    acknowledged: formInput.acknowledged ?? true,
  };

  const validation = validateForm(withdrawalFormSchema, payload);
  if (!validation.success) {
    const err = new Error('Please fill in all required fields.');
    err.fieldErrors = validation.errors;
    throw err;
  }

  const result = await withdrawalsApi.submitStudentWithdrawal(validation.data);
  bumpVersion();
  return result;
}

export async function updateWithdrawalStatus(targetId, newStatus, adminNotes) {
  if (newStatus === 'approved') {
    const offices = ['department', 'library', 'housing', 'registrar'];
    for (const off of offices) {
      try {
        await withdrawalsApi.updateClearance(targetId, off, { status: 'approved' });
      } catch {
        // Continue if clearance already processed
      }
    }
    await withdrawalsApi.approveWithdrawal(targetId, {
      adminNotes: adminNotes || 'Approved by Registrar.',
    });
  } else if (newStatus === 'rejected') {
    await withdrawalsApi.rejectWithdrawal(targetId, {
      adminNotes: adminNotes || 'Rejected by Registrar.',
    });
  }
  bumpVersion();
}

export async function cancelWithdrawalRequest(targetId) {
  const result = await withdrawalsApi.cancelStudentWithdrawal(targetId);
  bumpVersion();
  return result;
}
