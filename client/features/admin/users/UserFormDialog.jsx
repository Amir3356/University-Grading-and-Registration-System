import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ErrorState } from '@/components/common/ErrorState'
import { FormField } from '@/components/common/FormField'
import { Spinner } from '@/components/common/Loading'
import { useLookups } from '@/context/lookups-context'
import { useQuery, useMutation } from '@/hooks/useStore'
import { ROLE_LABELS } from '@/lib/format'
import { store } from '@/store'
import { SelectField } from './SelectField'

const ROLE_OPTIONS = ['student', 'teacher', 'admin'].map((r) => ({ value: r, label: ROLE_LABELS[r] }))

/** Resolve a typed department name or code to a department record. */
function findDepartment(departments, value) {
  const typed = String(value ?? '').trim().toLowerCase()
  if (!typed) return null
  return departments.find((d) => d.name.toLowerCase() === typed || d.code.toLowerCase() === typed) ?? null
}

function initialForm(user) {
  const p = user?.profile
  return {
    roleId: user?.roleId ?? 'student',
    username: user?.username ?? '',
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

/** Create form: full name, username, role and role-specific credential (Student ID / Teacher ID / password). */
function CreateUserForm({ defaultRole, onClose, onCreated }) {
  const lookups = useLookups()
  const allDepartments = lookups?.departments ?? []
  const [form, setForm] = useState({ fullName: '', username: '', roleId: defaultRole ?? 'student', password: '', identifier: '', department: '' })
  const [nameError, setNameError] = useState(null)
  const [usernameError, setUsernameError] = useState(null)
  const [identifierError, setIdentifierError] = useState(null)
  const [departmentError, setDepartmentError] = useState(null)
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e?.target ? e.target.value : e }))

  const [save, { loading, fieldErrors }] = useMutation((data) => store.users.createUser(data), {
    success: 'User account created.',
    onSuccess: (result) => {
      onClose()
      onCreated?.(result)
    },
  })

  const submit = (e) => {
    e.preventDefault()
    const parts = form.fullName.trim().split(/\s+/).filter(Boolean)
    if (parts.length < 2) {
      setNameError('Enter the first and last name.')
      return
    }
    setNameError(null)
    if (!form.username.trim()) {
      setUsernameError('Enter a username.')
      return
    }
    setUsernameError(null)
    const isAdmin = form.roleId === 'admin'
    if (!isAdmin && !form.identifier.trim()) {
      setIdentifierError(form.roleId === 'student' ? 'Enter the Student ID.' : 'Enter the Teacher ID.')
      return
    }
    setIdentifierError(null)
    const needsDepartment = !isAdmin
    const department = findDepartment(allDepartments, form.department)
    if (needsDepartment && !department) {
      setDepartmentError('Enter an existing department name.')
      return
    }
    setDepartmentError(null)
    const [firstName, ...rest] = parts
    const departmentId = needsDepartment ? department.id : ''
    save({
      firstName,
      lastName: rest.join(' '),
      username: form.username.trim(),
      roleId: form.roleId,
      password: isAdmin ? form.password : '',
      departmentId,
      email: store.users.suggestEmail(form.username || form.fullName),
      identifier: isAdmin ? '' : form.identifier.trim(),
      admissionYear: String(new Date().getFullYear()),
    })
  }

  const fe = fieldErrors ?? {}
  const isAdmin = form.roleId === 'admin'
  const needsDepartment = !isAdmin

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <FormField label="Full name" required error={nameError ?? fe.firstName ?? fe.lastName}>
        <Input value={form.fullName} onChange={set('fullName')} autoComplete="off" placeholder="e.g. Jane Doe" />
      </FormField>
      <FormField label="Username" required error={usernameError ?? fe.username}>
        <Input value={form.username} onChange={set('username')} autoComplete="off" placeholder="e.g. jane.doe" />
      </FormField>
      <SelectField label="Role" required value={form.roleId} onChange={set('roleId')} options={ROLE_OPTIONS} error={fe.roleId} />
      {isAdmin ? (
        <FormField label="Password" error={fe.password} hint="Optional. Leave blank to generate a temporary password.">
          <Input type="password" value={form.password} onChange={set('password')} autoComplete="new-password" />
        </FormField>
      ) : (
        <FormField label={form.roleId === 'student' ? 'Student ID' : 'Teacher ID'} required error={identifierError ?? fe.identifier}>
          <Input
            value={form.identifier}
            onChange={set('identifier')}
            autoComplete="off"
            placeholder={form.roleId === 'student' ? 'e.g. UGR/26/0001' : 'e.g. EMP-CS-01'}
          />
        </FormField>
      )}
      <FormField label="Department" required={needsDepartment} error={departmentError ?? (needsDepartment ? fe.departmentId : undefined)}>
        <Input value={form.department} onChange={set('department')} autoComplete="off" placeholder="e.g. Computer Science" />
      </FormField>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" loading={loading}>
          Create user
        </Button>
      </DialogFooter>
    </form>
  )
}

