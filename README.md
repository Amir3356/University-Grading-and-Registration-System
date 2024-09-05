# University Grading System (Frontend)

A responsive university grading platform with three roles: **System Administrator**, **Teacher** and **Student**. Each role has its own dashboard, navigation and permissions.

This repository contains the **frontend only**. There is no server. All data comes from static JSON mock files in [`client/data/`](client/data/). A small local store reads them and keeps your changes in the browser, so every form, table and workflow works. There is no API layer.

## Tech stack

- React 19 + Vite
- Tailwind CSS v4 + shadcn/ui-style components (Radix primitives)
- React Router 7
- Recharts
- jsPDF / SheetJS / PapaParse for PDF, Excel and CSV

## Getting started

Requirements: Node.js 20+ and npm.

```bash
cd client
npm install
npm run dev        # http://localhost:5173
```

Other commands:

| Command | What it does |
|---|---|
| `npm run build` | Production build into `client/dist` |
| `npm run preview` | Serve the production build |
| `npm run lint` | ESLint |

No environment variables are required.

### Signing in

The login form has three fields: **Username**, **Password** and **Role** (Admin, Teacher or Student). The username, password and role must all match the account. After signing in you are redirected to that role's dashboard, and only that role's pages are available.

Every account uses the password **`Password123!`**. Demo accounts:

| Role | Username | Notes |
|---|---|---|
| Admin | `admin` | Full access |
| Teacher | `teacher` | Dr. Sarah Mitchell (Computer Science). Has current-semester courses in draft, one Spring course with missing final marks, and one submission returned by the admin. |
| Student | `student` | Computer Science, 2024 cohort. Has published results across four semesters. |

Other accounts in `users.json` use the part of their email before the `@` as the username (for example `tewodros.assefa`). Usernames appear in Admin → Users.

## How the mock data works

```
data/*.json        static seed data (one file per table)
store/db.js        loads the JSON, saves changes to localStorage, applies each change all-or-nothing
store/*.js         plain functions the pages call, e.g. store.users.listUsers(), store.grades.saveScores()
hooks/useStore.js  useQuery (read, re-renders when data changes) and useMutation (change, with toast feedback)
```

- The JSON files follow a relational layout: `users`, `roles`, `departments`, `students`, `teachers`, `courses`, `academicYears`, `semesters`, `courseOfferings`, `courseEnrollments`, `assessments`, `assessmentScores`, `gradeScales`, `finalGrades`, `gradeApprovalRequests`, `notifications`, `auditLogs`, plus `announcements` and `settings`.
- Changes you make (new users, marks, approvals and so on) are saved in `localStorage` under `ugs-db-v2`. They survive a page reload.
- To restore the original JSON data, sign in as admin and go to **Settings → Data management → Reset demo data**. You can also clear site data in the browser.
- The signed-in user's ID is kept in `localStorage` under `ugs-current-user`.

The store functions also apply the app's rules:

- Each role only reaches its own pages, and admin-only functions refuse other roles.
- Teachers can only read or change the courses assigned to them.
- Student functions always use the signed-in student's own records.
- Form input is checked, and problems are shown next to the field.
- Passwords in `users.json` are stored as salted SHA-256 hashes and are never handed to the pages.

> This is a frontend-only demo, so these checks run in the browser. They show how the system should behave, but they are not real security.

## Features by role

**System Administrator**
- Dashboard: live statistics, enrollment and performance charts, grade distribution, items needing attention, recent activity, announcements.
- Users: create, edit, change role, deactivate (a reason is required), reset password to a temporary one, roles and permissions.
- Departments, courses, academic years and semesters (including setting the current semester).
- Teacher assignments (course offerings) and student enrollment. Duplicate enrollments and over-capacity enrollments are blocked.
- Grading policies: configurable grade scale (validated for overlaps and gaps), pass mark, approval workflow on/off, how repeats, incompletes and withdrawals count, courses excluded from GPA.
- Grade approvals: review the full grade sheet, approve (optionally publish at the same time), reject with a reason, publish.
- Reports and transcripts: department performance, course pass/fail rates, grade distributions, semester GPA and CGPA, missing or unpublished grades, student performance, course grade sheets, transcripts. Exports to PDF, Excel and CSV.
- Audit logs with before/after values and reasons. University settings.

**Teacher**
- Dashboard: current courses, pending submissions, course performance, recent activity.
- My courses and class lists by semester and academic year. Students list with per-student performance.
- Assessments: name, type, maximum marks, weight and due date. The total weight cannot exceed 100%. Teachers choose when to release marks to students.
- Grade entry: spreadsheet-style entry with live weighted totals and letter grades. Marks above the maximum are rejected. Drafts can be saved. CSV import has a preview step. Changing marks after a returned submission requires a reason.
- Grade submission: checklist (weights total 100%, all marks entered), preview, then submit for approval. If the approval workflow is off, grades are published directly.
- Performance reports: averages, pass rate, distribution, assessment averages, struggling students, and a grade sheet export.

**Student**
- Dashboard: current courses, semester GPA, CGPA, GPA trend chart, released marks, recent results.
- Courses with teachers, credit hours, assessment components and weights.
- Assessments with released marks. Grades by semester, with a PDF or Excel download.
- GPA and academic progress: completed, failed, in-progress and remaining courses, plus standing.
- Unofficial transcript with a PDF download.
- Students see only published final grades and only the marks their teacher has released.

## Grading rules

- Weighted total = Σ (mark ÷ max marks × weight). Final grades can only be submitted when the weights total exactly 100% and every mark is entered.
- The letter grade and grade points come from the active grade scale. The default scale is A 90–100 (4.0) down to F below 50 (0.0), and the admin can edit it.
- GPA = Σ (grade points × credit hours) ÷ Σ credit hours.
- CGPA follows the configured repeat policy: latest attempt (the default), highest attempt, or all attempts. Withdrawals (W) and incompletes (I) are either left out of the GPA or counted as F, depending on policy. Courses on the excluded list never count.

The logic lives in [`client/lib/grading.js`](client/lib/grading.js).

## Grade workflow

```
not_started → draft → submitted ──approve──→ approved ──publish──→ published
                 ↑          └──reject (reason)──→ rejected (teacher fixes and resubmits)
```

Submission, approval, rejection and publication each run as a single transaction. Each one writes an audit log entry and sends notifications to the teacher, the admins or the students. Marks are locked while a submission is under review and once grades are published.

## Project structure

```
client/                            (no src/ folder; app code lives at the client root)
    data/                          static mock JSON (the "database")
    store/                         local data store (db.js + auth, users, academics, grades, reports, teacher, student…)
    lib/                           grading maths, formatting, PDF/Excel/CSV export
    hooks/                         useQuery / useMutation, useDebounce…
    context/                       auth, theme, lookups providers
    components/ui/                 shadcn/ui-style primitives
    components/common/             DataTable, PageHeader, StatCard, ConfirmDialog, badges…
    components/charts/             chart theme + wrappers
    components/layout/             sidebar, top bar, global search (Ctrl K), notifications
    features/{auth,admin,teacher,student,shared}/   pages grouped by feature
    routes/                        router, role guard, navigation config
```

## Connecting a real backend later

Pages only use the `store` object from `store/index.js`. To connect a server later, keep the same function names and change their bodies to call it. The JSON files in `client/data/` correspond one-to-one to the tables you would create.
