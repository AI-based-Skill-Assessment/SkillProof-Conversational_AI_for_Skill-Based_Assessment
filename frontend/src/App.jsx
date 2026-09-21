import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ROUTES from './core/routes';
import ProtectedRoute, { GuestRoute } from './core/auth/ProtectedRoute';

// ── Layouts ──────────────────────────────────────────────────────────────────
import PublicLayout from './layouts/PublicLayout';
import UserLayout from './layouts/UserLayout';
import OrganisationLayout from './layouts/OrganisationLayout';
import AdminLayout from './layouts/AdminLayout';

// ── Pages: Public ────────────────────────────────────────────────────────────
import LandingPage from './pages/public/LandingPage';
import OrganizationLandingPage from './pages/public/OrganizationLandingPage';
import HowItWorks from './pages/public/HowItWorks';
import Security from './pages/public/Security';
import PublicReportVerify from './pages/public/PublicReportVerify';

// ── Pages: Candidate / User Portal ───────────────────────────────────────────
import UserSignIn from './pages/user/SignIn';
import UserSignUp from './pages/user/SignUp';
import UserForgotPassword from './pages/user/ForgotPassword';
import UserAccountTypeSetup from './pages/user/AccountTypeSetup';
import UserFaceRegistration from './pages/user/FaceRegistration';
import UserVoiceRegistration from './pages/user/VoiceRegistration';
import UserDashboard from './pages/user/Dashboard';
import UserNewAssessment from './pages/user/NewAssessment';
import UserCertificateAssessment from './pages/user/CertificateAssessment';
import UserSkillAssessment from './pages/user/SkillAssessment';
import UserAssessmentReview from './pages/user/AssessmentReview';
import UserInterviewCheck from './pages/user/InterviewCheck';
import BiometricCheckPage from './pages/user/BiometricCheckPage';
import UserInterviewSession from './pages/user/InterviewSession';
import UserInterviewProcessing from './pages/user/InterviewProcessing';
import UserReportsList from './pages/user/ReportsList';
import UserReportDetail from './pages/user/ReportDetail';
import UserCertificates from './pages/user/Certificates';
import UserOrganizations from './pages/user/Organizations';
import UserProfile from './pages/user/Profile';
import UserSettings from './pages/user/Settings';
import UserNotifications from './pages/user/Notifications';

// ── Pages: Organisation Portal ───────────────────────────────────────────────
import OrgSignIn from './pages/org/SignIn';
import OrgSignUp from './pages/org/SignUp';
import OrgPendingApproval from './pages/org/PendingApproval';
import OrgGoogleOnboard from './pages/org/GoogleOnboard';
import OrgDashboard from './pages/org/Dashboard';
import OrgCandidates from './pages/org/Candidates';
import OrgCandidateDetail from './pages/org/CandidateDetail';
import OrgReports from './pages/org/Reports';
import OrgQRVerification from './pages/org/QRVerification';
import OrgAnalytics from './pages/org/Analytics';
import OrgProfile from './pages/org/Profile';
import OrgSettings from './pages/org/Settings';

// ── Pages: Admin Portal ──────────────────────────────────────────────────────
import AdminLogin from './pages/admin/Login';
import AdminTwoFactorVerify from './pages/admin/TwoFactorVerify';
import AdminDashboard from './pages/admin/Dashboard';
import AdminOrgsList from './pages/admin/OrganizationsList';
import AdminOrgCreate from './pages/admin/OrganizationCreate';
import AdminOrgDetail from './pages/admin/OrganizationDetail';
import AdminOrgEdit from './pages/admin/OrganizationEdit';
import AdminUsers from './pages/admin/Users';
import AdminAssessments from './pages/admin/Assessments';
import AdminActivity from './pages/admin/Activity';
import AdminSettings from './pages/admin/Settings';

