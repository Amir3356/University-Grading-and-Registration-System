-- Migration: 008_settings_policies.sql
-- Module: University Settings and Academic Policies

DROP TABLE IF EXISTS policy_excluded_courses CASCADE;
DROP TABLE IF EXISTS academic_policies CASCADE;
DROP TABLE IF EXISTS university_settings CASCADE;

-- 1. University Settings
CREATE TABLE university_settings (
    id SMALLINT PRIMARY KEY CHECK (id = 1),
    name VARCHAR(160) NOT NULL,
    short_name VARCHAR(20) NOT NULL,
    motto VARCHAR(160),
    address VARCHAR(255),
    email VARCHAR(160) NOT NULL,
    phone VARCHAR(30),
    website VARCHAR(160),
    registrar_name VARCHAR(120) NOT NULL,
    updated_by VARCHAR(32) REFERENCES users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Academic Policies
CREATE TABLE academic_policies (
    id SMALLINT PRIMARY KEY CHECK (id = 1),
    pass_mark NUMERIC(5,2) NOT NULL DEFAULT 50 CHECK (pass_mark BETWEEN 0 AND 100),
    approval_workflow_enabled BOOLEAN NOT NULL DEFAULT true,
    repeat_policy VARCHAR(10) NOT NULL DEFAULT 'latest' CHECK (repeat_policy IN ('latest', 'highest', 'all')),
    incomplete_policy VARCHAR(10) NOT NULL DEFAULT 'exclude' CHECK (incomplete_policy IN ('exclude', 'as_fail')),
    withdrawal_policy VARCHAR(10) NOT NULL DEFAULT 'exclude' CHECK (withdrawal_policy IN ('exclude', 'as_fail')),
    probation_gpa NUMERIC(3,2) NOT NULL DEFAULT 2.00 CHECK (probation_gpa BETWEEN 0 AND 4),
    honors_gpa NUMERIC(3,2) NOT NULL DEFAULT 3.50 CHECK (honors_gpa BETWEEN 0 AND 4),
    require_weights_total_100 BOOLEAN NOT NULL DEFAULT true,
    at_risk_margin NUMERIC(5,2) NOT NULL DEFAULT 10,
    updated_by VARCHAR(32) REFERENCES users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Policy Excluded Courses
CREATE TABLE policy_excluded_courses (
    course_id VARCHAR(32) PRIMARY KEY REFERENCES courses(id) ON DELETE CASCADE
);
