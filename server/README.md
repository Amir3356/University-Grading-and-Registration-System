# University Grading and Registration System — Backend API

Backend server built with Node.js, Express.js, and native PostgreSQL, implementing the comprehensive specifications from `DATABASE_DESIGN.md` and `API.md`.

---

## 1. Architecture & Technology Stack

- **Runtime & Framework**: Node.js (ES Modules), Express.js 5
- **Database**: PostgreSQL (native instance via pgAdmin / local service on port 5432, **No Docker needed**)
- **Database Driver**: `pg` with connection pooling and transactional execution helpers
- **Authentication**: JWT access tokens (15-min expiry) & refresh tokens (7-day expiry with SHA-256 database hashing)
- **Password Security**: `bcryptjs` with salt rounds = 10

---

## 2. Layered Architecture

```
server/
├── config/
│   └── database.js            # PostgreSQL pool and transaction wrapper
├── controllers/               # Express request/response handlers
│   ├── academicController.js
│   ├── assessmentController.js
│   ├── auditController.js
│   ├── authController.js
│   ├── gradebookController.js
│   ├── lookupController.js
│   ├── notificationController.js
│   ├── offeringController.js
│   ├── registrationController.js
│   ├── reportController.js
│   ├── settingsController.js
│   ├── submissionController.js
│   ├── userController.js
│   ├── withdrawalController.js
│   └── workspaceController.js
├── middleware/
│   ├── audit.js               # Audit log recording utility
│   ├── auth.js                # JWT verification and user context injection
│   ├── authorize.js           # Role and department-scope authorization
│   └── errorHandler.js        # Standardized API error response handler
├── migrations/                # Classified modular SQL migrations (applied sequentially)
│   ├── 001_auth_identity.sql
│   ├── 002_departments_academics.sql
│   ├── 003_calendar_registration.sql
│   ├── 004_offerings_enrollments.sql
│   ├── 005_assessments_grading.sql
│   ├── 006_withdrawals.sql
│   ├── 007_communication_audit.sql
│   └── 008_settings_policies.sql
├── models/                    # Data schemas (Zod) and database domain models
├── repositories/              # Direct SQL queries and database operations
├── routes/                    # RESTful route definitions mounted under /api/v1
├── seed/                      # Custom database seed script and embedded seed data (index.js)
├── services/                  # Business logic and cross-entity workflows
├── utils/                     # Reusable helpers (JWT, password, response, formatters)
├── .env                       # Environment configuration
├── app.js                     # Express app setup and middleware pipeline
├── package.json
└── server.js                  # Server entry point and DB connection verification
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
npm run migrate        # Runs database migrations using node-pg-migrate
npm run migrate:down   # Rolls back the latest migration batch
npm run seed           # Runs seed script (seed/index.js) to set up admin credentials
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

Seed user accounts are configured with default password `Password123!`:

| Role | Username | Default Password | Notes |
|---|---|---|---|
| **Admin** | `Amir` | `Password123!` | System Administrator |
| **Admin** | `registrar` | `Password123!` | Registrar Office |
