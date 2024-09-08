import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/common/FormField'
import { PageHeader } from '@/components/common/PageHeader'
import { useAuth } from '@/context/auth-context'
import { useMutation } from '@/hooks/useStore'
import { formatDate, formatDateTime, ROLE_LABELS } from '@/lib/format'
import { fullName, initials } from '@/lib/utils'
import { store } from '@/store'

function Detail({ label, value }) {
  return (
    <div>
      <dt className="details__label">{label}</dt>
      <dd className="details__value">{value || '—'}</dd>
    </div>
  )
}

export function ProfilePage() {
  const { user, profile, setUser } = useAuth()
  const [form, setForm] = useState({ firstName: user.firstName, lastName: user.lastName, phone: user.phone ?? '' })
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })

  const [save, saveState] = useMutation((data) => store.auth.updateProfile(data), {
    success: 'Profile updated.',
    onSuccess: (res) => setUser(res.user, res.profile),
  })
  const [changePw, pwState] = useMutation((data) => store.auth.changePassword(data), {
    success: 'Password changed.',
    onSuccess: () => setPw({ currentPassword: '', newPassword: '', confirmPassword: '' }),
  })

  return (
    <>
      <PageHeader title="Profile" description="Your account details and security settings." />
      {user.mustChangePassword && (
        <Alert variant="warning" className="mb-lg">
          <KeyRound />
          <AlertDescription>You're using a temporary password. Please choose a new password below.</AlertDescription>
        </Alert>
      )}
      <div className="stack stack--lg">
        <Card>
          <CardContent className="stack stack--lg">
            <div className="cluster cluster--lg cluster--nowrap">
              <Avatar size="lg">
                <AvatarFallback>{initials(user)}</AvatarFallback>
              </Avatar>
              <div className="grow">
                <p className="truncate text-lg font-semibold">{profile?.title ? `${profile.title} ` : ''}{fullName(user)}</p>
                <p className="truncate text-sm text-muted">{user.email}</p>
                <Badge variant="info" className="mt-xs">{ROLE_LABELS[user.roleId]}</Badge>
              </div>
            </div>
            <dl className="details">
              {user.roleId === 'student' && (
                <>
                  <Detail label="Student ID" value={profile?.studentNumber} />
                  <Detail label="Programme" value={profile?.program} />
                  <Detail label="Department" value={profile?.department?.name} />
                  <Detail label="Admission year" value={profile?.admissionYear} />
                </>
              )}
              {user.roleId === 'teacher' && (
                <>
                  <Detail label="Employee ID" value={profile?.employeeNumber} />
                  <Detail label="Department" value={profile?.department?.name} />
                  <Detail label="Specialization" value={profile?.specialization} />
                  <Detail label="Office" value={profile?.officeRoom} />
                </>
              )}
              <Detail label="Member since" value={formatDate(user.createdAt)} />
              <Detail label="Last sign-in" value={formatDateTime(user.lastLoginAt)} />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Personal information</CardTitle>
              <CardDescription>Your username, email and university ID can only be changed by the registrar.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form
              className="form-grid"
              onSubmit={(e) => {
                e.preventDefault()
                save(form)
              }}
            >
              <FormField label="First name" required error={saveState.fieldErrors?.firstName}>
                <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} autoComplete="given-name" />
              </FormField>
              <FormField label="Last name" required error={saveState.fieldErrors?.lastName}>
                <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} autoComplete="family-name" />
              </FormField>
              <FormField label="Username">
                <Input value={user.username} disabled />
              </FormField>
              <FormField label="Email">
                <Input value={user.email} disabled />
              </FormField>
              <FormField label="Phone">
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} autoComplete="tel" />
              </FormField>
              <div className="span-all">
                <Button type="submit" loading={saveState.loading}>
                  Save changes
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Change password</CardTitle>
              <CardDescription>At least 8 characters with upper- and lower-case letters and a number.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form
              className="form-grid"
              onSubmit={(e) => {
                e.preventDefault()
                changePw(pw).then((r) => r.ok && setUser({ ...user, mustChangePassword: false }))
              }}
            >
              <FormField label="Current password" required error={pwState.fieldErrors?.currentPassword} className="span-all">
                <Input type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />
              </FormField>
              <FormField label="New password" required error={pwState.fieldErrors?.newPassword}>
                <Input type="password" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} />
              </FormField>
              <FormField label="Confirm new password" required error={pwState.fieldErrors?.confirmPassword}>
                <Input type="password" autoComplete="new-password" value={pw.confirmPassword} onChange={(e) => setPw({ ...pw, confirmPassword: e.target.value })} />
              </FormField>
              <div className="span-all">
                <Button type="submit" variant="outline" loading={pwState.loading}>
                  <KeyRound /> Update password
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
