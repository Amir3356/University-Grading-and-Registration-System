import { useCallback, useEffect, useState } from 'react';
import { getStoredProfile, getStoredUser } from '@/lib/storage';

const STORAGE_KEY = 'ugs_student_complaints_v1';

const INITIAL_COMPLAINTS = [
  {
    id: 'CMP-001',
    studentId: 'UGR/323838/14',
    studentName: 'Fkadu Tadesse',
    department: 'Computer Science',
    courseId: 'crs_cs201',
    courseCode: 'CS201',
    courseName: 'Data Structures & Algorithms',
    category: 'Grade Discrepancy',
    title: 'Midterm exam marks not recorded on grading portal',
    description: 'I took the midterm exam in Hall B. My returned exam paper shows 27/30, but the portal currently records —. Please review and update.',
    priority: 'High',
    status: 'in_review',
    statusLabel: 'Under Review',
    submittedAt: '2026-10-24T09:30:00Z',
    response: 'Instructor verified the exam paper record. Mark will be synchronized during the department grade revision.',
    respondedAt: '2026-10-25T14:20:00Z',
    respondedBy: 'Dr. Solomon Bekele (Instructor)',
  },
  {
    id: 'CMP-002',
    studentId: 'UGR/323838/14',
    studentName: 'Fkadu Tadesse',
    department: 'Computer Science',
    courseId: 'crs_cs204',
    courseCode: 'CS204',
    courseName: 'Database Systems',
    category: 'Missing Assessment Mark',
    title: 'Lab Project assignment grade missing',
    description: 'Our project group submitted the Database Final Project before the deadline. Marks for Assignment 2 are missing for our team members.',
    priority: 'Medium',
    status: 'pending',
    statusLabel: 'Pending',
    submittedAt: '2026-10-26T11:45:00Z',
    response: null,
    respondedAt: null,
    respondedBy: null,
  },
  {
    id: 'CMP-003',
    studentId: 'UGR/323838/14',
    studentName: 'Fkadu Tadesse',
    department: 'Computer Science',
    courseId: 'crs_math201',
    courseCode: 'MATH201',
    courseName: 'Applied Mathematics II',
    category: 'Course Scheduling',
    title: 'Class schedule overlap with elective lab',
    description: 'The Tuesday tutorial slot for MATH201 overlaps with the laboratory section for CS204. Requesting section re-assignment.',
    priority: 'Normal',
    status: 'resolved',
    statusLabel: 'Resolved',
    submittedAt: '2026-10-18T08:15:00Z',
    response: 'Tutorial transferred to Thursday afternoon session. Schedule conflict cleared.',
    respondedAt: '2026-10-20T10:00:00Z',
    respondedBy: 'Department Head (Academics Office)',
  },
];

function readStoredComplaints() {
  if (typeof window === 'undefined') return INITIAL_COMPLAINTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_COMPLAINTS));
      return INITIAL_COMPLAINTS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_COMPLAINTS;
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

    const newRecord = {
      id: newId,
      studentId: user?.identifier || profile?.student_number || user?.studentNumber || 'STU-1001',
      studentName: user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Student',
      department: profile?.department?.name || profile?.departmentName || 'Computer Science',
      courseId: data.courseId || '',
      courseCode: data.courseCode || 'General',
      courseName: data.courseName || 'General Academic / Department',
      category: data.category || 'Grade Discrepancy',
      title: data.title?.trim() || 'Academic Complaint',
      description: data.description?.trim() || '',
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
      return {
        ...c,
        ...patch,
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
