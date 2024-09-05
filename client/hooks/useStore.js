import { useCallback, useState, useSyncExternalStore } from 'react'
import { toast } from 'sonner'
import { getVersion, subscribe } from '@/store/db'

/** Re-renders whenever the store changes; returns the change counter. */
export function useStoreVersion() {
  return useSyncExternalStore(subscribe, getVersion)
}

/**
 * Read data from the local store.
 * `fn` runs synchronously during render and re-runs when `deps` change or, with `live`
 * (the default), whenever the stored data changes. With `live: false` the result is a
 * snapshot that only updates on `refetch()` — useful for forms being edited.
 * Returns { data, error, loading, refetch }. `loading` is always false (kept for symmetry).
 */
export function useQuery(fn, deps = [], { enabled = true, live = true } = {}) {
  const version = useStoreVersion()
  const [nonce, setNonce] = useState(0)
  const key = [enabled, live ? version : nonce, ...deps]
  // Recompute only when the key changes (state derived during render, no effect needed).
  const [cache, setCache] = useState(() => ({ key, result: run(fn, enabled) }))
  let result = cache.result
  if (!sameKey(cache.key, key)) {
    result = run(fn, enabled)
    setCache({ key, result })
  }
  const refetch = useCallback(() => setNonce((n) => n + 1), [])
  return { ...result, loading: false, refetch }
}

function run(fn, enabled) {
  if (!enabled) return { data: undefined, error: null }
  try {
    return { data: fn(), error: null }
  } catch (error) {
    return { data: undefined, error }
  }
}

function sameKey(a, b) {
  return a.length === b.length && a.every((v, i) => Object.is(v, b[i]))
}

/**
 * Wrap a store change with loading state, toast feedback and field errors.
 * Returns [mutate, { loading, error, fieldErrors, reset }]; mutate resolves { ok, result | error }.
 */
export function useMutation(fn, { success, onSuccess, onError, errorToast = true } = {}) {
  const [state, setState] = useState({ loading: false, error: null, fieldErrors: null })
  const mutate = useCallback(
    async (...args) => {
      setState({ loading: true, error: null, fieldErrors: null })
      try {
        const result = await fn(...args)
        setState({ loading: false, error: null, fieldErrors: null })
        if (success) toast.success(typeof success === 'function' ? success(result, ...args) : success)
        onSuccess?.(result, ...args)
        return { ok: true, result }
      } catch (error) {
        setState({ loading: false, error, fieldErrors: error.fieldErrors ?? null })
        if (errorToast) toast.error(error.message || 'Something went wrong.')
        onError?.(error)
        return { ok: false, error }
      }
    },
    [fn, success, onSuccess, onError, errorToast],
  )
  const reset = useCallback(() => setState({ loading: false, error: null, fieldErrors: null }), [])
  return [mutate, { ...state, reset }]
}
