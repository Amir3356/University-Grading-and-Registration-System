import { useState, useMemo } from 'react'
import {
  CalendarDays,
  CalendarCheck2,
  Users,
  UserX,
  Search,
  ChevronDown,
  Eye,
  CheckCircle2,
  FileSpreadsheet,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const INITIAL_STUDENTS = [
  {
    id: 'STU001',
    name: 'Alice Johnson',
    academicYear: '2026',
    semester: 'First',
    registrationType: 'Café',
    status: 'Registered',
    registrationDate: 'Jan 10, 2026',
    department: 'Computer Science',
    program: 'BSc Computer Science',
  },
  {
    id: 'STU002',
    name: 'Michael Brown',
    academicYear: '2026',
    semester: 'First',
    registrationType: 'Non-Café',
    status: 'Registered',
    registrationDate: 'Jan 12, 2026',
    department: 'Electrical Engineering',
    program: 'BSc Electrical Engineering',
  },
  {
    id: 'STU003',
    name: 'Sarah Davis',
    academicYear: '2026',
    semester: 'First',
    registrationType: '—',
    status: 'Not Registered',
    registrationDate: '—',
    department: 'Mathematics',
    program: 'BSc Mathematics',
  },
  {
    id: 'STU004',
    name: 'James Wilson',
    academicYear: '2026',
    semester: 'First',
    registrationType: 'Café',
    status: 'Pending',
    registrationDate: 'Jan 18, 2026',
    department: 'Information Systems',
    program: 'BSc Information Systems',
  },
  {
    id: 'STU005',
    name: 'Emma Taylor',
    academicYear: '2026',
    semester: 'First',
    registrationType: 'Non-Café',
    status: 'Registered',
    registrationDate: 'Jan 15, 2026',
    department: 'Computer Science',
    program: 'BSc Computer Science',
  },
  {
    id: 'STU006',
    name: 'David Miller',
    academicYear: '2026',
    semester: 'Second',
    registrationType: 'Café',
    status: 'Registered',
    registrationDate: 'Jan 11, 2026',
    department: 'Electrical Engineering',
    program: 'BSc Electrical Engineering',
  },
  {
    id: 'STU007',
    name: 'Sophia Wilson',
    academicYear: '2026',
    semester: 'Second',
    registrationType: 'Non-Café',
    status: 'Registered',
    registrationDate: 'Jan 14, 2026',
    department: 'Mathematics',
    program: 'BSc Mathematics',
  },
  {
    id: 'STU008',
    name: 'Daniel Anderson',
    academicYear: '2026',
    semester: 'First',
    registrationType: 'Café',
    status: 'Pending',
    registrationDate: 'Jan 19, 2026',
    department: 'Computer Science',
    program: 'BSc Computer Science',
  },
  {
    id: 'STU009',
    name: 'Olivia Martinez',
    academicYear: '2026',
    semester: 'First',
    registrationType: '—',
    status: 'Not Registered',
    registrationDate: '—',
    department: 'Mechanical Engineering',
    program: 'BSc Mechanical Engineering',
  },
  {
    id: 'STU010',
    name: 'Lucas Thomas',
    academicYear: '2026',
    semester: 'Second',
    registrationType: 'Non-Café',
    status: 'Registered',
    registrationDate: 'Jan 16, 2026',
    department: 'Information Systems',
    program: 'BSc Information Systems',
  },
  {
    id: 'STU011',
    name: 'Mia Jackson',
    academicYear: '2026',
    semester: 'First',
    registrationType: 'Café',
    status: 'Registered',
    registrationDate: 'Jan 09, 2026',
    department: 'Computer Science',
    program: 'BSc Computer Science',
  },
  {
    id: 'STU012',
    name: 'Benjamin White',
    academicYear: '2026',
    semester: 'Second',
    registrationType: 'Non-Café',
    status: 'Registered',
    registrationDate: 'Jan 13, 2026',
    department: 'Electrical Engineering',
    program: 'BSc Electrical Engineering',
  },
  {
    id: 'STU013',
    name: 'Charlotte Harris',
    academicYear: '2026',
    semester: 'First',
    registrationType: 'Café',
    status: 'Registered',
    registrationDate: 'Jan 10, 2026',
    department: 'Mathematics',
    program: 'BSc Mathematics',
  },
  {
    id: 'STU014',
    name: 'Henry Martin',
    academicYear: '2026',
    semester: 'First',
    registrationType: '—',
    status: 'Not Registered',
    registrationDate: '—',
    department: 'Mechanical Engineering',
    program: 'BSc Mechanical Engineering',
  },
  {
    id: 'STU015',
    name: 'Amelia Thompson',
    academicYear: '2026',
    semester: 'First',
    registrationType: 'Café',
    status: 'Pending',
    registrationDate: 'Jan 17, 2026',
    department: 'Computer Science',
    program: 'BSc Computer Science',
  },
  {
    id: 'STU016',
    name: 'Alexander Garcia',
    academicYear: '2026',
    semester: 'First',
    registrationType: 'Non-Café',
    status: 'Registered',
    registrationDate: 'Jan 12, 2026',
    department: 'Information Systems',
    program: 'BSc Information Systems',
  },
  {
    id: 'STU017',
    name: 'Harper Robinson',
    academicYear: '2026',
    semester: 'First',
    registrationType: 'Café',
    status: 'Registered',
    registrationDate: 'Jan 08, 2026',
    department: 'Electrical Engineering',
    program: 'BSc Electrical Engineering',
  },
  {
    id: 'STU018',
    name: 'Sebastian Clark',
    academicYear: '2026',
    semester: 'First',
    registrationType: 'Non-Café',
    status: 'Registered',
    registrationDate: 'Jan 15, 2026',
    department: 'Computer Science',
    program: 'BSc Computer Science',
  },
  {
    id: 'STU019',
    name: 'Evelyn Rodriguez',
    academicYear: '2026',
    semester: 'First',
    registrationType: '—',
    status: 'Not Registered',
    registrationDate: '—',
    department: 'Mathematics',
    program: 'BSc Mathematics',
  },
  {
    id: 'STU020',
    name: 'Jack Lewis',
    academicYear: '2026',
    semester: 'First',
    registrationType: 'Café',
    status: 'Registered',
    registrationDate: 'Jan 14, 2026',
    department: 'Computer Science',
    program: 'BSc Computer Science',
  },
  {
    id: 'STU021',
    name: 'Ella Lee',
    academicYear: '2026',
    semester: 'First',
    registrationType: 'Non-Café',
    status: 'Registered',
    registrationDate: 'Jan 11, 2026',
    department: 'Information Systems',
    program: 'BSc Information Systems',
  },
  {
    id: 'STU022',
    name: 'Samuel Walker',
    academicYear: '2026',
    semester: 'First',
    registrationType: 'Café',
    status: 'Pending',
    registrationDate: 'Jan 18, 2026',
    department: 'Electrical Engineering',
    program: 'BSc Electrical Engineering',
  },
  {
    id: 'STU023',
    name: 'Grace Hall',
    academicYear: '2026',
    semester: 'First',
    registrationType: 'Non-Café',
    status: 'Registered',
    registrationDate: 'Jan 16, 2026',
    department: 'Mechanical Engineering',
    program: 'BSc Mechanical Engineering',
  },
  {
    id: 'STU024',
    name: 'Logan Allen',
    academicYear: '2026',
    semester: 'First',
    registrationType: '—',
    status: 'Not Registered',
    registrationDate: '—',
    department: 'Mathematics',
    program: 'BSc Mathematics',
  },
  {
    id: 'STU025',
    name: 'Chloe Young',
    academicYear: '2026',
    semester: 'First',
    registrationType: 'Café',
    status: 'Registered',
    registrationDate: 'Jan 13, 2026',
    department: 'Computer Science',
    program: 'BSc Computer Science',
  },
  {
    id: 'STU026',
    name: 'Wyatt King',
    academicYear: '2026',
    semester: 'First',
    registrationType: 'Non-Café',
    status: 'Registered',
    registrationDate: 'Jan 15, 2026',
    department: 'Information Systems',
    program: 'BSc Information Systems',
  },
  {
    id: 'STU027',
    name: 'Lily Wright',
    academicYear: '2026',
    semester: 'First',
    registrationType: 'Café',
    status: 'Registered',
    registrationDate: 'Jan 10, 2026',
    department: 'Electrical Engineering',
    program: 'BSc Electrical Engineering',
  },
  {
    id: 'STU028',
    name: 'Owen Scott',
    academicYear: '2026',
    semester: 'First',
    registrationType: 'Café',
    status: 'Pending',
    registrationDate: 'Jan 19, 2026',
    department: 'Mechanical Engineering',
    program: 'BSc Mechanical Engineering',
  },
]

export function StudentRegistrationsPage() {
  const [students, setStudents] = useState(INITIAL_STUDENTS)
  const [studentSearch, setStudentSearch] = useState('')
  const [studentSemFilter, setStudentSemFilter] = useState('All')
  const [studentDeptFilter, setStudentDeptFilter] = useState('All')
  const [studentProgFilter, setStudentProgFilter] = useState('All')
  const [studentTypeFilter, setStudentTypeFilter] = useState('All')
  const [studentStatusFilter, setStudentStatusFilter] = useState('All')
  const [studentPage, setStudentPage] = useState(1)
  const studentsPerPage = 5

  // Metrics
  const totalSemestersCount = 4
  const openPeriodsCount = 1
  const registeredCount = 320
  const notRegisteredCount = 24

  // Filtered Students
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const q = studentSearch.toLowerCase().trim()
      const matchSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        s.department.toLowerCase().includes(q)

      const matchSem =
        studentSemFilter === 'All' ||
        (studentSemFilter === 'First' && (s.semester === 'First' || s.semester === 'First Semester')) ||
        (studentSemFilter === 'Second' && (s.semester === 'Second' || s.semester === 'Second Semester'))

      const matchDept = studentDeptFilter === 'All' || s.department === studentDeptFilter
      const matchProg = studentProgFilter === 'All' || s.program === studentProgFilter
      const matchType =
        studentTypeFilter === 'All' ||
        (studentTypeFilter === 'Café' && s.registrationType === 'Café') ||
        (studentTypeFilter === 'Non-Café' && s.registrationType === 'Non-Café')
      const matchStatus = studentStatusFilter === 'All' || s.status === studentStatusFilter

      return matchSearch && matchSem && matchDept && matchProg && matchType && matchStatus
    })
  }, [students, studentSearch, studentSemFilter, studentDeptFilter, studentProgFilter, studentTypeFilter, studentStatusFilter])

  // Pagination
  const totalStudentPages = Math.ceil(filteredStudents.length / studentsPerPage) || 1
  const paginatedStudents = useMemo(() => {
    const start = (studentPage - 1) * studentsPerPage
    return filteredStudents.slice(start, start + studentsPerPage)
  }, [filteredStudents, studentPage])

  const studentStartCount = filteredStudents.length === 0 ? 0 : (studentPage - 1) * studentsPerPage + 1
  const studentEndCount = Math.min(studentPage * studentsPerPage, filteredStudents.length)

  const renderStatusBadge = (status) => {
    switch (status) {
      case 'Registered':
        return <span className="reg-badge reg-badge--registered">Registered</span>
      case 'Pending':
        return <span className="reg-badge reg-badge--pending">Pending</span>
      case 'Not Registered':
        return <span className="reg-badge reg-badge--not-registered">Not Registered</span>
      default:
        return <span className="reg-badge">{status}</span>
    }
  }

  return (
    <div className="semester-reg-page">
      {/* Header */}
      <div className="semester-reg-header">
        <h1 className="semester-reg-header__title">Semester Registration Management</h1>
        <p className="semester-reg-header__subtitle">
          Configure registration periods, manage registration types and monitor student registrations for each semester.
        </p>
      </div>

      {/* 4 Summary Stat Cards */}
      <div className="semester-reg-stats">
        <div className="reg-stat-card">
          <div className="reg-stat-card__icon reg-stat-card__icon--blue">
            <CalendarDays aria-hidden="true" />
          </div>
          <div className="reg-stat-card__content">
            <p className="reg-stat-card__label">Total Semesters</p>
            <p className="reg-stat-card__value reg-stat-card__value--blue">{totalSemestersCount}</p>
          </div>
        </div>

        <div className="reg-stat-card">
          <div className="reg-stat-card__icon reg-stat-card__icon--green">
            <CalendarCheck2 aria-hidden="true" />
          </div>
          <div className="reg-stat-card__content">
            <p className="reg-stat-card__label">Open Registration Periods</p>
            <p className="reg-stat-card__value reg-stat-card__value--green">{openPeriodsCount}</p>
          </div>
        </div>

        <div className="reg-stat-card">
          <div className="reg-stat-card__icon reg-stat-card__icon--purple">
            <Users aria-hidden="true" />
          </div>
          <div className="reg-stat-card__content">
            <p className="reg-stat-card__label">Registered Students</p>
            <p className="reg-stat-card__value reg-stat-card__value--purple">{registeredCount}</p>
          </div>
        </div>

        <div className="reg-stat-card">
          <div className="reg-stat-card__icon reg-stat-card__icon--orange">
            <UserX aria-hidden="true" />
          </div>
          <div className="reg-stat-card__content">
            <p className="reg-stat-card__label">Not Registered Students</p>
            <p className="reg-stat-card__value reg-stat-card__value--orange">{notRegisteredCount}</p>
          </div>
        </div>
      </div>

      {/* Student Registrations Card */}
      <section className="reg-card" style={{ marginTop: '0.25rem' }}>
        <div className="reg-card__header">
          <h2 className="reg-card__title">Student Registrations</h2>
        </div>

        {/* Filters Row */}
        <div className="reg-filters">
          <div className="reg-search-wrap">
            <Search aria-hidden="true" />
            <input
              type="text"
              placeholder="Search by student name or ID..."
              value={studentSearch}
              onChange={(e) => {
                setStudentSearch(e.target.value)
                setStudentPage(1)
              }}
              className="reg-search-input"
            />
          </div>

          <div className="reg-filter-select-box">
            <label className="reg-filter-select-label">Semester</label>
            <select
              value={studentSemFilter}
              onChange={(e) => {
                setStudentSemFilter(e.target.value)
                setStudentPage(1)
              }}
              className="reg-filter-select"
            >
              <option value="All">All Semesters</option>
              <option value="First">First Semester</option>
              <option value="Second">Second Semester</option>
            </select>
          </div>

          <div className="reg-filter-select-box">
            <label className="reg-filter-select-label">Department</label>
            <select
              value={studentDeptFilter}
              onChange={(e) => {
                setStudentDeptFilter(e.target.value)
                setStudentPage(1)
              }}
              className="reg-filter-select"
            >
              <option value="All">All Departments</option>
              <option value="Computer Science">Computer Science</option>
              <option value="Electrical Engineering">Electrical Engineering</option>
              <option value="Mathematics">Mathematics</option>
              <option value="Information Systems">Information Systems</option>
              <option value="Mechanical Engineering">Mechanical Engineering</option>
            </select>
          </div>

          <div className="reg-filter-select-box">
            <label className="reg-filter-select-label">Program</label>
            <select
              value={studentProgFilter}
              onChange={(e) => {
                setStudentProgFilter(e.target.value)
                setStudentPage(1)
              }}
              className="reg-filter-select"
            >
              <option value="All">All Programs</option>
              <option value="BSc Computer Science">BSc Computer Science</option>
              <option value="BSc Electrical Engineering">BSc Electrical Engineering</option>
              <option value="BSc Mathematics">BSc Mathematics</option>
              <option value="BSc Information Systems">BSc Information Systems</option>
              <option value="BSc Mechanical Engineering">BSc Mechanical Engineering</option>
            </select>
          </div>

          <div className="reg-filter-select-box">
            <label className="reg-filter-select-label">Registration Type</label>
            <select
              value={studentTypeFilter}
              onChange={(e) => {
                setStudentTypeFilter(e.target.value)
                setStudentPage(1)
              }}
              className="reg-filter-select"
            >
              <option value="All">All Types</option>
              <option value="Café">Café</option>
              <option value="Non-Café">Non-Café</option>
            </select>
          </div>

          <div className="reg-filter-select-box">
            <label className="reg-filter-select-label">Status</label>
            <select
              value={studentStatusFilter}
              onChange={(e) => {
                setStudentStatusFilter(e.target.value)
                setStudentPage(1)
              }}
              className="reg-filter-select"
            >
              <option value="All">All Statuses</option>
              <option value="Registered">Registered</option>
              <option value="Pending">Pending</option>
              <option value="Not Registered">Not Registered</option>
            </select>
          </div>
        </div>

        {/* Students Table */}
        <div className="reg-table-container">
          <table className="reg-table">
            <thead>
              <tr>
                <th>Student ID</th>
                <th>Student Name</th>
                <th>Academic Year</th>
                <th>Semester</th>
                <th>Registration Type</th>
                <th>Status</th>
                <th>Registration Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedStudents.map((student) => (
                <tr key={student.id}>
                  <td style={{ fontWeight: 500, color: 'var(--foreground)' }}>{student.id}</td>
                  <td>{student.name}</td>
                  <td>{student.academicYear}</td>
                  <td>{student.semester}</td>
                  <td>
                    {student.registrationType === 'Café' ? (
                      <span className="reg-badge reg-badge--cafe">Café</span>
                    ) : student.registrationType === 'Non-Café' ? (
                      <span className="reg-badge reg-badge--non-cafe">Non-Café</span>
                    ) : (
                      <span>—</span>
                    )}
                  </td>
                  <td>{renderStatusBadge(student.status)}</td>
                  <td>{student.registrationDate}</td>
                  <td>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button type="button" className="reg-action-trigger">
                          <span>{student.status === 'Pending' ? 'Review' : 'View'}</span>
                          <ChevronDown size={14} aria-hidden="true" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuLabel>
                          {student.name} ({student.id})
                        </DropdownMenuLabel>
                        <DropdownMenuItem
                          onClick={() => toast.info(`Viewing student profile: ${student.name} (${student.id})`)}
                        >
                          <Eye size={14} className="mr-2" />
                          View Profile & Details
                        </DropdownMenuItem>
                        {student.status === 'Pending' && (
                          <DropdownMenuItem
                            onClick={() => {
                              setStudents((prev) =>
                                prev.map((s) => (s.id === student.id ? { ...s, status: 'Registered' } : s))
                              )
                              toast.success(`Registration approved for ${student.name}`)
                            }}
                          >
                            <CheckCircle2 size={14} className="mr-2 text-emerald-600" />
                            Approve Registration
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() => {
                            const newType = student.registrationType === 'Café' ? 'Non-Café' : 'Café'
                            setStudents((prev) =>
                              prev.map((s) => (s.id === student.id ? { ...s, registrationType: newType } : s))
                            )
                            toast.success(`Changed registration type to ${newType}`)
                          }}
                        >
                          <FileSpreadsheet size={14} className="mr-2" />
                          Switch Café / Non-Café
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
              {paginatedStudents.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted-foreground)' }}
                  >
                    No student registrations found matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Students Pagination */}
        <div className="reg-pagination">
          <span className="reg-pagination__info">
            Showing {studentStartCount}–{studentEndCount} of {filteredStudents.length} records
          </span>
          <div className="reg-pagination__controls">
            <button
              type="button"
              className="reg-page-btn"
              disabled={studentPage <= 1}
              onClick={() => setStudentPage((p) => Math.max(p - 1, 1))}
              aria-label="Previous page"
            >
              ‹
            </button>
            {Array.from({ length: totalStudentPages }, (_, i) => i + 1).map((pageNum) => (
              <button
                key={pageNum}
                type="button"
                className={`reg-page-btn ${studentPage === pageNum ? 'reg-page-btn--active' : ''}`}
                onClick={() => setStudentPage(pageNum)}
              >
                {pageNum}
              </button>
            ))}
            <button
              type="button"
              className="reg-page-btn"
              disabled={studentPage >= totalStudentPages}
              onClick={() => setStudentPage((p) => Math.min(p + 1, totalStudentPages))}
              aria-label="Next page"
            >
              ›
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
