import { useState, useEffect, useMemo } from 'react'
import { Pencil, Plus, Trash2, UserCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { DataTable } from '@/components/common/DataTable'
import { FormField } from '@/components/common/FormField'
import { PageHeader } from '@/components/common/PageHeader'
import { useAuth } from '@/context/auth-context'
import { useLookups } from '@/context/lookups-context'
import { useQuery, useMutation } from '@/hooks/useStore'
import { formatSemesterTerm } from '@/lib/format'
import { onUserChange } from '@/lib/syncEvents'
import { useWebSocketEvent } from '@/lib/websocket'
import { store } from '@/store'
import { SelectField } from '../users/SelectField'

const LOCKED = ['submitted', 'approved', 'published']

const teacherLabel = (t) => {
  const dept = t.departmentName || t.department_name || t.departmentCode || t.department_code || t.department?.name || t.department?.code
  return dept ? `${t.name} — ${dept}` : t.name
}

function OfferingForm({ offering, defaultSemesterId, onClose }) {
  const lookups = useLookups()
  const { profile, user } = useAuth()
  const isEdit = Boolean(offering)

  const headDeptId =
    profile?.departmentId ??
    profile?.department_id ??
    user?.departmentId ??
    user?.department_id ??
    (lookups?.departments ?? []).find((d) => d.headTeacherId === profile?.id)?.id ??
    ''

  const initialDeptId =
    offering?.course?.department?.id ??
    offering?.course?.departmentId ??
    offering?.course?.department_id ??
    offering?.departmentId ??
    offering?.department_id ??
    headDeptId ??
    ''

  const [form, setForm] = useState({
    departmentId: initialDeptId,
    courseId: offering?.courseId ?? offering?.course_id ?? offering?.course?.id ?? '',
    semesterId: offering?.semesterId ?? offering?.semester_id ?? offering?.semester?.id ?? defaultSemesterId ?? '',
    teacherId: offering?.teacherId ?? offering?.teacher_id ?? offering?.teacher?.id ?? '',
    section: offering?.section ?? 'A',
    capacity: String(offering?.capacity ?? 40),
    room: offering?.room ?? '',
    schedule: offering?.schedule ?? '',
  })

  // Live query for courses directly matching Department Courses sidebar
  const { data: coursesData } = useQuery(
    () => store.academics.listCourses({ pageSize: 100 }),
    [],
  )
  const coursesList = useMemo(() => {
    if (Array.isArray(coursesData)) return coursesData
    if (Array.isArray(coursesData?.items)) return coursesData.items
    if (Array.isArray(lookups?.courses)) return lookups.courses
    return []
  }, [coursesData, lookups?.courses])

  // Live query for teachers matching Account Provision / Department Teachers
  const { data: usersData, refetch: refetchUsers } = useQuery(
    () => store.users.listUsers({ role: 'teacher', pageSize: 'all' }),
    [],
  )
  const { data: teachersData, refetch: refetchTeachers } = useQuery(
    () => store.academics.listTeachers(),
    [],
  )

  useEffect(() => {
    return onUserChange(() => {
      refetchUsers?.()
      refetchTeachers?.()
    })
  }, [refetchUsers, refetchTeachers])

  useWebSocketEvent('USER_UPDATED', () => {
    refetchUsers?.()
    refetchTeachers?.()
  })

  const teachersList = useMemo(() => {
    const list = []
    const seenUserIds = new Set()
    const seenTeacherIds = new Set()
    const seenNames = new Set()

    // 1. Teachers from listTeachers API (contains the proper tch_... IDs and department info)
    const rawTeachers = Array.isArray(teachersData)
      ? teachersData
      : Array.isArray(teachersData?.items)
      ? teachersData.items
      : Array.isArray(lookups?.teachers)
      ? lookups.teachers
      : []

    for (const t of rawTeachers) {
      if (t.roleId && t.roleId !== 'teacher') continue
      if (t.role_id && t.role_id !== 'teacher') continue
      if (t.status === 'inactive') continue

      const uId = t.userId || t.user_id
      const tId = t.id
      const cleanName = (t.name || `${t.firstName || t.first_name || ''} ${t.lastName || t.last_name || ''}`).trim()
      const nameKey = cleanName.toLowerCase()

      if (uId) seenUserIds.add(uId)
      if (tId) seenTeacherIds.add(tId)
      if (nameKey) seenNames.add(nameKey)

      list.push({
        id: tId,
        userId: uId,
        name: cleanName,
        departmentId: t.departmentId || t.department_id,
        departmentName: t.departmentName || t.department_name,
        departmentCode: t.departmentCode || t.department_code || t.department?.code,
        employeeNumber: t.employeeNumber || t.employee_number,
      })
    }

    // 2. Teachers provisioned in Account Provision (role === 'teacher')
    const provisionedTeachers = (usersData?.items ?? []).filter(
      (u) => (u.roleId === 'teacher' || u.role_id === 'teacher') && u.status !== 'inactive',
    )

    for (const u of provisionedTeachers) {
      const uId = u.id
      const tId = u.teacherProfileId || u.teacher_profile_id || u.teacherId || u.id
      const cleanName = (u.name || `${u.firstName || u.first_name || ''} ${u.lastName || u.last_name || ''}`).trim()
      const nameKey = cleanName.toLowerCase()

      // If already included via listTeachers by userId, teacherId, or matching name, skip to prevent duplicates
      if (uId && seenUserIds.has(uId)) continue
      if (tId && seenTeacherIds.has(tId)) continue
      if (nameKey && seenNames.has(nameKey)) continue

      if (uId) seenUserIds.add(uId)
      if (tId) seenTeacherIds.add(tId)
      if (nameKey) seenNames.add(nameKey)

      list.push({
        id: tId,
        userId: uId,
        name: cleanName,
        departmentId: u.departmentId || u.department_id || u.teacherDeptId || u.teacher_dept_id,
        departmentName: u.departmentName || u.department_name,
        departmentCode: u.departmentCode || u.department_code,
        employeeNumber: u.identifier || u.employeeNumber || u.employee_number,
      })
    }

    return list
  }, [usersData, teachersData, lookups?.teachers])

  const [save, { loading, fieldErrors }] = useMutation(
    (data) =>
      isEdit
        ? store.academics.updateOffering(offering.id, {
            courseId: data.courseId,
            semesterId: data.semesterId,
            teacherId: data.teacherId,
            section: data.section,
            capacity: data.capacity,
            room: data.room,
            schedule: data.schedule,
          })
        : store.academics.createOffering(data),
    { success: isEdit ? 'Offering updated.' : 'Course offering created and teacher notified.', onSuccess: onClose },
  )
  const fe = fieldErrors ?? {}
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }))

  const departmentOptions = useMemo(() => {
    const opts = (lookups?.departments ?? []).map((d) => ({
      value: d.id,
      label: d.name,
    }))
    return [{ value: '', label: 'All Departments' }, ...opts]
  }, [lookups?.departments])

  const handleDepartmentChange = (deptId) => {
    setForm((f) => {
      const courseStillValid = coursesList.some(
        (c) => c.id === f.courseId && (!deptId || (c.departmentId || c.department_id) === deptId),
      )
      return {
        ...f,
        departmentId: deptId,
        courseId: courseStillValid ? f.courseId : '',
      }
    })
  }

  const handleCourseChange = (courseId) => {
    const selectedCourse = coursesList.find((c) => c.id === courseId)
    const cDept = selectedCourse?.departmentId || selectedCourse?.department_id
    setForm((f) => ({
      ...f,
      courseId,
      departmentId: cDept || f.departmentId,
    }))
  }

  const course = coursesList.find((c) => c.id === form.courseId) || (lookups?.courses ?? []).find((c) => c.id === form.courseId)

  const courseOptions = useMemo(() => {
    const active = coursesList.filter((c) => !c.status || c.status === 'active')
    const filtered = form.departmentId && form.departmentId !== 'all'
      ? active.filter((c) => (c.departmentId || c.department_id) === form.departmentId)
      : active
    const list = filtered.length > 0 ? filtered : active
    const opts = list
      .sort((a, b) => (a.title || a.name || '').localeCompare(b.title || b.name || ''))
      .map((c) => ({
        value: c.id,
        label: `${c.title || c.name} (${c.code})`,
      }))
    if (isEdit && offering?.course && !opts.some((o) => o.value === (offering.courseId || offering.course?.id))) {
      const oc = offering.course
      opts.unshift({
        value: oc.id,
        label: `${oc.title || oc.name} (${oc.code})`,
      })
    }
    return opts
  }, [coursesList, form.departmentId, isEdit, offering])

  const semesterOptions = useMemo(() => {
    const currentAyId =
      lookups?.currentSemester?.academic_year_id ||
      lookups?.currentSemester?.academicYearId ||
      (lookups?.academicYears ?? []).find((ay) => ay.is_current || ay.isCurrent)?.id

    const allSemesters = lookups?.semesters ?? []
    const currentYearSemesters = currentAyId
      ? allSemesters.filter((s) => (s.academic_year_id ?? s.academicYearId) === currentAyId)
      : []

    const pool = currentYearSemesters.length > 0 ? currentYearSemesters : allSemesters

    const firstSem = pool.find((s) => {
      const t = String(s.term || '').toLowerCase()
      return t === 'first' || t === 'fall' || t === '1'
    })
    const secondSem = pool.find((s) => {
      const t = String(s.term || '').toLowerCase()
      return t === 'second' || t === 'spring' || t === '2'
    })

    const options = []
    if (firstSem) {
      options.push({ value: firstSem.id, label: 'First Semester' })
    }
    if (secondSem) {
      options.push({ value: secondSem.id, label: 'Second Semester' })
    }
    if (isEdit && offering?.semester && !options.some((o) => o.value === (offering.semesterId || offering.semester?.id))) {
      options.push({
        value: offering.semesterId || offering.semester?.id,
        label: offering.semester.name || 'Semester',
      })
    }
    return options
  }, [lookups?.semesters, lookups?.currentSemester, lookups?.academicYears, isEdit, offering])

  useEffect(() => {
    if (!isEdit && semesterOptions.length > 0 && !semesterOptions.some((o) => o.value === form.semesterId)) {
      setForm((f) => ({ ...f, semesterId: semesterOptions[0].value }))
    }
  }, [semesterOptions, form.semesterId, isEdit])

  // Teachers from the course's or selected department first.
  const targetDeptId = course?.departmentId || course?.department_id || form.departmentId
  const teacherOptions = useMemo(() => {
    const teachers = [...teachersList].sort(
      (a, b) =>
        Number((b.departmentId || b.department_id) === targetDeptId) - Number((a.departmentId || a.department_id) === targetDeptId) ||
        (a.name || '').localeCompare(b.name || ''),
    )
    const opts = teachers.map((t) => ({ value: t.id, label: teacherLabel(t) }))
    if (isEdit && offering?.teacher && !opts.some((t) => t.value === offering.teacherId)) {
      opts.push({ value: offering.teacherId, label: `${teacherLabel(offering.teacher)} (inactive)`, disabled: true })
    }
    return opts
  }, [teachersList, targetDeptId, isEdit, offering])

  const teacherLocked = isEdit && LOCKED.includes(offering.gradeStatus)

  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        save({
          courseId: form.courseId,
          semesterId: form.semesterId,
          teacherId: form.teacherId,
          section: form.section,
          capacity: form.capacity,
          room: form.room,
          schedule: form.schedule,
        })
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Department"
          value={form.departmentId}
          onChange={handleDepartmentChange}
          options={departmentOptions}
          placeholder="Choose a department"
          className="sm:col-span-2"
        />
        <SelectField
          label="Course Name"
          required
          value={form.courseId}
          onChange={handleCourseChange}
          options={courseOptions}
          error={fe.courseId}
          placeholder="Choose a course name"
          className="sm:col-span-2"
        />
        <SelectField
          label="Semester"
          required
          value={form.semesterId}
          onChange={set('semesterId')}
          options={semesterOptions}
          error={fe.semesterId}
          placeholder="Choose a semester"
          className="sm:col-span-2"
        />
      </div>
      <SelectField
        label="Teacher"
        required
        value={form.teacherId}
        onChange={set('teacherId')}
        options={teacherOptions}
        error={fe.teacherId}
        placeholder="Choose a teacher"
        disabled={teacherLocked}
        hint={teacherLocked ? 'The teacher cannot be changed after grades have been submitted.' : course ? `Teachers from ${course.department?.name ?? 'the course department'} are listed first.` : undefined}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Section" required error={fe.section}>
          <Input value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value.toUpperCase() })} maxLength={4} />
        </FormField>
        <FormField label="Room" error={fe.room}>
          <Input value={form.room} onChange={set('room')} placeholder="e.g. CS-144" />
        </FormField>
        <FormField label="Schedule" error={fe.schedule} className="sm:col-span-2">
          <Input value={form.schedule} onChange={set('schedule')} placeholder="e.g. Tue/Thu 10:30–12:00" />
        </FormField>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" loading={loading}>
          {isEdit ? 'Save changes' : 'Create offering'}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function AssignmentsPage() {
  const lookups = useLookups()
  const semesterId = lookups?.currentSemester?.id ?? ''
  const { data, loading, error, refetch } = useQuery(
    () => store.academics.listOfferings({ semesterId, pageSize: 100 }),
    [semesterId],
    { enabled: Boolean(semesterId) },
  )

  useEffect(() => {
    return onUserChange(() => {
      refetch()
    })
  }, [refetch])

  useWebSocketEvent('USER_UPDATED', () => refetch())

  const [dialog, setDialog] = useState({ open: false, offering: null })
  const [deleting, setDeleting] = useState(null)
  const [remove] = useMutation((id) => store.academics.deleteOffering(id), { success: 'Offering deleted.' })
  const semester = (lookups?.semesters ?? []).find((s) => s.id === semesterId)

  const columns = [
    {
      key: 'courseCode',
      header: 'Course Code',
      value: (o) => o.course?.code ?? '',
      cell: (o) => <span className="font-medium text-foreground">{o.course?.code}</span>,
    },
    {
      key: 'courseName',
      header: 'Course Name',
      value: (o) => o.course?.title ?? '',
      cell: (o) => <span className="font-semibold text-foreground">{o.course?.title ?? '—'}</span>,
    },
    {
      key: 'department',
      header: 'Department',
      value: (o) =>
        o.course?.department?.name ??
        (lookups?.departments ?? []).find((d) => d.id === o.course?.departmentId)?.name ??
        o.teacher?.department?.name ??
        '—',
      cell: (o) => (
        <span className="text-muted-foreground">
          {o.course?.department?.name ??
            (lookups?.departments ?? []).find((d) => d.id === o.course?.departmentId)?.name ??
            o.teacher?.department?.name ??
            '—'}
        </span>
      ),
    },
    { key: 'section', header: 'Section' },
    {
      key: 'teacherName',
      header: 'Teacher',
      value: (o) => o.teacher?.name ?? '',
      cell: (o) => (
        <div>
          <p>{o.teacher?.name ?? 'Unassigned'}</p>
          <p className="text-xs text-muted-foreground">{o.teacher?.department?.code}</p>
        </div>
      ),
    },
    {
      key: 'room',
      header: 'Room / schedule',
      value: (o) => [o.room, o.schedule].filter(Boolean).join(' · '),
      cell: (o) => (
        <div>
          <p>{o.room || '—'}</p>
          <p className="text-xs text-muted-foreground">{o.schedule}</p>
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      sortable: false,
      searchable: false,
      export: false,
      align: 'right',
      cell: (o) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Edit ${o.course?.code ?? 'offering'}`}
            title="Edit offering"
            onClick={() => setDialog({ open: true, offering: o })}
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            aria-label={`Delete ${o.course?.code ?? 'offering'}`}
            title="Delete offering"
            onClick={() => setDeleting(o)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Teacher Assignments"
        description="Offer courses each semester and assign the teachers responsible for them."
        centered
        actions={
          <Button onClick={() => setDialog({ open: true, offering: null })}>
            <Plus /> New offering
          </Button>
        }
      />
      <DataTable
        columns={columns}
        rows={semesterId ? data?.items : []}
        loading={loading}
        error={error}
        onRetry={refetch}
        searchable={false}
        sortable={false}
        emptyIcon={UserCheck}
        emptyTitle="No courses offered in this semester"
        emptyDescription="Create an offering to assign a teacher to a course."
      />

      <Dialog open={dialog.open} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{dialog.offering ? `Edit ${dialog.offering.course.code} · Section ${dialog.offering.section}` : 'New course offering'}</DialogTitle>
            <DialogDescription>{dialog.offering ? 'Reassign the teacher or update section details. Affected teachers are notified.' : 'The assigned teacher is notified of the new course.'}</DialogDescription>
          </DialogHeader>
          <OfferingForm key={dialog.offering?.id ?? 'new'} offering={dialog.offering} defaultSemesterId={semester?.status !== 'closed' ? semesterId : lookups?.currentSemester?.id} onClose={() => setDialog((d) => ({ ...d, open: false }))} />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={`Delete ${deleting ? `${deleting.course.code} · Section ${deleting.section}` : 'offering'}?`}
        description="Offerings with enrolled students cannot be deleted. Its assessments are removed as well. This cannot be undone."
        confirmLabel="Delete offering"
        variant="destructive"
        onConfirm={async () => {
          const res = await remove(deleting.id)
          return res.ok ? undefined : false
        }}
      />
    </>
  )
}
