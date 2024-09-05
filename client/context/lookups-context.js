import { createContext, useContext } from 'react'

export const LookupsContext = createContext(null)

/**
 * Reference data: departments, semesters, academicYears, currentSemester,
 * gradeScale, policy, university, roles (+ courses, teachers for admins).
 */
export function useLookups() {
  return useContext(LookupsContext)
}
