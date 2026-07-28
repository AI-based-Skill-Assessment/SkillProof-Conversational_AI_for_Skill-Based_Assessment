/**
 * core/constants.js
 * Platform-wide enums, config values, and skill lists.
 */

// ── Session / Assessment statuses ──────────────────────────────────────────────
export const SESSION_STATUS = {
  PENDING:          'pending',
  OCR_DONE:         'ocr_done',
  VERIFIED:         'verified',
  INTERVIEW_DONE:   'interview_done',
  SCORED:           'scored',
  FAILED:           'failed',
};

export const SESSION_STATUS_LABELS = {
  pending:        'Processing',
  ocr_done:       'Ready for Interview',
  verified:       'Verified',
  interview_done: 'Interview Complete',
  scored:         'Completed',
  failed:         'Failed',
};

export const SESSION_STATUS_VARIANT = {
  pending:        'info',
  ocr_done:       'warning',
  verified:       'info',
  interview_done: 'warning',
  scored:         'success',
  failed:         'error',
};

// ── Intake modes ───────────────────────────────────────────────────────────────
export const INTAKE_MODE = {
  CERTIFICATE: 'certificate',
  SKILL_ONLY:  'skill_only',
};

// ── Skill verdict ──────────────────────────────────────────────────────────────
export const VERDICT = {
  VERIFIED:          'verified',
  SUSPICIOUS:        'suspicious',
  LIKELY_FRAUDULENT: 'likely_fraudulent',
};

export const VERDICT_LABELS = {
  verified:          'Verified',
  suspicious:        'Suspicious',
  likely_fraudulent: 'Likely Fraudulent',
};

export const VERDICT_VARIANT = {
  verified:          'success',
  suspicious:        'warning',
  likely_fraudulent: 'error',
};

// ── Organisation status ────────────────────────────────────────────────────────
export const ORG_STATUS = {
  PENDING:   'pending',
  APPROVED:  'approved',
  REJECTED:  'rejected',
  SUSPENDED: 'suspended',
};

// ── Skill categories ───────────────────────────────────────────────────────────
export const SKILL_CATEGORIES = [
  {
    label: 'Programming Languages',
    skills: ['Python', 'Java', 'JavaScript', 'TypeScript', 'C', 'C++', 'Go', 'Rust', 'Swift', 'Kotlin'],
  },
  {
    label: 'Web Development',
    skills: ['React', 'Vue.js', 'Angular', 'Next.js', 'Node.js', 'Express.js', 'Django', 'FastAPI', 'Spring Boot', 'HTML/CSS'],
  },
  {
    label: 'Data & AI',
    skills: ['Machine Learning', 'Deep Learning', 'Data Analysis', 'SQL', 'Data Structures', 'Algorithms', 'NLP', 'Computer Vision'],
  },
  {
    label: 'DevOps & Cloud',
    skills: ['Docker', 'Kubernetes', 'AWS', 'Azure', 'GCP', 'CI/CD', 'Linux', 'Git'],
  },
  {
    label: 'Mobile',
    skills: ['React Native', 'Flutter', 'Android', 'iOS', 'Kotlin', 'Swift'],
  },
  {
    label: 'Databases',
    skills: ['PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch', 'Cassandra'],
  },
];

// Flat list of all skills
export const ALL_SKILLS = SKILL_CATEGORIES.flatMap(c => c.skills);

// ── Experience levels ──────────────────────────────────────────────────────────
export const EXPERIENCE_LEVELS = [
  { value: 'beginner',     label: 'Beginner',     desc: '0–1 years' },
  { value: 'intermediate', label: 'Intermediate', desc: '1–3 years' },
  { value: 'advanced',     label: 'Advanced',     desc: '3+ years' },
];

// ── API base URL ───────────────────────────────────────────────────────────────
export const API_BASE_URL = '/api/v1';
export const WS_BASE_URL  = `ws://${window.location.hostname}:8000/api/v1`;

// ── Notification categories ────────────────────────────────────────────────────
export const NOTIFICATION_CATEGORY = {
  ASSESSMENT:   'assessment',
  REPORT:       'report',
  ORGANISATION: 'organisation',
  SECURITY:     'security',
  SYSTEM:       'system',
};

// ── Upload limits ──────────────────────────────────────────────────────────────
export const UPLOAD_MAX_SIZE_MB  = 10;
export const UPLOAD_ACCEPTED_EXT = ['pdf', 'jpg', 'jpeg', 'png'];
