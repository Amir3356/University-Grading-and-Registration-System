import { useEffect, useRef } from 'react';

class WebSocketClient {
  constructor() {
    this.ws = null;
    this.subscribers = new Map();
    this.reconnectTimeout = null;
    this.reconnectInterval = 2000;
    this.isExplicitlyClosed = false;
  }

  getWebSocketUrl() {
    if (typeof window === 'undefined') return '';
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Use current host (via Vite proxy /ws) or direct port 5000 fallback
    return `${protocol}//${window.location.host}/ws`;
  }

  connect() {
    if (typeof window === 'undefined') return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      const url = this.getWebSocketUrl();
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log('[WebSocket Client] Connected to UGS real-time server');
        this.reconnectInterval = 2000;
        // Periodic keep-alive ping
        this.pingTimer = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 25000);
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type && data.type !== 'pong' && data.type !== 'CONNECTED') {
            const callbacks = this.subscribers.get(data.type);
            if (callbacks) {
              callbacks.forEach((cb) => {
                try {
                  cb(data.payload);
                } catch (err) {
                  console.error(`[WebSocket Client] Error in handler for ${data.type}:`, err);
                }
              });
            }
          }
        } catch {}
      };

      this.ws.onclose = () => {
        clearInterval(this.pingTimer);
        if (!this.isExplicitlyClosed) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (err) => {
        console.warn('[WebSocket Client] Connection error, will attempt reconnect...');
        this.ws?.close();
      };
    } catch (err) {
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectInterval = Math.min(this.reconnectInterval * 1.5, 10000);
      this.connect();
    }, this.reconnectInterval);
  }

  subscribe(eventType, callback) {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Set());
    }
    this.subscribers.get(eventType).add(callback);

    // Ensure connection is active
    this.connect();

    return () => {
      const set = this.subscribers.get(eventType);
      if (set) {
        set.delete(callback);
        if (set.size === 0) {
          this.subscribers.delete(eventType);
        }
      }
    };
  }
}

export const wsClient = new WebSocketClient();

/**
 * React hook to listen for real-time WebSocket events
 * @param {string} eventType e.g. 'PERIOD_CHANGED'
 * @param {(payload: any) => void} handler
 */
export function useWebSocketEvent(eventType, handler) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const unsubscribe = wsClient.subscribe(eventType, (payload) => {
      handlerRef.current?.(payload);
    });
    return unsubscribe;
  }, [eventType]);
}
