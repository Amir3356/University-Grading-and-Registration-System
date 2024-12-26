# University Grading and Registration System (UGS)
### Kotebe University of Education (KUE)

A modern, full-stack Academic Information, Semester Registration, and Grade Governance Management System engineered for **Kotebe University of Education**. The platform unifies the entire student academic lifecycle—from semester registration and course enrollment to continuous assessment mark entry, multi-tier grade review and approval, academic standing computation, transcript generation, institutional clearance for withdrawals, and academic grievance resolution.

---

## Architecture & Technology Stack

The platform is structured as a decoupled, layered client-server web application with persistent local database storage, stateless JWT authentication, and event-driven WebSocket synchronization.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   Vite + React 19 Client (SPA)                        │
│   • React Router 7 (Protected, Role-Guarded Nested Routes)             │
│   • Recharts Data Visualizations • TanStack Headless Table Primitives │
│   • jsPDF & jspdf-autotable (Client-Side Vector PDF Engine)           │
│   • Native WebSocket Client with Automatic Reconnection & Heartbeat    │
└───────────────────────────────────▲────────────────────────────────────┘
                                    │ HTTP REST (JSON) / WebSocket WS
┌───────────────────────────────────▼────────────────────────────────────┐
│                  Node.js & Express 5 API Server                        │
│   • Layered Architecture: Routes → Controllers → Services → Repositories│
│   • Security: Helmet Headers, Input Sanitization, Sliding Rate Limiter │
│   • Auth: Dual-Token JWT (Access + DB-Hashed Revocable Refresh Tokens)  │
│   • CASL Attribute-Based & Role-Based Authorization Middleware          │
│   • Native WebSocket Server (`ws`) Broadcasting 11 Domain Event Types  │
└───────────────────────────────────▲────────────────────────────────────┘
                                    │ Connection Pool (pg) & ACID Transactions
┌───────────────────────────────────▼────────────────────────────────────┐
│                     PostgreSQL 16 Database                             │
│   • 36 Normalized Relational Tables + Migration Tracking (node-pg-migrate)│
│   • Strict Foreign Keys (CASCADE / RESTRICT / SET NULL) & CHECK Guards  │
│   • Immutable Audit Log Protection Trigger (PL/pgSQL)                  │
│   • Partial & Compound Indexes on Filter and Foreign Key Columns       │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Functional Requirements

### 1.1 Authentication & Credential Management
- **Dual-Identifier Authentication**: Users authenticate using either their system-assigned unique username or their official academic identifier (Student ID: `UGR/xxx/yy` or Teacher Employee Number: `EMP/xxx`) together with their password.
- **Dual-Token Session Strategy**:
  - Short-lived Access Token (15-minute expiration) transmitted in HTTP Authorization headers (`Bearer <token>`) or `ugs_token` cookies.
  - Long-lived Refresh Token (7-day expiration) stored securely with SHA-256 cryptographic hashing in the `refresh_tokens` database table.
  - Refresh rotation and revocable sessions: Refreshing issues a new token pair and verifies revocation status (`revoked_at`).
- **Forced Password Reset Lifecycle**: When accounts are provisioned, `must_change_password` is flagged `true`. Users are prompted to establish a custom password upon first login.
- **Self-Service Profile & Password Management**: Authenticated users can update their first name, last name, phone number, and change their password by validating their existing current password.
- **Account State & Deactivation**: Administrators and Department Heads can toggle user accounts between `active` and `inactive` states, requiring an explicit deactivation reason for governance tracking.

---

### 1.2 Role-Based Access Control (RBAC) & Scoped Permissions
The system enforces strict multi-tier access control across four standardized roles:

| Role | Role Identifier | Scope & Domain Authority | Default Home Route |
| :--- | :--- | :--- | :--- |
| **System Administrator** | `admin` | University-wide global administrative authority across all departments, users, settings, calendar, registration periods, approvals, audits, and policies. | `/admin/reports` |
| **Department Head** | `dept_head` | Scoped authority over their designated academic department. Supervises departmental courses, students, teachers, course offerings, grade approvals, and missing grade alerts. | `/dept-head/reports` |
| **Teacher / Instructor** | `teacher` | Scoped to assigned course offering sections. Configures course assessments, records continuous assessment marks, submits final grades, and responds to course grievances. | `/teacher` |
| **Student** | `student` | Self-service portal. Registers for active semesters, tracks enrolled courses, inspects assessment marks, views official grades and GPA, requests withdrawals, files complaints, and exports transcripts. | `/student/registrations` |

