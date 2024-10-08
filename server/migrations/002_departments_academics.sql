-- Migration: 002_departments_academics.sql
-- Module: Departments, Programs, Courses, Program Courses, Teachers, and Students

DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS teachers CASCADE;
DROP TABLE IF EXISTS program_courses CASCADE;
DROP TABLE IF EXISTS courses CASCADE;
DROP TABLE IF EXISTS programs CASCADE;
DROP TABLE IF EXISTS departments CASCADE;

-- 1. Departments
CREATE TABLE departments (
    id VARCHAR(32) PRIMARY KEY,
    code VARCHAR(6) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL UNIQUE,
    description TEXT,
    head_teacher_id VARCHAR(32) UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Programs
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

-- 3. Courses
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

-- 4. Program Courses
CREATE TABLE program_courses (
    program_id VARCHAR(32) NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    course_id VARCHAR(32) NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    year_of_study SMALLINT CHECK (year_of_study BETWEEN 1 AND 7),
    term VARCHAR(10) CHECK (term IN ('first', 'second', 'summer')),
    is_required BOOLEAN NOT NULL DEFAULT true,
    PRIMARY KEY (program_id, course_id)
);

-- 5. Teachers
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

-- 6. Students
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
