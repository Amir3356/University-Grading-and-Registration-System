-- Migration: 004_offerings_enrollments.sql
-- Module: Course Offerings and Course Enrollments

DROP TABLE IF EXISTS course_enrollments CASCADE;
DROP TABLE IF EXISTS course_offerings CASCADE;

-- 1. Course Offerings
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

-- 2. Course Enrollments
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
