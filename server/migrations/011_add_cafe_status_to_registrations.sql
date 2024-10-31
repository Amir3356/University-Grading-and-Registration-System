-- Migration: 011_add_cafe_status_to_registrations.sql
-- Add cafe_status (Cafe vs Non-cafe) to semester registrations

ALTER TABLE semester_registrations 
ADD COLUMN IF NOT EXISTS cafe_status VARCHAR(20) NOT NULL DEFAULT 'cafe';