---

### 1.3 User & Identity Provisioning
- **Role-Delimited Provisioning**:
  - Administrators can provision any user across any role and department.
  - Department Heads can provision Teachers and Students directly into their own department.
- **Automated Identifier Generation**:
  - Students: Generates structured institutional IDs (e.g., `UGR/262626/13`).
  - Teachers: Generates employee numbers (e.g., `EMP/1001`).
- **Automated Email Suggestion**: Generates standardized institutional email addresses (`firstname.lastname@kue.edu.et` or department-prefixed variations) based on entered user attributes.
- **Temporary Password Generator**: Generates cryptographically randomized alphanumeric passwords with special characters for initial distribution.
- **Creator Traceability (`created_by`)**: Tracks which administrative user provisioned each account, ensuring Department Heads retain view access to records they created even during institutional transitions.
- **Data Export**: User rosters can be exported directly to CSV or Microsoft Excel (`.xlsx`) formats.

---

### 1.4 Academic Structure & Curriculum Management
- **Department Management**:
  - Create, view, update, and manage academic departments with unique codes (2–6 characters) and titles.
  - Assign a Head Teacher (`head_teacher_id`) from active faculty members.
- **Degree Programs**:
  - Configure undergraduate and graduate degree programs linked to parent departments.
  - Define program duration in years (1–7 years) and total credit hour completion requirements.
  - Program status lifecycle: `active` or `archived`.
- **Course Catalog**:
  - Maintain centralized course inventory with unique alphanumeric course codes (up to 10 characters), titles, credit hours (1–6 credits), academic level (100–900 series), and department ownership.
  - Support course archiving to prevent deletion of historical course records with existing enrollments.
- **Program Curriculum Mapping (`program_courses`)**:
  - Map courses to specific degree programs by year of study (Year 1 to 7) and academic term (`first`, `second`, `summer`).
  - Flag courses as required core subjects or elective offerings.

---

### 1.5 Academic Calendar & Semester Lifecycle
- **Academic Years**: Define fiscal/academic cycles (e.g., `2025/2026`, `2026/2027`) with strict start and end dates. Exactly one academic year can be flagged as active/current (`is_current = true`).
- **Semesters**:
  - Partition academic years into terms: `first`, `second`, or `summer`.
  - Maintain chronological sort order, operational start/end dates, grade submission deadlines, and withdrawal deadlines.
  - Manage status transitions: `upcoming` → `active` → `closed`.
  - Enforce constraint: Grade submission deadline must be on or after the semester end date.
  - Single active semester constraint: Exactly one semester is designated as current university-wide.

---

### 1.6 Semester Registration Management
- **Registration Periods**:
  - Administrators open, schedule, toggle, or close semester registration windows bound to a specific semester.
  - Define window start dates and registration deadlines.
  - Associate permissible registration program types (`regular`, `extension`, `weekend`).
- **Student Self-Service Registration**:
  - Eligible students view currently open registration periods.
  - Submit semester registration specifying their study program type and dining service status (`cafe` vs `non_cafe`).
  - Prevent duplicate submissions for the same semester via database uniqueness constraints (`UNIQUE (student_id, semester_id)`).
  - Students can edit or cancel registrations while in `pending` status.
- **Administrative Registration Governance**:
  - Filter and inspect registration applications by semester, department, program, registration type, cafe status, and status (`pending`, `registered`, `rejected`, `cancelled`).
  - Approve or reject registrations with reviewer notes and timestamps.
  - Bulk approval/rejection capabilities for batch processing.

---

### 1.7 Course Offerings & Student Enrollment
- **Course Offering Configuration**:
  - Create section-specific offerings for active semesters (e.g., Section 1, Section 2).
  - Assign a designated instructor (`teacher_id`), target year of study (Year 1–5), room assignment, schedule string, and student capacity (1–500 students).
  - Enforce uniqueness: A course cannot have duplicate section numbers within the same semester (`UNIQUE (course_id, semester_id, section)`).
