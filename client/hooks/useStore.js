import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { toast } from 'sonner'
import { getVersion, subscribe } from '@/store/db'

/** Re-renders whenever the store changes; returns the change counter. */
export function useStoreVersion() {
  return useSyncExternalStore(subscribe, getVersion)
}

/**
 * Read data from the store.
 * Supports both synchronous functions and async Promises.
 * Returns { data, error, loading, refetch }.
 */
export function useQuery(fn, deps = [], { enabled = true, live = true } = {}) {
  const version = useStoreVersion()
  const [nonce, setNonce] = useState(0)
  const [state, setState] = useState({
    data: undefined,
    error: null,
    loading: enabled,
  })

  useEffect(() => {
    if (!enabled) return

    let cancelled = false
    try {
      const res = fn()
      if (res && typeof res.then === 'function') {
        res
          .then((data) => {
            if (!cancelled) setState({ data, error: null, loading: false })
          })
          .catch((error) => {
            if (!cancelled) setState({ data: undefined, error, loading: false })
          })
      } else {
        queueMicrotask(() => {
          if (!cancelled) setState({ data: res, error: null, loading: false })
        })
      }
    } catch (error) {
      queueMicrotask(() => {
        if (!cancelled) setState({ data: undefined, error, loading: false })
      })
    }

    return () => {
      cancelled = true
    }
  }, [enabled, live ? version : nonce, ...deps])

  const refetch = useCallback(() => {
    setState((s) => ({ ...s, loading: true }))
    setNonce((n) => n + 1)
  }, [])

  return {
    data: enabled ? state.data : undefined,
    error: enabled ? state.error : null,
    loading: enabled ? state.loading : false,
    refetch,
  }
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
