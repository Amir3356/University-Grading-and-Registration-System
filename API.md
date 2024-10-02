# REST API — University Grading and Registration System

This is the HTTP API the backend must provide so the React client in `client/` can drop its in-browser mock store (`client/store/*.js`) and the page-local mock data.

Each endpoint is derived from a page in `client/features/`:

- Most of them match an existing store function one-to-one. Appendix A gives the mapping, so pages can be switched over one call at a time.
- Endpoints marked **NEW** back pages that currently run on hard-coded or localStorage data: semester registration, withdrawals, My Grades, the dashboards, and dept-head approvals.

The tables, columns and enums referred to here are defined in [DATABASE_DESIGN.md](DATABASE_DESIGN.md).

---

## 1. Conventions

### 1.1 Basics
| Item | Rule |
|---|---|
| Base URL | `/api/v1` |
| Format | JSON in and out, `Content-Type: application/json`. Field names are `camelCase` |
| Auth | `Authorization: Bearer <accessToken>` on every endpoint except `POST /auth/login` and `POST /auth/refresh` |
| IDs | String IDs as stored (`usr_0001`, `off_0012`, …) |
| Dates | `YYYY-MM-DD` for dates; ISO-8601 UTC for timestamps (`2026-10-19T08:30:00Z`) |
| Enums | Lower-case codes from DATABASE_DESIGN.md §4. The client maps them to labels |
| Scoping | The server derives the caller's identity (student, teacher, department) from the token. **Never** from a request parameter. A student can only ever read their own records; a dept head only their own department |

### 1.2 Roles

`A` = admin, `H` = dept_head, `T` = teacher, `S` = student. A **Roles** column lists who may call an endpoint.

### 1.3 Pagination, search, sort
List endpoints accept `page` (default 1), `pageSize` (default 10, max 100; `pageSize=all` returns everything on endpoints that allow it), `search`, and `sort=field:asc|desc`. They return:

```json
{ "items": [ … ], "total": 128, "page": 1, "pageSize": 10, "pageCount": 13 }
```

Some lists add extra summary fields next to `items`, such as `pendingCount` or `unreadCount`.

### 1.4 Errors
The error shape matches the client's `StoreError` (`client/store/helpers.js`), so `useMutation` can keep showing field errors.

```json
{
  "error": {
    "kind": "validation",
    "message": "Please correct the highlighted fields.",
    "fieldErrors": { "email": "This email is already in use." }
  }
}
```

| HTTP | `kind` | When |
|---|---|---|
| 400 / 422 | `validation` | Bad input. `fieldErrors` maps field → message. For mark entry, the keys are `"<enrollmentId>:<assessmentId>"` |
| 401 | `unauthenticated` | Missing or expired token, or inactive user |
| 403 | `forbidden` | Wrong role, or the resource is outside the caller's scope |
| 404 | `not_found` | |
| 409 | `conflict` | Business rule blocked the action (grades locked, duplicate registration, record in use, …) |

### 1.5 Side effects
Every write records an `audit_logs` row and, where noted, creates `notifications`. Neither needs a separate call.

---

## 2. Authentication & profile

| Method | Path | Roles | Description |
|---|---|---|---|
| POST | `/auth/login` | public | Sign in |
| POST | `/auth/refresh` | public | Exchange a refresh token for a new access token |
| POST | `/auth/logout` | any | Revoke the refresh token (audit `auth.logout`) |
| GET | `/auth/me` | any | Current user and profile (used on app load) |
| PATCH | `/auth/me` | any | Update own `firstName`, `lastName`, `phone` |
| POST | `/auth/me/password` | any | Change own password |

**POST `/auth/login`**

Request:

```json
{ "role": "student", "identifier": "UGR/24/0001", "password": "••••••••" }
```

- `identifier` may be the username or the role's ID:
  - student: Student ID (`students.studentNumber`)
  - teacher: Teacher ID (`teachers.employeeNumber`)
  - dept_head: employee number or department code (`CS`)
  - admin: username
- The password is **always** checked.
- Wrong credentials and inactive accounts both return 401 with a single generic message.

Response `200`:

```json
{
  "accessToken": "…", "refreshToken": "…", "expiresIn": 900,
  "user":    { "id": "usr_0018", "roleId": "student", "username": "abebe.k", "firstName": "Abebe", "lastName": "Kebede",
               "email": "…", "phone": "…", "status": "active", "mustChangePassword": false, "lastLoginAt": "…", "createdAt": "…" },
  "profile": { "id": "stu_0001", "studentNumber": "UGR/24/0001", "departmentId": "dep_cs", "department": { … },
               "programId": "prg_bsc_cs", "program": "BSc Computer Science", "programType": "regular",
               "admissionYear": 2024, "yearOfStudy": 3, "academicStatus": "active" }
}
```

`profile` depends on the role:
- teacher and dept_head: the teacher profile (`employeeNumber`, `title`, `specialization`, `officeRoom`, `hireDate`, `department`).
- student: the student profile shown above.
- admin: `null`.

**POST `/auth/me/password`**

Request:

```json
{ "currentPassword": "…", "newPassword": "…", "confirmPassword": "…" }
```

- The new password needs at least 8 characters, including an upper-case letter, a lower-case letter and a digit.
- It clears `mustChangePassword` and revokes the user's other refresh tokens.

---

