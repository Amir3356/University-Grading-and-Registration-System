/**
 * Application-level metadata, environment flags, and global UI defaults.
 */

export const APP_CONFIG = {
  name: 'University Grading and Registration System',
  shortName: 'UGS',
  version: '1.0.0',
  environment: import.meta.env.MODE || 'development',
  isProduction: Boolean(import.meta.env.PROD),
  isDevelopment: Boolean(import.meta.env.DEV),
  defaultLanguage: 'en',
  dateFormat: 'YYYY-MM-DD',
  timeFormat: 'HH:mm:ss',
  dateTimeFormat: 'YYYY-MM-DD HH:mm',
  toastDuration: 3000,
  defaultPageSize: 20,
};

export default APP_CONFIG;