- **Student Enrollment**:
  - Enroll students into specific course offerings.
  - Track enrollment status (`enrolled`, `dropped`, `withdrawn`, `completed`) and repeat flags (`is_repeat`).
  - Prevent over-enrollment beyond section capacity.

---

### 1.8 Assessment Management & Entermark Gradebook
- **Assessment Configuration**:
  - Instructors configure course assessments under six categories: `assignment`, `quiz`, `midterm`, `final`, `practical`, and `project`.
  - Set maximum raw marks (1–1000) and percentage weights (0.5%–100%).
  - Total weight validation: Requires total assessment weights to sum to exactly 100.0% before grades can be submitted.
  - Uniqueness constraint: Assessment titles within an offering must be unique (`offering_id, lower(name)`).
- **Assessment Release Control**:
  - Instructors toggle `is_released` to control whether students can view assessment marks on their portal.
- **Entermark Score Grid**:
  - Real-time tabular grade entry interface supporting continuous auto-saving and batch score updates.
  - Computes weighted total, running percentages, projected letter grade, and pass/fail indicators dynamically.
  - Gradebook locking: Automatically locks score modification once an offering's final grades have been submitted.
  - Adjustment audit justification: If scores are modified after initial entry, an audit adjustment reason is recorded.
- **CSV & Excel Import/Export**:
  - Export student mark sheets to formatted CSV and Excel files.
  - Bulk import assessment marks with automatic validation against maximum scores and enrollment IDs.

---

### 1.9 Multi-Tier Grade Approval & Publishing Workflow
The system implements a rigid three-stage governance workflow to ensure academic integrity:

```
┌─────────────────┐       Submit Grades       ┌──────────────────────┐
│     TEACHER     │ ────────────────────────> │   DEPARTMENT HEAD    │
│ Enters marks &  │   Status: 'submitted'     │ Reviews distribution │
│ verifies 100%   │                           │ & anomalies          │
└─────────────────┘                           └──────────┬───────────┘
                                                         │
                                  Approve                │ Reject with Feedback
                         ┌───────────────────────────────┴──────────────────────────────┐
                         ▼                                                              ▼
              ┌──────────────────────┐                                     ┌──────────────────────┐
              │  OFFICIALLY APPROVED │                                     │  RETURNED TO DRAFT   │
              │ Status: 'approved'   │                                     │ Status: 'rejected'   │
              └──────────┬───────────┘                                     └──────────────────────┘
                         │
                         │ Publish Officially
                         ▼
              ┌──────────────────────┐
              │  REGISTRAR / ADMIN   │
              │ Status: 'published'  │
              │ • Updates transcripts│
              │ • Notifies students  │
              └──────────────────────┘
```

1. **Stage 1 — Submission (Teacher)**:
   - Teacher submits finalized grades along with optional submission notes.
   - Status changes to `submitted`. Offering grade status advances to `submitted`.
   - Notification dispatched to the Department Head.
2. **Stage 2 — Departmental Review (Department Head)**:
   - Department Head inspects score distribution curves, pass/fail counts, and at-risk students.
   - **Approve**: Department Head approves submission (`stage = 'department'`, `decision = 'approved'`). Status becomes `approved`.
   - **Reject**: Department Head rejects submission with mandatory feedback comments (`decision = 'rejected'`). Status returns to `draft`/`rejected`, unlocking the gradebook for teacher revisions.
3. **Stage 3 — Official Publishing (Registrar / Admin)**:
   - System Administrator / Registrar performs final institutional audit.
   - Grades can only be published if previously approved by the department.
   - Publishing locks final grades (`status = 'published'`), stamps publication timestamps, and generates automated in-app notifications to all enrolled students.

---

