import { useCallback, useEffect, useState } from 'react';
import { getStoredProfile, getStoredUser } from '@/lib/storage';

const STORAGE_KEY = 'ugs_student_complaints_v1';

const INITIAL_COMPLAINTS = [];

function readStoredComplaints() {
  if (typeof window === 'undefined') return INITIAL_COMPLAINTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_COMPLAINTS));
      return INITIAL_COMPLAINTS;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return INITIAL_COMPLAINTS;
    return parsed.map((c) => ({
      ...c,
      reason: c.reason || c.description || c.title || '',
    }));
  } catch {
    return INITIAL_COMPLAINTS;
  }
}

function writeStoredComplaints(complaints) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(complaints));
    window.dispatchEvent(new CustomEvent('ugs:complaints-updated', { detail: complaints }));
  } catch (err) {
    console.error('Failed to save complaints to localStorage:', err);
  }
}

export function useComplaints() {
  const [complaints, setComplaints] = useState(readStoredComplaints);
  const user = getStoredUser();
  const profile = getStoredProfile();

  const reload = useCallback(() => {
    setComplaints(readStoredComplaints());
  }, []);

  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === STORAGE_KEY || e.type === 'ugs:complaints-updated') {
        reload();
      }
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('ugs:complaints-updated', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('ugs:complaints-updated', handleStorage);
    };
  }, [reload]);

  const addComplaint = useCallback((data) => {
    const current = readStoredComplaints();
    const nextIdNum = current.length + 1;
    const newId = `CMP-${String(nextIdNum).padStart(3, '0')}`;

    const complaintReason = data.reason?.trim() || data.title?.trim() || data.description?.trim() || '';
    const newRecord = {
      id: newId,
      studentId: user?.identifier || profile?.student_number || user?.studentNumber || 'STU-1001',
      studentName: user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Student',
      department: profile?.department?.name || profile?.departmentName || 'Computer Science',
      courseId: data.courseId || '',
      courseCode: data.courseCode || 'General',
      courseName: data.courseName || 'General Academic / Department',
      category: data.category || 'Grade Discrepancy',
      reason: complaintReason,
      title: complaintReason || 'Academic Complaint',
      description: data.description?.trim() || complaintReason,
      priority: data.priority || 'Normal',
      status: 'pending',
      statusLabel: 'Pending',
      submittedAt: new Date().toISOString(),
      response: null,
      respondedAt: null,
      respondedBy: null,
    };

    const nextList = [newRecord, ...current];
    writeStoredComplaints(nextList);
    setComplaints(nextList);
    return newRecord;
  }, [user, profile]);

  const updateComplaint = useCallback((id, patch) => {
    const current = readStoredComplaints();
    const nextList = current.map((c) => {
      if (c.id !== id) return c;
      const updatedReason = patch.reason !== undefined ? patch.reason : (patch.title || patch.description || c.reason || c.title || '');
      return {
        ...c,
        ...patch,
        reason: updatedReason,
        title: patch.title !== undefined ? patch.title : updatedReason,
        description: patch.description !== undefined ? patch.description : updatedReason,
        updatedAt: new Date().toISOString(),
      };
    });
    writeStoredComplaints(nextList);
    setComplaints(nextList);
  }, []);

  const deleteComplaint = useCallback((id) => {
    const current = readStoredComplaints();
    const nextList = current.filter((c) => c.id !== id);
    writeStoredComplaints(nextList);
    setComplaints(nextList);
  }, []);

  return {
    complaints,
    addComplaint,
    updateComplaint,
    deleteComplaint,
    reload,
  };
}
