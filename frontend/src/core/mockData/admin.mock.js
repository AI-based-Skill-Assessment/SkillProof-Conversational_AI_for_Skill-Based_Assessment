/**
 * core/mockData/admin.mock.js
 * Realistic mock data for the admin portal.
 */

export const MOCK_ADMIN_STATS = {
  total_organisations: 23,
  active_organisations: 17,
  pending_approval: 4,
  suspended_organisations: 2,
  total_users: 312,
  total_assessments: 489,
};

export const MOCK_ORGANISATIONS = [
  {
    id: 'org-001',
    name: 'National Institute of Technology, Trichy',
    email: 'placement@nitt.edu',
    org_type: 'university',
    contact_name: 'Dr. Ramesh Kumar',
    status: 'approved',
    total_candidates: 47,
    created_at: '2024-10-01T10:00:00Z',
  },
  {
    id: 'org-002',
    name: 'TechCorp Solutions Pvt Ltd',
    email: 'hr@techcorp.in',
    org_type: 'company',
    contact_name: 'Ananya Reddy',
    status: 'approved',
    total_candidates: 28,
    created_at: '2024-10-15T10:00:00Z',
  },
  {
    id: 'org-003',
    name: 'IIT Bombay Placement Cell',
    email: 'placement@iitb.ac.in',
    org_type: 'university',
    contact_name: 'Prof. Suresh Verma',
    status: 'pending',
    total_candidates: 0,
    created_at: '2024-12-10T10:00:00Z',
  },
  {
    id: 'org-004',
    name: 'StartupHub Incubator',
    email: 'admin@startuphub.io',
    org_type: 'company',
    contact_name: 'Vikram Singh',
    status: 'pending',
    total_candidates: 0,
    created_at: '2024-12-12T10:00:00Z',
  },
  {
    id: 'org-005',
    name: 'InfraCore Technologies',
    email: 'recruiter@infracore.com',
    org_type: 'company',
    contact_name: 'Meera Pillai',
    status: 'suspended',
    total_candidates: 5,
    created_at: '2024-09-01T10:00:00Z',
  },
];

export const MOCK_USERS = [
  {
    id: 'user-001',
    full_name: 'Arjun Sharma',
    email: 'arjun.sharma@example.com',
    is_google_auth: false,
    email_verified: true,
    face_registered: true,
    voice_registered: true,
    account_type: 'individual',
    is_active: true,
    created_at: '2024-11-15T10:30:00Z',
  },
  {
    id: 'user-002',
    full_name: 'Priya Nair',
    email: 'priya.nair@example.com',
    is_google_auth: true,
    email_verified: true,
    face_registered: true,
    voice_registered: true,
    account_type: 'organisation_connected',
    is_active: true,
    created_at: '2024-11-20T11:00:00Z',
  },
  {
    id: 'user-003',
    full_name: 'Rohan Mehta',
    email: 'rohan.mehta@example.com',
    is_google_auth: false,
    email_verified: true,
    face_registered: true,
    voice_registered: false,
    account_type: 'individual',
    is_active: true,
    created_at: '2024-11-28T09:00:00Z',
  },
];

export const MOCK_ADMIN_ASSESSMENTS = [
  {
    id: 'session-001',
    candidate_name: 'Arjun Sharma',
    candidate_email: 'arjun.sharma@example.com',
    intake_mode: 'certificate',
    status: 'scored',
    extracted_role: 'Software Development Intern',
    extracted_skills: ['React', 'Node.js', 'PostgreSQL'],
    created_at: '2024-11-20T09:00:00Z',
  },
  {
    id: 'session-002',
    candidate_name: 'Priya Nair',
    candidate_email: 'priya.nair@example.com',
    intake_mode: 'skill_only',
    status: 'interview_done',
    extracted_role: 'ML Engineer',
    extracted_skills: ['Python', 'Machine Learning'],
    created_at: '2024-12-01T14:00:00Z',
  },
];

export const MOCK_ACTIVITY = [
  {
    session_id: 'session-001',
    candidate: 'Arjun Sharma',
    event: 'Status changed to scored',
    timestamp: '2024-11-20T11:30:00Z',
  },
  {
    session_id: 'session-002',
    candidate: 'Priya Nair',
    event: 'Status changed to interview_done',
    timestamp: '2024-12-01T15:00:00Z',
  },
  {
    session_id: 'session-003',
    candidate: 'Rohan Mehta',
    event: 'Status changed to ocr_done',
    timestamp: '2024-12-10T08:05:00Z',
  },
];
