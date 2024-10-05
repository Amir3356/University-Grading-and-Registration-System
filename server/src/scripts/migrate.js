import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  console.log('--- Running database migrations ---');
  const sqlFile = path.resolve(__dirname, '../../migrations/001_initial_schema.sql');
  const sql = fs.readFileSync(sqlFile, 'utf-8');

  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log('Migration 001_initial_schema.sql applied successfully!');
  } finally {
    client.release();
  }
}

if (process.argv[1] && process.argv[1].endsWith('migrate.js')) {
  runMigrations()
    .then(() => pool.end())
    .catch((err) => {
      console.error('Migration failed:', err);
      pool.end();
      process.exit(1);
    });
}