### 1.10 Grading Policies, GPA Calculation & Academic Standing
- **Configurable University Grading Scale**:
  - Maintains an active grading scale with letter grades, percentage boundaries, and Grade Points (GP):
    - `A` (90.00% – 100.00% | 4.00 GP)
    - `A-` (85.00% – 89.99% | 3.75 GP)
    - `B+` (80.00% – 84.99% | 3.50 GP)
    - `B` (75.00% – 79.99% | 3.00 GP)
    - `B-` (70.00% – 74.99% | 2.75 GP)
    - `C+` (65.00% – 69.99% | 2.50 GP)
    - `C` (60.00% – 64.99% | 2.00 GP)
    - `D` (50.00% – 59.99% | 1.00 GP)
    - `F` (0.00% – 49.99% | 0.00 GP)
  - Strict scale validation: Unique letter grades, contiguous non-overlapping ranges covering 0.00% to 100.00% with no gaps > 0.01%, grade points bounded between 0.00 and 5.00.
- **Academic Policy Configuration**:
  - Minimum Pass Mark (default: `50.00%`).
  - Repeat Policy (`latest`, `highest`, `all` attempts).
  - Incomplete (`I`) Policy (`exclude` from GPA or treat `as_fail`).
  - Withdrawal (`W`) Policy (`exclude` from GPA calculation).
  - Honors GPA Threshold (default: `3.50`).
  - Academic Probation GPA Threshold (default: `2.00`).
  - At-Risk Student Margin (default: `10.00%` above pass mark).
  - Policy Excluded Courses (courses exempt from standard GPA calculations).
- **GPA Computation Engine**:
  - **Semester GPA (SGPA)**: \(\frac{\sum (\text{Credit Hours} \times \text{Grade Points})}{\sum \text{Credit Hours}}\) for graded courses completed within a specific semester.
  - **Cumulative GPA (CGPA)**: Weighted cumulative grade point average across all completed semesters in the student's academic history.
  - **Academic Standing Determination**:
    - \(\text{CGPA} \ge 3.50\) \(\rightarrow\) **Dean's List / Honors**
    - \(2.00 \le \text{CGPA} < 3.50\) \(\rightarrow\) **Good Standing**
    - \(\text{CGPA} < 2.00\) \(\rightarrow\) **Academic Probation**

---

### 1.11 Transcripts & Official Document Generation
- **Student Academic Transcript**:
  - Aggregates complete biographical details (Student Name, Student ID, Department, Program, Program Type, Admission Year).
  - Organizes records by chronological academic years and semesters.
  - Lists course codes, course titles, credit hours, raw percentage scores, letter grades, and earned grade points.
  - Computes per-semester summary rows: Total Credits Registered, Credits Completed, Total Grade Points Earned, SGPA, and cumulative CGPA.
  - Calculates degree progress: Total Credits Earned vs Total Required Credits.
- **Automated Client-Side PDF Generation**:
  - Directly generates vector PDF transcripts using `jsPDF` and `jspdf-autotable`.
  - Includes official **Kotebe University of Education** institutional headers, university motto, student biographical metadata table, structured semester grade tables, academic standing badges, and registrar signature lines.
  - One-click direct background download with no popup blockers or page redirects.

---

### 1.12 Student Withdrawals & Multi-Office Clearance
- **Withdrawal Scope Levels**:
  - `course`: Withdraw from a single course section.
  - `semester`: Terminate registration and enrollments for the current semester.
  - `university`: Complete institutional withdrawal and departure from the university.
- **Structured Reason Categories**: Predefined categories (`Health / Medical`, `Financial Reasons`, `Family Emergency`, `Academic Difficulty`, `Personal / Relocation`).
- **Four-Stage Institutional Clearance Workflow**:
  - Every withdrawal request automatically instantiates mandatory clearance checkpoints across four administrative offices:
    1. **Department Office** (academic standing and property check)
    2. **Library Office** (borrowed book returns and fines check)
    3. **Housing / Proctor Office** (dormitory key and property surrender)
    4. **Registrar Office** (final academic file closure)
  - Authorized administrative officers record clearance status (`pending`, `approved`, `rejected`) and operational remarks.
- **Automated Withdrawal Side Effects**:
  - Upon final approval by the Registrar:
    - `course`: Sets course enrollment to `withdrawn`, assigns special grade `W`, and updates final grades.
    - `semester`: Withdraws all course enrollments for the semester, assigns `W` grades, and cancels semester registration (`status = 'cancelled'`).
    - `university`: Withdraws all active and upcoming course enrollments, cancels registrations, and updates the student's master academic status to `withdrawn`.
    - Automated notification sent to the student.

