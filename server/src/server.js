import app from './app.js';
import { env } from './config/env.js';
import { pool } from './config/database.js';

const PORT = env.PORT;

async function startServer() {
  try {
    // Verify database connectivity
    const client = await pool.connect();
    const res = await client.query('SELECT current_database(), current_user, version()');
    client.release();

    console.log(`[Database] Connected successfully to "${res.rows[0].current_database}" as user "${res.rows[0].current_user}"`);

    app.listen(PORT, () => {
      console.log(`[Server] University Grading & Registration API running on http://localhost:${PORT}`);
      console.log(`[Server] Environment: ${env.NODE_ENV}`);
    });
  } catch (err) {
    console.error('[Server] Failed to connect to database or start server:', err);
    process.exit(1);
  }
}

startServer();
