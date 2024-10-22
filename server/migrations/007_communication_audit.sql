-- Migration: 007_communication_audit.sql
-- Module: Notifications, Announcements, and Audit Logs

DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS announcements CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;

-- 1. Notifications
CREATE TABLE notifications (
    id VARCHAR(32) PRIMARY KEY,
    user_id VARCHAR(32) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(160) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN (
        'system', 'announcement', 'assignment', 'enrollment', 'marks_released',
        'grade_published', 'grade_approved', 'grade_rejected', 'grade_attention',
        'approval_required', 'registration', 'withdrawal'
    )),
    link VARCHAR(255),
    is_read BOOLEAN NOT NULL DEFAULT false,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON notifications (user_id, is_read, created_at DESC);

-- 2. Announcements
CREATE TABLE announcements (
    id VARCHAR(32) PRIMARY KEY,
    title VARCHAR(160) NOT NULL,
    body TEXT NOT NULL,
    audience VARCHAR(10) NOT NULL CHECK (audience IN ('all', 'student', 'teacher', 'dept_head')),
    author_id VARCHAR(32) NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


