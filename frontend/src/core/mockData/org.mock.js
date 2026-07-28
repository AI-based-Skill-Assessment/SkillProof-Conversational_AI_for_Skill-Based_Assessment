/**
 * core/mockData/org.mock.js
 * Realistic mock data for the organisation portal.
 */

export const MOCK_ORG = {
  id: 'org-mock-001',
  name: 'National Institute of Technology, Trichy',
  email: 'placement@nitt.edu',
  org_type: 'university',
  contact_name: 'Dr. Ramesh Kumar',
  contact_phone: '+91-9876543210',
  website: 'https://www.nitt.edu',
  address: 'Tanjore Main Road, Tiruchirappalli, Tamil Nadu 620015',
  logo_url: null,
  status: 'approved',
  total_candidates: 47,
  created_at: '2024-10-01T10:00:00Z',
};

export const MOCK_CANDIDATES = [
  {
    id: 'cand-001',
    full_name: 'Arjun Sharma',
    email: 'arjun.sharma@example.com',
    connected_at: '2024-11-25',
    reports_shared: 2,
    assessments_count: 3,
    average_score: 82,
    face_registered: true,
    voice_registered: true,
    latest_status: 'verified',
  },
  {
    id: 'cand-002',
    full_name: 'Priya Nair',
    email: 'priya.nair@example.com',
    connected_at: '2024-11-28',
    reports_shared: 1,
    assessments_count: 1,
    average_score: 74,
    face_registered: true,
    voice_registered: true,
    latest_status: 'scored',
  },
  {
    id: 'cand-003',
    full_name: 'Rohan Mehta',
    email: 'rohan.mehta@example.com',
    connected_at: '2024-12-01',
    reports_shared: 0,
    assessments_count: 2,
    average_score: 91,
    face_registered: true,
    voice_registered: false,
    latest_status: 'interview_done',
  },
  {
    id: 'cand-004',
    full_name: 'Sneha Iyer',
    email: 'sneha.iyer@example.com',
    connected_at: '2024-12-05',
    reports_shared: 1,
    assessments_count: 1,
    average_score: 68,
    face_registered: true,
    voice_registered: true,
    latest_status: 'scored',
  },
];

export const MOCK_ORG_STATS = {
  total_candidates: 47,
  verified_assessments: 38,
  pending_assessments: 9,
  average_skill_score: 76,
};

export const MOCK_ORG_REPORTS = [
  {
    id: 'rpt-001',
    candidate_name: 'Arjun Sharma',
    candidate_email: 'arjun.sharma@example.com',
    assessment_type: 'certificate',
    skill: 'React & Node.js',
    score: 82,
    verdict: 'verified',
    shared_at: '2024-11-25',
  },
  {
    id: 'rpt-002',
    candidate_name: 'Priya Nair',
    candidate_email: 'priya.nair@example.com',
    assessment_type: 'skill_only',
    skill: 'Machine Learning',
    score: 74,
    verdict: 'verified',
    shared_at: '2024-11-30',
  },
  {
    id: 'rpt-003',
    candidate_name: 'Sneha Iyer',
    candidate_email: 'sneha.iyer@example.com',
    assessment_type: 'certificate',
    skill: 'Java Spring Boot',
    score: 68,
    verdict: 'suspicious',
    shared_at: '2024-12-08',
  },
];

export const MOCK_ANALYTICS = {
  verification_distribution: [
    { label: 'Verified', value: 38, color: 'var(--success)' },
    { label: 'Suspicious', value: 6,  color: 'var(--warning)' },
    { label: 'Pending',  value: 3,  color: 'var(--info)' },
  ],
  completion_trend: [
    { month: 'Sep', count: 4 },
    { month: 'Oct', count: 8 },
    { month: 'Nov', count: 16 },
    { month: 'Dec', count: 19 },
  ],
  top_skills: [
    { skill: 'React', count: 14 },
    { skill: 'Python', count: 11 },
    { skill: 'Java', count: 9 },
    { skill: 'Node.js', count: 7 },
    { skill: 'SQL', count: 6 },
  ],
};
