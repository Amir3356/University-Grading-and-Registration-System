# University Grading and Registration System — Backend API

Backend server built with Node.js, Express.js, and native PostgreSQL, implementing the comprehensive specifications from `DATABASE_DESIGN.md` and `API.md`.

---

## 1. Architecture & Technology Stack

- **Runtime & Framework**: Node.js (ES Modules), Express.js 5
- **Database**: PostgreSQL (native instance via pgAdmin / local service on port 5432, **No Docker needed**)
- **Database Driver**: `pg` with connection pooling and transactional execution helpers
- **Authentication**: JWT access tokens (15-min expiry) & refresh tokens (7-day expiry with SHA-256 database hashing)
- **Password Security**: `bcryptjs` with salt rounds = 10
- **Testing**: Node.js native test runner (`node:test`, `node:assert/strict`) & `supertest`

---

## 2. Layered Architecture

```
server/
├── migrations/
│   └── 001_initial_schema.sql     # Complete schema (35 tables, constraints, indexes, triggers)
├── src/
│   ├── config/
│   │   ├── env.js                 # Environment variable loader
│   │   └── database.js            # PostgreSQL pool and transaction wrapper
│   ├── controllers/               # Express request/response handlers
│   │   ├── academicController.js
│   │   ├── assessmentController.js
│   │   ├── auditController.js
│   │   ├── authController.js
│   │   ├── gradebookController.js
│   │   ├── lookupController.js
│   │   ├── notificationController.js
│   │   ├── offeringController.js
│   │   ├── registrationController.js
│   │   ├── reportController.js
│   │   ├── settingsController.js
│   │   ├── submissionController.js
│   │   ├── userController.js
│   │   ├── withdrawalController.js
│   │   └── workspaceController.js
│   ├── middleware/
│   │   ├── audit.js               # Audit log recording utility
│   │   ├── auth.js                # JWT verification and user context injection
│   │   ├── authorize.js           # Role and department-scope authorization
│   │   └── errorHandler.js        # Standardized API error response handler
│   ├── repositories/              # Direct SQL queries and data access
│   ├── routes/                    # RESTful route definitions mounted under /api/v1
│   ├── scripts/
│   │   ├── migrate.js             # Runs database migrations
│   │   └── seed.js                # Populates comprehensive demo dataset
│   ├── services/                  # Business logic and cross-entity workflows
│   ├── utils/
│   │   ├── errors.js              # Standardized AppError hierarchy
│   │   ├── formatters.js          # snake_case / camelCase and pagination helpers
│   │   ├── gpaCalculator.js       # GPA, CGPA, quality points & academic standing
│   │   ├── idGenerator.js         # Domain-prefixed unique identifiers
│   │   ├── jwt.js                 # Token signing and verification
│   │   └── password.js            # bcrypt hashing and strength checking
│   ├── app.js                     # Express app setup and middleware pipeline
│   └── server.js                  # Server entry point and DB connection verification
├── tests/
│   └── api.test.js                # Automated integration test suite
├── .env                           # Environment configuration
└── package.json
```

---

## 3. Environment & Database Configuration

Database configuration in `server/.env`:

```env
PORT=5000
NODE_ENV=development

# PostgreSQL connection (Native local PostgreSQL, accessible in pgAdmin)
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=AEHJSS36
DB_NAME=university_grading

# JWT Secrets
JWT_SECRET=ugs_access_secret_production_key_2026
JWT_REFRESH_SECRET=ugs_refresh_secret_production_key_2026
JWT_EXPIRES_IN=900
JWT_REFRESH_EXPIRES_IN=604800

# CORS
CORS_ORIGIN=http://localhost:5173
```

---

## 4. Setup & Running

### Run Migrations & Seed Data
```bash
cd server
npm install
npm run migrate   # Executes migrations/001_initial_schema.sql
npm run seed      # Seeds 77 users, courses, offerings, enrollments, assessments & grades
```

### Run Tests
```bash
npm test
```

### Start Backend API Server
```bash
npm run dev       # Starts on http://localhost:5000 with nodemon
# or
npm start
```

### Start Frontend Client
```bash
cd client
npm install
npm run dev       # Starts on http://localhost:5173 with Vite
```

---

## 5. Default Login Accounts

All seed user accounts are configured with default password `Password123!`:

| Role | Username / Identifier | Notes |
|---|---|---|
| **Admin** | `admin` | System administrator / Registrar |
| **Department Head** | `CS` or `dept_head` | Head of Computer Science (Dr. Tewodros Assefa) |
| **Teacher** | `EMP-CS-01` or `teacher` | Instructor (Dr. Sarah Mitchell) |
| **Student** | `UGR/24/0001` or `student` | Undergraduate student (Abebe Kebede) |
