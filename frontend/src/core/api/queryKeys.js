/**
 * core/api/queryKeys.js
 * TanStack Query key factory — keeps cache keys consistent across the app.
 */

export const QK = {
  // ── Auth ──────────────────────────────────────────────────────────────────
  me:               ['auth', 'me'],
  orgMe:            ['auth', 'org', 'me'],
  adminMe:          ['auth', 'admin', 'me'],
  orgsSearch:       (q) => ['orgs', 'search', q],

  // ── User data ─────────────────────────────────────────────────────────────
  userSessions:     (userId) => ['sessions', 'user', userId],
  session:          (id) => ['sessions', id],
  sessionVerify:    (id) => ['sessions', id, 'verify'],
  sessionScore:     (id) => ['sessions', id, 'score'],

  // ── Admin ─────────────────────────────────────────────────────────────────
  adminStats:       ['admin', 'stats'],
  adminOrgs:        (page) => ['admin', 'orgs', page],
  adminOrg:         (id)   => ['admin', 'orgs', id],
  adminUsers:       (page) => ['admin', 'users', page],
  adminAssessments: (page) => ['admin', 'assessments', page],
  adminActivity:    (page) => ['admin', 'activity', page],

  // ── Organisation ──────────────────────────────────────────────────────────
  orgCandidates:    (orgId) => ['org', orgId, 'candidates'],
  orgCandidate:     (orgId, userId) => ['org', orgId, 'candidate', userId],
  orgReports:       (orgId) => ['org', orgId, 'reports'],
};

export default QK;
