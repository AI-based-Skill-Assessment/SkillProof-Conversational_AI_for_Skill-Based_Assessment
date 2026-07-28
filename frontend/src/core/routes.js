/**
 * core/routes.js
 * Single source of truth for all route paths.
 * Import this file everywhere instead of hardcoding strings.
 */

export const ROUTES = {
  // ── Public ──────────────────────────────────────────────
  HOME:               '/',
  FOR_ORGANISATIONS:  '/for-organisations',
  HOW_IT_WORKS:       '/how-it-works',
  SECURITY:           '/security',

  // ── User (Candidate) Portal ──────────────────────────────
  USER: {
    SIGNIN:             '/user/signin',
    SIGNUP:             '/user/signup',
    FORGOT_PASSWORD:    '/user/forgot-password',
    VERIFY_EMAIL:       '/user/verify-email',
    FACE_REGISTRATION:  '/user/face-registration',
    VOICE_REGISTRATION: '/user/voice-registration',
    ACCOUNT_TYPE:       '/user/account-type',
    DASHBOARD:          '/user/dashboard',
    NEW_ASSESSMENT:     '/user/new-assessment',
    CERTIFICATE_ASSESSMENT: '/user/assessment/certificate',
    SKILL_ASSESSMENT:       '/user/assessment/skill',
    ASSESSMENT_REVIEW:  (id = ':id') => `/user/assessment/${id}/review`,
    INTERVIEW_CHECK:    (id = ':id') => `/user/interview/${id}/check`,
    INTERVIEW_SESSION:  (id = ':id') => `/user/interview/${id}`,
    INTERVIEW_PROCESSING: (id = ':id') => `/user/interview/${id}/processing`,
    REPORTS_LIST:       '/user/reports',
    REPORT_DETAIL:      (id = ':id') => `/user/reports/${id}`,
    CERTIFICATES:       '/user/certificates',
    ORGANIZATIONS:      '/user/organizations',
    PROFILE:            '/user/profile',
    SETTINGS:           '/user/settings',
    NOTIFICATIONS:      '/user/notifications',
  },

  // ── Organisation Portal ──────────────────────────────────
  ORG: {
    SIGNIN:           '/org/signin',
    SIGNUP:           '/org/signup',
    PENDING:          '/org/pending',
    GOOGLE_ONBOARD:   '/org/google-onboard',
    DASHBOARD:        '/org/dashboard',
    CANDIDATES:       '/org/candidates',
    CANDIDATE_DETAIL: (id = ':id') => `/org/candidates/${id}`,
    REPORTS_LIST:     '/org/reports',
    REPORT_DETAIL:    (id = ':id') => `/org/reports/${id}`,
    QR_VERIFY:        '/org/verify',
    ANALYTICS:        '/org/analytics',
    PROFILE:          '/org/profile',
    SETTINGS:         '/org/settings',
  },

  // ── Admin Portal ─────────────────────────────────────────
  ADMIN: {
    LOGIN:              '/admin/login',
    TWO_FACTOR:         '/admin/2fa',
    DASHBOARD:          '/admin/dashboard',
    ORGS_LIST:          '/admin/organizations',
    ORG_CREATE:         '/admin/organizations/new',
    ORG_DETAIL:         (id = ':id') => `/admin/organizations/${id}`,
    ORG_EDIT:           (id = ':id') => `/admin/organizations/${id}/edit`,
    USERS:              '/admin/users',
    ASSESSMENTS:        '/admin/assessments',
    REPORTS:            '/admin/reports',
    ACTIVITY:           '/admin/activity',
    SETTINGS:           '/admin/settings',
  },
};

export default ROUTES;
