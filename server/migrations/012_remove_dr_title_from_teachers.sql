-- Migration: 012_remove_dr_title_from_teachers.sql
-- Remove Dr. default title from teachers and clear existing Dr. titles

ALTER TABLE teachers ALTER COLUMN title DROP DEFAULT;
ALTER TABLE teachers ALTER COLUMN title DROP NOT NULL;
ALTER TABLE teachers ALTER COLUMN title SET DEFAULT '';

UPDATE teachers SET title = '' WHERE title ILIKE 'Dr%' OR title IS NULL;
