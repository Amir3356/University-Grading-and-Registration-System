import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import app from './app.js';
import { pool } from './config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config();

const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

async function startServer() {
  try {
    // Verify database connectivity
    const client = await pool.connect();
    const res = await client.query('SELECT current_database(), current_user, version()');
    client.release();

    console.log(`[Database] Connected successfully to "${res.rows[0].current_database}" as user "${res.rows[0].current_user}"`);

    app.listen(PORT, () => {
      console.log(`[Server] University Grading & Registration API running on http://localhost:${PORT}`);
      console.log(`[Server] Environment: ${NODE_ENV}`);
    });
  } catch (err) {
    console.error('[Server] Failed to connect to database or start server:', err);
    process.exit(1);
  }
}

startServer();
