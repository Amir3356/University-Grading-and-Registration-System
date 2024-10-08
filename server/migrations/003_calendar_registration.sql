-- Migration: 003_calendar_registration.sql
-- Module: Academic Years, Semesters, Registration Types, Periods, and Registrations

DROP TABLE IF EXISTS semester_registrations CASCADE;
DROP TABLE IF EXISTS registration_period_types CASCADE;
DROP TABLE IF EXISTS registration_periods CASCADE;
DROP TABLE IF EXISTS registration_types CASCADE;
DROP TABLE IF EXISTS semesters CASCADE;
DROP TABLE IF EXISTS academic_years CASCADE;

-- 1. Academic Years
CREATE TABLE academic_years (
    id VARCHAR(32) PRIMARY KEY,
    name VARCHAR(9) NOT NULL UNIQUE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL CHECK (end_date > start_date),
    is_current BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_academic_years_current ON academic_years (is_current) WHERE is_current = true;

-- 2. Semesters
CREATE TABLE semesters (
    id VARCHAR(32) PRIMARY KEY,
    academic_year_id VARCHAR(32) NOT NULL REFERENCES academic_years(id),
    term VARCHAR(10) NOT NULL CHECK (term IN ('first', 'second', 'summer')),
    name VARCHAR(60) NOT NULL,
    sort_order SMALLINT NOT NULL UNIQUE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL CHECK (end_date > start_date),
    grade_submission_deadline DATE NOT NULL CHECK (grade_submission_deadline >= end_date),
    withdrawal_deadline DATE,
    is_current BOOLEAN NOT NULL DEFAULT false,
    status VARCHAR(10) NOT NULL CHECK (status IN ('upcoming', 'active', 'closed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (academic_year_id, term)
);
CREATE UNIQUE INDEX uq_semesters_current ON semesters (is_current) WHERE is_current = true;

-- 3. Registration Types
CREATE TABLE registration_types (
    id VARCHAR(20) PRIMARY KEY,
    label VARCHAR(60) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true
);

-- 4. Registration Periods
CREATE TABLE registration_periods (
    id VARCHAR(32) PRIMARY KEY,
    semester_id VARCHAR(32) NOT NULL UNIQUE REFERENCES semesters(id),
    start_date DATE NOT NULL,
    deadline DATE NOT NULL CHECK (deadline >= start_date),
    status VARCHAR(10) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'open', 'closed')),
    created_by VARCHAR(32) NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE registration_period_types (
    period_id VARCHAR(32) NOT NULL REFERENCES registration_periods(id) ON DELETE CASCADE,
    registration_type_id VARCHAR(20) NOT NULL REFERENCES registration_types(id),
    PRIMARY KEY (period_id, registration_type_id)
);

-- 5. Semester Registrations
CREATE TABLE semester_registrations (
    id VARCHAR(32) PRIMARY KEY,
    student_id VARCHAR(32) NOT NULL REFERENCES students(id),
    semester_id VARCHAR(32) NOT NULL REFERENCES semesters(id),
    period_id VARCHAR(32) NOT NULL REFERENCES registration_periods(id),
    registration_type_id VARCHAR(20) NOT NULL REFERENCES registration_types(id),
    status VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'registered', 'rejected', 'cancelled')),
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_by VARCHAR(32) REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (student_id, semester_id)
);
CREATE INDEX idx_semester_reg_sem_status ON semester_registrations (semester_id, status);
CREATE INDEX idx_semester_reg_period ON semester_registrations (period_id);
