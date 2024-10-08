-- Migration: 005_assessments_grading.sql
-- Module: Assessments, Scores, Grade Scales, Final Grades, and Submissions

DROP TABLE IF EXISTS department_assessment_templates CASCADE;
DROP TABLE IF EXISTS grade_submission_reviews CASCADE;
DROP TABLE IF EXISTS grade_submissions CASCADE;
DROP TABLE IF EXISTS final_grades CASCADE;
DROP TABLE IF EXISTS grade_scale_entries CASCADE;
DROP TABLE IF EXISTS grade_scales CASCADE;
DROP TABLE IF EXISTS assessment_scores CASCADE;
DROP TABLE IF EXISTS assessments CASCADE;

-- 1. Assessments
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

-- 2. Assessment Scores
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

-- 3. Grade Scales
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

-- 4. Final Grades
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

-- 5. Grade Submissions & Reviews
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

-- 6. Assessment Templates
CREATE TABLE department_assessment_templates (
    id VARCHAR(32) PRIMARY KEY,
    department_id VARCHAR(32) NOT NULL REFERENCES departments(id),
    name VARCHAR(80) NOT NULL,
    type VARCHAR(12) NOT NULL CHECK (type IN ('assignment', 'quiz', 'midterm', 'final', 'practical', 'project')),
    max_marks NUMERIC(6,2) NOT NULL,
    weight NUMERIC(5,2) NOT NULL,
    sort_order SMALLINT NOT NULL
);