---

### 1.13 Academic Grievances & Complaints Management
- **Student Grievance Filing**:
  - Students file complaints targeting general academic concerns or specific enrolled courses.
  - Configurable Priority levels: `Low`, `Normal`, `Medium`, `High`, `Urgent`.
  - Automatic unique reference number generation (e.g., `CMP-2026-001`).
  - Students can modify details or cancel complaints while in `pending` status.
- **Faculty & Administrative Resolution**:
  - Department Heads and assigned instructors review complaints filed for their respective department/courses.
  - Accept complaints into review (`status = 'in_review'`).
  - Provide official written resolution responses (`status = 'resolved'`).
  - Server-side cursor and offset pagination with full-text search across reference numbers, course codes, and complaint descriptions.

---

### 1.14 Reporting & Administrative Dashboards
- **System Administrator Dashboard**:
  - University-wide enrollment, active student counts, course offerings, pending grade submissions, and registration metrics.
  - Real-time audit log event stream.
- **Department Head Dashboard & Reports**:
  - **Missing Grades Report**: Real-time identification of course offerings past or approaching the grade submission deadline with unsubmitted final grades, complete with instructor contact info.
  - **Course Results Report**: Course-by-course performance breakdown: total enrolled, graded count, pass percentage, average percentage score, and distribution counts across letter grades (`A`, `B`, `C`, `D`, `F`, `W`, `I`).
  - **GPA Roster Report**: Searchable, paginated student GPA rankings filterable by department, program type, year of study, and academic standing (`Good Standing`, `Dean's List`, `Academic Probation`).
  - **Grade Distribution Analytics**: Visual distribution charts highlighting departmental grade variance.
- **Withdrawals & Registration Cross-Report**:
  - Tabular and visual cross-analysis comparing student registration intake (Regular, Extension, Weekend, Cafe vs Non-Cafe) against withdrawal volumes across scopes.
  - Filterable by specific academic semester or all historical periods with vector PDF export.

---

### 1.15 Notifications & Announcements
- **In-App Notification Center**:
  - Real-time alerts for twelve event triggers: `system`, `announcement`, `assignment`, `enrollment`, `marks_released`, `grade_published`, `grade_approved`, `grade_rejected`, `grade_attention`, `approval_required`, `registration`, and `withdrawal`.
  - Unread count badges, individual mark-as-read, and bulk mark-all-read operations.
  - Embedded deep-links directing users straight to the affected page (e.g., clicking a published grade notification navigates directly to `/student/grades`).
- **Broadcast Announcements**:
  - Administrators post system announcements targeted by audience: `all`, `student`, `teacher`, or `dept_head`.

---

### 1.16 Centralized Immutable Audit Trail
- **Comprehensive Activity Logging**: Automatically captures administrative, departmental, and grading actions:
  - Actor context: User ID, username, full name, role, email.
  - Department context: Department ID, department name, code.
  - Action types: `create`, `update`, `approve`, `reject`, `delete`, `other`.
  - Entity tracked: Entity type (e.g., `grade_submission`, `user`, `course`, `semester_registration`, `withdrawal`), entity ID, entity name.
  - JSON state snapshots (`details`): Captures prior state (`before`) and updated state (`after`).
  - Network metadata: Client IP address and browser User-Agent string.
- **Database-Enforced Immutability**: Protected by a native PostgreSQL `BEFORE UPDATE OR DELETE` trigger (`trg_audit_logs_immutable`) that blocks any attempt to modify or delete audit log entries.
- **Audit Viewer**: Filterable by action type, entity type, actor, department, and date range with JSON difference inspection.

---

### 1.17 System Administration & Governance
- **University Identity Settings**:
  - Manage university branding stored in singleton configuration (`university_settings` where `id = 1`): Institution Name, Short Name, Motto, Address, Official Email, Phone, Website, and Registrar Name.
  - Changes instantly propagate to client navigation headers, report summaries, and PDF export templates.
- **System Backup & Demo Data Management**:
  - JSON database backup endpoint (`/api/v1/system/backup`) allowing administrators to export table records for disaster recovery.
  - Controlled demo data reset functionality.

