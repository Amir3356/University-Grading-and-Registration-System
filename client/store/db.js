// Lightweight event emitter for triggering reactive query re-renders across the client.
let version = 0
const listeners = new Set()

export function bumpVersion() {
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
