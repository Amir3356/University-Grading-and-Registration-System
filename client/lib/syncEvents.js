const CHANNEL_NAME = 'ugs_registration_events';

let channel = null;
if (typeof window !== 'undefined' && typeof window.BroadcastChannel === 'function') {
  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
  } catch {
    channel = null;
  }
}

/**
 * Notify all browser tabs and components that a registration period has changed.
 */
export function notifyPeriodChange() {
  if (typeof window === 'undefined') return;

  // 1. Same-window custom event
  try {
    window.dispatchEvent(new CustomEvent('ugs_period_changed', { detail: { timestamp: Date.now() } }));
  } catch {}

  // 2. BroadcastChannel for cross-tab communication
  try {
    channel?.postMessage({ type: 'ugs_period_changed', timestamp: Date.now() });
  } catch {}

  // 3. LocalStorage event fallback
  try {
    localStorage.setItem('ugs_period_event', Date.now().toString());
  } catch {}
}

/**
 * Listen for registration period changes across tabs, windows, and local actions.
 * @param {() => void} callback
 * @returns {() => void} Unsubscribe function
 */
export function onPeriodChange(callback) {
  if (typeof window === 'undefined' || typeof callback !== 'function') return () => {};

  const handleEvent = () => {
    callback();
  };

  // Same-window listener
  window.addEventListener('ugs_period_changed', handleEvent);

  // BroadcastChannel listener
  const handleMessage = (e) => {
    if (e.data?.type === 'ugs_period_changed') {
      callback();
    }
  };
  channel?.addEventListener('message', handleMessage);

  // Cross-tab storage fallback listener
  const handleStorage = (e) => {
    if (e.key === 'ugs_period_event') {
      callback();
    }
  };
  window.addEventListener('storage', handleStorage);

  return () => {
    window.removeEventListener('ugs_period_changed', handleEvent);
    channel?.removeEventListener('message', handleMessage);
    window.removeEventListener('storage', handleStorage);
  };
}
