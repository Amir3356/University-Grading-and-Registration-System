// Lightweight event emitter for triggering reactive query re-renders across the client.
let version = 0
const listeners = new Set()

export function emit() {
  version += 1
  for (const fn of listeners) fn(version)
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

export const now = () => new Date().toISOString()

let idCounter = Date.now() % 100000
export function newId(prefix = 'id') {
  idCounter += 1
  return `${prefix}_${Date.now().toString(36)}${idCounter.toString(36)}`
}

export function read() {
  return {}
}
