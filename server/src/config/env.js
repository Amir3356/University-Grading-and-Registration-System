import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const env = {
  PORT: process.env.PORT || 5000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  DB: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'university_grading',
  },
  JWT: {
    secret: process.env.JWT_SECRET || 'secret_jwt_access_key_university_grading',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'secret_jwt_refresh_key_university_grading',
    expiresIn: parseInt(process.env.JWT_EXPIRES_IN || '900', 10), // 15 mins
    refreshExpiresIn: parseInt(process.env.JWT_REFRESH_EXPIRES_IN || '604800', 10), // 7 days
  },
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
};
