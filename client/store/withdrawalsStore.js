import { useEffect, useState } from 'react'

const STORAGE_KEY = 'ugs_student_withdrawals_v3'

export const INITIAL_WITHDRAWAL_REQUESTS = [
  {
    id: 'WR-001',
    requestId: 'WR-001',
    studentId: 'UGR/24/0001',
    studentName: 'Abebe Kebede',
    department: 'Computer Science',
    departmentCode: 'CS',
    programType: 'Regular',
    withdrawalType: 'Semester Withdrawal',
    academicYear: '2026',
    semester: 'First Semester',
    reasonCategory: 'Medical / Health',
    reason: 'Medical condition requiring rest and clinical treatment for the duration of the semester. Medical documentation provided to the health clinic.',
    status: 'pending',
    requestDate: '18 Oct 2026',
    adminNotes: 'Awaiting formal review by the Academic Commission and Registrar Office.',
    clearance: {
      department: 'pending',
      library: 'approved',
      housing: 'pending',
      registrar: 'pending',
    },
  },
  {
    id: 'WR-002',
    requestId: 'WR-002',
    studentId: 'UGR/24/0002',
    studentName: 'Bethlehem Tadesse',
    department: 'Mathematics',
    departmentCode: 'MATH',
    programType: 'Extension',
    withdrawalType: 'University Withdrawal',
    academicYear: '2026',
    semester: 'Second Semester',
    reasonCategory: 'Relocation / Transfer',
    reason: 'Permanently relocating abroad and transferring academic credits to an international university.',
    status: 'approved',
    requestDate: '15 Oct 2026',
    adminNotes: 'All university clearance items verified and approved. Permanent withdrawal finalized.',
    clearance: {
      department: 'approved',
      library: 'approved',
      housing: 'approved',
      registrar: 'approved',
    },
  },
  {
    id: 'WR-003',
    requestId: 'WR-003',
    studentId: 'UGR/24/0003',
    studentName: 'Chala Gemechu',
    department: 'Business Administration',
    departmentCode: 'BUS',
    programType: 'Regular',
    withdrawalType: 'Semester Withdrawal',
    academicYear: '2026',
    semester: 'First Semester',
    reasonCategory: 'Financial Hardship',
    reason: 'Temporary family financial hardship preventing active enrollment for this term.',
    status: 'pending',
    requestDate: '16 Oct 2026',
    adminNotes: 'Pending sponsor confirmation and finance clearance.',
    clearance: {
      department: 'pending',
      library: 'pending',
      housing: 'pending',
      registrar: 'pending',
    },
  },
  {
    id: 'WR-004',
    requestId: 'WR-004',
    studentId: 'UGR/24/0004',
    studentName: 'Desta Haile',
    department: 'Electrical Engineering',
    departmentCode: 'EE',
    programType: 'Weekend',
    withdrawalType: 'Semester Withdrawal',
    academicYear: '2026',
    semester: 'First Semester',
    reasonCategory: 'Personal Emergency',
    reason: 'Urgent family caregiver duties in hometown requiring leave of absence.',
    status: 'rejected',
    requestDate: '10 Oct 2026',
    adminNotes: 'Rejected due to incomplete verification documents.',
    clearance: {
      department: 'rejected',
      library: 'approved',
      housing: 'approved',
      registrar: 'rejected',
    },
  },
  {
    id: 'WR-005',
    requestId: 'WR-005',
    studentId: 'UGR/24/0005',
    studentName: 'Eleni Berhanu',
    department: 'Computer Science',
    departmentCode: 'CS',
    programType: 'Regular',
    withdrawalType: 'University Withdrawal',
    academicYear: '2026',
    semester: 'First Semester',
    reasonCategory: 'Employment / Career',
    reason: 'Accepted full-time industry apprenticeship offer and withdrawing from degree program.',
    status: 'pending',
    requestDate: '17 Oct 2026',
    adminNotes: 'Clearance sign-offs in progress across campus facilities.',
    clearance: {
      department: 'approved',
      library: 'approved',
      housing: 'pending',
      registrar: 'pending',
    },
  },
  {
    id: 'WR-006',
    requestId: 'WR-006',
    studentId: 'UGR/24/0006',
    studentName: 'Fikadu Bekele',
    department: 'Civil Engineering',
    departmentCode: 'CE',
    programType: 'Extension',
    withdrawalType: 'Semester Withdrawal',
    academicYear: '2026',
    semester: 'Second Semester',
    reasonCategory: 'Health / Medical',
    reason: 'Scheduled surgical procedure and post-op physical rehabilitation.',
    status: 'approved',
    requestDate: '12 Oct 2026',
    adminNotes: 'Medical board clearance confirmed.',
    clearance: {
      department: 'approved',
      library: 'approved',
      housing: 'approved',
      registrar: 'approved',
    },
  },
  {
    id: 'WR-007',
    requestId: 'WR-007',
    studentId: 'UGR/24/0007',
    studentName: 'Genet Alemu',
    department: 'Economics',
    departmentCode: 'ECON',
    programType: 'Regular',
    withdrawalType: 'Semester Withdrawal',
    academicYear: '2026',
    semester: 'First Semester',
    reasonCategory: 'Personal / Family',
    reason: 'Maternity leave requested for the upcoming semester.',
    status: 'approved',
    requestDate: '08 Oct 2026',
    adminNotes: 'Maternity leave approved for Semester 1.',
    clearance: {
      department: 'approved',
      library: 'approved',
      housing: 'approved',
      registrar: 'approved',
    },
  },
  {
    id: 'WR-008',
    requestId: 'WR-008',
    studentId: 'UGR/24/0008',
    studentName: 'Henok Girma',
    department: 'Information Systems',
    departmentCode: 'IS',
    programType: 'Weekend',
    withdrawalType: 'University Withdrawal',
    academicYear: '2026',
    semester: 'First Semester',
    reasonCategory: 'Academic Standing',
    reason: 'Voluntary university withdrawal to pursue vocational training.',
    status: 'rejected',
    requestDate: '05 Oct 2026',
    adminNotes: 'Application missed withdrawal window for the semester.',
    clearance: {
      department: 'rejected',
      library: 'approved',
      housing: 'pending',
      registrar: 'rejected',
    },
  },
]

