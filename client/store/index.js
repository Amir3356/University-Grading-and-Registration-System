// Local data store. Pages read and change the mock data only through these functions,
// e.g. store.users.listUsers(), store.grades.saveScores().
// Results are deep copies, so callers can never mutate the stored data by accident.
import * as academics from './academics'
import * as auth from './auth'
import * as grades from './grades'
import * as lookups from './lookups'
import * as notifications from './notifications'
import * as reports from './reports'
import * as student from './student'
import * as teacher from './teacher'
import * as users from './users'

export { StoreError } from './helpers'

const copy = (value) => (value === undefined ? value : structuredClone(value))

function withCopies(mod) {
  const out = {}
  for (const [name, fn] of Object.entries(mod)) {
    if (typeof fn !== 'function') continue
    out[name] = (...args) => {
      const result = fn(...args)
      return result instanceof Promise ? result.then(copy) : copy(result)
    }
  }
  return out
}

export const store = {
  auth: withCopies(auth),
  users: withCopies(users),
  academics: withCopies(academics),
  grades: withCopies(grades),
  lookups: withCopies(lookups),
  notifications: withCopies(notifications),
  reports: withCopies(reports),
  teacher: withCopies(teacher),
  student: withCopies(student),
}
