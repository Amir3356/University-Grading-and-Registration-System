import { useState, useEffect, useMemo } from 'react'
import { Pencil, Plus, Trash2, UserCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { DataTable } from '@/components/common/DataTable'
import { FilterSelect } from '@/components/common/FilterSelect'
import { FormField } from '@/components/common/FormField'
import { PageHeader } from '@/components/common/PageHeader'
import { useAuth } from '@/context/auth-context'
import { useLookups } from '@/context/lookups-context'
import { useQuery, useMutation } from '@/hooks/useStore'
import { formatSemesterOptionLabel, formatSemesterTerm, formatYearOfStudy, getCourseStudyYear } from '@/lib/format'
import { onUserChange } from '@/lib/syncEvents'
import { useWebSocketEvent } from '@/lib/websocket'
import { store } from '@/store'
import { SelectField } from '../users/SelectField'

const LOCKED = ['submitted', 'approved', 'published']

const cleanTeacherName = (name) => {
  if (!name) return ''
  return name.replace(/^Dr\.?\s+/i, '').trim()
}

const YEAR_OF_STUDY_OPTIONS = [
  { value: '', label: 'All Years' },
  { value: '1', label: 'Year 1' },
  { value: '2', label: 'Year 2' },
  { value: '3', label: 'Year 3' },
  { value: '4', label: 'Year 4' },
  { value: '5', label: 'Year 5' },
]

const OFFERING_YEAR_STUDY_OPTIONS = [
  { value: '1', label: 'Year 1' },
  { value: '2', label: 'Year 2' },
  { value: '3', label: 'Year 3' },
  { value: '4', label: 'Year 4' },
  { value: '5', label: 'Year 5' },
]

function matchesDepartment(c, deptId, lookups) {
  if (!deptId || deptId === 'all') return true
  const cDeptId =
    c?.departmentId ||
    c?.department_id ||
    c?.department?.id ||
    (typeof c?.department === 'string' ? c.department : null)
  if (cDeptId && (cDeptId === deptId || String(cDeptId).toLowerCase() === String(deptId).toLowerCase())) {
    return true
  }
  if (c?.departmentCode && c.departmentCode.toLowerCase() === String(deptId).toLowerCase()) {
    return true
  }
  if (c?.departmentName && c.departmentName.toLowerCase() === String(deptId).toLowerCase()) {
    return true
  }
  if (lookups?.departments) {
    const targetDept = lookups.departments.find(
      (d) => d.id === deptId || d.code?.toLowerCase() === String(deptId).toLowerCase() || d.name?.toLowerCase() === String(deptId).toLowerCase()
    )
    if (targetDept) {
      if (cDeptId && (cDeptId === targetDept.id || String(cDeptId).toLowerCase() === targetDept.code?.toLowerCase() || String(cDeptId).toLowerCase() === targetDept.name?.toLowerCase())) return true
      if (c?.departmentCode && c.departmentCode.toLowerCase() === targetDept.code?.toLowerCase()) return true
      if (c?.departmentName && c.departmentName.toLowerCase() === targetDept.name?.toLowerCase()) return true
    }
  }
  return false
}

const teacherLabel = (t) => {
  if (!t) return ''
  const name =
    t.fullName ||
    t.name ||
    `${t.firstName || t.first_name || ''} ${t.lastName || t.last_name || ''}`.trim() ||
    t.username ||
    ''
  return name.trim()
}

function OfferingForm({ offering, defaultSemesterId, preloadedCourses, onClose, onSaved }) {
  const lookups = useLookups()
  const { profile, user } = useAuth()
  const isEdit = Boolean(offering)

  // Resolve department head's department reliably from account profile
  const { data: self } = useQuery(
    () => (user?.id ? store.users.getUser(user.id).catch(() => null) : Promise.resolve(null)),
    [user?.id],
  )

  const headDeptId =
    self?.departmentId ??
    self?.department_id ??
    self?.profile?.departmentId ??
    self?.profile?.department_id ??
    profile?.departmentId ??
    profile?.department_id ??
    profile?.department?.id ??
    user?.departmentId ??
    user?.department_id ??
    (lookups?.departments ?? []).find(
      (d) =>
        (d.headTeacherId && (d.headTeacherId === profile?.id || d.headTeacherId === user?.id || d.headTeacherId === self?.id)) ||
        (d.head_teacher_id && (d.head_teacher_id === profile?.id || d.head_teacher_id === user?.id || d.head_teacher_id === self?.id))
    )?.id ??
    (lookups?.teachers ?? []).find(
      (t) => (t.userId && t.userId === user?.id) || (t.user_id && t.user_id === user?.id) || t.id === profile?.id
    )?.departmentId ??
    ''

  const initialDeptId =
    offering?.teacher?.department?.id ??
    offering?.teacher?.departmentId ??
    offering?.course?.department?.id ??
    offering?.course?.departmentId ??
    offering?.course?.department_id ??
    offering?.departmentId ??
    offering?.department_id ??
    headDeptId ??
    ''

  const [form, setForm] = useState({
    departmentId: initialDeptId,
    yearOfStudy: String(
      offering?.yearOfStudy ??
      offering?.year_of_study ??
      (offering?.course ? getCourseStudyYear(offering.course) : '1') ??
      '1'
    ),
    courseId: offering?.courseId ?? offering?.course_id ?? offering?.course?.id ?? '',
    semesterId: offering?.semesterId ?? offering?.semester_id ?? offering?.semester?.id ?? defaultSemesterId ?? '',
    teacherId: offering?.teacherId ?? offering?.teacher_id ?? offering?.teacher?.id ?? '',
    section: offering?.section ?? 'A',
    capacity: String(offering?.capacity ?? 40),
    room: offering?.room ?? '',
    schedule: offering?.schedule ?? '',
  })

  // Ensure departmentId defaults to headDeptId if empty on load
  useEffect(() => {
    if (!isEdit && headDeptId && !form.departmentId) {
      setForm((f) => ({ ...f, departmentId: headDeptId }))
    }
  }, [headDeptId, isEdit, form.departmentId])

  // Live query for courses belonging to department (matching Department Courses sidebar)
  const { data: deptCoursesData, refetch: refetchDeptCourses } = useQuery(
    () => store.academics.listCourses(headDeptId ? { departmentId: headDeptId, pageSize: 100 } : { pageSize: 100 }),
    [headDeptId],
  )

  const activeCoursesList = useMemo(() => {
    const list = []
    const seenIds = new Set()

    const addCourses = (arr) => {
      if (!arr) return
      const items = Array.isArray(arr) ? arr : Array.isArray(arr.items) ? arr.items : []
      for (const c of items) {
        if (c && c.id && !seenIds.has(c.id)) {
          seenIds.add(c.id)
          list.push(c)
        }
      }
    }

    addCourses(deptCoursesData)
    addCourses(preloadedCourses)
    addCourses(store.academics.getCachedCourses?.())
    addCourses(lookups?.courses)

    return list
  }, [deptCoursesData, preloadedCourses, lookups?.courses])

  // Live query for teachers matching Account Provision / Department Teachers
  const { data: usersData, refetch: refetchUsers } = useQuery(
    () => store.users.listUsers({ role: 'teacher', pageSize: 'all' }),
    [],
  )
  const { data: teachersData, refetch: refetchTeachers } = useQuery(
    () => store.academics.listTeachers({ all: true }),
    [],
  )

  useEffect(() => {
    return onUserChange(() => {
      refetchDeptCourses?.()
      refetchUsers?.()
      refetchTeachers?.()
    })
  }, [refetchDeptCourses, refetchUsers, refetchTeachers])

  useWebSocketEvent('USER_UPDATED', () => {
    refetchUsers?.()
    refetchTeachers?.()
  })
  useWebSocketEvent('COURSE_CREATED', () => refetchDeptCourses?.())
  useWebSocketEvent('COURSE_UPDATED', () => refetchDeptCourses?.())
  useWebSocketEvent('COURSE_DELETED', () => refetchDeptCourses?.())

  const teachersList = useMemo(() => {
    const list = []
    const seenUserIds = new Set()
    const seenTeacherIds = new Set()
    const seenNames = new Set()

    // 1. Teachers provisioned in Account Provision (role === 'teacher')
    const provisionedUsers = (usersData?.items ?? []).filter(
      (u) => u.roleId === 'teacher' || u.role_id === 'teacher',
    )

    // Lookup map to get the exact Fullname from Account Provision (Fullname column header)
    const provisionMap = new Map()
    for (const u of provisionedUsers) {
      const fullName = (
        u.name ||
        `${u.firstName || u.first_name || ''} ${u.lastName || u.last_name || ''}`.trim() ||
        u.username
      ).trim()

      const deptId =
        u.departmentId ||
        u.department_id ||
        u.teacherDeptId ||
        u.teacher_dept_id ||
        u.department?.id ||
        ''
      const deptName =
        u.departmentName ||
        u.department_name ||
        u.department?.name ||
        ''

      const record = {
        userId: u.id,
        teacherId: u.teacherProfileId || u.teacher_profile_id || u.teacherId || u.id,
        fullName,
        departmentId: deptId,
        departmentName: deptName,
        status: u.status,
      }
      if (u.id) provisionMap.set(u.id, record)
      if (u.teacherProfileId) provisionMap.set(u.teacherProfileId, record)
      if (u.teacher_profile_id) provisionMap.set(u.teacher_profile_id, record)
      if (u.teacherId) provisionMap.set(u.teacherId, record)
    }

    // 2. Teachers from listTeachers API
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

      const uId = t.userId || t.user_id
      const tId = t.id
      const prov = (uId && provisionMap.get(uId)) || (tId && provisionMap.get(tId))
      const fullName = (
        prov?.fullName ||
        t.name ||
        `${t.firstName || t.first_name || ''} ${t.lastName || t.last_name || ''}`.trim()
      ).trim()
      const nameKey = fullName.toLowerCase()

      if (uId) seenUserIds.add(uId)
      if (tId) seenTeacherIds.add(tId)
      if (nameKey) seenNames.add(nameKey)

      const deptId =
        prov?.departmentId ||
        t.departmentId ||
        t.department_id ||
        t.department?.id ||
        (lookups?.departments ?? []).find((d) => d.headTeacherId === tId || d.headTeacherId === uId)?.id ||
        ''
      const deptName =
        prov?.departmentName ||
        t.departmentName ||
        t.department_name ||
        t.department?.name ||
        (lookups?.departments ?? []).find((d) => d.id === deptId)?.name ||
        ''

      list.push({
        id: tId,
        userId: uId,
        name: fullName,
        fullName,
        departmentId: deptId,
        departmentName: deptName,
        status: t.status || prov?.status || 'active',
        employeeNumber: t.employeeNumber || t.employee_number,
      })
    }

    // 3. Include any provisioned teachers from Account Provision that weren't in rawTeachers
    for (const u of provisionedUsers) {
      const uId = u.id
      const tId = u.teacherProfileId || u.teacher_profile_id || u.teacherId || u.id
      const fullName = (
        u.name ||
        `${u.firstName || u.first_name || ''} ${u.lastName || u.last_name || ''}`.trim() ||
        u.username
      ).trim()
      const nameKey = fullName.toLowerCase()

      if (uId && seenUserIds.has(uId)) continue
      if (tId && seenTeacherIds.has(tId)) continue
      if (nameKey && seenNames.has(nameKey)) continue

      if (uId) seenUserIds.add(uId)
      if (tId) seenTeacherIds.add(tId)
      if (nameKey) seenNames.add(nameKey)

      const deptId =
        u.departmentId ||
        u.department_id ||
        u.teacherDeptId ||
        u.teacher_dept_id ||
        u.department?.id ||
        ''
      const deptName =
        u.departmentName ||
        u.department_name ||
        u.department?.name ||
        ''

      list.push({
        id: tId,
        userId: uId,
        name: fullName,
        fullName,
        departmentId: deptId,
        departmentName: deptName,
        status: u.status || 'active',
        employeeNumber: u.identifier || u.employeeNumber || u.employee_number,
      })
    }

    return list
  }, [usersData, teachersData, lookups?.teachers, lookups?.departments])

  const [save, { loading, fieldErrors }] = useMutation(
    (data) =>
      isEdit
        ? store.academics.updateOffering(offering.id, {
            courseId: data.courseId,
            semesterId: data.semesterId,
            teacherId: data.teacherId,
            yearOfStudy: data.yearOfStudy,
            section: data.section,
            capacity: data.capacity,
            room: data.room,
            schedule: data.schedule,
          })
        : store.academics.createOffering(data),
    {
      success: isEdit ? 'Offering updated.' : 'Course offering created and teacher notified.',
      onSuccess: (result, data) => {
        onSaved?.(result, data)
        onClose?.(result, data)
      },
    },
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
      const currentCourse = activeCoursesList.find((c) => c.id === f.courseId)
      const courseBelongsToDept = currentCourse && (!deptId || deptId === 'all' || matchesDepartment(currentCourse, deptId, lookups))
      return {
        ...f,
        departmentId: deptId === 'all' ? '' : deptId,
        courseId: courseBelongsToDept ? f.courseId : '',
      }
    })
  }

  const handleYearOfStudyChange = (year) => {
    setForm((f) => ({
      ...f,
      yearOfStudy: year,
    }))
  }

  const handleCourseChange = (courseId) => {
    const selectedCourse = activeCoursesList.find((c) => c.id === courseId) || (lookups?.courses ?? []).find((c) => c.id === courseId)
    const cDept =
      selectedCourse?.departmentId ||
      selectedCourse?.department_id ||
      selectedCourse?.department?.id ||
      (typeof selectedCourse?.department === 'string' ? selectedCourse.department : null)
    const cYear = getCourseStudyYear(selectedCourse)
    setForm((f) => ({
      ...f,
      courseId,
      departmentId: cDept || f.departmentId,
      yearOfStudy: f.yearOfStudy && f.yearOfStudy !== 'all' ? f.yearOfStudy : (cYear || ''),
    }))
  }

  const handleTeacherChange = (teacherId) => {
    const selectedTeacher =
      teachersList.find((t) => t.id === teacherId || t.userId === teacherId) ||
      (lookups?.teachers ?? []).find((t) => t.id === teacherId || t.userId === teacherId || t.user_id === teacherId) ||
      (usersData?.items ?? []).find((u) => u.id === teacherId || u.teacherProfileId === teacherId)

    let tDeptId =
      selectedTeacher?.departmentId ||
      selectedTeacher?.department_id ||
      selectedTeacher?.teacherDeptId ||
      selectedTeacher?.teacher_dept_id ||
      selectedTeacher?.department?.id ||
      (lookups?.departments ?? []).find(
        (d) => d.headTeacherId === teacherId || d.headTeacherId === selectedTeacher?.userId
      )?.id

    if (tDeptId && !(lookups?.departments ?? []).some((d) => d.id === tDeptId)) {
      const match = (lookups?.departments ?? []).find(
        (d) => d.code === tDeptId || d.name?.toLowerCase() === String(tDeptId).toLowerCase()
      )
      if (match) tDeptId = match.id
    }

    setForm((f) => {
      const nextDeptId = f.courseId ? f.departmentId : (tDeptId || f.departmentId)
      const courseStillValid = activeCoursesList.some(
        (c) =>
          c.id === f.courseId &&
          (!nextDeptId || matchesDepartment(c, nextDeptId, lookups))
      )
      return {
        ...f,
        teacherId,
        departmentId: nextDeptId,
        courseId: courseStillValid ? f.courseId : '',
      }
    })
  }

  const course = activeCoursesList.find((c) => c.id === form.courseId) || (lookups?.courses ?? []).find((c) => c.id === form.courseId)

  const courseOptions = useMemo(() => {
    const active = activeCoursesList.filter((c) => !c.status || c.status === 'active')
    const targetDept = form.departmentId || headDeptId
    let deptCourses = active
    if (targetDept && targetDept !== 'all') {
      const filtered = active.filter((c) => matchesDepartment(c, targetDept, lookups))
      if (filtered.length > 0) {
        deptCourses = filtered
      }
    }

    const sorted = [...deptCourses].sort((a, b) => {
      if (form.yearOfStudy) {
        const aMatches = getCourseStudyYear(a) === String(form.yearOfStudy)
        const bMatches = getCourseStudyYear(b) === String(form.yearOfStudy)
        if (aMatches && !bMatches) return -1
        if (!aMatches && bMatches) return 1
      }
      return (a.title || a.name || '').localeCompare(b.title || b.name || '')
    })

    const opts = sorted.map((c) => ({
      value: c.id,
      label: `${c.title || c.name} (${c.code})`,
    }))

    const currentCourseId = form.courseId || offering?.courseId || offering?.course?.id
    if (currentCourseId && !opts.some((o) => o.value === currentCourseId)) {
      const currentCourse =
        activeCoursesList.find((c) => c.id === currentCourseId) ||
        (lookups?.courses ?? []).find((c) => c.id === currentCourseId) ||
        offering?.course
      if (currentCourse) {
        opts.unshift({
          value: currentCourse.id,
          label: `${currentCourse.title || currentCourse.name} (${currentCourse.code})`,
        })
      }
    }
    return opts
  }, [activeCoursesList, form.departmentId, headDeptId, form.yearOfStudy, form.courseId, isEdit, offering, lookups])

  const semesterOptions = useMemo(() => {
    const allSemesters = lookups?.semesters ?? []
    const academicYears = lookups?.academicYears ?? []
    const currentYear = new Date().getFullYear()

    // Include non-closed (active and upcoming) semesters, filtered for the current arrived year
    const available = allSemesters.filter((s) => s.status !== 'closed')
    const arrivedSemesters = available.filter((s) => {
      const yearMatch =
        (s.name || '').match(/\b(20\d{2})\b/) ||
        (s.academic_year?.name || '').match(/\b(20\d{2})\b/) ||
        (s.id || '').match(/\b(20\d{2})\b/)
      if (yearMatch) {
        return parseInt(yearMatch[1], 10) === currentYear
      }
      return true
    })
    const pool = arrivedSemesters.length > 0 ? arrivedSemesters : (available.length > 0 ? available : allSemesters)

    // Sort chronologically by sort_order
    const sorted = [...pool].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

    const options = sorted.map((s) => ({
      value: s.id,
      label: formatSemesterOptionLabel(s, academicYears),
    }))

    // If editing and the offering's semester is not in options, include it
    const currentSemId = offering?.semesterId || offering?.semester_id || offering?.semester?.id
    if (isEdit && currentSemId && !options.some((o) => o.value === currentSemId)) {
      const existing = allSemesters.find((s) => s.id === currentSemId) || offering?.semester
      options.unshift({
        value: currentSemId,
        label: formatSemesterOptionLabel(existing, academicYears),
      })
    }

    return options
  }, [lookups?.semesters, lookups?.academicYears, isEdit, offering])

  useEffect(() => {
    if (!isEdit && semesterOptions.length > 0 && (!form.semesterId || !semesterOptions.some((o) => o.value === form.semesterId))) {
      const match = defaultSemesterId && semesterOptions.find((o) => o.value === defaultSemesterId)
      setForm((f) => ({ ...f, semesterId: match ? match.value : semesterOptions[0].value }))
    }
  }, [semesterOptions, form.semesterId, defaultSemesterId, isEdit])

  // Teachers from the course's or selected department first.
  const targetDeptId = form.departmentId || headDeptId || course?.departmentId || course?.department_id
  const teacherOptions = useMemo(() => {
    let teachers = [...teachersList]
    if (targetDeptId && targetDeptId !== 'all') {
      const deptTeachers = teachers.filter(
        (t) => (t.departmentId || t.department_id) === targetDeptId
      )
      if (deptTeachers.length > 0) {
        teachers = deptTeachers
      }
    }
    teachers.sort((a, b) => (a.fullName || a.name || '').localeCompare(b.fullName || b.name || ''))
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
        const assignedYear =
          form.yearOfStudy && form.yearOfStudy !== 'all'
            ? parseInt(form.yearOfStudy, 10)
            : course
            ? parseInt(getCourseStudyYear(course), 10)
            : undefined

        save({
          courseId: form.courseId,
          semesterId: form.semesterId,
          teacherId: form.teacherId,
          yearOfStudy: assignedYear,
          section: form.section,
          capacity: form.capacity,
          room: form.room,
          schedule: form.schedule,
        })
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {!(user?.roleId === 'dept_head' || Boolean(headDeptId)) && (
          <SelectField
            label="Department"
            value={form.departmentId}
            onChange={handleDepartmentChange}
            options={departmentOptions}
            placeholder="Choose a department"
            className="sm:col-span-2"
          />
        )}
        <SelectField
          label="Year of Study"
          value={form.yearOfStudy}
          onChange={handleYearOfStudyChange}
          options={OFFERING_YEAR_STUDY_OPTIONS}
          placeholder="Choose Year of Study"
          className="sm:col-span-2"
        />
        <SelectField
          label="Course Name"
          required
          value={form.courseId}
          onChange={handleCourseChange}
          options={courseOptions}
          error={fe.courseId}
          placeholder={
            courseOptions.length === 0
              ? 'No courses available for this department'
              : 'Choose a course name'
          }
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
        onChange={handleTeacherChange}
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
  const [createdOfferings, setCreatedOfferings] = useState([])
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [selectedYearOfStudy, setSelectedYearOfStudy] = useState('')

  const { data: pageCourses, refetch: refetchCourses } = useQuery(
    () => store.academics.listCourses({ pageSize: 100 }),
    [],
  )
  const { data, loading, error, refetch } = useQuery(
    () => store.academics.listOfferings({ pageSize: 100 }),
    [],
    { enabled: true },
  )

  useEffect(() => {
    return onUserChange(() => {
      refetch()
      refetchCourses()
    })
  }, [refetch, refetchCourses])

  useWebSocketEvent('USER_UPDATED', () => refetch())
  useWebSocketEvent('TEACHER_UPDATED', () => refetch())
  useWebSocketEvent('OFFERING_UPDATED', () => refetch())
  useWebSocketEvent('OFFERING_CREATED', () => refetch())
  useWebSocketEvent('OFFERING_DELETED', () => refetch())
  useWebSocketEvent('COURSE_CREATED', () => refetchCourses?.())
  useWebSocketEvent('COURSE_UPDATED', () => refetchCourses?.())
  useWebSocketEvent('COURSE_DELETED', () => refetchCourses?.())

  const [dialog, setDialog] = useState({ open: false, offering: null })
  const [deleting, setDeleting] = useState(null)
  const [remove] = useMutation((id) => store.academics.deleteOffering(id), { success: 'Offering deleted.' })

  const displayRows = useMemo(() => {
    const serverItems = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : [])
    if (!createdOfferings.length) return serverItems

    const serverIds = new Set(serverItems.map((o) => o.id))
    const fresh = createdOfferings.filter((o) => !serverIds.has(o.id))
    if (!fresh.length) return serverItems

    return [...fresh, ...serverItems]
  }, [data, createdOfferings])

  // Course Name filter options built from the courses behind the listed offerings
  const courseFilterOptions = useMemo(() => {
    const seen = new Map()
    for (const o of displayRows) {
      const c = o.course || {}
      const id = c.id || o.courseId || o.course_id
      if (!id || seen.has(id)) continue
      const title = c.title || c.name || ''
      const code = c.code || ''
      seen.set(id, { value: String(id), label: code ? `${title} (${code})` : title })
    }
    return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label))
  }, [displayRows])

  const filteredRows = useMemo(() => {
    return displayRows.filter((o) => {
      if (selectedCourseId) {
        const id = o.course?.id || o.courseId || o.course_id
        if (String(id) !== String(selectedCourseId)) return false
      }
      if (selectedYearOfStudy) {
        const yos = String(
          o.yearOfStudy ?? o.year_of_study ?? (o.course ? getCourseStudyYear(o.course) : '')
        )
        if (yos !== String(selectedYearOfStudy)) return false
      }
      return true
    })
  }, [displayRows, selectedCourseId, selectedYearOfStudy])

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
      key: 'yearOfStudy',
      header: 'Year of Study',
      value: (o) =>
        formatYearOfStudy(
          o.yearOfStudy ?? o.year_of_study ?? o.course?.yearOfStudy ?? o.course?.level ?? o.course?.code
        ),
      cell: (o) => (
        <span className="tabular">
          {formatYearOfStudy(
            o.yearOfStudy ?? o.year_of_study ?? o.course?.yearOfStudy ?? o.course?.level ?? o.course?.code
          )}
        </span>
      ),
    },
    {
      key: 'semester',
      header: 'Semester',
      value: (o) =>
        formatSemesterOptionLabel(o.semester, lookups?.academicYears) ||
        o.semester?.name ||
        (o.semester?.term ? formatSemesterTerm(o.semester.term) : '') ||
        '—',
      cell: (o) => (
        <span className="text-muted-foreground">
          {formatSemesterOptionLabel(o.semester, lookups?.academicYears) ||
            o.semester?.name ||
            (o.semester?.term ? formatSemesterTerm(o.semester.term) : '') ||
            '—'}
        </span>
      ),
    },
    { key: 'section', header: 'Section' },
    {
      key: 'teacherName',
      header: 'Teacher',
      value: (o) => cleanTeacherName(o.teacher?.name),
      cell: (o) => {
        const name = cleanTeacherName(o.teacher?.name)
        const tDeptId = o.teacher?.departmentId || o.teacher?.department?.id
        const deptCode =
          o.teacher?.department?.code ??
          (lookups?.departments ?? []).find((d) => d.id === tDeptId)?.code
        return (
          <div>
            <p>{name || 'Unassigned'}</p>
            {deptCode && <p className="text-xs text-muted-foreground">{deptCode}</p>}
          </div>
        )
      },
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
        rows={filteredRows}
        loading={loading}
        error={error}
        onRetry={refetch}
        searchable={true}
        searchPlaceholder="Search course code, course name, or teacher…"
        sortable={true}
        toolbar={
          <div className="assignments-toolbar-filters cluster cluster--end push-end">
            <FilterSelect
              value={selectedYearOfStudy}
              onChange={(val) => setSelectedYearOfStudy(val || '')}
              options={YEAR_OF_STUDY_OPTIONS.filter((o) => o.value !== '')}
              allLabel="All Years of Study"
              placeholder="Filter by Year of Study"
              className="filter-select--year w-48"
              align="end"
            />
            <FilterSelect
              value={selectedCourseId}
              onChange={(val) => setSelectedCourseId(val || '')}
              options={courseFilterOptions}
              allLabel="All Courses"
              placeholder="Filter by Course Name"
              className="filter-select--course w-64"
              align="end"
            />
          </div>
        }
        emptyIcon={UserCheck}
        emptyTitle={selectedCourseId ? 'No offerings for this course' : 'No courses offered'}
        emptyDescription="Create an offering to assign a teacher to a course."
      />

      <Dialog open={dialog.open} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {dialog.offering ? `Edit ${dialog.offering.course?.code ?? 'offering'} · Section ${dialog.offering.section}` : 'New course offering'}
            </DialogTitle>
            <DialogDescription>
              {dialog.offering ? 'Reassign the teacher or update section details. Affected teachers are notified.' : 'The assigned teacher is notified of the new course.'}
            </DialogDescription>
          </DialogHeader>
          <OfferingForm
            key={dialog.offering?.id ?? 'new'}
            offering={dialog.offering}
            preloadedCourses={pageCourses}
            defaultSemesterId={lookups?.currentSemester?.id}
            onClose={() => setDialog({ open: false, offering: null })}
            onSaved={(savedOffering) => {
              if (savedOffering && savedOffering.id) {
                setCreatedOfferings((prev) => [savedOffering, ...prev.filter((o) => o.id !== savedOffering.id)])
              }
              setDialog({ open: false, offering: null })
              refetch()
            }}
          />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(v) => !v && setDeleting(null)}
        title={`Delete ${deleting ? `${deleting.course?.code ?? 'offering'} · Section ${deleting.section}` : 'offering'}?`}
        description="Offerings with enrolled students cannot be deleted. Its assessments are removed as well. This cannot be undone."
        confirmLabel="Delete offering"
        variant="destructive"
        onConfirm={async () => {
          const res = await remove(deleting.id)
          if (res.ok) {
            setCreatedOfferings((prev) => prev.filter((o) => o.id !== deleting.id))
            refetch()
            return undefined
          }
          return false
        }}
      />
    </>
  )
}

