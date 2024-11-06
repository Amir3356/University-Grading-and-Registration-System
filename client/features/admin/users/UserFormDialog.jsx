import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { ErrorState } from '@/components/common/ErrorState'
import { FormField } from '@/components/common/FormField'
import { Spinner } from '@/components/common/Loading'
import { useQuery, useMutation } from '@/hooks/useStore'
import { useLookups } from '@/context/lookups-context'
import { ROLE_LABELS } from '@/lib/format'
import { store } from '@/store'
import { notifyUserChange } from '@/lib/syncEvents'
import { SelectField } from './SelectField'

export const ADMIN_ROLE_OPTIONS = [
  { value: 'dept_head', label: 'Department Head' },
]

export const DEFAULT_ROLE_OPTIONS = ADMIN_ROLE_OPTIONS

export const PROGRAM_TYPE_OPTIONS = [
  { value: 'regular', label: 'Regular' },
  { value: 'weekend', label: 'Weekend' },
  { value: 'extension', label: 'Extension' },
]

export const DEPARTMENT_OPTIONS = [
  { value: 'dep_fresh', label: 'Fresh' },
  { value: 'dep_cs', label: 'Computer Science' },
  { value: 'dep_it', label: 'IT' },
  { value: 'dep_bio', label: 'Biology' },
  { value: 'dep_chem', label: 'Chemistry' },
  { value: 'dep_phys', label: 'Physics' },
  { value: 'dep_math', label: 'Mathematics' },
  { value: 'dep_sport', label: 'Sport' },
  { value: 'dep_hist', label: 'History' },
  { value: 'dep_geog', label: 'Geography' },
  { value: 'dep_econ', label: 'Economics' },
  { value: 'dep_edlead', label: 'Education Leadership' },
  { value: 'dep_psyc', label: 'Psychology' },
  { value: 'dep_spneed', label: 'Special Need' },
  { value: 'dep_eng', label: 'English' },
  { value: 'dep_bus', label: 'Business Administration' },
  { value: 'dep_ee', label: 'Electrical Engineering' },
  { value: 'dep_ce', label: 'Civil Engineering' },
]

export function getDepartmentId(value) {
  if (!value) return ''
  const str = String(value).trim().toLowerCase()
  if (str === 'fresh' || str === 'dep_fresh' || str === 'freshman') return 'dep_fresh'
  if (str === 'it' || str === 'dep_it' || str === 'information technology') return 'dep_it'
  const found = DEPARTMENT_OPTIONS.find(
    (d) =>
      d.value.toLowerCase() === str ||
      d.label.toLowerCase() === str ||
      d.label.toLowerCase().replace(/\s+/g, '') === str.replace(/\s+/g, '') ||
      d.label.toLowerCase().replace(/s$/, '') === str.replace(/s$/, '') ||
      (str.startsWith('dep_') && d.value.toLowerCase().includes(str.replace('dep_', '')))
  )
  return found ? found.value : value
}

export function getDepartmentName(value) {
  if (!value) return ''
  const str = String(value).trim().toLowerCase()
  if (str === 'fresh' || str === 'dep_fresh' || str === 'freshman') return 'Fresh'
  if (str === 'it' || str === 'dep_it' || str === 'information technology') return 'IT'
  const found = DEPARTMENT_OPTIONS.find(
    (d) =>
      d.value.toLowerCase() === str ||
      d.label.toLowerCase() === str ||
      d.label.toLowerCase().replace(/\s+/g, '') === str.replace(/\s+/g, '') ||
      d.label.toLowerCase().replace(/s$/, '') === str.replace(/s$/, '') ||
      (str.startsWith('dep_') && d.value.toLowerCase().includes(str.replace('dep_', '')))
  )
  return found ? found.label : value
}

/** Server errors for fields the form has no input for (e.g. email), so a 422 is never silent. */
function OtherFieldErrors({ fieldErrors, shown }) {
  const extra = Object.entries(fieldErrors ?? {}).filter(([key, msg]) => msg && !shown.includes(key))
  if (extra.length === 0) return null
  return (
    <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {extra.map(([key, msg]) => (
        <p key={key}>{msg}</p>
      ))}
    </div>
  )
}

const SHOWN_FIELDS = ['firstName', 'lastName', 'username', 'roleId', 'identifier', 'password', 'departmentId', 'programType']

