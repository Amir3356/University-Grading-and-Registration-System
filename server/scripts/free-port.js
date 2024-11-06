/**
 * Frees the configured PORT before starting the dev server.
 *
 * Prevents the common "Port 5000 is already in use" crash caused by a
 * previous nodemon/node instance that stayed alive after its terminal
 * was closed (orphaned process).
 *
 * Runs automatically via the "predev" npm script. Safe to run manually:
 *   node scripts/free-port.js
 */
import { execSync } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const PORT = Number(process.env.PORT) || 5000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Check whether the port can be bound the same way server.js binds it.
 */
function isPortFree(port) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.unref();
    probe.once('error', () => resolve(false));
    probe.once('listening', () => probe.close(() => resolve(true)));
    probe.listen(port);
  });
}

/**
 * Return PIDs listening on the given port (Linux/macOS).
 */
function findListeningPids(port) {
  try {
    const output = execSync(`lsof -ti tcp:${port}`, { encoding: 'utf8' });
    return [...new Set(output.split('\n').map((pid) => pid.trim()).filter(Boolean))];
  } catch {
    // lsof returns a non-zero exit code when nothing matches.
    return [];
  }
}

function isAlive(pid) {
  try {
    process.kill(Number(pid), 0);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (await isPortFree(PORT)) return;

  if (process.platform === 'win32') {
    console.warn(
      `[predev] Port ${PORT} is in use. Close the other process manually ` +
        `(e.g. "netstat -ano | findstr :${PORT}" then "taskkill /PID <pid> /F").`
    );
    process.exit(1);
  }

  const pids = findListeningPids(PORT);
  if (pids.length === 0) {
    console.warn(`[predev] Port ${PORT} is in use but no owning process could be found.`);
    process.exit(1);
  }

  console.log(`[predev] Port ${PORT} is in use by PID(s): ${pids.join(', ')}. Stopping them...`);

  for (const pid of pids) {
    try {
      process.kill(Number(pid), 'SIGTERM');
    } catch {
      // Already gone.
    }
  }

  // Give processes a moment to shut down gracefully.
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (pids.every((pid) => !isAlive(pid))) break;
    await sleep(100);
  }

  for (const pid of pids) {
    if (isAlive(pid)) {
      try {
        process.kill(Number(pid), 'SIGKILL');
      } catch {
        // Already gone.
      }
    }
  }

  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (await isPortFree(PORT)) {
      console.log(`[predev] Port ${PORT} is free. Starting server...`);
      return;
    }
    await sleep(100);
  }

  console.error(`[predev] Could not free port ${PORT}. Stop the process manually and retry.`);
  process.exit(1);
}

main().catch((err) => {
  console.error('[predev] Failed to free port:', err.message);
  process.exit(1);
});