---

## 2. Non-Functional Requirements

### 2.1 Security & Protection Attributes
- **Password Security & Hashing**:
  - Passwords hashed using `bcryptjs` with a work factor of 10 salt rounds.
  - Passwords are never stored or logged in plaintext.
- **Token Cryptography & Storage**:
  - JSON Web Tokens signed with HMAC-SHA256 (`HS256`).
  - Separate distinct secrets for Access Tokens (`JWT_SECRET`) and Refresh Tokens (`JWT_REFRESH_SECRET`).
  - Refresh tokens stored as SHA-256 hashes in the database; plaintext tokens never persist.
- **Defense-in-Depth HTTP Security**:
  - Standardized `Helmet` integration: Enforces `X-Frame-Options: DENY` (anti-clickjacking), `X-Content-Type-Options: nosniff` (anti-MIME-sniffing), `Strict-Transport-Security` (HSTS max-age 1 year), and removes `X-Powered-By`.
  - CORS strictly configured to validate authorized origins with credential support (`credentials: true`).
- **Request Input Sanitization & Injection Prevention**:
  - Global middleware strips null bytes (`\0`) and script tags from request bodies and query parameters.
  - 100% of database interactions utilize parameterized SQL queries (`$1, $2, ...`), completely eliminating SQL Injection vulnerabilities.
  - Request payloads validated at route boundaries using strict `Zod` schemas before hitting controllers.
