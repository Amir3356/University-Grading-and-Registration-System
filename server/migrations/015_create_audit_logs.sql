-- Migration: 015_create_audit_logs.sql
-- Module: Centralized Immutable Audit Trail for Administrative & Departmental Operations

CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(32) PRIMARY KEY,
    actor_id VARCHAR(32),
    actor_username VARCHAR(50),
    actor_name VARCHAR(160) NOT NULL,
    actor_role VARCHAR(32) NOT NULL,
    actor_email VARCHAR(160),
    department_id VARCHAR(32),
    department_name VARCHAR(120),
    department_code VARCHAR(20),
    action VARCHAR(20) NOT NULL CHECK (action IN ('create', 'update', 'approve', 'reject', 'delete', 'other')),
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(64),
    entity_name VARCHAR(255),
    description TEXT NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indices for rapid querying and filtering
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_dept ON audit_logs (department_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_role ON audit_logs (actor_role, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs (entity_type, created_at DESC);

-- Accountability & Immutability Trigger: Strictly prevent updates and deletions on audit_logs
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Audit records are immutable and cannot be updated or deleted.';
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.id != NEW.id OR OLD.action != NEW.action OR OLD.description != NEW.description OR OLD.created_at != NEW.created_at THEN
            RAISE EXCEPTION 'Audit records are immutable and cannot be updated.';
        END IF;
        RETURN NEW;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON audit_logs;

CREATE TRIGGER trg_audit_logs_immutable
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_log_modification();
