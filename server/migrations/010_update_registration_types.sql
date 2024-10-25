-- Migration: 010_update_registration_types.sql
-- Ensure registration types contain Regular, Extension, and Weekend (removing cafe and non_cafe)

INSERT INTO registration_types (id, label, description, is_active)
VALUES 
  ('regular', 'Regular', 'Regular program registration', true),
  ('extension', 'Extension', 'Evening extension program registration', true),
  ('weekend', 'Weekend', 'Weekend program registration', true)
ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, description = EXCLUDED.description, is_active = true;

-- Map any cafe / non_cafe registrations to regular
UPDATE semester_registrations 
SET registration_type_id = 'regular' 
WHERE registration_type_id IN ('cafe', 'non_cafe');

-- Update registration_period_types
DELETE FROM registration_period_types WHERE registration_type_id IN ('cafe', 'non_cafe');

-- Remove cafe and non_cafe registration types
DELETE FROM registration_types WHERE id IN ('cafe', 'non_cafe');
