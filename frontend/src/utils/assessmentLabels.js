/**
 * Human-readable labels for assessment status and verdict values coming from
 * the backend. Wording matches the candidate's Reports page.
 */

export function statusLabel(status) {
  if (status === 'scored' || status === 'completed') return 'Completed';
  if (status === 'ocr_done' || status === 'verified') return 'Ready for Interview';
  if (status === 'interview_done') return 'Scoring';
  if (status === 'failed') return 'Failed';
  if (!status) return 'No assessments';
  return 'Verifying';
}

export function statusVariant(status) {
  if (status === 'scored' || status === 'completed') return 'success';
  if (status === 'ocr_done' || status === 'verified') return 'warning';
  if (status === 'failed') return 'error';
  if (!status) return 'neutral';
  return 'info';
}

export function verdictLabel(verdict) {
  switch (verdict) {
    case 'verified':          return 'Verified';
    case 'suspicious':        return 'Suspicious';
    case 'likely_fraudulent': return 'Likely fraudulent';
    default:                  return 'Not scored';
  }
}