## 3. Lookups (reference data)

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/lookups` | any | Everything forms and filters need, in one call |

Response:

```json
{
  "departments": [ … ], "programs": [ … ], "academicYears": [ … ], "semesters": [ { …, "academicYear": { … } } ],
  "currentSemester": { … }, "gradeScale": [ { "letter": "A", "min": 90, "max": 100, "points": 4.0 } ],
  "policy": { "passMark": 50, "approvalWorkflowEnabled": true, "repeatPolicy": "latest", … },
  "university": { "name": "…", "shortName": "NBU", … }, "roles": [ … ],
  "assessmentTypes": [ { "value": "quiz", "label": "Quiz" } ],
  "programTypes": [ "regular", "extension", "weekend" ],
  "registrationTypes": [ { "id": "cafe", "label": "Regular (Café)" } ],
  "withdrawalReasonCategories": [ { "id": "medical", "label": "Medical / Health" } ],
  "courses": [ … ], "teachers": [ … ], "students": [ … ]
}
```

`courses`, `teachers` and `students` are included for admins only; for dept heads they are limited to their department.

---

## 4. Users & accounts (Account Provision)

Used by: Admin › Account Provision, User detail, Dept head › Account Provision / Department Students / Department Teachers.

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/users` | A, H | List users. Filters: `search` (name, username, email, ID), `role`, `status`, `departmentId`, `programType`. Paged |
| GET | `/users/:id` | A, H | Detail: user, profile, and for students `summary{enrollments, cgpa, earnedCredits}`; for teachers `offerings[]`; `recentActivity[]` (last 10 audit rows) |
| POST | `/users` | A, H | Create an account (see body below) |
| PUT | `/users/:id` | A, H | Update account and profile. Role change → 409 if academic records exist |
| PATCH | `/users/:id/status` | A, H | `{ "status": "inactive", "reason": "…" }`. Reason is required when deactivating; students become `suspended` |
| DELETE | `/users/:id` | A, H | 409 if the student has enrollments or the teacher has offerings |
| POST | `/users/:id/reset-password` | A, H | Returns `{ "temporaryPassword": "…" }`, sets `mustChangePassword`, notifies the user |
| GET | `/users/suggest-email?name=Jane Doe` | A, H | `{ "email": "jane.doe@university.edu" }` (unique) |
| GET | `/users/suggest-identifier?roleId=student&departmentId=dep_cs` | A, H | `{ "identifier": "UGR/26/0061" }` or `EMP-CS-07` |
| GET | `/students` | A, H | Student picker / Department Students. Filters: `search`, `departmentId`, `programId`, `programType`, `yearOfStudy`, `status`. Paged |
| GET | `/teachers` | A, H | Teacher list with `offeringCount` in the current semester. Filter: `departmentId` |

**POST `/users`**

Request:

```json
{
  "roleId": "student",
  "firstName": "Jane", "lastName": "Doe", "username": "jane.doe", "email": "jane.doe@university.edu", "phone": "",
  "identifier": "UGR/26/0061", "departmentId": "dep_cs",
  "programId": "prg_bsc_cs", "programType": "regular", "admissionYear": 2026, "yearOfStudy": 1, "dateOfBirth": null,
  "title": "Dr.", "specialization": "", "officeRoom": "",
  "password": null
}
```

- Student-only fields: `programId`, `programType`, `admissionYear`, `yearOfStudy`, `dateOfBirth`.
- Teacher/dept-head-only fields: `title`, `specialization`, `officeRoom`.
- `password` is optional; when omitted, a temporary one is generated.

Response `201`:

```json
{ "user": { … }, "username": "jane.doe", "temporaryPassword": "Xk3…7a" }
```

Rules:
- Department heads may only create, update or delete `student` and `teacher` accounts in their own department.
- `username`, `email` and `identifier` must be unique.
- Creating a `dept_head` sets the department's head, and the previous head is demoted.

---

## 5. Departments & programs

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/departments` | A | With `head`, `courseCount`, `teacherCount`, `studentCount`. Filter: `search` |
| POST | `/departments` | A | `{ code?, name, description, headTeacherId? }`. If `code` is omitted, it is generated from the name |
| PUT | `/departments/:id` | A | Same body |
| DELETE | `/departments/:id` | A | 409 while it has courses, teachers or students |
| GET | `/programs` | A, H | **NEW.** Filter: `departmentId` |
| POST | `/programs` | A | **NEW.** `{ departmentId, code, name, durationYears, requiredCredits }` |
| PUT | `/programs/:id` | A | **NEW** |
| DELETE | `/programs/:id` | A | **NEW.** 409 if students are assigned |
| GET | `/programs/:id/courses` | A, H, S | **NEW.** Curriculum (used by Student › Progress "remaining courses") |
| PUT | `/programs/:id/courses` | A, H | **NEW.** Replace the curriculum `[{ courseId, yearOfStudy, term, isRequired }]` |

---

## 6. Courses

Used by: Admin › Courses, Dept head › Department Courses.

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/courses` | A, H | Filters: `search` (code, title), `departmentId`, `status`. Rows include `departmentName` and `offeringCount`. Dept heads see their own department only |
| POST | `/courses` | A, H | `{ code, title, departmentId, creditHours, level, description }`. Dept head: department is forced to their own |
| PUT | `/courses/:id` | A, H | Same body plus `status` (`active` / `archived`). 409 if `creditHours` changes after grades were published |
| DELETE | `/courses/:id` | A, H | 409 if the course was ever offered (archive instead) |

Validation:
- `code` must match `^[A-Z]{2,6}\d{3}[A-Z]?$` and be unique.
- `creditHours` must be 1–6.
- `level` must be 100–900.
- `departmentId` must be an existing department; unknown names are **not** auto-created, as they are today.

---

## 7. Academic calendar

Used by: Admin › Academic Calendar.

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/academic-calendar` | A | Academic years (newest first), each with `semesters[]` and `offeringCount` |
| POST | `/academic-years` | A | `{ name: "2027/2028", startDate, endDate }` |
| PUT | `/academic-years/:id` | A | `{ startDate, endDate }` |
| POST | `/semesters` | A | `{ academicYearId, term: "first", startDate, endDate, gradeSubmissionDeadline, withdrawalDeadline? }` |
| PUT | `/semesters/:id` | A | Dates, deadlines, `status` |
| POST | `/semesters/:id/set-current` | A | Marks it current: earlier semesters become `closed`, later ones `upcoming` |
| DELETE | `/semesters/:id` | A | 409 if current or has offerings |

---

## 8. Semester registration (NEW)

These endpoints replace the page-local mock data in `RegistrationPeriodsPage`, `StudentRegistrationsPage` and the student `RegistrationsPage`.

### 8.1 Registration periods (admin)
| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/registration-periods` | A | Filters: `academicYearId`, `term`, `status`, `search`. Paged. Rows: `{ id, semester{ id, name, term, academicYear }, startDate, deadline, status, registrationTypes[], registeredCount, pendingCount }` |
| GET | `/registration-periods/:id` | A | |
| POST | `/registration-periods` | A | `{ semesterId, startDate, deadline, registrationTypeIds: ["cafe","non_cafe"], status: "scheduled" }` |
| PUT | `/registration-periods/:id` | A | Same body. 409 if the period is closed and has registrations |
| POST | `/registration-periods/:id/open` | A | 409 if dates are missing or another period is already open |
| POST | `/registration-periods/:id/close` | A | |
| DELETE | `/registration-periods/:id` | A | 409 if any registrations exist |
| GET | `/registration/summary?semesterId=` | A | Stat cards: `{ totalSemesters, openPeriods, registered, pending, notRegistered, byType: [{ typeId, count }] }` |

