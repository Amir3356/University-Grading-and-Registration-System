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

/**
 * Notify all browser tabs and components that user/student info (e.g. ID, program type) has been updated.
 */
export function notifyUserChange(detail = {}) {
  if (typeof window === 'undefined') return;

  try {
    window.dispatchEvent(new CustomEvent('ugs_user_changed', { detail: { ...detail, timestamp: Date.now() } }));
  } catch {}

  try {
    channel?.postMessage({ type: 'ugs_user_changed', ...detail, timestamp: Date.now() });
  } catch {}

  try {
    localStorage.setItem('ugs_user_event', JSON.stringify({ ...detail, timestamp: Date.now() }));
  } catch {}
}

/**
 * Listen for user updates across tabs, windows, and local actions.
 * @param {(detail?: any) => void} callback
 * @returns {() => void} Unsubscribe function
 */
export function onUserChange(callback) {
  if (typeof window === 'undefined' || typeof callback !== 'function') return () => {};

  const handleEvent = (e) => {
    callback(e.detail);
  };

  window.addEventListener('ugs_user_changed', handleEvent);

  const handleMessage = (e) => {
    if (e.data?.type === 'ugs_user_changed') {
      callback(e.data);
    }
  };
  channel?.addEventListener('message', handleMessage);

  const handleStorage = (e) => {
    if (e.key === 'ugs_user_event') {
      try {
        const parsed = JSON.parse(e.newValue || '{}');
        callback(parsed);
      } catch {
        callback();
      }
    }
  };
  window.addEventListener('storage', handleStorage);

  return () => {
    window.removeEventListener('ugs_user_changed', handleEvent);
    channel?.removeEventListener('message', handleMessage);
    window.removeEventListener('storage', handleStorage);
  };
}

/**
 * Notify all browser tabs and components that a semester registration has changed (created, updated, deleted, reviewed).
 */
export function notifyRegistrationChange(detail = {}) {
  if (typeof window === 'undefined') return;

  try {
    window.dispatchEvent(new CustomEvent('ugs_registration_changed', { detail: { ...detail, timestamp: Date.now() } }));
  } catch {}

  try {
    channel?.postMessage({ type: 'ugs_registration_changed', ...detail, timestamp: Date.now() });
  } catch {}

  try {
    localStorage.setItem('ugs_registration_event', JSON.stringify({ ...detail, timestamp: Date.now() }));
  } catch {}
}

/**
 * Listen for semester registration changes across tabs, windows, and local actions.
 * @param {(detail?: any) => void} callback
 * @returns {() => void} Unsubscribe function
 */
export function onRegistrationChange(callback) {
  if (typeof window === 'undefined' || typeof callback !== 'function') return () => {};

  const handleEvent = (e) => {
    callback(e.detail);
  };

  window.addEventListener('ugs_registration_changed', handleEvent);

  const handleMessage = (e) => {
    if (e.data?.type === 'ugs_registration_changed') {
      callback(e.data);
    }
  };
  channel?.addEventListener('message', handleMessage);

  const handleStorage = (e) => {
    if (e.key === 'ugs_registration_event') {
      try {
        const parsed = JSON.parse(e.newValue || '{}');
        callback(parsed);
      } catch {
        callback();
      }
    }
  };
  window.addEventListener('storage', handleStorage);

  return () => {
    window.removeEventListener('ugs_registration_changed', handleEvent);
    channel?.removeEventListener('message', handleMessage);
    window.removeEventListener('storage', handleStorage);
  };
}

