import { api, getStoredUser, getStoredProfile, setStoredSession, clearStoredSession, getStoredRefreshToken } from '@/api/client'
import { bumpVersion } from './db'

export const ROLE_OPTIONS = ['admin', 'dept_head', 'teacher', 'student']

export async function login({ username, role, identifier, password }) {
  const payload = {
    role,
    identifier: (identifier || username || '').trim(),
    username: (username || '').trim(),
    password: password || undefined,
  }

  const res = await api.post('/auth/login', payload)
  setStoredSession(res.token, res.refreshToken, res.user, res.profile || res.user?.profile)
  bumpVersion()
  return { user: res.user, profile: res.profile || res.user?.profile }
}

export async function logout() {
  try {
    const refreshToken = getStoredRefreshToken()
    if (refreshToken) {
      await api.post('/auth/logout', { refreshToken })
    }
  } catch (e) {
    // Ignore network failure on logout
  }
  clearStoredSession()
  bumpVersion()
  return { ok: true }
}

export function me() {
  const user = getStoredUser()
  const profile = getStoredProfile()
  if (!user) throw new Error('Unauthenticated')
  return { user, profile }
}

export async function updateProfile(data) {
  const res = await api.put('/auth/profile', data)
  setStoredSession(null, null, res.user, getStoredProfile())
  bumpVersion()
  return { user: res.user, profile: getStoredProfile() }
}

export async function changePassword({ currentPassword, newPassword, confirmPassword }) {
  if (confirmPassword && newPassword !== confirmPassword) {
    const err = new Error('Passwords do not match.')
    err.fieldErrors = { confirmPassword: 'Passwords do not match.' }
    throw err
  }
  return await api.put('/auth/password', { currentPassword, newPassword })
}