Validation:
- `deadline ≥ startDate`.
- At least one registration type.
- One period per semester: a duplicate returns 409.

### 8.2 Student registrations (admin view)
| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/semester-registrations` | A | Filters: `semesterId` (default current), `departmentId`, `programId`, `registrationTypeId`, `status` (`pending`, `registered`, `rejected`, `cancelled`, **`not_registered`**), `search` (name, Student ID). Paged |
| PATCH | `/semester-registrations/:id` | A | `{ registrationTypeId }` (switch Café / Non-Café). The type must be allowed by the period |
| POST | `/semester-registrations/:id/approve` | A | `pending` → `registered`. Notifies the student |
| POST | `/semester-registrations/:id/reject` | A | `{ remarks }` (required) |
| POST | `/semester-registrations/bulk-approve` | A | `{ ids: [ … ] }`. Only pending rows change. Returns `{ approved, skipped }` |
| DELETE | `/semester-registrations/:id` | A | Remove a record created in error |

Each row in `GET /semester-registrations` is a student joined to their registration, or `null` when they have none:

```json
{ "studentId": "stu_0001", "studentNumber": "UGR/24/0001", "name": "Abebe Kebede", "department": { "id": "dep_cs", "name": "Computer Science" },
  "program": "BSc Computer Science", "programType": "regular", "yearOfStudy": 3,
  "registration": { "id": "reg_…", "registrationTypeId": "cafe", "status": "registered", "submittedAt": "…", "reviewedAt": "…" },
  "status": "registered" }
```

### 8.3 Student self-service
| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/student/registration/current-period` | S | The open period (or `null`) with `allowedTypes[]`, `daysLeft` and `myRegistration` |
| GET | `/student/registrations` | S | Own registration history, newest first |
| POST | `/student/registrations` | S | `{ semesterId, registrationTypeId }`. Created with status `pending` |
| POST | `/student/registrations/:id/cancel` | S | Only while `pending` and the period is open |

`POST /student/registrations` errors:
- **409** `"You have already registered for 2026 First Semester."`
- **409** if the period is not open, today is outside its dates, or the student's academic status is not active.
- **422** if the type is not allowed by the period.

---

## 9. Course offerings & teacher assignment

Used by: Admin/Dept head › Teacher Assignments, Approvals, Reports.

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/offerings` | A, H | Filters: `semesterId`, `departmentId`, `teacherId`, `gradeStatus`, `search` (course code/title, teacher). Paged. Rows are the offering view (below) |
| GET | `/offerings/:id` | A, H, T(own) | Offering view |
| POST | `/offerings` | A, H | `{ courseId, semesterId, teacherId, section, capacity, room, schedule }`. Notifies the teacher (`assignment`) |
| PUT | `/offerings/:id` | A, H | `{ teacherId, section, capacity, room, schedule }`. 409 if the teacher changes after submission; 422 if capacity is below enrolled |
| DELETE | `/offerings/:id` | A, H | 409 while students are enrolled |

**Offering view:**

```json
{ "id": "off_0012", "courseId": "…", "semesterId": "…", "teacherId": "…", "section": "A", "capacity": 45, "room": "CS-144",
  "schedule": "Tue/Thu 10:30–12:00", "gradeStatus": "draft",
  "course": { "id": "…", "code": "CS101", "title": "…", "creditHours": 3, "level": 100, "department": { … } },
  "semester": { "id": "…", "name": "2026 First Semester", "term": "first", "isCurrent": true, "gradeSubmissionDeadline": "…", "academicYear": { … } },
  "teacher": { "id": "…", "name": "Dr. Jane Doe", "employeeNumber": "EMP-CS-01", "user": { "email": "…" } },
  "enrolledCount": 40, "withdrawnCount": 2, "assessmentCount": 5, "weightTotal": 100, "weightsValid": true,
  "missingMarks": 12, "completeCount": 31, "overdue": false }
```

`missingMarks`, `completeCount` and `overdue` are included so the grade-entry index doesn't have to load one gradebook per course.

---

## 10. Enrollment

Used by: Admin › Enrollment.

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/offerings/:id/enrollments` | A | Class list: `[{ id, status, isRepeat, enrolledAt, student{…}, hasScores }]` |
| GET | `/offerings/:id/eligible-students` | A | Active students not yet enrolled. Filters: `search`, `departmentId`. Max 200 |
| POST | `/offerings/:id/enrollments` | A | `{ studentIds: [ … ] }` → `{ enrolled: 3 }`. Blocked when the semester is closed, grades are submitted, capacity is exceeded, or a student is already enrolled. Sets `isRepeat` automatically. Notifies each student |
| POST | `/enrollments/:id/withdraw` | A | `{ reason }` (required). 409 if grades are published |
| DELETE | `/enrollments/:id` | A | Only if no marks or final grade exist |

---

## 11. Assessments