- **Rate Limiting & Abuse Prevention**:
  - Sliding-window in-memory rate limiting applied to authentication routes (`/api/v1/auth/login`) to mitigate brute-force credential stuffing.
  - Global API rate limiting on `/api/*` endpoints with standard rate limit response headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`).
- **Authorization Attribute Verification**:
  - Controller and repository checks enforce tenant/department boundaries. Teachers cannot inspect gradebooks of courses they do not instruct; Department Heads cannot approve submissions outside their department.

---

### 2.2 Performance & Responsiveness
- **Database Connection Pooling**:
  - Native PostgreSQL client pool (`pg.Pool`) configured with configurable maximum connections (`DB_POOL_MAX`, default: 20).
  - Idle connection timeout (`10,000ms`) and acquisition timeout (`5,000ms`) prevent pool exhaustion and thread starvation.
  - Execution duration monitoring: Automatically warns on slow database queries exceeding 250ms in development mode.
- **Database Indexing Strategy**:
  - Targeted B-tree indexes applied on all foreign key references, status columns, and timestamp sorting columns (e.g., `idx_final_grades_status`, `idx_audit_logs_created_at`, `idx_semester_reg_sem_status`).
  - Case-insensitive unique indexes on user identifiers: `lower(username)` and `lower(email)`.
- **Client Bundle Optimization**:
  - Route-level code splitting using `React.lazy()` and `Suspense` across all feature modules.
  - Initial vendor chunk separation ensures rapid first-contentful-paint (FCP).
- **Client-Side Reference Data Caching**:
  - `LookupsProvider` loads university reference data (departments, semesters, academic years, programs, grade scales, university branding) once upon authentication and caches it in memory, eliminating redundant network roundtrips.

---

### 2.3 Scalability & Concurrency
- **Stateless Application Server**:
  - The Express server maintains no in-memory session state; session identity is extracted entirely from the cryptographically validated JWT access tokens.
  - The API tier can be horizontally scaled behind a load balancer (e.g., Nginx, AWS ALB) with sticky sessions or Redis pub/sub for WebSocket sync.
- **Optimized WebSocket Event Broadcasting**:
  - Non-blocking WebSocket broadcast engine fans out operational events to connected clients, enabling multiple concurrent users (e.g., teacher entering grades while department head monitors approvals) to maintain synchronized state without polling.
- **Cursor & Offset Pagination**:
  - Heavy listing endpoints (Complaints, Audit Logs, Users, GPA Rosters, Registrations) enforce pagination limits, preventing large memory allocations when database volume scales.

---

### 2.4 Data Integrity & Consistency
- **ACID Transaction Management**:
  - Multi-step state changes executed inside `withTransaction(async (client) => { ... })` wrappers.
  - Automatic `ROLLBACK` on any unexpected failure or constraint violation, ensuring partial updates never corrupt database state.
- **Relational Integrity Rules**:
  - Strict Foreign Key constraints prevent orphan records (`ON DELETE CASCADE` for dependent sub-entities like assessment scores; `ON DELETE RESTRICT` or `ON DELETE SET NULL` for academic entities).
  - Check constraints ensure valid domains (e.g., `credit_hours BETWEEN 1 AND 6`, `duration_years BETWEEN 1 AND 7`, `marks >= 0`, `capacity BETWEEN 1 AND 500`).
- **Audit Immutability**:
  - Native PostgreSQL trigger `trg_audit_logs_immutable` guarantees that audit records cannot be altered or purged through any standard SQL query.

---

### 2.5 Reliability, Availability & Fault Tolerance
- **Centralized Error Handling Architecture**:
  - Custom error hierarchy (`AppError`, `NotFoundError`, `ValidationError`, `ConflictError`, `ForbiddenError`, `UnauthorizedError`).
  - Standardized JSON error response schema:
    ```json
    {
      "error": {
        "kind": "validation",
        "message": "Please correct the highlighted fields.",
        "fieldErrors": { "email": "Please enter a valid email address." }
      }
    }
    ```
  - Graceful handling of PostgreSQL native error codes (`23505` unique violation, `23503` foreign key violation) preventing raw database stack trace leakage.
- **WebSocket Heartbeat & Reconnection**:
  - Server executes a 30-second ping/pong heartbeat interval to clean up stale/dead socket connections.
  - Client automatically detects socket drops and reconnects with exponential backoff.
- **Graceful Process Shutdown**:
  - Listens for `SIGINT` and `SIGTERM` signals to cleanly drain the PostgreSQL connection pool and close active HTTP/WebSocket servers before exiting.

---

### 2.6 Usability, Design & Accessibility
- **Responsive Layout**:
  - Fully responsive web layout supporting mobile, tablet, and desktop viewports with collapsible navigation sidebars and sliding sheet drawers.
- **Theme Support**:
  - Dual-mode support for Light and Dark themes driven by persistent CSS design tokens and `ThemeProvider`.
- **Accessible UI Primitives**:
  - Component library built on accessible Radix UI primitives with full keyboard navigation and ARIA attributes.
- **Feedback & Confirmation Modals**:
  - Destructive operations (dropping courses, rejecting grade submissions, account deactivations) require explicit modal confirmation.
  - Asynchronous operations communicate status via `Sonner` toast notifications.

---

## 3. Database Schema Reference

The system database (`university_grading`) comprises **36 domain tables**:

| Module | Tables | Purpose |
| :--- | :--- | :--- |
| **Authentication & RBAC** | `roles`, `role_permissions`, `users`, `refresh_tokens` | Identity, role authorization, credentials, and revocable sessions. |
| **Academic Structure** | `departments`, `programs`, `courses`, `program_courses`, `teachers`, `students` | Institutional taxonomy, faculty records, student profiles, and curricula. |
| **Calendar & Registration** | `academic_years`, `semesters`, `registration_types`, `registration_periods`, `registration_period_types`, `semester_registrations` | Academic scheduling, registration periods, cafe status, and enrollments. |
| **Courses & Deliveries** | `course_offerings`, `course_enrollments` | Section offerings, teacher assignments, room schedules, and student rosters. |
| **Assessments & Grading** | `department_assessment_templates`, `assessments`, `assessment_scores`, `grade_scales`, `grade_scale_entries`, `final_grades`, `grade_submissions`, `grade_submission_reviews` | Assessment definitions, mark books, grade scales, submissions, and approval reviews. |
| **Withdrawals & Clearance** | `withdrawal_reason_categories`, `withdrawal_requests`, `withdrawal_clearances` | Withdrawal requests, reason taxonomies, and 4-office clearance records. |
| **Grievances & Complaints** | `complaints` | Student academic grievances, status transitions, and faculty responses. |
| **Governance & Policies** | `university_settings`, `academic_policies`, `policy_excluded_courses` | Singleton university metadata, grading thresholds, and course exclusions. |
| **Audit & Communication** | `audit_logs`, `notifications`, `announcements` | Immutable audit trail, in-app notifications, and targeted broadcasts. |

---

## 4. Real-Time WebSocket Event Architecture

The system coordinates real-time synchronization between clients via WebSocket (`/ws`):

| Broadcast Event | Trigger Condition | Intended Client Reaction |
| :--- | :--- | :--- |
| `PERIOD_CHANGED` | Registration period created, modified, toggled, or deleted. | Admin & Student registration pages re-fetch active windows. |
| `REGISTRATION_CHANGED` | Student submits, cancels, or admin approves/rejects registration. | Live update of student registration table and admin approval queue. |
| `OFFERING_UPDATED` | Offering details change or grade submission status advances. | Teacher dashboard, enter mark page, and dept approval queue refresh. |
| `GRADE_SUBMISSION_UPDATED` | Teacher submits grades for review. | Department Head badge count updates; approval row reflects status. |
| `SCORES_UPDATED` / `GRADE_UPDATED` | Teacher saves continuous assessment marks. | Student assessment marks view and teacher gradebook sync live. |
| `TRANSCRIPT_UPDATED` | Final grades published officially by Registrar. | Student report page and transcript PDF data refresh automatically. |
| `WITHDRAWAL_CHANGED` | Withdrawal submitted, clearance updated, approved, or rejected. | Admin withdrawal table and student status view update immediately. |
| `COMPLAINT_CREATED` / `UPDATED` | Student files complaint or staff member resolves it. | Teacher, Dept Head, and Student complaint tables synchronize. |
| `AUDIT_LOG_CREATED` | Any auditable system operation completes. | Admin Audit Trail live event stream prepends new log entry. |
| `COURSE_CREATED` / `UPDATED` / `DELETED` | Department/admin edits the course catalog. | Course dropdowns and department course lists refresh. |
| `USER_UPDATED` / `DELETED` | User details, status, or role profile modified. | User administration tables update in real time. |
| `GRADING_POLICY_UPDATED` | Grading scale or academic policy modified by admin. | Lookups cache invalidates; calculations adopt new policy rules. |

---

## 5. Getting Started & Installation

### Prerequisites
- **Node.js**: `v20.x` or higher
- **PostgreSQL**: `v14.x` – `v16.x` running on local port `5432`
- **Package Manager**: `npm`

### 1. Database Setup
Ensure PostgreSQL is active and create the database:
```sql
CREATE DATABASE university_grading;
```

### 2. Backend Server Setup
Navigate to the `server` directory and configure environment variables:
```bash
cd server
npm install
```

Configure `server/.env`:
```env
PORT=5000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=YOUR_POSTGRES_PASSWORD
DB_NAME=university_grading
DB_POOL_MAX=20

