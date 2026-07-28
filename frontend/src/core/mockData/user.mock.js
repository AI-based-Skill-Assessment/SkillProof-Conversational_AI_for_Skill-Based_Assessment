/**
 * core/mockData/user.mock.js
 * Realistic mock data for the user/candidate portal.
 * Used when backend returns no data or is unavailable.
 */

export const MOCK_USER = {
  id: 'mock-user-001',
  full_name: 'Arjun Sharma',
  email: 'arjun.sharma@example.com',
  is_google_auth: false,
  email_verified: true,
  face_registered: true,
  voice_registered: true,
  account_type: 'individual',
  profile_picture_url: null,
  is_active: true,
  created_at: '2024-11-15T10:30:00Z',
};

export const MOCK_SESSIONS = [
  {
    id: 'session-001',
    intake_mode: 'certificate',
    candidate_name: 'Arjun Sharma',
    candidate_email: 'arjun.sharma@example.com',
    certificate_filename: 'internship_certificate.pdf',
    extracted_company: 'Infosys Limited',
    extracted_role: 'Software Development Intern',
    extracted_skills: ['React', 'Node.js', 'PostgreSQL', 'REST APIs'],
    status: 'scored',
    created_at: '2024-11-20T09:00:00Z',
    updated_at: '2024-11-20T11:30:00Z',
    scores: [{
      overall_skill_score: 82,
      specificity_score: 78,
      depth_score: 85,
      consistency_score: 83,
      verdict: 'verified',
      llm_reasoning: 'Candidate demonstrated strong practical knowledge of React hooks, component lifecycle, and state management. Node.js API design was accurate. Minor gaps in advanced PostgreSQL query optimization.',
    }],
  },
  {
    id: 'session-002',
    intake_mode: 'skill_only',
    candidate_name: 'Arjun Sharma',
    candidate_email: 'arjun.sharma@example.com',
    certificate_filename: null,
    extracted_company: null,
    extracted_role: 'Python Developer',
    extracted_skills: ['Python', 'Machine Learning', 'Data Analysis'],
    status: 'interview_done',
    created_at: '2024-12-01T14:00:00Z',
    updated_at: '2024-12-01T15:00:00Z',
    scores: [],
  },
  {
    id: 'session-003',
    intake_mode: 'certificate',
    candidate_name: 'Arjun Sharma',
    candidate_email: 'arjun.sharma@example.com',
    certificate_filename: 'aws_certification.pdf',
    extracted_company: 'Amazon Web Services',
    extracted_role: 'Cloud Practitioner',
    extracted_skills: ['AWS', 'Cloud Architecture', 'S3', 'EC2', 'Lambda'],
    status: 'ocr_done',
    created_at: '2024-12-10T08:00:00Z',
    updated_at: '2024-12-10T08:05:00Z',
    scores: [],
  },
];

export const MOCK_REPORT = {
  session_id: 'session-001',
  candidate: {
    name: 'Arjun Sharma',
    email: 'arjun.sharma@example.com',
  },
  assessment: {
    intake_mode: 'certificate',
    certificate: 'Software Development Intern — Infosys Limited',
    date: '2024-11-20',
    skills: ['React', 'Node.js', 'PostgreSQL', 'REST APIs'],
    role: 'Software Development Intern',
    company: 'Infosys Limited',
  },
  score: {
    overall: 82,
    specificity: 78,
    depth: 85,
    consistency: 83,
    verdict: 'verified',
  },
  document_verification: {
    status: 'verified',
    path: 'url_fetch',
    score: 90,
  },
  biometric: {
    face_verified: true,
    voice_verified: true,
    integrity_score: 100,
    violations: 0,
  },
  ai_summary: 'Candidate demonstrated strong practical knowledge of React hooks, component lifecycle, and state management. Node.js API design was accurate and well-structured. Minor gaps identified in advanced PostgreSQL query optimization, but overall technical depth is solid. Skill set is consistent with the internship role described in the certificate.',
  strengths: ['React component architecture', 'REST API design', 'Database schema design'],
  improvements: ['Advanced SQL query optimization', 'System design at scale'],
  qr_verification_id: 'SP-82AB-9F3C-2024',
  created_at: '2024-11-20T11:30:00Z',
};

export const MOCK_CERTIFICATES = [
  {
    id: 'cert-001',
    title: 'Verified Skill Certificate — React & Node.js',
    issued_to: 'Arjun Sharma',
    score: 82,
    verdict: 'verified',
    skills: ['React', 'Node.js', 'PostgreSQL'],
    issued_at: '2024-11-20',
    qr_id: 'SP-82AB-9F3C-2024',
  },
];

export const MOCK_DASHBOARD_STATS = {
  completed_assessments: 3,
  verified_certificates: 1,
  average_skill_score: 82,
  shared_organisations: 1,
};

export const MOCK_NOTIFICATIONS = [
  {
    id: 'notif-001',
    category: 'assessment',
    title: 'Assessment Report Ready',
    message: 'Your React & Node.js skill assessment has been completed. Score: 82/100.',
    is_read: false,
    created_at: '2024-11-20T11:31:00Z',
  },
  {
    id: 'notif-002',
    category: 'organisation',
    title: 'Organisation Connected',
    message: 'TechCorp Solutions has confirmed your connection request.',
    is_read: true,
    created_at: '2024-11-25T09:00:00Z',
  },
];

export const MOCK_ORGANISATIONS_CONNECTED = [
  {
    id: 'org-001',
    name: 'TechCorp Solutions Pvt Ltd',
    org_type: 'company',
    status: 'approved',
    reports_shared: 1,
    connected_at: '2024-11-25',
    logo_url: null,
  },
];