Used by: Teacher › Assessment Management, Course detail.

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/offerings/:id/assessments` | A, T(own) | Sorted by due date, each with `scoreCount` |
| POST | `/offerings/:id/assessments` | A, T(own) | `{ name, type, maxMarks, weight, dueDate, description }` |
| PUT | `/assessments/:id` | A, T(own) | Same body |
| DELETE | `/assessments/:id` | A, T(own) | 409 if marks exist |
| POST | `/assessments/:id/release` | A, T(own) | `{ "isReleased": true }`. On release, notifies every non-withdrawn student (`marks_released`) |
| POST | `/offerings/:id/assessments/apply-template` | A, T(own) | **NEW, optional.** Copy the department's assessment template into an empty offering |

Rules:
- `name` must be unique within the offering (case-insensitive).
- `maxMarks` must be 1–1000 and cannot go below the highest mark already entered.
- `weight` must be 0.5–100, and the offering's total may not exceed 100. The error states the remaining weight.
- Creating, editing and deleting assessments is blocked (409) while grades are submitted, approved or published. Releasing marks is still allowed.

---

## 12. Gradebook & mark entry

Used by: Teacher › Entermark, Grade Entry spreadsheet, Grade Sheet, Course detail, Performance reports, Student performance.

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/offerings/:id/gradebook` | A, T(own) | Full gradebook (shape below) |
| PATCH | `/offerings/:id/scores` | A, T(own) | Save draft marks |
| POST | `/offerings/:id/scores/import` | A, T(own) | CSV import, with a dry run |
| GET | `/offerings/:id/scores/import-template` | A, T(own) | **NEW, optional.** CSV `student_id,name,<assessment names…>` pre-filled with current marks (withdrawn students excluded) |
| GET | `/offerings/:id/grade-history` | A, H(dept), T(own) | Audit trail of mark and status changes: `[{ createdAt, userName, action, details, reason, before, after }]` |
| GET | `/offerings/:id/performance` | A, H(dept), T(own) | `{ offering, assessments, rows, stats, struggling[], passMark }` |
| GET | `/offerings/:id/students/:enrollmentId/performance` | A, T(own) | One student: `{ offering, student, enrollment, total, runningPercent, letter, complete, assessments[{…, marks, percent, classAveragePercent}], classAverage, atRisk }` |
| GET | `/offerings/:id/grade-sheet` | A, H(dept), T(own) | Printable sheet: gradebook + `stats` + `university` + `generatedAt`. The client builds the CSV, XLSX and PDF |

**GET `/offerings/:id/gradebook`** response:

```json
{
  "offering": { …offering view… },
  "assessments": [ { "id": "asm_1", "name": "Quiz 1", "type": "quiz", "maxMarks": 10, "weight": 10, "dueDate": "…", "isReleased": true } ],
  "rows": [ {
      "enrollmentId": "enr_1", "enrollment": { "status": "enrolled", "isRepeat": false },
      "student": { "id": "stu_1", "studentNumber": "UGR/24/0001", "name": "…", "email": "…" },
      "marks": { "asm_1": 8.5 }, "total": 8.5, "runningPercent": 85, "complete": false, "enteredCount": 1,
      "letter": null, "gradePoints": null, "passed": null, "finalGrade": null } ],
  "weightTotal": 100, "weightsValid": true, "passMark": 50, "scale": [ … ],
  "stats": { "studentCount": 40, "completeCount": 0, "average": null, "runningAverage": 71.2, "highest": null, "lowest": null,
             "passRate": null, "passed": 0, "failed": 0, "distribution": [ { "letter": "A", "count": 0 } ],
             "assessmentAverages": [ { "assessmentId": "asm_1", "name": "Quiz 1", "maxMarks": 10, "average": 7.1, "averagePercent": 71, "entered": 40, "expected": 40 } ],
             "missingMarks": 160 },
  "locked": false,
  "latestSubmission": { "id": "gar_…", "status": "rejected", "submittedAt": "…", "reviews": [ { "stage": "department", "decision": "rejected", "comment": "…", "reviewedAt": "…" } ] },
  "requiresReason": true,
  "approvalWorkflowEnabled": true
}
```

`requiresReason` is true after a submission has been **rejected**. While it is true, changing a mark that already exists needs a reason. A brand-new mark never does.

**PATCH `/offerings/:id/scores`**

Request:

```json
{ "changes": [ { "enrollmentId": "enr_1", "assessmentId": "asm_1", "marks": 9 },
               { "enrollmentId": "enr_2", "assessmentId": "asm_1", "marks": null } ],
  "reason": "Re-marked after review" }
```

- `marks: null` clears a mark.

Response:

```json
{ "created": 1, "updated": 0, "cleared": 1 }
```

Errors:
- **409** if the offering is locked.
- **422** with `fieldErrors` keyed `"enr_1:asm_1"`: "Must be a number", "Cannot be negative", "Cannot exceed 10", or "Student has withdrawn".
- **422** `reason` when it is required (see `requiresReason` above) but missing.

Side effects:
- An offering in `not_started` moves to `draft`.
- Draft final grades are marked `isStale`.
- Each change writes an audit row (`score.created`, `score.updated` or `score.deleted`) with before/after values and the reason.

**POST `/offerings/:id/scores/import`**

Request:

```json
{ "records": [ { "student_id": "UGR/24/0001", "Quiz 1": "9", "Midterm": "41" } ], "dryRun": true, "reason": null }
```

- `records` are the CSV rows parsed by the client.

Response:

```json
{ "matchedColumns": ["Quiz 1","Midterm"], "unknownColumns": [], "errors": [ { "row": 3, "message": "Student UGR/24/0099 is not enrolled in this course." } ],
  "changeCount": 2, "changes": [ … ], "applied": false }
```

How the import is read:
- The ID column may be named `student_id`, `student id`, `studentid`, `student_number` or `student number`.
- Columns named `name`, `student name`, `total` and `grade` are ignored.
- Assessment columns are matched to assessment names, case-insensitively.
- Empty cells are skipped.
- The import is all-or-nothing: any error means nothing is applied.
- `dryRun: false` applies the changes through the same rules as `PATCH /scores`.

---

## 13. Grade submission, approval & publication

**Workflow:**
1. The teacher submits.
2. The **department head** approves or rejects. This is the department stage.
3. The **admin (registrar)** publishes, or rejects. This is the registrar stage.

