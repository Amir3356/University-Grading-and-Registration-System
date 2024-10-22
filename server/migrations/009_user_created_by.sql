-- Up Migration
-- Migration: 009_user_created_by.sql
-- Module: Track who provisioned each account, so department heads keep access
-- to accounts they created even after moving them to another department.

ALTER TABLE users ADD COLUMN IF NOT EXISTS created_by VARCHAR(32) REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_users_created_by ON users (created_by);

-- Backfill from the audit trail for accounts created before this column existed (if audit_logs exists).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
    UPDATE users u
    SET created_by = a.user_id
    FROM (
      SELECT DISTINCT ON (entity_id) entity_id, user_id
      FROM audit_logs
      WHERE action = 'user.created' AND entity_type = 'user' AND user_id IS NOT NULL
      ORDER BY entity_id, created_at
    ) a
    WHERE u.id = a.entity_id AND u.created_by IS NULL AND a.user_id <> u.id;
  END IF;
END $$;

-- Down Migration
DROP INDEX IF EXISTS idx_users_created_by;
ALTER TABLE users DROP COLUMN IF EXISTS created_by;
