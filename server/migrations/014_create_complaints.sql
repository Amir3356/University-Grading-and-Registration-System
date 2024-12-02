-- Migration: 014_create_complaints.sql
-- Module: Academic Grievances and Complaints with Server-side Pagination

CREATE TABLE IF NOT EXISTS complaints (
    id VARCHAR(32) PRIMARY KEY,
    reference_no VARCHAR(32) UNIQUE,
    student_id VARCHAR(32) NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    course_id VARCHAR(32) REFERENCES courses(id) ON DELETE SET NULL,
    category VARCHAR(64) NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'Normal' CHECK (priority IN ('Low', 'Normal', 'Medium', 'High', 'Urgent')),
    reason TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'resolved', 'rejected', 'cancelled')),
    status_label VARCHAR(50) DEFAULT 'Pending',
    response TEXT,
    responded_by VARCHAR(120),
    responded_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_complaints_student ON complaints(student_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_category ON complaints(category);
CREATE INDEX IF NOT EXISTS idx_complaints_submitted_at ON complaints(submitted_at DESC);
