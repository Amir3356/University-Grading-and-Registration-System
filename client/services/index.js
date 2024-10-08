import * as authService from './authService';
import * as gradeService from './gradeService';
import * as userService from './userService';
import * as academicService from './academicService';
import * as offeringService from './offeringService';
import * as withdrawalService from './withdrawalService';
import * as studentService from './studentService';
import * as teacherService from './teacherService';
import * as reportService from './reportService';
import * as exportService from './exportService';
import * as notificationService from './notificationService';

export {
  authService,
  gradeService,
  userService,
  academicService,
  offeringService,
  withdrawalService,
  studentService,
  teacherService,
  reportService,
  exportService,
  notificationService,
};

export const services = {
  auth: authService,
  grades: gradeService,
  users: userService,
  academics: academicService,
  offerings: offeringService,
  withdrawals: withdrawalService,
  student: studentService,
  teacher: teacherService,
  reports: reportService,
  export: exportService,
  notifications: notificationService,
};

export default services;

export * from './authService';
export * from './gradeService';
export * from './userService';
export * from './academicService';
export * from './offeringService';
export * from './withdrawalService';
export * from './studentService';
export * from './teacherService';
export * from './reportService';
export * from './exportService';
export * from './notificationService';
