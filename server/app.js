import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import apiRouter from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { helmetSecurity, sanitizeInputs } from './middleware/security.js';
import { apiRateLimiter } from './middleware/rateLimiter.js';
import { NotFoundError } from './utils/errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config();

const app = express();

// Security Guards & Core Middleware
app.use(helmetSecurity);
app.use(cors({
  origin: true,
  credentials: true,
}));

app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(sanitizeInputs);

// Global API Rate Limiter
app.use('/api', apiRateLimiter);


// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Mount API v1
app.use('/api/v1', apiRouter);

// 404 handler for unmatched routes
app.use((req, res, next) => {
  next(new NotFoundError(`Route ${req.method} ${req.originalUrl}`));
});

// Centralized error handling
app.use(errorHandler);

export default app;
