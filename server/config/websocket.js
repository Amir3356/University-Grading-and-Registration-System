import { WebSocketServer } from 'ws';

let wss = null;

/**
 * Initialize WebSocket Server attached to the HTTP server
 * @param {import('http').Server} server
 */
export function initWebSocketServer(server) {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    ws.isAlive = true;

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        }
      } catch {}
    });

    ws.on('error', (err) => {
      console.error('[WebSocket] Client error:', err.message);
    });

    // Send welcome / connected acknowledgment
    try {
      ws.send(JSON.stringify({ type: 'CONNECTED', message: 'WebSocket connected to UGS server' }));
    } catch {}
  });

  // Heartbeat ping interval to clean dead connections
  const interval = setInterval(() => {
    if (!wss) return;
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => {
    clearInterval(interval);
  });

  console.log('[WebSocket] Server listening on path /ws');
  return wss;
}

/**
 * Broadcast an event to all connected WebSocket clients
 * @param {string} type
 * @param {object} payload
 */
export function broadcastEvent(type, payload = {}) {
  if (!wss) return;
  const message = JSON.stringify({ type, payload, timestamp: Date.now() });
  for (const client of wss.clients) {
    if (client.readyState === 1) { // 1 = WebSocket.OPEN
      try {
        client.send(message);
      } catch (err) {
        console.error('[WebSocket] Send error:', err.message);
      }
    }
  }
}
