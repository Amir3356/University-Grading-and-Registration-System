-- Migration: 001_initial_schema.sql
-- University Grading and Registration System Relational Schema

-- Drop in reverse dependency order if resetting
DROP TABLE IF EXISTS department_assessment_templates CASCADE;
DROP TABLE IF EXISTS policy_excluded_courses CASCADE;
DROP TABLE IF EXISTS academic_policies CASCADE;
DROP TABLE IF EXISTS university_settings CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS announcements CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS withdrawal_clearances CASCADE;
DROP TABLE IF EXISTS withdrawal_requests CASCADE;
DROP TABLE IF EXISTS withdrawal_reason_categories CASCADE;
DROP TABLE IF EXISTS grade_submission_reviews CASCADE;
DROP TABLE IF EXISTS grade_submissions CASCADE;
DROP TABLE IF EXISTS final_grades CASCADE;
DROP TABLE IF EXISTS grade_scale_entries CASCADE;
DROP TABLE IF EXISTS grade_scales CASCADE;
DROP TABLE IF EXISTS assessment_scores CASCADE;
DROP TABLE IF EXISTS assessments CASCADE;
DROP TABLE IF EXISTS course_enrollments CASCADE;
DROP TABLE IF EXISTS course_offerings CASCADE;
DROP TABLE IF EXISTS semester_registrations CASCADE;
DROP TABLE IF EXISTS registration_period_types CASCADE;
DROP TABLE IF EXISTS registration_periods CASCADE;
DROP TABLE IF EXISTS registration_types CASCADE;
DROP TABLE IF EXISTS semesters CASCADE;
DROP TABLE IF EXISTS academic_years CASCADE;
DROP TABLE IF EXISTS program_courses CASCADE;
DROP TABLE IF EXISTS courses CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS teachers CASCADE;
DROP TABLE IF EXISTS programs CASCADE;
DROP TABLE IF EXISTS departments CASCADE;
DROP TABLE IF EXISTS refresh_tokens CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS role_permissions CASCADE;
DROP TABLE IF EXISTS roles CASCADE;

DROP SEQUENCE IF EXISTS withdrawal_ref_seq;
CREATE SEQUENCE withdrawal_ref_seq START WITH 1;

-- 1. Identity and access
CREATE TABLE roles (
    id VARCHAR(20) PRIMARY KEY,
    name VARCHAR(80) NOT NULL,
    description TEXT
);

CREATE TABLE role_permissions (
    role_id VARCHAR(20) NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission VARCHAR(60) NOT NULL,
    PRIMARY KEY (role_id, permission)
);

