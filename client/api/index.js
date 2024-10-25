import { api as httpClient } from './client';
import * as auth from './auth';
import * as users from './users';
import * as academics from './academics';
import * as offerings from './offerings';
import * as grades from './grades';
import * as registration from './registration';
import * as withdrawals from './withdrawals';
import * as student from './student';
import * as teacher from './teacher';
import * as notifications from './notifications';
import * as reports from './reports';
import * as lookups from './lookups';
import * as settings from './settings';

export {
  auth,
  users,
  academics,
  offerings,
  grades,
  registration,
  withdrawals,
  student,
  teacher,
  notifications,
  reports,
  lookups,
  settings,
};

export const api = {
  ...httpClient,
  auth,
  users,
  academics,
  offerings,
  grades,
  registration,
  withdrawals,
  student,
  teacher,
  notifications,
  reports,
  lookups,
  settings,
};

export default api;

export * from './client';
export * from './auth';
export * from './users';
export * from './academics';
export * from './offerings';
export * from './grades';
export * from './registration';
export * from './withdrawals';
export * from './student';
export * from './teacher';
export * from './notifications';
export * from './reports';
export * from './lookups';
export * from './settings';