/** Edit an existing account: only the fields shown as table columns (full name, username, role, department). */
function UserForm({ user, onClose }) {
  const lookups = useLookups()
  const allDepartments = lookups?.departments ?? []
  const [form, setForm] = useState(() => ({
    ...initialForm(user),
    fullName: `${user.firstName} ${user.lastName}`.trim(),
    department: user.departmentName && user.departmentName !== '—' ? user.departmentName : '',
  }))
  const [nameError, setNameError] = useState(null)
  const [usernameError, setUsernameError] = useState(null)
  const [departmentError, setDepartmentError] = useState(null)
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e?.target ? e.target.value : e }))

  const [save, { loading, fieldErrors }] = useMutation((data) => store.users.updateUser(user.id, data), {
    success: 'User updated.',
    onSuccess: onClose,
  })

  const submit = (e) => {
    e.preventDefault()
    const parts = form.fullName.trim().split(/\s+/).filter(Boolean)
    if (parts.length < 2) {
      setNameError('Enter the first and last name.')
      return
    }
    setNameError(null)
    if (!form.username.trim()) {
      setUsernameError('Enter a username.')
      return
    }
    setUsernameError(null)
    const needsDepartment = form.roleId !== 'admin'
    const department = findDepartment(allDepartments, form.department)
    if (needsDepartment && !department) {
      setDepartmentError('Enter an existing department name.')
      return
    }
    setDepartmentError(null)
    const departmentId = needsDepartment ? department.id : ''
    const rest = { ...form }
    delete rest.fullName
    delete rest.department
    rest.firstName = parts[0]
    rest.lastName = parts.slice(1).join(' ')
    rest.departmentId = departmentId
    if (needsDepartment && !rest.identifier) rest.identifier = store.users.suggestIdentifier(form.roleId, departmentId)
    save(rest)
  }

  const fe = fieldErrors ?? {}
  const needsDepartment = form.roleId !== 'admin'

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <FormField label="Full name" required error={nameError ?? fe.firstName ?? fe.lastName}>
        <Input value={form.fullName} onChange={set('fullName')} autoComplete="off" placeholder="e.g. Jane Doe" />
      </FormField>
      <FormField label="Username" required error={usernameError ?? fe.username}>
        <Input value={form.username} onChange={set('username')} autoComplete="off" />
      </FormField>
      <SelectField
        label="Role"
        required
        value={form.roleId}
        onChange={set('roleId')}
        options={ROLE_OPTIONS}
        error={fe.roleId}
        hint="Role changes are blocked if the user has academic records."
      />
      <FormField label="Department" required={needsDepartment} error={departmentError ?? (needsDepartment ? fe.departmentId : undefined)}>
        {needsDepartment ? (
          <Input value={form.department} onChange={set('department')} autoComplete="off" placeholder="e.g. Computer Science" />
        ) : (
          <Input value="—" disabled readOnly />
        )}
      </FormField>
      <FormField label="Password" error={fe.password} hint="Leave blank to keep the current password.">
        <Input type="password" value={form.password} onChange={set('password')} autoComplete="new-password" placeholder="New password" />
      </FormField>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" loading={loading}>
          Save changes
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
          <DialogDescription>{userId ? 'Update the name, username, role and department for this account.' : 'Create a student, teacher or administrator account.'}</DialogDescription>
        </DialogHeader>
        {userId ? <EditUserForm userId={userId} onClose={close} /> : <CreateUserForm defaultRole={defaultRole} onClose={close} onCreated={onCreated} />}
      </DialogContent>
    </Dialog>
  )
}
