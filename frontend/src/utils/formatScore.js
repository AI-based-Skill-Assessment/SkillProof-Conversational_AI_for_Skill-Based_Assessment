/**
 * utils/formatScore.js
 * Score display helpers.
 */

/**
 * Format a 0–100 score with one decimal place.
 * Returns "—" if null/undefined.
 */
export function formatScore(score) {
  if (score == null) return '—';
  return Number(score).toFixed(1);
}

/**
 * Map a 0–100 score to a color token name.
 */
export function scoreColor(score) {
  if (score == null) return '#94a3b8';
  if (score >= 80)   return '#1F9D6C'; // Green
  if (score >= 60)   return '#C98A1E'; // Amber / Orange
  return '#D4483C'; // Red
}

/**
 * Map a 0–100 score to a label.
 */
export function scoreLabel(score) {
  if (score == null) return 'Not scored';
  if (score >= 85)   return 'Excellent';
  if (score >= 70)   return 'Good';
  if (score >= 55)   return 'Average';
  return 'Needs Improvement';
}

/**
 * Map a verdict string to a badge variant.
 */
export function verdictVariant(verdict) {
  switch (verdict) {
    case 'verified':          return 'success';
    case 'suspicious':        return 'warning';
    case 'likely_fraudulent': return 'error';
    default:                  return 'info';
  }
}