When `policy.approvalWorkflowEnabled = false`, submitting publishes immediately.

| Method | Path | Roles | Description |
|---|---|---|---|
| POST | `/offerings/:id/grade-submissions` | A, T(own) | Submit final grades. `{ note? }` → `{ status: "submitted" \| "published", submissionId }` |
| GET | `/offerings/:id/grade-submissions` | A, H(dept), T(own) | **Full** submission history of one offering, each with `reviews[]` |
| GET | `/grade-submissions` | A, H | Approval queue. Filters: `status` (`pending`, `approved`, `rejected`, `published`), `semesterId`, `search` (course, teacher). Paged, plus `pendingCount`. Dept heads see their department only; admins see everything |
| GET | `/grade-submissions/:id` | A, H(dept) | Detail: `{ submission{…, submitterName, note, reviews[]}, offering, assessments, rows, weightTotal, weightsValid, passMark, scale, stats, history[] }` |
| POST | `/grade-submissions/:id/approve` | H(dept), A | Department-stage approval. `{ comment? }`. Offering → `approved`. Notifies the teacher and admins |
| POST | `/grade-submissions/:id/reject` | H(dept), A | `{ comment }` (**required**). Allowed at either stage. Offering → `rejected`, final grades → `draft`. Notifies the teacher (`grade_rejected`) |
| POST | `/grade-submissions/:id/publish` | A | Registrar stage. Only from `approved`. Final grades → `published`. Notifies all enrolled students (`grade_published`) and the teacher |

`POST /offerings/:id/grade-submissions` rules:
- **409** unless weights total exactly 100.
- **409** if there are no active students.
- **409** if any active student has missing marks; the error names how many.
- **409** if the offering is already locked.

What a successful submission does:
- Computes a final grade for every enrollment. Withdrawn enrollments get `W`.
- Locks the offering.
- Notifies the department head (`approval_required`).

`GET /grade-submissions` list row:

```json
{ "id": "gar_…", "offering": { "id": "…", "course": { "code": "CS101", "title": "…" }, "semester": { "name": "…" }, "section": "A" },
  "teacher": { "name": "Dr. Jane Doe", "employeeNumber": "EMP-CS-01" }, "studentCount": 45, "submittedAt": "…",
  "status": "pending", "offeringStatus": "submitted", "lastReview": { "stage": "department", "reviewerName": "…", "reviewedAt": "…" } }
```

---

## 14. Grading configuration

Used by: Admin › Grading Policies, Settings › Grading.

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/grading/config` | any | `{ scale: { id, name, effectiveFrom, entries[] }, policy, courses[{id, code, title}] }` |
| PUT | `/grading/scale` | A | `{ entries: [ { letter, min, max, points } ] }`. Saves a **new scale version**; published grades keep their letters |
| PUT | `/grading/policy` | A | `{ passMark, approvalWorkflowEnabled, repeatPolicy, incompletePolicy, withdrawalPolicy, probationGpa, honorsGpa, atRiskMargin, excludedCourseIds[] }` |

Scale validation errors come back as `fieldErrors.scale: [ "A and A- overlap.", … ]`. The rules:
- letters unique and non-empty;
- 0 ≤ min ≤ max ≤ 100;
- points between 0 and 5;
- the scale starts at 0 and ends at 100, with no gaps or overlaps.

---

## 15. Withdrawals (NEW)

These endpoints replace `client/store/withdrawalsStore.js` (localStorage) and the unsaved "Request Withdrawal" dialog on the student course page.

### 15.1 Student
| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/student/withdrawal-requests` | S | Own requests, newest first, with `clearances[]` |
| POST | `/student/withdrawal-requests` | S | Submit a request (body below) |
| POST | `/student/withdrawal-requests/:id/cancel` | S | Only while `pending` |

**POST `/student/withdrawal-requests`**

Request:

```json
{ "scope": "semester", "semesterId": "sem_2026_fall", "enrollmentId": null,
  "reasonCategoryId": "medical", "reason": "…", "acknowledged": true }
```

- `scope` is one of `course`, `semester`, `university`.
- `enrollmentId` is required only when `scope` is `course`.

Response `201`:

```json
{ "id": "…", "referenceNo": "WR-009", "status": "pending", "submittedAt": "…",
  "clearances": [ { "office": "department", "status": "pending" }, … ] }
```

Errors:
- **409** if a pending request already exists for the same scope and term.
- **409** if the withdrawal deadline has passed.
- **409** for a course-scope request once that course's grades are published.

Student name, department and program type come from the student's profile. They are not sent in the request.

### 15.2 Administration
| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/withdrawal-requests` | A, H(dept) | Filters: `status`, `scope`, `departmentId`, `semesterId`, `programType`, `search` (name, Student ID, reference). Paged |
| GET | `/withdrawal-requests/summary` | A | `{ total, pending, approved, rejected, byScope: { course, semester, university } }` |
| GET | `/withdrawal-requests/:id` | A, H(dept) | Detail with student profile and clearances |
| PATCH | `/withdrawal-requests/:id/clearances/:office` | A, H (`department` office only) | `{ status: "approved" \| "rejected", remarks? }` |
| POST | `/withdrawal-requests/:id/approve` | A | `{ adminNotes? }` |
| POST | `/withdrawal-requests/:id/reject` | A | `{ adminNotes }` (required) |

`POST /withdrawal-requests/:id/approve`:
- Allowed only from `pending`.
- For `semester` and `university` scope, all clearances must be approved first.

Side effects of approval:
- **course**: the enrollment becomes `withdrawn`.
- **semester**: every enrollment in that semester is withdrawn and the semester registration is cancelled.
- **university**: additionally, the student's academic status becomes `withdrawn`.
- The student is notified.

Row shape:

```json
{ "id": "…", "referenceNo": "WR-001", "scope": "semester", "status": "pending", "submittedAt": "…",
  "student": { "id": "stu_0001", "studentNumber": "UGR/24/0001", "name": "Abebe Kebede", "programType": "regular",
               "department": { "id": "dep_cs", "code": "CS", "name": "Computer Science" } },
  "semester": { "id": "sem_2026_fall", "name": "2026 First Semester", "academicYear": { "name": "2026/2027" } },
  "enrollment": null, "reasonCategory": { "id": "medical", "label": "Medical / Health" }, "reason": "…",
  "adminNotes": null, "decidedBy": null, "decidedAt": null,
  "clearances": [ { "office": "library", "status": "approved", "clearedAt": "…", "remarks": null } ] }