import NetworkStatusFallback from './components/common/NetworkStatusFallback';
import CursorSpark from './components/common/CursorSpark';

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <CursorSpark />
      <NetworkStatusFallback />
      <Routes>
        {/* ── 1. Public Marketing Routes & QR Audit Verification ──────────────── */}
        <Route path="/verify/:id" element={<PublicReportVerify />} />
        <Route element={<PublicLayout />}>
          <Route path={ROUTES.HOME} element={<LandingPage />} />
          <Route path={ROUTES.FOR_ORGANISATIONS} element={<OrganizationLandingPage />} />
          <Route path={ROUTES.HOW_IT_WORKS} element={<HowItWorks />} />
          <Route path={ROUTES.SECURITY} element={<Security />} />
        </Route>

        {/* ── 2. Guest-Only Auth Routes (No login required) ───────────────────── */}
        {/* Candidate Auth */}
        <Route
          path={ROUTES.USER.SIGNIN}
          element={
            <GuestRoute role="user">
              <UserSignIn />
            </GuestRoute>
          }
        />
        <Route
          path={ROUTES.USER.SIGNUP}
          element={
            <GuestRoute role="user">
              <UserSignUp />
            </GuestRoute>
          }
        />
        <Route path={ROUTES.USER.FORGOT_PASSWORD} element={<UserForgotPassword />} />

        {/* Organisation Auth */}
        <Route
          path={ROUTES.ORG.SIGNIN}
          element={
            <GuestRoute role="org">
              <OrgSignIn />
            </GuestRoute>
          }
        />
        <Route
          path={ROUTES.ORG.SIGNUP}
          element={
            <GuestRoute role="org">
              <OrgSignUp />
            </GuestRoute>
          }
        />
        <Route path={ROUTES.ORG.PENDING} element={<OrgPendingApproval />} />
        <Route
          path={ROUTES.ORG.GOOGLE_ONBOARD}
          element={
            <ProtectedRoute requiredRole="org">
              <OrgGoogleOnboard />
            </ProtectedRoute>
          }
        />

        {/* System Admin Auth */}
        <Route
          path={ROUTES.ADMIN.LOGIN}
          element={
            <GuestRoute role="admin">
              <AdminLogin />
            </GuestRoute>
          }
        />
        <Route path={ROUTES.ADMIN.TWO_FACTOR} element={<AdminTwoFactorVerify />} />

        {/* ── 3. Protected Candidate / User Routes ────────────────────────────── */}
        <Route
          path={ROUTES.USER.ACCOUNT_TYPE}
          element={
            <ProtectedRoute requiredRole="user">
              <UserAccountTypeSetup />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.USER.FACE_REGISTRATION}
          element={
            <ProtectedRoute requiredRole="user">
              <UserFaceRegistration />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.USER.VOICE_REGISTRATION}
          element={
            <ProtectedRoute requiredRole="user">
              <UserVoiceRegistration />
            </ProtectedRoute>
          }
        />

        <Route
          element={
            <ProtectedRoute requiredRole="user">
              <UserLayout pageTitle="" />
            </ProtectedRoute>
          }
        >
          <Route path={ROUTES.USER.DASHBOARD} element={<UserDashboard />} />
          <Route path={ROUTES.USER.NEW_ASSESSMENT} element={<UserNewAssessment />} />
          <Route path={ROUTES.USER.CERTIFICATE_ASSESSMENT} element={<UserCertificateAssessment />} />
          <Route path={ROUTES.USER.SKILL_ASSESSMENT} element={<UserSkillAssessment />} />
          <Route path={ROUTES.USER.ASSESSMENT_REVIEW()} element={<UserAssessmentReview />} />
          <Route path={ROUTES.USER.INTERVIEW_CHECK()} element={<UserInterviewCheck />} />
          <Route path={ROUTES.USER.BIOMETRIC_CHECK} element={<BiometricCheckPage />} />
          <Route path={ROUTES.USER.INTERVIEW_SESSION()} element={<UserInterviewSession />} />
          <Route path={ROUTES.USER.INTERVIEW_PROCESSING()} element={<UserInterviewProcessing />} />
          <Route path={ROUTES.USER.REPORTS_LIST} element={<UserReportsList />} />
          <Route path={ROUTES.USER.REPORT_DETAIL()} element={<UserReportDetail />} />
          <Route path={ROUTES.USER.CERTIFICATES} element={<UserCertificates />} />
          <Route path={ROUTES.USER.ORGANIZATIONS} element={<UserOrganizations />} />
          <Route path={ROUTES.USER.PROFILE} element={<UserProfile />} />
          <Route path={ROUTES.USER.SETTINGS} element={<UserSettings />} />
          <Route path={ROUTES.USER.NOTIFICATIONS} element={<UserNotifications />} />
        </Route>

        {/* ── 4. Protected Organisation Routes ────────────────────────────────── */}
        <Route
          element={
            <ProtectedRoute requiredRole="org">
              <OrganisationLayout pageTitle="Institution Portal" />
            </ProtectedRoute>
          }
        >
          <Route path={ROUTES.ORG.DASHBOARD} element={<OrgDashboard />} />
          <Route path={ROUTES.ORG.CANDIDATES} element={<OrgCandidates />} />
          <Route path={ROUTES.ORG.CANDIDATE_DETAIL()} element={<OrgCandidateDetail />} />
          <Route path={ROUTES.ORG.REPORTS_LIST} element={<OrgReports />} />
          <Route path={ROUTES.ORG.QR_VERIFY} element={<OrgQRVerification />} />
          <Route path={ROUTES.ORG.ANALYTICS} element={<OrgAnalytics />} />
          <Route path={ROUTES.ORG.PROFILE} element={<OrgProfile />} />
          <Route path={ROUTES.ORG.SETTINGS} element={<OrgSettings />} />
        </Route>

        {/* ── 5. Protected System Admin Routes ────────────────────────────────── */}
        <Route
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminLayout pageTitle="System Admin Panel" />
            </ProtectedRoute>
          }
        >
          <Route path={ROUTES.ADMIN.DASHBOARD} element={<AdminDashboard />} />
          <Route path={ROUTES.ADMIN.ORGS_LIST} element={<AdminOrgsList />} />
          <Route path={ROUTES.ADMIN.ORG_CREATE} element={<AdminOrgCreate />} />
          <Route path={ROUTES.ADMIN.ORG_DETAIL()} element={<AdminOrgDetail />} />
          <Route path={ROUTES.ADMIN.ORG_EDIT()} element={<AdminOrgEdit />} />
          <Route path={ROUTES.ADMIN.USERS} element={<AdminUsers />} />
          <Route path={ROUTES.ADMIN.ASSESSMENTS} element={<AdminAssessments />} />
          <Route path={ROUTES.ADMIN.ACTIVITY} element={<AdminActivity />} />
          <Route path={ROUTES.ADMIN.SETTINGS} element={<AdminSettings />} />
        </Route>

        {/* ── 6. Fallback Redirect ────────────────────────────────────────────── */}
        <Route path="*" element={<Navigate to={ROUTES.HOME} replace />} />
      </Routes>
    </BrowserRouter>
  );
}
