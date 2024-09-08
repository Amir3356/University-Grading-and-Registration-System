import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FormField } from '@/components/common/FormField'
import { Spinner } from '@/components/common/Loading'
import { useAuth } from '@/context/auth-context'
import { HOME_BY_ROLE } from '@/routes/navigation'

const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'teacher', label: 'Teacher' },
  { value: 'student', label: 'Student' },
]

export function LoginPage() {
  const { user, loading, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ username: '', password: '', identifier: '', role: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})

  if (loading) return <Spinner />
  if (user) return <Navigate to={HOME_BY_ROLE[user.roleId]} replace />

  const submit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setFieldErrors({})
    try {
      const res = await login(form)
      // Role-based redirect: each role lands on its own dashboard.
      const from = location.state?.from?.pathname
      const home = HOME_BY_ROLE[res.user.roleId]
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
              <Input autoComplete="username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} autoFocus />
            </FormField>
            <FormField label="Role" error={fieldErrors.role} required>
              <Select value={form.role} onValueChange={(role) => setForm({ ...form, role })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select your role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            {form.role === 'student' || form.role === 'teacher' ? (
              <FormField label={form.role === 'student' ? 'Student ID' : 'Teacher ID'} error={fieldErrors.identifier} required>
                <Input
                  autoComplete="off"
                  value={form.identifier}
                  onChange={(e) => setForm({ ...form, identifier: e.target.value })}
                  placeholder={form.role === 'student' ? 'e.g. UGR/26/0001' : 'e.g. EMP-CS-01'}
                />
              </FormField>
            ) : (
              <FormField label="Password" error={fieldErrors.password} required>
                <div className="password-field">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    aria-label="Password"
                    aria-invalid={fieldErrors.password ? true : undefined}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="password-field__toggle"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="icon" /> : <Eye className="icon" />}
                  </button>
                </div>
              </FormField>
            )}
            <Button type="submit" className="btn--block" loading={submitting}>
              Sign in
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