```

---

## 16. Teacher workspace

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/teacher/dashboard` | T, H | `{ currentSemester, stats{courses, students, pendingSubmissions, awaitingApproval}, currentOfferings[], pendingOfferings[], coursePerformance[{offeringId, code, title, average, students, missingMarks}], distribution[], distributionSemester, recentActivity[], upcoming[assessment + courseCode] }` |
| GET | `/teacher/offerings` | T, H | Own offerings (offering view). Filters: `semesterId`, `academicYearId`, `search`. Sorted newest semester first |
| GET | `/teacher/offerings/:id` | T, H | `{ offering, assessments, students[{ enrollment, student, runningPercent, total, complete, letter }] }` |
| GET | `/teacher/students` | T, H | Class lists across own offerings. Filters: `semesterId`, `offeringId`, `search`. Paged. Rows: `{ enrollmentId, offeringId, courseCode, courseTitle, semesterName, studentId, studentNumber, name, email, department, yearOfStudy, status, isRepeat, runningPercent, letter }` |

Teachers also use these endpoints for their own offerings: §11 (assessments), §12 (gradebook, scores, history, performance) and §13 (submit grades, submission history).

A dept head who also teaches uses the same `/teacher/*` endpoints for their own offerings.

---

## 17. Student workspace

All responses are limited to the signed-in student.

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/student/dashboard` | S | `{ student, currentSemester, currentCourses[], gpa, gpaSemester, cgpa, earnedCredits, standing{label, tone}, trend[{semester, term, gpa, cgpa, credits}], recentResults[], releasedMarks[], publishedCount }` |
| GET | `/student/courses` | S | Own enrollments. Filters: `academicYearId`, `semesterId`, `term`. Row shape below |
| GET | `/student/courses/:enrollmentId` | S | Course row plus `assessments[{ id, name, type, maxMarks, weight, dueDate, isReleased, marks }]`, `runningPercent`, `earnedWeighted` |
| GET | `/student/assessments` | S | All own assessments. Filters: `semesterId`, `offeringId`, `status` (`graded`, `upcoming`, `pending`). Rows add `courseCode`, `courseTitle`, `percent`, `dueDate`, `status` |
| GET | `/student/grades` | S | **My Grades.** Filters: `academicYearId`, `semesterId`, `offeringId`. `{ semesters[{ semester, courses[courseRow + countsInGpa, note], gpa, cgpa, credits, qualityPoints }], cgpa, earnedCredits, passMark }` |
| GET | `/student/grade-report?semesterId=` | S | **NEW.** One semester's published results: `{ student, semester, courses[{ code, title, creditHours, totalScore, letter, gradePoints, result }], gpa, cgpa, credits, standing }` |
| GET | `/student/progress` | S | `{ student, cgpa, earnedCredits, attemptedCredits, requiredCredits, gpaCredits, qualityPoints, standing, policy{…}, semesters[], completed[], failed[{course, attempts[]}], inProgress[], remaining[] }`. `remaining` and `requiredCredits` come from the program curriculum |
| GET | `/student/transcript` | S | Transcript (shape in §18) |

**Course row** (`/student/courses`):

```json
{ "enrollmentId": "enr_1", "offeringId": "off_1", "status": "enrolled", "isRepeat": false,
  "course": { "code": "CS101", "title": "…", "creditHours": 3, "level": 100 },
  "semester": { "id": "…", "name": "2026 First Semester", "term": "first", "isCurrent": true, "academicYear": { "id": "ay_2026", "name": "2026/2027" } },
  "teacher": { "name": "Dr. Jane Doe", "email": "…", "officeRoom": "CS-105" },
  "section": "A", "room": "CS-144", "schedule": "…", "weightTotal": 100,
  "resultStatus": "in_progress",
  "finalGrade": null,
  "pendingWithdrawal": null }
```

- `resultStatus` is one of `in_progress`, `pending`, `published`, `withdrawn`.
- `finalGrade` is filled only once the grade is published: `{ totalScore, letter, gradePoints, special, publishedAt, passed }`.
- `pendingWithdrawal` is the open course-withdrawal request for this enrollment, if any.

Visibility rule: an assessment's marks are returned only if the assessment is released or the final grade is published. Totals and letters are hidden until publication.

---

## 18. Reports

Admins see every department. Dept heads may call these endpoints too: `departmentId` is forced to their own department and any other value returns 403.

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/reports/admin-dashboard` | A | Admin dashboard (shape below) |
| GET | `/reports/dept-dashboard` | H | **NEW.** `{ department, currentSemester, stats{ students, teachers, courses, currentOfferings, pendingApprovals, overdueGrades, passRate, averageScore }, pendingSubmissions[], distribution[], coursePerformance[], studentsByStanding[] }` |
| GET | `/reports/missing-grades` | A, H | Filters: `semesterId`, `departmentId`. `[{ offeringId, courseCode, courseTitle, semesterName, teacherName, gradeStatus, students, incompleteStudents, missingMarks, weightTotal, deadline, overdue }]` |
| GET | `/reports/departments` | A | Filter: `semesterId`. `[{ departmentId, code, name, grades, averageScore, averageGradePoint, passRate, passed, failed, students, averageCgpa, distribution[] }]` |
| GET | `/reports/course-results` | A, H | Filters: `semesterId`, `departmentId`. `[{ offeringId, courseCode, courseTitle, semesterName, teacherName, gradeStatus, students, average, passRate, passed, failed, highest, lowest, distribution[] }]` |
| GET | `/reports/grade-distribution` | A, H | Filters: `semesterId`, `departmentId`. `{ total, withdrawn, incomplete, distribution[], averageScore }` |
| GET | `/reports/gpa` | A, H | Filters: `departmentId`, `programType`, `yearOfStudy`, `standing`, `search`, `sort`. Paged rows `{ studentId, studentNumber, name, department, program, admissionYear, semesterGpa, semesterName, cgpa, earnedCredits, standing }`, plus `summary{ averageCgpa, deansList, probation }` |
| GET | `/reports/registrations` | A | **NEW.** Filter: `semesterId`. Registration counts by department, program type and registration type |
| GET | `/students/:id/transcript` | A, H(dept), S(self) | Transcript |
| GET | `/students/:id/performance` | A, H(dept) | `{ student, cgpa, earnedCredits, standing, trend[{semester, gpa, cgpa}], courses[{ enrollmentId, courseCode, courseTitle, creditHours, semesterName, status, gradeStatus, runningPercent, total, letter, published }] }` |

