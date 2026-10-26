-- Migration: 013_add_year_of_study_to_offerings.sql
-- Add year_of_study to course_offerings

ALTER TABLE course_offerings ADD COLUMN IF NOT EXISTS year_of_study SMALLINT;