/** Departments from the database, falling back to the static list until lookups load. */
function useDepartmentOptions() {
  const departments = useLookups()?.departments
  const raw = departments?.length
    ? departments.map((d) => ({ value: d.id, label: d.name }))
    : [...DEPARTMENT_OPTIONS]
  const fresh = raw.find((o) => o.value === 'dep_fresh' || o.label.toLowerCase() === 'fresh') || { value: 'dep_fresh', label: 'Fresh' }
  const rest = raw.filter((o) => o.value !== fresh.value && o.label.toLowerCase() !== 'fresh')
  return [{ value: fresh.value || 'dep_fresh', label: fresh.label || 'Fresh' }, ...rest]
}

function initialForm(user) {
  const p = user?.profile
  return {
    roleId: user?.roleId ?? 'dept_head',
    username: user?.username ?? '',
    email: user?.email ?? '',
    phone: user?.phone ?? '',
    identifier:
      user && user.identifier && user.identifier !== '—'
        ? user.identifier
        : (p?.student_number || p?.employee_number || ''),
    departmentId: user?.departmentId ?? p?.department_id ?? '',
    program: p?.program ?? user?.program ?? '',
    programType: (p?.programType ?? p?.program_type ?? user?.programType ?? user?.program_type ?? 'regular').toLowerCase().replace('extensions', 'extension'),
    admissionYear: String(p?.admissionYear ?? p?.admission_year ?? new Date().getFullYear()),
    title: p?.title ?? user?.title ?? 'Prof.',
    specialization: p?.specialization ?? '',
    officeRoom: p?.officeRoom ?? '',
    password: '',
  }
}