**Admin dashboard** (`/reports/admin-dashboard`):

```json
{ "currentSemester": { … },
  "stats": { "students": 60, "teachers": 14, "departments": 5, "courses": 32, "currentOfferings": 12, "currentEnrollments": 238,
             "pendingApprovals": 3, "overdueGrades": 1, "approvedUnpublished": 1, "passRate": 88.2, "averageScore": 72.4,
             "pendingRegistrations": 4, "pendingWithdrawals": 3 },
  "enrollmentTrend": [ { "semester": "…", "enrollments": 140, "students": 55 } ],
  "performanceTrend": [ { "semester": "…", "average": 71.3, "passRate": 89.1 } ],
  "distribution": [ { "letter": "A", "count": 40 } ],
  "departmentPerformance": [ { "department": "CS", "name": "Computer Science", "average": 73.1, "gpa": 2.91 } ],
  "attention": [ { "id": "approvals", "tone": "warning", "title": "3 grade submission(s) awaiting approval", "link": "/admin/grade-approvals" } ],
  "recentActivity": [ { …audit row, "userName": "…" } ] }
```

**Transcript** (`/students/:id/transcript` and `/student/transcript`):

```json
{ "university": { "name": "…", "registrarName": "…", … }, "student": { "name": "…", "studentNumber": "…", "program": "…", "department": { … }, "admissionYear": 2024 },
  "generatedAt": "…",
  "semesters": [ { "semesterId": "…", "name": "2024 First Semester", "gpa": 3.21, "cgpa": 3.21, "credits": 15, "qualityPoints": 48.15,
                   "courses": [ { "courseCode": "CS101", "courseTitle": "…", "creditHours": 3, "totalScore": 83.15, "letter": "B+", "gradePoints": 3.5,
                                  "countsInGpa": true, "isRepeat": false, "superseded": false, "note": null } ] } ],
  "cgpa": 3.05, "earnedCredits": 60, "attemptedCredits": 63, "qualityPoints": 183.0, "gpaCredits": 60,
  "standing": { "label": "Good Standing", "tone": "default" }, "scale": [ … ], "policy": { "repeatPolicy": "latest", "passMark": 50 } }
```

Only published grades appear. `note` is one of `Withdrawn`, `Incomplete`, `Excluded from GPA`, `Failed` or `Repeated`.

---

## 19. Notifications & announcements

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/notifications` | any | Own notifications. Filters: `unreadOnly`. Paged, plus `unreadCount` |
| GET | `/notifications/unread-count` | any | `{ unreadCount }`, for the sidebar badge |
| PATCH | `/notifications/:id/read` | any | Mark one notification read (own only) |
| POST | `/notifications/read-all` | any | Mark all own notifications read |
| GET | `/announcements?limit=5` | any | Announcements for the caller's role (admins see all) |
| POST | `/announcements` | A | `{ title, body, audience }`. Notifies every active user in the audience |

---

## 20. Audit logs

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/audit-logs` | A | Filters: `search` (details, user, action, reason), `action` (prefix, e.g. `grades`), `entityType`, `userId`, `from`, `to` (dates). Paged, newest first. Rows add `userName` and `userRole` |
| GET | `/audit-logs/actions` | A | Distinct action prefixes: `["academic_year","assessment","auth","course","enrollment","grades",…]` |

---

