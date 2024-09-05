import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { ErrorState } from '@/components/common/ErrorState'
import { FormField } from '@/components/common/FormField'
import { Spinner } from '@/components/common/Loading'
import { useLookups } from '@/context/lookups-context'
import { useQuery, useMutation } from '@/hooks/useStore'
import { ROLE_LABELS } from '@/lib/format'
import { store } from '@/store'
import { SelectField } from './SelectField'

const TITLES = ['Dr.', 'Prof.', 'Mr.', 'Ms.']
const ROLE_OPTIONS = ['student', 'teacher', 'admin'].map((r) => ({ value: r, label: ROLE_LABELS[r] }))

function initialForm(user, defaultRole) {
  const p = user?.profile
  return {
    roleId: user?.roleId ?? defaultRole ?? 'student',
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
    email: user?.email ?? '',
    phone: user?.phone ?? '',
    identifier: user && user.identifier !== '—' ? (user.identifier ?? '') : '',
    departmentId: user?.departmentId ?? '',
    program: p?.program ?? user?.program ?? '',
    admissionYear: String(p?.admissionYear ?? new Date().getFullYear()),
    title: p?.title ?? user?.title ?? 'Dr.',
    specialization: p?.specialization ?? '',
    officeRoom: p?.officeRoom ?? '',
    password: '',
  }
}

function UserForm({ user, defaultRole, onClose, onCreated }) {
  const lookups = useLookups()
  const isEdit = Boolean(user)
  const [form, setForm] = useState(() => initialForm(user, defaultRole))
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e?.target ? e.target.value : e }))

  const [save, { loading, fieldErrors }] = useMutation(
    (data) => (isEdit ? store.users.updateUser(user.id, data) : store.users.createUser(data)),
    {
      success: isEdit ? 'User updated.' : 'User account created.',
      onSuccess: (result) => {
        onClose()
        if (!isEdit) onCreated?.(result)
      },
    },
  )

  const submit = (e) => {
    e.preventDefault()
    const data = { ...form }
    if (isEdit || !data.password) delete data.password
    save(data)
  }

  const fe = fieldErrors ?? {}
  const departments = (lookups?.departments ?? []).map((d) => ({ value: d.id, label: d.name }))
  const isStudent = form.roleId === 'student'
  const isTeacher = form.roleId === 'teacher'

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Role"
          required
          value={form.roleId}
          onChange={set('roleId')}
          options={ROLE_OPTIONS}
          error={fe.roleId}
          hint={isEdit ? 'Role changes are blocked if the user has academic records.' : undefined}
          className="sm:col-span-2"
        />
        <FormField label="First name" required error={fe.firstName}>
          <Input value={form.firstName} onChange={set('firstName')} autoComplete="off" />
        </FormField>
        <FormField label="Last name" required error={fe.lastName}>
          <Input value={form.lastName} onChange={set('lastName')} autoComplete="off" />
        </FormField>
        <FormField label="Email" required error={fe.email}>
          <Input type="email" value={form.email} onChange={set('email')} autoComplete="off" />
        </FormField>
        <FormField label="Phone" error={fe.phone}>
          <Input type="tel" value={form.phone} onChange={set('phone')} autoComplete="off" />
        </FormField>
      </div>

      {(isStudent || isTeacher) && (
        <>
          <Separator />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={isStudent ? 'Student ID' : 'Employee ID'} required error={fe.identifier}>
              <Input value={form.identifier} onChange={set('identifier')} placeholder={isStudent ? 'e.g. STU-2026-0101' : 'e.g. EMP-CS-12'} />
            </FormField>
            <SelectField label="Department" required value={form.departmentId} onChange={set('departmentId')} options={departments} error={fe.departmentId} placeholder="Choose a department" />
            {isStudent && (
              <>
                <FormField label="Programme" error={fe.program} hint="Defaults to the department name.">
                  <Input value={form.program} onChange={set('program')} />
                </FormField>
                <FormField label="Admission year" required error={fe.admissionYear}>
                  <Input type="number" min={2000} max={2100} value={form.admissionYear} onChange={set('admissionYear')} />
                </FormField>
              </>
            )}
            {isTeacher && (
              <>
                <SelectField label="Title" value={form.title} onChange={set('title')} options={TITLES.map((t) => ({ value: t, label: t }))} error={fe.title} />
                <FormField label="Specialization" error={fe.specialization}>
                  <Input value={form.specialization} onChange={set('specialization')} />
                </FormField>
                <FormField label="Office room" error={fe.officeRoom}>
                  <Input value={form.officeRoom} onChange={set('officeRoom')} />
                </FormField>
              </>
            )}
          </div>
        </>
      )}

      {!isEdit && (
        <>
          <Separator />
          <FormField label="Initial password" error={fe.password} hint="Optional. Leave blank to generate a temporary password. The user must change it at first sign-in.">
            <Input type="password" value={form.password} onChange={set('password')} autoComplete="new-password" />
          </FormField>
        </>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" loading={loading}>
          {isEdit ? 'Save changes' : 'Create user'}
        </Button>
      </DialogFooter>
    </form>
  )
}

/** Loads the full user record (profile fields) before showing the edit form. */
function EditUserForm({ userId, onClose }) {
  const { data, loading, error, refetch } = useQuery(() => store.users.getUser(userId), [userId], { live: false })
  if (loading && !data) return <Spinner label="Loading user…" />
  if (error) return <ErrorState error={error} onRetry={refetch} />
  return <UserForm user={data} onClose={onClose} />
}

/**
 * Create / edit a user account.
 * userId: edit that user; omitted = create. onCreated({ user, temporaryPassword }) after create.
 */
export function UserFormDialog({ open, onOpenChange, userId, defaultRole, onCreated }) {
  const close = () => onOpenChange(false)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{userId ? 'Edit user' : 'Create user'}</DialogTitle>
          <DialogDescription>{userId ? 'Update account details and role-specific information.' : 'Create a student, teacher or administrator account.'}</DialogDescription>
        </DialogHeader>
        {userId ? <EditUserForm userId={userId} onClose={close} /> : <UserForm defaultRole={defaultRole} onClose={close} onCreated={onCreated} />}
      </DialogContent>
    </Dialog>
  )
}
