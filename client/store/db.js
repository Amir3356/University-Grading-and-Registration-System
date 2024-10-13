// In-browser mock database. Seeds from the static JSON files in data/ and
// persists changes to localStorage so they survive a page reload.
import academicYears from '@/data/academicYears.json'
import announcements from '@/data/announcements.json'
import assessmentScores from '@/data/assessmentScores.json'
import assessments from '@/data/assessments.json'
import auditLogs from '@/data/auditLogs.json'
import courseEnrollments from '@/data/courseEnrollments.json'
import courseOfferings from '@/data/courseOfferings.json'
import courses from '@/data/courses.json'
import departments from '@/data/departments.json'
import finalGrades from '@/data/finalGrades.json'
import gradeApprovalRequests from '@/data/gradeApprovalRequests.json'
import gradeScales from '@/data/gradeScales.json'
import notifications from '@/data/notifications.json'
import roles from '@/data/roles.json'
import semesters from '@/data/semesters.json'
import settings from '@/data/settings.json'
import students from '@/data/students.json'
import teachers from '@/data/teachers.json'
import users from '@/data/users.json'

const STORAGE_KEY = 'ugs-db-v3'

const SEED = {
  roles,
  users,
  departments,
  teachers,
  students,
  courses,
  academicYears,
  semesters,
  courseOfferings,
  courseEnrollments,
  assessments,
  assessmentScores,
  gradeScales,
  finalGrades,
  gradeApprovalRequests,
  notifications,
  auditLogs,
  announcements,
  settings,
}

export const TABLES = Object.keys(SEED)

function seedState() {
  return structuredClone(SEED)
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (TABLES.every((t) => t in parsed)) {
        // Ensure dept_head role exists
        if (!parsed.roles.some((r) => r.id === 'dept_head')) {
          const deptHeadRole = SEED.roles.find((r) => r.id === 'dept_head')
          if (deptHeadRole) parsed.roles.push(deptHeadRole)
        }
        // Ensure admin user usr_0001 has username Amir
        const adminUser = parsed.users.find((u) => u.id === 'usr_0001');
        if (adminUser) {
          adminUser.username = 'Amir';
          adminUser.firstName = 'Amir';
          adminUser.email = 'amir@university.edu';
          adminUser.roleId = 'admin';
          adminUser.status = 'active';
        }

        // Ensure at least one active user has roleId = 'dept_head'
        const deptHeadUser = parsed.users.find(
          (u) => u.id === 'usr_0004' || u.username === 'tewodros.assefa' || u.username === 'dept_head',
        )
        if (deptHeadUser) {
          deptHeadUser.roleId = 'dept_head'
          deptHeadUser.status = 'active'
        } else {
          const seedHead = SEED.users.find((u) => u.roleId === 'dept_head')
          if (seedHead) parsed.users.push(seedHead)
        }
        // Ensure sample pending and dropped/withdrawn enrollments exist for demonstration
        const pendingEnrs = ['enr_0555', 'enr_0655', 'enr_0735']
        const droppedEnrs = ['enr_0550', 'enr_0650', 'enr_0730']
        for (const id of pendingEnrs) {
          const item = parsed.courseEnrollments.find((e) => e.id === id)
          if (item && item.status !== 'pending') item.status = 'pending'
        }
        for (const id of droppedEnrs) {
          const item = parsed.courseEnrollments.find((e) => e.id === id)
          if (item && item.status !== 'withdrawn' && item.status !== 'dropped') item.status = 'withdrawn'
        }
        if (Array.isArray(parsed.semesters)) {
          for (const s of parsed.semesters) {
            const m = String(s.name).match(/^(Fall|Spring|Summer)\s+(\d{4})/i)
            if (m) {
              const termMap = { fall: 'First Semester', spring: 'Second Semester', summer: 'Summer Semester' }
              s.name = `${m[2]} ${termMap[m[1].toLowerCase()] || `${m[1]} Semester`}`
            }
          }
        }
        return parsed
      }
    }
  } catch {
    // Corrupt or unavailable storage — fall back to the seed.
  }
  return seedState()
}

let state = load()
let version = 0
const listeners = new Set()

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (err) {
    console.warn('Could not persist mock database', err)
  }
}

function emit() {
  version += 1
  for (const fn of listeners) fn(version)
}

let idCounter = Date.now() % 100000
export function newId(prefix) {
  idCounter += 1
  return `${prefix}_${Date.now().toString(36)}${idCounter.toString(36)}`
}

export const now = () => new Date().toISOString()

/** Read-only access to the current state. Never mutate the result outside a transaction. */
export function read() {
  return state
}

/**
 * Run `fn` against a draft copy of the database. If it throws, nothing is
 * committed (rollback); otherwise the draft replaces the state atomically.
 */
export function transaction(fn) {
  const draft = structuredClone(state)
  const tx = createTx(draft)
  const result = fn(tx)
  state = draft
  persist()
  emit()
  return result
}

function createTx(draft) {
  return {
    state: draft,
    table: (name) => draft[name],
    find: (name, id) => draft[name].find((r) => r.id === id),
    insert(name, row) {
      draft[name].push(row)
      return row
    },
    update(name, id, patch) {
      const row = draft[name].find((r) => r.id === id)
      if (!row) throw new Error(`${name} ${id} not found`)
      Object.assign(row, patch, 'updatedAt' in row ? { updatedAt: now() } : {})
      return row
    },
    remove(name, predicate) {
      const before = draft[name].length
      draft[name] = draft[name].filter((r) => !predicate(r))
      return before - draft[name].length
    },
  }
}

export function resetDatabase() {
  state = seedState()
  persist()
  emit()
}

export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function getVersion() {
  return version
}

export function bumpVersion() {
  emit()
}


// Keep tabs in sync.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
      state = load()
      emit()
    }
  })
}