export function getWithdrawalRequests() {
  if (typeof window === 'undefined') return INITIAL_WITHDRAWAL_REQUESTS
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item, idx) => ({
          ...item,
          programType: item.programType || (idx % 3 === 0 ? 'Regular' : idx % 3 === 1 ? 'Extension' : 'Weekend'),
        }))
      }
    }
  } catch (err) {
    console.error('Failed to load withdrawals from localStorage:', err)
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_WITHDRAWAL_REQUESTS))
  } catch {
    // Ignore storage quota errors
  }
  return INITIAL_WITHDRAWAL_REQUESTS
}

export function saveWithdrawalRequest(newRecord) {
  const current = getWithdrawalRequests()
  const recordWithProgram = {
    ...newRecord,
    programType: newRecord.programType || 'Regular',
  }
  const next = [recordWithProgram, ...current]
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    window.dispatchEvent(new Event('ugs-withdrawals-updated'))
  } catch (err) {
    console.error('Failed to save withdrawal request:', err)
  }
  return next
}

export function updateWithdrawalStatus(requestId, newStatus, adminNotes) {
  const current = getWithdrawalRequests()
  const next = current.map((item) => {
    if (item.requestId === requestId || item.id === requestId) {
      return {
        ...item,
        status: newStatus,
        adminNotes: adminNotes ?? (newStatus === 'approved' ? 'Approved by University Registrar Admin.' : newStatus === 'rejected' ? 'Rejected by University Registrar Admin.' : item.adminNotes),
      }
    }
    return item
  })
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    window.dispatchEvent(new Event('ugs-withdrawals-updated'))
  } catch (err) {
    console.error('Failed to update withdrawal status:', err)
  }
  return next
}

export function deleteWithdrawalRequest(requestId) {
  const current = getWithdrawalRequests()
  const next = current.filter((item) => item.requestId !== requestId && item.id !== requestId)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    window.dispatchEvent(new Event('ugs-withdrawals-updated'))
  } catch (err) {
    console.error('Failed to delete withdrawal request:', err)
  }
  return next
}

export function useWithdrawalRequests() {
  const [requests, setRequests] = useState(() => getWithdrawalRequests())

  useEffect(() => {
    const handleUpdate = () => {
      setRequests(getWithdrawalRequests())
    }
    window.addEventListener('ugs-withdrawals-updated', handleUpdate)
    return () => window.removeEventListener('ugs-withdrawals-updated', handleUpdate)
  }, [])

  return {
    requests,
    addRequest: saveWithdrawalRequest,
    updateStatus: updateWithdrawalStatus,
    deleteRequest: deleteWithdrawalRequest,
  }
}
