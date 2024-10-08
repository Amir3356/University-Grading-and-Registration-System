-- Migration: 006_withdrawals.sql
-- Module: Withdrawal Reasons, Requests, and Clearances

DROP TABLE IF EXISTS withdrawal_clearances CASCADE;
DROP TABLE IF EXISTS withdrawal_requests CASCADE;
DROP TABLE IF EXISTS withdrawal_reason_categories CASCADE;
DROP SEQUENCE IF EXISTS withdrawal_ref_seq;

CREATE SEQUENCE withdrawal_ref_seq START WITH 1;

-- 1. Reason Categories
CREATE TABLE withdrawal_reason_categories (
    id VARCHAR(30) PRIMARY KEY,
    label VARCHAR(60) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true
);

-- 2. Withdrawal Requests
CREATE TABLE withdrawal_requests (
    id VARCHAR(32) PRIMARY KEY,
    reference_no VARCHAR(12) NOT NULL UNIQUE,
    student_id VARCHAR(32) NOT NULL REFERENCES students(id),
    scope VARCHAR(10) NOT NULL CHECK (scope IN ('course', 'semester', 'university')),
    semester_id VARCHAR(32) REFERENCES semesters(id),
    enrollment_id VARCHAR(32) REFERENCES course_enrollments(id),
    reason_category_id VARCHAR(30) NOT NULL REFERENCES withdrawal_reason_categories(id),
    reason TEXT NOT NULL,
    status VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    decided_by VARCHAR(32) REFERENCES users(id),
    decided_at TIMESTAMPTZ,
    admin_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_withdrawal_requests_pending ON withdrawal_requests (
    student_id,
    scope,
    COALESCE(semester_id, ''),
    COALESCE(enrollment_id, '')
) WHERE status = 'pending';
CREATE INDEX idx_withdrawal_student ON withdrawal_requests (student_id);
CREATE INDEX idx_withdrawal_status_date ON withdrawal_requests (status, submitted_at DESC);
CREATE INDEX idx_withdrawal_semester ON withdrawal_requests (semester_id);

-- 3. Withdrawal Clearances
CREATE TABLE withdrawal_clearances (
    request_id VARCHAR(32) NOT NULL REFERENCES withdrawal_requests(id) ON DELETE CASCADE,
    office VARCHAR(12) NOT NULL CHECK (office IN ('department', 'library', 'housing', 'registrar')),
    status VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    cleared_by VARCHAR(32) REFERENCES users(id),
    cleared_at TIMESTAMPTZ,
    remarks TEXT,
    PRIMARY KEY (request_id, office)
);
