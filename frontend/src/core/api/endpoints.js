/**
 * core/api/endpoints.js
 * All API endpoint path constants. Import instead of hardcoding strings.
 */

export const EP = {
  // ── Auth ──────────────────────────────────────────────────────────────────
  AUTH: {
    USER_REGISTER:    '/auth/user/register',
    USER_LOGIN:       '/auth/user/login',
    USER_REFRESH:     '/auth/user/refresh',
    ORG_REGISTER:     '/auth/org/register',
    ORG_LOGIN:        '/auth/org/login',
    ADMIN_LOGIN:      '/auth/admin/login',
    ADMIN_2FA:        '/auth/admin/2fa',
    ADMIN_GOOGLE_VERIFY: '/auth/admin/google/verify',
    ME:               '/auth/me',
    ORG_ME:           '/auth/org/me',
    ADMIN_ME:         '/auth/admin/me',
    ORGS_SEARCH:      '/auth/orgs/search',
    CHANGE_PASSWORD:  '/auth/me/change-password',
  },

  // ── Assessment pipeline ───────────────────────────────────────────────────
  INGEST:         '/ingest',
  VERIFY:         (sessionId) => `/verify/${sessionId}`,
  SCORE:          (sessionId) => `/score/${sessionId}`,

  // ── Interview ─────────────────────────────────────────────────────────────
  INTERVIEW_WS:   (sessionId) => `/interview/${sessionId}`,

  // ── Biometrics ────────────────────────────────────────────────────────────
  BIOMETRIC: {
    REGISTER:        '/biometric/register',
    CHECK_DUPLICATE: '/biometric/check-duplicate',
    VERIFY:          '/biometric/verify',
    INTERVIEW_VERIFY:'/biometric/interview-verify',
  },

  // ── Admin management ──────────────────────────────────────────────────────
  ADMIN: {
    STATS:         '/admin/stats',
    ORGS:          '/admin/organisations',
    ORG:           (id) => `/admin/organisations/${id}`,
    ORG_APPROVE:   (id) => `/admin/organisations/${id}/approve`,
    ORG_REJECT:    (id) => `/admin/organisations/${id}/reject`,
    ORG_SUSPEND:   (id) => `/admin/organisations/${id}/suspend`,
    ORG_REACTIVATE:(id) => `/admin/organisations/${id}/reactivate`,
    USERS:         '/admin/users',
    USER:          (id) => `/admin/users/${id}`,
    ASSESSMENTS:   '/admin/assessments',
    ACTIVITY:      '/admin/activity',
  },
};

export default EP;
