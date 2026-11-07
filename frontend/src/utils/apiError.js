/**
 * Turn an API (axios) error into a short, human-readable message.
 * Used instead of silently falling back to mock/demo data, so a backend
 * failure is visible rather than disguised as real numbers.
 */
export function apiErrorMessage(err, what = 'data') {
  if (!err?.response) {
    return `Could not load ${what}: the server is unreachable. Make sure the backend is running.`;
  }
  const detail = err.response.data?.detail;
  const reason = typeof detail === 'string' ? detail : `HTTP ${err.response.status}`;
  return `Could not load ${what}: ${reason}`;
}