CREATE TABLE users (
    id VARCHAR(32) PRIMARY KEY,
    role_id VARCHAR(20) NOT NULL REFERENCES roles(id),
    username VARCHAR(32) NOT NULL,
    first_name VARCHAR(80) NOT NULL,
    last_name VARCHAR(80) NOT NULL,
    email VARCHAR(160) NOT NULL,
    phone VARCHAR(30),
    password_hash VARCHAR(255) NOT NULL,
    must_change_password BOOLEAN NOT NULL DEFAULT true,
    status VARCHAR(10) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    deactivation_reason TEXT,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_users_username_lower ON users (lower(username));
CREATE UNIQUE INDEX uq_users_email_lower ON users (lower(email));
CREATE INDEX idx_users_role_status ON users (role_id, status);

CREATE TABLE refresh_tokens (
    id VARCHAR(32) PRIMARY KEY,
    user_id VARCHAR(32) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    user_agent VARCHAR(255),
    ip_address VARCHAR(45),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Organisation and people
CREATE TABLE departments (
    id VARCHAR(32) PRIMARY KEY,
    code VARCHAR(6) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL UNIQUE,
    description TEXT,
    head_teacher_id VARCHAR(32) UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE programs (
    id VARCHAR(32) PRIMARY KEY,
    department_id VARCHAR(32) NOT NULL REFERENCES departments(id),
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(160) NOT NULL,
    duration_years SMALLINT NOT NULL DEFAULT 4 CHECK (duration_years BETWEEN 1 AND 7),
    required_credits SMALLINT NOT NULL CHECK (required_credits > 0),
    status VARCHAR(10) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE courses (
    id VARCHAR(32) PRIMARY KEY,
    code VARCHAR(10) NOT NULL UNIQUE,
    title VARCHAR(160) NOT NULL,
    department_id VARCHAR(32) NOT NULL REFERENCES departments(id),
    credit_hours SMALLINT NOT NULL CHECK (credit_hours BETWEEN 1 AND 6),
    level SMALLINT NOT NULL DEFAULT 100 CHECK (level BETWEEN 100 AND 900),
    description TEXT,
    status VARCHAR(10) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_courses_dept_status ON courses (department_id, status);

CREATE TABLE program_courses (
    program_id VARCHAR(32) NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    course_id VARCHAR(32) NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    year_of_study SMALLINT CHECK (year_of_study BETWEEN 1 AND 7),
    term VARCHAR(10) CHECK (term IN ('first', 'second', 'summer')),
    is_required BOOLEAN NOT NULL DEFAULT true,
    PRIMARY KEY (program_id, course_id)
);

CREATE TABLE teachers (
    id VARCHAR(32) PRIMARY KEY,
    user_id VARCHAR(32) NOT NULL UNIQUE REFERENCES users(id),
    employee_number VARCHAR(30) NOT NULL UNIQUE,
    department_id VARCHAR(32) NOT NULL REFERENCES departments(id),
    title VARCHAR(20) NOT NULL DEFAULT 'Dr.',
    specialization VARCHAR(120),
    office_room VARCHAR(30),
    hire_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_teachers_dept ON teachers (department_id);

ALTER TABLE departments
    ADD CONSTRAINT fk_departments_head
    FOREIGN KEY (head_teacher_id) REFERENCES teachers(id) ON DELETE SET NULL;

CREATE TABLE students (
    id VARCHAR(32) PRIMARY KEY,
    user_id VARCHAR(32) NOT NULL UNIQUE REFERENCES users(id),
    student_number VARCHAR(30) NOT NULL UNIQUE,
    department_id VARCHAR(32) NOT NULL REFERENCES departments(id),
    program_id VARCHAR(32) NOT NULL REFERENCES programs(id),
    program_type VARCHAR(10) NOT NULL DEFAULT 'regular' CHECK (program_type IN ('regular', 'extension', 'weekend')),
    admission_year SMALLINT NOT NULL CHECK (admission_year BETWEEN 2000 AND 2100),
    year_of_study SMALLINT NOT NULL CHECK (year_of_study >= 1),
    date_of_birth DATE,
    academic_status VARCHAR(12) NOT NULL DEFAULT 'active' CHECK (academic_status IN ('active', 'suspended', 'withdrawn', 'graduated')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_students_dept ON students (department_id);
CREATE INDEX idx_students_prog ON students (program_id);
CREATE INDEX idx_students_status ON students (academic_status);

-- 3. Calendar
CREATE TABLE academic_years (
    id VARCHAR(32) PRIMARY KEY,
    name VARCHAR(9) NOT NULL UNIQUE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL CHECK (end_date > start_date),
    is_current BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_academic_years_current ON academic_years (is_current) WHERE is_current = true;

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

-- 4. Registration
CREATE TABLE registration_types (
    id VARCHAR(20) PRIMARY KEY,
    label VARCHAR(60) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true
);

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

-- 5. Offerings & Enrollment
CREATE TABLE course_offerings (
    id VARCHAR(32) PRIMARY KEY,
    course_id VARCHAR(32) NOT NULL REFERENCES courses(id),
    semester_id VARCHAR(32) NOT NULL REFERENCES semesters(id),
    teacher_id VARCHAR(32) NOT NULL REFERENCES teachers(id),
    section VARCHAR(5) NOT NULL,
    capacity SMALLINT NOT NULL CHECK (capacity BETWEEN 1 AND 500),
    room VARCHAR(30),
    schedule VARCHAR(80),
    grade_status VARCHAR(12) NOT NULL DEFAULT 'not_started' CHECK (grade_status IN ('not_started', 'draft', 'submitted', 'approved', 'rejected', 'published')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (course_id, semester_id, section)
);
CREATE INDEX idx_offerings_semester ON course_offerings (semester_id);
CREATE INDEX idx_offerings_teacher ON course_offerings (teacher_id);
CREATE INDEX idx_offerings_grade_status ON course_offerings (grade_status);

CREATE TABLE course_enrollments (
    id VARCHAR(32) PRIMARY KEY,
    offering_id VARCHAR(32) NOT NULL REFERENCES course_offerings(id),
    student_id VARCHAR(32) NOT NULL REFERENCES students(id),
    status VARCHAR(10) NOT NULL DEFAULT 'enrolled' CHECK (status IN ('pending', 'enrolled', 'completed', 'withdrawn')),
    is_repeat BOOLEAN NOT NULL DEFAULT false,
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    withdrawn_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (offering_id, student_id)
);
CREATE INDEX idx_enrollments_student ON course_enrollments (student_id);
CREATE INDEX idx_enrollments_offering_status ON course_enrollments (offering_id, status);

-- 6. Assessment and grading
CREATE TABLE assessments (
    id VARCHAR(32) PRIMARY KEY,
    offering_id VARCHAR(32) NOT NULL REFERENCES course_offerings(id) ON DELETE CASCADE,
    name VARCHAR(80) NOT NULL,
    type VARCHAR(12) NOT NULL CHECK (type IN ('assignment', 'quiz', 'midterm', 'final', 'practical', 'project')),
    max_marks NUMERIC(6,2) NOT NULL CHECK (max_marks BETWEEN 1 AND 1000),
    weight NUMERIC(5,2) NOT NULL CHECK (weight BETWEEN 0.5 AND 100),
    due_date DATE NOT NULL,
    description TEXT,
    is_released BOOLEAN NOT NULL DEFAULT false,
    released_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_assessments_offering_name_lower ON assessments (offering_id, lower(name));
CREATE INDEX idx_assessments_offering_due ON assessments (offering_id, due_date);

CREATE TABLE assessment_scores (
    id VARCHAR(32) PRIMARY KEY,
    assessment_id VARCHAR(32) NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    enrollment_id VARCHAR(32) NOT NULL REFERENCES course_enrollments(id) ON DELETE CASCADE,
    marks NUMERIC(6,2) NOT NULL CHECK (marks >= 0),
    remarks TEXT,
    updated_by VARCHAR(32) NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (assessment_id, enrollment_id)
);
CREATE INDEX idx_scores_enrollment ON assessment_scores (enrollment_id);

CREATE TABLE grade_scales (
    id VARCHAR(32) PRIMARY KEY,
    name VARCHAR(80) NOT NULL,
    is_active BOOLEAN NOT NULL,
    effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by VARCHAR(32) REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_grade_scales_active ON grade_scales (is_active) WHERE is_active = true;

CREATE TABLE grade_scale_entries (
    id VARCHAR(32) PRIMARY KEY,
    scale_id VARCHAR(32) NOT NULL REFERENCES grade_scales(id) ON DELETE CASCADE,
    letter VARCHAR(3) NOT NULL,
    min_score NUMERIC(5,2) NOT NULL CHECK (min_score BETWEEN 0 AND 100),
    max_score NUMERIC(5,2) NOT NULL CHECK (max_score BETWEEN 0 AND 100 AND max_score >= min_score),
    grade_points NUMERIC(3,2) NOT NULL CHECK (grade_points BETWEEN 0 AND 5),
    UNIQUE (scale_id, letter)
);

CREATE TABLE final_grades (
    id VARCHAR(32) PRIMARY KEY,
    enrollment_id VARCHAR(32) NOT NULL UNIQUE REFERENCES course_enrollments(id) ON DELETE CASCADE,
    grade_scale_id VARCHAR(32) NOT NULL REFERENCES grade_scales(id),
    total_score NUMERIC(5,2) CHECK (total_score BETWEEN 0 AND 100),
    letter VARCHAR(3) NOT NULL,
    grade_points NUMERIC(3,2),
    special_grade CHAR(1) CHECK (special_grade IN ('W', 'I')),
    status VARCHAR(10) NOT NULL CHECK (status IN ('draft', 'submitted', 'approved', 'published')),
    is_stale BOOLEAN NOT NULL DEFAULT false,
    computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    submitted_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_final_grades_status ON final_grades (status);

CREATE TABLE grade_submissions (
    id VARCHAR(32) PRIMARY KEY,
    offering_id VARCHAR(32) NOT NULL REFERENCES course_offerings(id),
    submitted_by VARCHAR(32) NOT NULL REFERENCES users(id),
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    note TEXT,
    student_count SMALLINT NOT NULL,
    status VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'published', 'rejected'))
);
CREATE UNIQUE INDEX uq_grade_submissions_active ON grade_submissions (offering_id) WHERE status IN ('pending', 'approved');
CREATE INDEX idx_grade_submissions_offering_date ON grade_submissions (offering_id, submitted_at DESC);
CREATE INDEX idx_grade_submissions_status ON grade_submissions (status);

CREATE TABLE grade_submission_reviews (
    id VARCHAR(32) PRIMARY KEY,
    submission_id VARCHAR(32) NOT NULL REFERENCES grade_submissions(id) ON DELETE CASCADE,
    stage VARCHAR(12) NOT NULL CHECK (stage IN ('department', 'registrar')),
    decision VARCHAR(10) NOT NULL CHECK (decision IN ('approved', 'rejected', 'published')),
    reviewer_id VARCHAR(32) NOT NULL REFERENCES users(id),
    comment TEXT,
    reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE department_assessment_templates (
    id VARCHAR(32) PRIMARY KEY,
    department_id VARCHAR(32) NOT NULL REFERENCES departments(id),
    name VARCHAR(80) NOT NULL,
    type VARCHAR(12) NOT NULL CHECK (type IN ('assignment', 'quiz', 'midterm', 'final', 'practical', 'project')),
    max_marks NUMERIC(6,2) NOT NULL,
    weight NUMERIC(5,2) NOT NULL,
    sort_order SMALLINT NOT NULL
);

-- 7. Withdrawals
CREATE TABLE withdrawal_reason_categories (
    id VARCHAR(30) PRIMARY KEY,
    label VARCHAR(60) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE withdrawal_requests (
    id VARCHAR(32) PRIMARY KEY,
    reference_no VARCHAR(12) NOT NULL UNIQUE,
    student_id VARCHAR(32) NOT NULL REFERENCES students(id),
    scope VARCHAR(10) NOT NULL CHECK (scope IN ('course', 'semester', 'university')),
    semester_id VARCHAR(32) REFERENCES semesters(id),
    enrollment_id VARCHAR(32) REFERENCES course_enrollments(id),
    reason_category_id VARCHAR(30) NOT NULL REFERENCES withdrawal_reason_categories(id),
    reason TEXT NOT NULL,
    status VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    decided_by VARCHAR(32) REFERENCES users(id),
    decided_at TIMESTAMPTZ,
    admin_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_withdrawal_requests_pending ON withdrawal_requests (
    student_id,
    scope,
    COALESCE(semester_id, ''),
    COALESCE(enrollment_id, '')
) WHERE status = 'pending';
CREATE INDEX idx_withdrawal_student ON withdrawal_requests (student_id);
CREATE INDEX idx_withdrawal_status_date ON withdrawal_requests (status, submitted_at DESC);
CREATE INDEX idx_withdrawal_semester ON withdrawal_requests (semester_id);

CREATE TABLE withdrawal_clearances (
    request_id VARCHAR(32) NOT NULL REFERENCES withdrawal_requests(id) ON DELETE CASCADE,
    office VARCHAR(12) NOT NULL CHECK (office IN ('department', 'library', 'housing', 'registrar')),
    status VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    cleared_by VARCHAR(32) REFERENCES users(id),
    cleared_at TIMESTAMPTZ,
    remarks TEXT,
    PRIMARY KEY (request_id, office)
);

-- 8. Communication and audit
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

CREATE TABLE announcements (
    id VARCHAR(32) PRIMARY KEY,
    title VARCHAR(160) NOT NULL,
    body TEXT NOT NULL,
    audience VARCHAR(10) NOT NULL CHECK (audience IN ('all', 'student', 'teacher', 'dept_head')),
    author_id VARCHAR(32) NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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

-- 9. Settings
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

CREATE TABLE policy_excluded_courses (
    course_id VARCHAR(32) PRIMARY KEY REFERENCES courses(id) ON DELETE CASCADE
);
