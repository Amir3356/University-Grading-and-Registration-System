import { useMemo, useState } from 'react'
import { BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/common/DataTable'
import { FilterSelect } from '@/components/common/FilterSelect'
import { PageHeader } from '@/components/common/PageHeader'
import { useLookups } from '@/context/lookups-context'
import { useQuery } from '@/hooks/useStore'
import { formatSemesterOptionLabel, formatSemesterTerm, formatYearOfStudy, getCourseStudyYear } from '@/lib/format'
import { store } from '@/store'

export function MyCoursesPage() {
  const lookups = useLookups()
  const [academicYearChoice, setAcademicYearChoice] = useState('all')
  const [semesterChoice, setSemesterChoice] = useState('all')
  const [yearOfStudyChoice, setYearOfStudyChoice] = useState('')

  const { data, loading, error, refetch } = useQuery(() => store.teacher.listMyOfferings())

  // Autoincrements dynamically when the new calendar year arrives (e.g. 2026, 2027 when reached)
  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear()
    return [String(currentYear)]
  }, [])

  const academicYearOptions = [
    { value: 'all', label: 'Academic Year' },
    ...availableYears.map((y) => ({ value: y, label: y })),
  ]

  const semesterOptions = [
    { value: 'all', label: 'Semester' },
    { value: 'first', label: 'First Semester' },
    { value: 'second', label: 'Second Semester' },
  ]

  const rawList = useMemo(() => {
    return Array.isArray(data) ? data : (data?.items || data?.courses || [])
  }, [data])

  // Distinct years of study assigned to the teacher by the Department Head in Teacher Assignments
  const yearOfStudyOptions = useMemo(() => {
    const map = new Map()
    for (const o of rawList) {
      const rawYear =
        o.yearOfStudy ??
        o.year_of_study ??
        o.course?.yearOfStudy ??
        o.course?.level ??
        (o.course ? getCourseStudyYear(o.course) : null) ??
        o.course?.code
      const formatted = formatYearOfStudy(rawYear)
      if (formatted && formatted !== '—') {
        const numMatch = formatted.match(/^(\d+)/)
        const key = numMatch ? numMatch[1] : formatted
        if (!map.has(key)) {
          map.set(key, { value: key, label: formatted })
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => Number(a.value) - Number(b.value))
  }, [rawList])

  const defaultYear = yearOfStudyOptions[0]?.value || ''
  const effectiveYearOfStudyChoice = useMemo(() => {
    if (yearOfStudyChoice && yearOfStudyOptions.some((o) => o.value === yearOfStudyChoice)) {
      return yearOfStudyChoice
    }
    return defaultYear
  }, [yearOfStudyChoice, yearOfStudyOptions, defaultYear])

  const filteredData = useMemo(() => {
    return rawList.filter((o) => {
      const sem =
        o.semester ||
        (lookups?.semesters ?? []).find((s) => s.id === (o.semesterId || o.semester_id))

      if (academicYearChoice !== 'all') {
        const semFormatted = formatSemesterOptionLabel(sem, lookups?.academicYears)
        const ayName = String(sem?.academicYear?.name ?? sem?.academic_year?.name ?? '')
        const semName = String(sem?.name ?? '')
        const start = String(sem?.startDate ?? sem?.start_date ?? '')
        const end = String(sem?.endDate ?? sem?.end_date ?? '')
        const matchesYear =
          semFormatted.includes(academicYearChoice) ||
          ayName.includes(academicYearChoice) ||
          semName.includes(academicYearChoice) ||
          start.startsWith(academicYearChoice) ||
          end.startsWith(academicYearChoice)
        if (!matchesYear) return false
      }

      if (semesterChoice !== 'all') {
        const term = String(sem?.term ?? '').toLowerCase()
        const semName = String(sem?.name ?? '').toLowerCase()
        const formatted = (formatSemesterTerm(sem?.term) || '').toLowerCase()
        if (semesterChoice === 'first') {
          const isFirst =
            term.includes('fall') ||
            term === '1' ||
            term.includes('first') ||
            semName.includes('fall') ||
            semName.includes('first') ||
            formatted.includes('first')
          if (!isFirst) return false
        } else if (semesterChoice === 'second') {
          const isSecond =
            term.includes('spring') ||
            term === '2' ||
            term.includes('second') ||
            semName.includes('spring') ||
            semName.includes('second') ||
            formatted.includes('second')
          if (!isSecond) return false
        }
      }

      if (effectiveYearOfStudyChoice) {
        const yStr = formatYearOfStudy(
          o.yearOfStudy ?? o.year_of_study ?? o.course?.yearOfStudy ?? o.course?.level ?? o.course?.code
        )
        const matchYear =
          yStr.startsWith(`${effectiveYearOfStudyChoice}st`) ||
          yStr.startsWith(`${effectiveYearOfStudyChoice}nd`) ||
          yStr.startsWith(`${effectiveYearOfStudyChoice}rd`) ||
          yStr.startsWith(`${effectiveYearOfStudyChoice}th`) ||
          yStr.includes(`Year ${effectiveYearOfStudyChoice}`) ||
          String(o.yearOfStudy ?? o.year_of_study ?? '') === effectiveYearOfStudyChoice
        if (!matchYear) return false
      }

      return true
    })
  }, [rawList, academicYearChoice, semesterChoice, effectiveYearOfStudyChoice, lookups])

  const isFiltered =
    academicYearChoice !== 'all' ||
    semesterChoice !== 'all' ||
    effectiveYearOfStudyChoice !== defaultYear

  const toolbar = (
    <div
      className="cluster"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '0.75rem',
      }}
    >
      <div style={{ width: '12rem', minWidth: '9.5rem' }}>
        <FilterSelect
          value={academicYearChoice}
          onChange={setAcademicYearChoice}
          options={academicYearOptions}
          placeholder="Academic Year"
          includeAll={false}
        />
      </div>
      <div style={{ width: '12rem', minWidth: '9.5rem' }}>
        <FilterSelect
          value={semesterChoice}
          onChange={setSemesterChoice}
          options={semesterOptions}
          placeholder="Semester"
          includeAll={false}
        />
      </div>
      <div style={{ width: '11.5rem', minWidth: '9rem' }}>
        <FilterSelect
          value={effectiveYearOfStudyChoice}
          onChange={setYearOfStudyChoice}
          options={yearOfStudyOptions}
          placeholder="Select Year"
          includeAll={false}
        />
      </div>
      {isFiltered && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setAcademicYearChoice('all')
            setSemesterChoice('all')
            setYearOfStudyChoice(defaultYear)
          }}
          className="text-xs text-muted-foreground hover:text-foreground h-9"
        >
          Reset filters
        </Button>
      )}
    </div>
  )

  const columns = [
    {
      key: 'courseCode',
      header: 'Course Code',
      value: (o) => o.course?.code ?? '',
      cell: (o) => <span className="font-semibold text-foreground">{o.course?.code ?? '—'}</span>,
    },
    {
      key: 'courseName',
      header: 'Course Name',
      value: (o) => o.course?.title ?? '',
      cell: (o) => <span className="font-medium text-foreground">{o.course?.title ?? '—'}</span>,
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
      value: (o) => {
        const sem =
          o.semester ||
          (lookups?.semesters ?? []).find((s) => s.id === (o.semesterId || o.semester_id))
        return (
          formatSemesterOptionLabel(sem, lookups?.academicYears) ||
          sem?.name ||
          (sem?.term ? formatSemesterTerm(sem.term) : '') ||
          '—'
        )
      },
      cell: (o) => {
        const sem =
          o.semester ||
          (lookups?.semesters ?? []).find((s) => s.id === (o.semesterId || o.semester_id))
        const text =
          formatSemesterOptionLabel(sem, lookups?.academicYears) ||
          sem?.name ||
          (sem?.term ? formatSemesterTerm(sem.term) : '') ||
          '—'
        return <span className="text-muted-foreground">{text}</span>
      },
    },
    {
      key: 'section',
      header: 'Section',
      value: (o) => o.section ?? '',
      cell: (o) => <span>{o.section || '—'}</span>,
    },
  ]

  return (
    <>
      <PageHeader title="My courses" description="Course offerings assigned to you, by semester." centered />
      <DataTable
        columns={columns}
        rows={filteredData}
        loading={loading}
        error={error}
        onRetry={refetch}
        searchable={true}
        searchPlaceholder="Search course code, name, year, or semester…"
        toolbar={toolbar}
        emptyIcon={BookOpen}
        emptyTitle="No courses found"
        emptyDescription="No course offerings match your search and filter criteria."
      />
    </>
  )
}

export default MyCoursesPage
