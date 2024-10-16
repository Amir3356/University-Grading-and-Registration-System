import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { FormField } from '@/components/common/FormField'
import { Spinner } from '@/components/common/Loading'
import { useAuth } from '@/context/auth-context'
import { HOME_BY_ROLE } from '@/routes/navigation'
import { validateForm, loginFormSchema } from '@/lib/validators'

export function LoginPage() {
  const { user, loading, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ username: '', password: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})

  if (loading) return <Spinner />
  if (user) return <Navigate to={HOME_BY_ROLE[user.roleId] || '/admin'} replace />

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setFieldErrors({})

    const validation = validateForm(loginFormSchema, form)
    if (!validation.success) {
      setFieldErrors(validation.errors)
      return
    }

    setSubmitting(true)
    try {
      const res = await login(validation.data)
      // Role-based redirect: each role lands on its own RBAC dashboard
      const from = location.state?.from?.pathname
      const home = HOME_BY_ROLE[res.user.roleId] || '/admin'
      navigate(from && from.startsWith(home) ? from : home, { replace: true })
    } catch (err) {
      setError(err.message)
      setFieldErrors(err.fieldErrors ?? {})
      setSubmitting(false)
    }
  }

  return (
    <main className="login">
      <Card className="login__card">
        <CardContent>
          <h1 className="login__title text-center">Sign in</h1>
          <form onSubmit={submit} className="stack" noValidate>
            {error && !Object.keys(fieldErrors).length && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <FormField label="Username" error={fieldErrors.username} required>
              <Input
                autoComplete="username"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="Enter your username, ID, or email"
                autoFocus
              />
            </FormField>
            <FormField label="Password" error={fieldErrors.password} required>
              <PasswordInput
                autoComplete="current-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Enter your password"
                aria-label="Password"
                aria-invalid={fieldErrors.password ? true : undefined}
              />
            </FormField>
            <Button type="submit" className="btn--block" loading={submitting}>
              Sign in
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
