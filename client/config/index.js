/**
 * Central configuration index for the client application.
 * Exposes API settings, app metadata, constants, grading rules, and navigation.
 */

export * from './api.config';
export * from './app.config';
export * from './constants';
export * from './grading.config';
export * from './navigation.config';

import { API_CONFIG } from './api.config';
import { APP_CONFIG } from './app.config';
import * as CONSTANTS from './constants';
import * as GRADING_CONFIG from './grading.config';
import { NAVIGATION, HOME_BY_ROLE } from './navigation.config';

export const config = {
  app: APP_CONFIG,
  api: API_CONFIG,
  constants: CONSTANTS,
  grading: GRADING_CONFIG,
  navigation: {
    routes: NAVIGATION,
    homeByRole: HOME_BY_ROLE,
  },
};

export default config;
