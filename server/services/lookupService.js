import { query } from '../config/database.js';
import * as lookupRepo from '../repositories/lookupRepository.js';
import { getCurrentSemester, ensureAcademicCalendarYears } from '../repositories/calendarRepository.js';
import { getAcademicPolicy, getActiveGradeScale } from '../repositories/gradebookRepository.js';
import { getUniversitySettings } from '../repositories/settingsRepository.js';
import { listReasonCategories } from '../repositories/withdrawalRepository.js';


export async function getLookups(user) {
  await ensureAcademicCalendarYears();
  const deptsRes = await query(`SELECT * FROM departments ORDER BY name ASC`);
  const progsRes = await query(`SELECT * FROM programs WHERE status = 'active' ORDER BY name ASC`);
  const yearsRes = await query(`SELECT * FROM academic_years ORDER BY start_date DESC`);
  const semsRes = await query(`
    SELECT s.*,
           json_build_object('id', ay.id, 'name', ay.name, 'startDate', ay.start_date, 'endDate', ay.end_date) as academic_year
    FROM semesters s
    JOIN academic_years ay ON ay.id = s.academic_year_id
    ORDER BY s.sort_order DESC
  `);
  const currentSemester = await getCurrentSemester();
  const scale = await getActiveGradeScale();
  const policy = await getAcademicPolicy();
  const excRes = await query(`SELECT course_id FROM policy_excluded_courses`);
  policy.excludedCourseIds = excRes.rows.map((r) => r.course_id);

  const university = await getUniversitySettings();
  const rolesRes = await query(`SELECT id, name, description FROM roles ORDER BY id ASC`);
  const categories = await listReasonCategories();
  const regTypesRes = await query(
    `SELECT id, label, description
     FROM registration_types
     WHERE is_active = true
     ORDER BY CASE id
       WHEN 'regular' THEN 1
       WHEN 'extension' THEN 2
       WHEN 'weekend' THEN 3
       ELSE 4
     END ASC`
  );

  const assessmentTypes = [
    { value: 'assignment', label: 'Assignment' },
    { value: 'quiz', label: 'Quiz' },
    { value: 'midterm', label: 'Midterm Exam' },
    { value: 'final', label: 'Final Exam' },
    { value: 'practical', label: 'Practical Exam' },
    { value: 'project', label: 'Project' },
  ];

  const programTypes = ['regular', 'extension', 'weekend'];

  const lookups = {
    departments: deptsRes.rows,
    programs: progsRes.rows,
    academicYears: yearsRes.rows,
    semesters: semsRes.rows,
    currentSemester,
    gradeScale: scale.entries,
    policy,
    university,
    roles: rolesRes.rows,
    assessmentTypes,
    programTypes,
    registrationTypes: regTypesRes.rows,
    withdrawalReasonCategories: categories,
  };

  // Add courses, teachers, students for admin and dept_head
  if (user?.roleId === 'admin') {
    const { listCourses } = await import('../repositories/courseRepository.js');
    const { listTeachers, listStudents } = await import('../repositories/userRepository.js');
    lookups.courses = await listCourses();
    lookups.teachers = await listTeachers({ currentSemesterId: currentSemester?.id });
    const studentsRes = await listStudents({ status: 'active', pageSize: 'all' });
    lookups.students = studentsRes.items;
  } else if (user?.roleId === 'dept_head' && user?.departmentId) {
    const { listCourses } = await import('../repositories/courseRepository.js');
    const { listTeachers, listStudents } = await import('../repositories/userRepository.js');
    lookups.courses = await listCourses({ departmentId: user.departmentId });
    lookups.teachers = await listTeachers({ departmentId: user.departmentId, currentSemesterId: currentSemester?.id });
    const studentsRes = await listStudents({ departmentId: user.departmentId, status: 'active', pageSize: 'all' });
    lookups.students = studentsRes.items;
  }

  return lookups;
}

export async function getDepartments() {
  return await lookupRepo.getDepartmentsLookup();
}

export async function getSemesters() {
  return await lookupRepo.getSemestersLookup();
}

export async function getAcademicYears() {
  return await lookupRepo.getAcademicYearsLookup();
}

export async function getPrograms(departmentId = null) {
  return await lookupRepo.getProgramsLookup(departmentId);
}

export async function getTeachers(departmentId = null) {
  return await lookupRepo.getTeachersLookup(departmentId);
}

export async function getWithdrawalReasons() {
  return await listReasonCategories();
}

