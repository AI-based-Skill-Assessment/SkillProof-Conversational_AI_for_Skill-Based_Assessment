/**
 * utils/formatDate.js
 * Date formatting utilities.
 */

const DATE_OPTS = { year: 'numeric', month: 'short', day: 'numeric' };
const DATETIME_OPTS = { ...DATE_OPTS, hour: '2-digit', minute: '2-digit' };

/**
 * Format ISO date string → "Nov 20, 2024"
 */
export function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', DATE_OPTS);
  } catch {
    return '—';
  }
}

/**
 * Format ISO date string → "Nov 20, 2024, 11:30 AM"
 */
export function formatDateTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-US', DATETIME_OPTS);
  } catch {
    return '—';
  }
}

/**
 * Format ISO date string → relative time ("2 days ago", "just now")
 */
export function formatRelative(iso) {
  if (!iso) return '—';
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days  = Math.floor(diff / 86400000);
    if (mins < 1)    return 'just now';
    if (mins < 60)   return `${mins}m ago`;
    if (hours < 24)  return `${hours}h ago`;
    if (days < 7)    return `${days}d ago`;
    return formatDate(iso);
  } catch {
    return '—';
  }
}

/**
 * Format seconds → "MM:SS"
 */
export function formatDuration(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}