## 21. Settings & system

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/settings` | A | `{ university, policy, updatedAt }` |
| PUT | `/settings/university` | A | `{ name, shortName, motto, address, email, phone, website, registrarName }`. `name`, `shortName`, `email` and `registrarName` are required |
| GET | `/system/backup` | A | Optional. Downloads a JSON export, replacing the localStorage "Download backup" |
| POST | `/system/reset-demo-data` | A | **Development only.** Re-seeds the database. Disable in production |

---

## Appendix A — Mock store function → endpoint

Replace each `store.<module>.<fn>()` call with the HTTP call shown.

| Store function | Endpoint |
|---|---|
| auth.login / logout / me | `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` |
| auth.updateProfile / changePassword | `PATCH /auth/me`, `POST /auth/me/password` |
| lookups.getLookups | `GET /lookups` |
| users.listUsers / getUser | `GET /users`, `GET /users/:id` |
| users.createUser / updateUser / deleteUser | `POST /users`, `PUT /users/:id`, `DELETE /users/:id` |
| users.setUserStatus / resetUserPassword | `PATCH /users/:id/status`, `POST /users/:id/reset-password` |
| users.suggestEmail / suggestIdentifier | `GET /users/suggest-email`, `GET /users/suggest-identifier` |
| users.searchStudents | `GET /students` |
| academics.listDepartments / create / update / delete | `GET/POST /departments`, `PUT/DELETE /departments/:id` |
| academics.listCourses / createCourse / updateCourse / deleteCourse | `GET/POST /courses`, `PUT/DELETE /courses/:id` |
| academics.listAcademicCalendar | `GET /academic-calendar` |
| academics.createAcademicYear / updateAcademicYear | `POST /academic-years`, `PUT /academic-years/:id` |
| academics.createSemester / updateSemester / deleteSemester / setCurrentSemester | `POST /semesters`, `PUT /semesters/:id`, `DELETE /semesters/:id`, `POST /semesters/:id/set-current` |
| academics.listOfferings / getOfferingAdmin | `GET /offerings`, `GET /offerings/:id` |
| academics.createOffering / updateOffering / deleteOffering | `POST /offerings`, `PUT /offerings/:id`, `DELETE /offerings/:id` |
| academics.listOfferingEnrollments / listEligibleStudents | `GET /offerings/:id/enrollments`, `GET /offerings/:id/eligible-students` |
| academics.enrollStudents / withdrawEnrollment / removeEnrollment | `POST /offerings/:id/enrollments`, `POST /enrollments/:id/withdraw`, `DELETE /enrollments/:id` |
| academics.listTeachers | `GET /teachers` |
| grades.getGradingConfig / updateGradeScale / updatePolicy | `GET /grading/config`, `PUT /grading/scale`, `PUT /grading/policy` |
| grades.listAssessments / createAssessment | `GET/POST /offerings/:id/assessments` |
| grades.updateAssessment / deleteAssessment / setAssessmentReleased | `PUT/DELETE /assessments/:id`, `POST /assessments/:id/release` |
| grades.getGradebook / saveScores / importScores | `GET /offerings/:id/gradebook`, `PATCH /offerings/:id/scores`, `POST /offerings/:id/scores/import` |
| grades.submitGrades | `POST /offerings/:id/grade-submissions` |
| grades.listApprovalRequests / getApprovalRequest | `GET /grade-submissions`, `GET /grade-submissions/:id` |
| grades.approveGrades / rejectGrades / publishGrades | `POST /grade-submissions/:id/approve`, `/reject`, `/publish` |
| grades.getOfferingPerformance / getGradeHistory | `GET /offerings/:id/performance`, `GET /offerings/:id/grade-history` |
| teacher.getTeacherDashboard / listMyOfferings / getMyOffering | `GET /teacher/dashboard`, `GET /teacher/offerings`, `GET /teacher/offerings/:id` |
| teacher.listMyStudents / getStudentPerformance | `GET /teacher/students`, `GET /offerings/:id/students/:enrollmentId/performance` |
| student.getStudentDashboard / listMyCourses / getMyCourse | `GET /student/dashboard`, `GET /student/courses`, `GET /student/courses/:enrollmentId` |
| student.listMyAssessments / getMyGrades / getMyProgress / getMyTranscript | `GET /student/assessments`, `/student/grades`, `/student/progress`, `/student/transcript` |
| reports.getAdminDashboard | `GET /reports/admin-dashboard` |
| reports.getMissingGradesReport / getDepartmentReport / getCourseResultsReport | `GET /reports/missing-grades`, `/reports/departments`, `/reports/course-results` |
| reports.getGradeDistributionReport / getGpaReport | `GET /reports/grade-distribution`, `/reports/gpa` |
| reports.getTranscript / getStudentPerformanceReport | `GET /students/:id/transcript`, `GET /students/:id/performance` |
| reports.getCourseGradeSheet | `GET /offerings/:id/grade-sheet` |
| reports.listAuditLogs / listAuditActions | `GET /audit-logs`, `GET /audit-logs/actions` |
| reports.getSettings / updateUniversitySettings / resetDemoData | `GET /settings`, `PUT /settings/university`, `POST /system/reset-demo-data` |
| notifications.listNotifications / markNotificationRead / markAllNotificationsRead | `GET /notifications`, `PATCH /notifications/:id/read`, `POST /notifications/read-all` |
| notifications.listAnnouncements / createAnnouncement | `GET /announcements`, `POST /announcements` |
| withdrawalsStore (localStorage) | §15 `/student/withdrawal-requests`, `/withdrawal-requests` |
| RegistrationPeriodsPage / StudentRegistrationsPage / student RegistrationsPage mocks | §8 |
| DeptApprovalsPage (localStorage `ugs-dept-grade-approvals-v3`) | `GET /grade-submissions` (dept-scoped) and §13 |
| MyGradesPage (`COURSES_DATA`) | `GET /student/grades` |

## Appendix B — UI review findings the API resolves

The API enforces these rules on the server, whatever the current UI does.

1. **Login** never checks a password, drops the Student/Teacher ID, falls back to any user of the chosen role, and can rewrite a user's role or status (`store/auth.js`). `POST /auth/login` must verify credentials and never change data.
2. **Department scope** for dept heads is worked out in the browser, falling back to the first department. The server must derive it from the token for users, courses, approvals, reports and withdrawals.
3. **Dept-head approvals** (`DeptApprovalsPage`) use hard-coded courses and generated marks, toggle status with no reason, and are not linked to the teacher's submission. They should use `/grade-submissions`, with a comment required on rejection.
4. **Publish rights:** `ApprovalDetailPage` shows Publish and "Publish immediately" to dept heads. Only `POST /grade-submissions/:id/publish` (admin) publishes.
5. **The reason rule for mark changes** differs between Entermark, the spreadsheet and CSV import. The API decides it: `requiresReason` is set after a rejection and applies only to changing an existing mark.
6. **Semester registration**: the student page registers instantly, the admin page approves, and neither checks the period window, the allowed types or duplicates. §8 enforces all of these.
7. **Withdrawals** hard-code the department (CS) and reason category, store dates as display strings, allow approve/reject from any status, and never update clearances or enrollments. §15 fixes each of these.
8. **Withdrawn students** can be selected in the Entermark dialog. `PATCH /scores` rejects them (422).
9. **Overdue** is computed from semester order. The API uses `semesters.gradeSubmissionDeadline`.
10. **Placeholder pages** have no data yet: the admin, dept-head, teacher and student dashboards, admin Reports, Audit Logs, dept-head Reports and the student Grade Report. Their endpoints are in §16–§20.
11. **Assessment Management** has no working create/edit/delete or release UI, but the endpoints exist (§11).
12. **Enum spelling** varies across pages: "Extension"/"Extensions", "Café"/"Regular (Café)", "First"/"First Semester", Title-case vs lower-case statuses. The API uses only the codes in DATABASE_DESIGN.md §4.
