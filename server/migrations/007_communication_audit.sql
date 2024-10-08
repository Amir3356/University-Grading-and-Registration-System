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

-- 3. Audit Logs
CREATE TABLE audit_logs (
    id VARCHAR(32) PRIMARY KEY,
    user_id VARCHAR(32) REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(60) NOT NULL,
    entity_type VARCHAR(40) NOT NULL,
    entity_id VARCHAR(32) NOT NULL,
    offering_id VARCHAR(32) REFERENCES course_offerings(id) ON DELETE SET NULL,
    details TEXT NOT NULL,
    reason TEXT,
    before JSONB,
    after JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_logs_created_at ON audit_logs (created_at DESC);
CREATE INDEX idx_audit_logs_user_date ON audit_logs (user_id, created_at DESC);
CREATE INDEX idx_audit_logs_offering_date ON audit_logs (offering_id, created_at DESC);
CREATE INDEX idx_audit_logs_entity ON audit_logs (entity_type, entity_id);
CREATE INDEX idx_audit_logs_action ON audit_logs (action);