JWT_SECRET=ugs_access_secret_production_key_2026
JWT_REFRESH_SECRET=ugs_refresh_secret_production_key_2026
JWT_EXPIRES_IN=900
JWT_REFRESH_EXPIRES_IN=604800

CORS_ORIGIN=http://localhost:5173
```

Run database migrations and seed the initial administrator:
```bash
npm run migrate    # Applies SQL migrations 001 through 015
npm run seed       # Seeds roles, permissions, and primary Administrator (Amir)
```

Start the backend server:
```bash
npm run dev        # Starts server on http://localhost:5000 with nodemon
```

### 3. Frontend Client Setup
In a separate terminal, navigate to the `client` directory:
```bash
cd client
npm install
```

Start the Vite development server:
```bash
npm run dev        # Starts client on http://localhost:5173
```

---

## 6. Seed Accounts & Credentials

The database seed script initializes the primary Administrator account. Subsequent departmental heads, teachers, and students are provisioned directly through the application's Account Provisioning interfaces.

| Role | Username | Identifier | Default Password | Permissions & Notes |
| :--- | :--- | :--- | :--- | :--- |
| **System Administrator** | `Amir` | `usr_0001` | `AEHJSS36` | Full system governance, policies, calendar, approvals, audit trail. |

---

## 7. License & Intellectual Property

Developed for **Kotebe University of Education (KUE)**. All rights reserved.