/** Create form: full name, username, role, department dropdown, identifier and password. */
function CreateUserForm({ defaultRole, defaultDepartment, roleOptions: customRoleOptions, departmentOptions: customDepartmentOptions, lockDepartment, onClose, onCreated }) {
  const roleOptions =
    customRoleOptions ??
    (defaultRole === 'student'
      ? [{ value: 'student', label: 'Student' }]
      : defaultRole
        ? [{ value: defaultRole, label: ROLE_LABELS[defaultRole] || defaultRole }]
        : DEFAULT_ROLE_OPTIONS)
  const initialRole = defaultRole ?? roleOptions[0]?.value ?? 'dept_head'
  const initialDeptId = getDepartmentId(defaultDepartment) || (defaultRole === 'admin' ? '' : initialRole === 'student' ? 'dep_fresh' : 'dep_cs')

  const [form, setForm] = useState({
    fullName: '',
    username: '',
    roleId: initialRole,
    password: '',
    identifier: '',
    departmentId: initialDeptId,
    programType: 'regular',
  })
  const lookupDeptOptions = useDepartmentOptions()
  const departmentOptions = customDepartmentOptions ?? lookupDeptOptions
  const [nameError, setNameError] = useState(null)
  const [usernameError, setUsernameError] = useState(null)
  const [identifierError, setIdentifierError] = useState(null)
  const [departmentError, setDepartmentError] = useState(null)
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e?.target ? e.target.value : e }))

  const [save, { loading, fieldErrors }] = useMutation((data) => store.users.createUser(data), {
    success: 'User account created successfully.',
    onSuccess: (result) => {
      notifyUserChange({ userId: result?.user?.id })
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
    if (form.username.trim().length < 3) {
      setUsernameError('Username must be at least 3 characters.')
      return
    }
    setUsernameError(null)
    const isAdmin = form.roleId === 'admin'
    if (!isAdmin && !form.identifier.trim()) {
      setIdentifierError(form.roleId === 'dept_head' ? 'Enter the Department Head ID.' : form.roleId === 'student' ? 'Enter the Student ID.' : 'Enter the Teacher ID.')
      return
    }
    setIdentifierError(null)
    const needsDepartment = !isAdmin
    if (needsDepartment && !form.departmentId) {
      setDepartmentError('Select a department.')
      return
    }
    setDepartmentError(null)
    const departmentId = needsDepartment ? form.departmentId : undefined
    const departmentName = needsDepartment ? getDepartmentName(form.departmentId) : undefined
    const [firstName, ...rest] = parts

    const cleanUser = form.username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '')
    const email = `${cleanUser || 'user'}@university.edu`

    save({
      firstName,
      lastName: rest.join(' '),
      username: form.username.trim(),
      roleId: form.roleId,
      password: form.password?.trim() ? form.password.trim() : undefined,
      departmentId,
      department: departmentName,
      email,
      identifier: isAdmin ? `ADM-${form.username.trim()}` : form.identifier.trim(),
      admissionYear: form.roleId === 'student' ? new Date().getFullYear() : undefined,
      yearOfStudy: form.roleId === 'student' ? 1 : undefined,
      programType: form.roleId === 'student' ? (form.programType || 'regular').toLowerCase().replace('extensions', 'extension') : undefined,
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
      <SelectField
        label="Role"
        required
        value={form.roleId}
        onChange={(val) => {
          setForm((f) => {
            let nextDept = f.departmentId
            if (!lockDepartment) {
              if (val === 'student') {
                nextDept = 'dep_fresh'
              } else if (val === 'teacher' && f.departmentId === 'dep_fresh') {
                const nonFresh = departmentOptions.find((d) => d.value !== 'dep_fresh')
                if (nonFresh) nextDept = nonFresh.value
              }
            }
            return {
              ...f,
              roleId: val,
              departmentId: nextDept,
            }
          })
        }}
        options={roleOptions}
        error={fe.roleId}
      />
      {!isAdmin && (
        <FormField label={form.roleId === 'dept_head' ? 'Department Head ID' : form.roleId === 'student' ? 'Student ID' : 'Teacher ID'} required error={identifierError ?? fe.identifier}>
          <Input
            value={form.identifier}
            onChange={set('identifier')}
            autoComplete="off"
            placeholder={form.roleId === 'dept_head' ? 'e.g. EMP-CS-02 or CS' : form.roleId === 'student' ? 'e.g. UGR/26/0001' : 'e.g. EMP-CS-01'}
          />
        </FormField>
      )}
      <FormField label="Password" error={fe.password} hint="Optional. Leave blank to use default 'Password123!'">
        <PasswordInput
          value={form.password}
          onChange={set('password')}
          autoComplete="new-password"
          placeholder="Enter password (default: Password123!)"
        />
      </FormField>
      {needsDepartment && (
        <SelectField
          label="Department"
          required
          value={form.departmentId}
          onChange={(val) => {
            setForm((f) => ({ ...f, departmentId: val }))
            if (departmentError) setDepartmentError(null)
          }}
          options={departmentOptions}
          placeholder="Select department…"
          error={departmentError ?? fe.departmentId}
          disabled={lockDepartment}
        />
      )}
      {form.roleId === 'student' && (
        <SelectField
          label="Program type"
          required
          value={form.programType}
          onChange={set('programType')}
          options={PROGRAM_TYPE_OPTIONS}
          error={fe.programType}
        />
      )}
      <OtherFieldErrors fieldErrors={fe} shown={SHOWN_FIELDS} />
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

/** Edit an existing account: full name, username, role, department dropdown, and password. */
function UserForm({ user, roleOptions: customRoleOptions, departmentOptions: customDepartmentOptions, lockDepartment, onClose }) {
  const roleOptions =
    customRoleOptions ??
    (user.roleId === 'student'
      ? [{ value: 'student', label: 'Student' }]
      : DEFAULT_ROLE_OPTIONS)

  const currentDeptId =
    getDepartmentId(user.departmentId) ||
    getDepartmentId(user.departmentName) ||
    getDepartmentId(user.department) ||
    getDepartmentId(user.profile?.departmentId) ||
    getDepartmentId(user.profile?.department?.id) ||
    getDepartmentId(user.profile?.department?.name) ||
    ''

  const [form, setForm] = useState(() => ({
    ...initialForm(user),
    fullName: `${user.firstName} ${user.lastName}`.trim(),
    departmentId: currentDeptId,
  }))
  const lookupDeptOptions = useDepartmentOptions()
  const departmentOptions = customDepartmentOptions ?? lookupDeptOptions
  const [nameError, setNameError] = useState(null)
  const [usernameError, setUsernameError] = useState(null)
  const [departmentError, setDepartmentError] = useState(null)
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e?.target ? e.target.value : e }))

  const [save, { loading, fieldErrors }] = useMutation((data) => store.users.updateUser(user.id, data), {
    success: 'User updated.',
    onSuccess: (result) => {
      notifyUserChange({
        userId: user?.id,
        studentNumber: form.identifier?.trim(),
        programType: form.programType,
        profile: result?.profile,
        user: result?.user || result,
      })
      onClose()
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
    const needsDepartment = !isAdmin
    if (needsDepartment && !form.departmentId) {
      setDepartmentError('Select a department.')
      return
    }
    setDepartmentError(null)
    const departmentId = needsDepartment ? form.departmentId : undefined
    const departmentName = needsDepartment ? getDepartmentName(form.departmentId) : undefined
    const [firstName, ...rest] = parts

    const payload = {
      firstName,
      lastName: rest.join(' '),
      username: form.username.trim(),
      roleId: form.roleId,
      departmentId,
      department: departmentName,
      email: form.email?.trim() || undefined,
      phone: form.phone?.trim() || null,
      identifier: isAdmin ? form.identifier?.trim() || `ADM-${form.username.trim()}` : form.identifier?.trim() || undefined,
      programType: form.roleId === 'student' ? (form.programType || 'regular').toLowerCase().replace('extensions', 'extension') : undefined,
      password: form.password?.trim() ? form.password.trim() : undefined,
    }
    save(payload)
  }

  const fe = fieldErrors ?? {}
  const isAdmin = form.roleId === 'admin'
  const needsDepartment = !isAdmin

  const editOptions =
    departmentOptions.some((d) => d.value === form.departmentId) || !form.departmentId
      ? departmentOptions
      : [...departmentOptions, { value: form.departmentId, label: user.departmentName || form.departmentId }]

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
        options={roleOptions}
        error={fe.roleId}
        hint="Role changes are blocked if the user has academic records."
      />
      {!isAdmin && (
        <FormField
          label={form.roleId === 'dept_head' ? 'Department Head ID' : form.roleId === 'student' ? 'Student ID' : 'Teacher ID'}
          error={fe.identifier}
        >
          <Input
            value={form.identifier}
            onChange={set('identifier')}
            autoComplete="off"
            placeholder={form.roleId === 'dept_head' ? 'e.g. EMP-CS-02 or CS' : form.roleId === 'student' ? 'e.g. UGR/26/0001' : 'e.g. EMP-CS-01'}
          />
        </FormField>
      )}
      {needsDepartment ? (
        <SelectField
          label="Department"
          required
          value={form.departmentId}
          onChange={(val) => {
            setForm((f) => ({ ...f, departmentId: val }))
            if (departmentError) setDepartmentError(null)
          }}
          options={editOptions}
          placeholder="Select department…"
          error={departmentError ?? fe.departmentId}
          disabled={lockDepartment}
        />
      ) : (
        <FormField label="Department">
          <Input value="—" disabled readOnly />
        </FormField>
      )}
      {form.roleId === 'student' && (
        <SelectField
          label="Program type"
          required
          value={form.programType}
          onChange={set('programType')}
          options={PROGRAM_TYPE_OPTIONS}
          error={fe.programType}
        />
      )}
      <FormField label="Password" error={fe.password} hint="Leave blank to keep the current password.">
        <PasswordInput value={form.password} onChange={set('password')} autoComplete="new-password" placeholder="New password" />
      </FormField>

      <OtherFieldErrors fieldErrors={fe} shown={SHOWN_FIELDS} />
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
function EditUserForm({ userId, roleOptions, departmentOptions, lockDepartment, onClose }) {
  const { data, loading, error, refetch } = useQuery(() => store.users.getUser(userId), [userId], { live: false })
  if (loading && !data) return <Spinner label="Loading user…" />
  if (error) return <ErrorState error={error} onRetry={refetch} />
  const userObj = data?.user ? { ...data, ...data.user, profile: data.profile } : data
  return <UserForm user={userObj} roleOptions={roleOptions} departmentOptions={departmentOptions} lockDepartment={lockDepartment} onClose={onClose} />
}

/**
 * Create / edit a user account.
 * userId: edit that user; omitted = create. onCreated({ user, temporaryPassword }) after create.
 */
export function UserFormDialog({ open, onOpenChange, userId, defaultRole, defaultDepartment, roleOptions, departmentOptions, lockDepartment = false, onCreated }) {
  const close = () => onOpenChange(false)
  const isStudentOnly = roleOptions ? roleOptions.every((r) => r.value === 'student') : defaultRole === 'student'
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{userId ? (isStudentOnly ? 'Edit student user' : 'Edit user') : (isStudentOnly ? 'Create student user' : 'Create user')}</DialogTitle>
          <DialogDescription>
            {userId
              ? 'Update the name, username, role and department for this account.'
              : isStudentOnly
                ? 'Create a student user account for your department.'
                : 'Create a student, teacher or administrator account.'}
          </DialogDescription>
        </DialogHeader>
        {userId ? (
          <EditUserForm userId={userId} roleOptions={roleOptions} departmentOptions={departmentOptions} lockDepartment={lockDepartment} onClose={close} />
        ) : (
          <CreateUserForm
            defaultRole={defaultRole}
            defaultDepartment={defaultDepartment}
            roleOptions={roleOptions}
            departmentOptions={departmentOptions}
            lockDepartment={lockDepartment}
            onClose={close}
            onCreated={onCreated}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
