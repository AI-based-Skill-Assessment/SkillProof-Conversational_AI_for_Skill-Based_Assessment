import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ROUTES from './core/routes';
import ProtectedRoute, { GuestRoute } from './core/auth/ProtectedRoute';

// ── Layouts ──────────────────────────────────────────────────────────────────
import PublicLayout from './layouts/PublicLayout';
import UserLayout from './layouts/UserLayout';
import OrganisationLayout from './layouts/OrganisationLayout';
import AdminLayout from './layouts/AdminLayout';

// Pages are loaded on demand (code-splitting) so the first load only downloads
// the page being opened, not all three portals.

// ── Pages: Public ────────────────────────────────────────────────────────────
const LandingPage = lazy(() => import('./pages/public/LandingPage'));
const OrganizationLandingPage = lazy(() => import('./pages/public/OrganizationLandingPage'));
const HowItWorks = lazy(() => import('./pages/public/HowItWorks'));
const Security = lazy(() => import('./pages/public/Security'));
const PublicReportVerify = lazy(() => import('./pages/public/PublicReportVerify'));
const PublicCredentialVerify = lazy(() => import('./pages/public/PublicCredentialVerify'));
const LoadingDemosPage = lazy(() => import('./pages/public/LoadingDemosPage'));
const AmbientEffectsDemoPage = lazy(() => import('./pages/public/AmbientEffectsDemoPage'));

// ── Pages: Candidate / User Portal ───────────────────────────────────────────
const UserSignIn = lazy(() => import('./pages/user/SignIn'));
const UserSignUp = lazy(() => import('./pages/user/SignUp'));
const UserForgotPassword = lazy(() => import('./pages/user/ForgotPassword'));
const UserAccountTypeSetup = lazy(() => import('./pages/user/AccountTypeSetup'));
const UserFaceRegistration = lazy(() => import('./pages/user/FaceRegistration'));
const UserVoiceRegistration = lazy(() => import('./pages/user/VoiceRegistration'));
const UserDashboard = lazy(() => import('./pages/user/Dashboard'));
const UserNewAssessment = lazy(() => import('./pages/user/NewAssessment'));
const UserCertificateAssessment = lazy(() => import('./pages/user/CertificateAssessment'));
const UserSkillAssessment = lazy(() => import('./pages/user/SkillAssessment'));
const UserAssessmentReview = lazy(() => import('./pages/user/AssessmentReview'));
const UserInterviewCheck = lazy(() => import('./pages/user/InterviewCheck'));
const BiometricCheckPage = lazy(() => import('./pages/user/BiometricCheckPage'));
const UserInterviewSession = lazy(() => import('./pages/user/InterviewSession'));
const UserInterviewProcessing = lazy(() => import('./pages/user/InterviewProcessing'));
const UserReportsList = lazy(() => import('./pages/user/ReportsList'));
const UserReportDetail = lazy(() => import('./pages/user/ReportDetail'));
const UserCertificates = lazy(() => import('./pages/user/Certificates'));
const UserOrganizations = lazy(() => import('./pages/user/Organizations'));
const UserProfile = lazy(() => import('./pages/user/Profile'));
const UserSettings = lazy(() => import('./pages/user/Settings'));
const UserNotifications = lazy(() => import('./pages/user/Notifications'));

// ── Pages: Organisation Portal ───────────────────────────────────────────────
const OrgSignIn = lazy(() => import('./pages/org/SignIn'));
const OrgSignUp = lazy(() => import('./pages/org/SignUp'));
const OrgPendingApproval = lazy(() => import('./pages/org/PendingApproval'));
const OrgGoogleOnboard = lazy(() => import('./pages/org/GoogleOnboard'));
const OrgDashboard = lazy(() => import('./pages/org/Dashboard'));
const OrgCandidates = lazy(() => import('./pages/org/Candidates'));
const OrgCandidateDetail = lazy(() => import('./pages/org/CandidateDetail'));
const OrgReports = lazy(() => import('./pages/org/Reports'));
const OrgQRVerification = lazy(() => import('./pages/org/QRVerification'));
const OrgAnalytics = lazy(() => import('./pages/org/Analytics'));
const OrgProfile = lazy(() => import('./pages/org/Profile'));
const OrgSettings = lazy(() => import('./pages/org/Settings'));

// ── Pages: Admin Portal ──────────────────────────────────────────────────────
const AdminLogin = lazy(() => import('./pages/admin/Login'));
const AdminTwoFactorVerify = lazy(() => import('./pages/admin/TwoFactorVerify'));
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminOrgsList = lazy(() => import('./pages/admin/OrganizationsList'));
const AdminOrgCreate = lazy(() => import('./pages/admin/OrganizationCreate'));
const AdminOrgDetail = lazy(() => import('./pages/admin/OrganizationDetail'));
const AdminOrgEdit = lazy(() => import('./pages/admin/OrganizationEdit'));
const AdminUsers = lazy(() => import('./pages/admin/Users'));
const AdminAssessments = lazy(() => import('./pages/admin/Assessments'));
const AdminActivity = lazy(() => import('./pages/admin/Activity'));
const AdminSettings = lazy(() => import('./pages/admin/Settings'));

import NetworkStatusFallback from './components/common/NetworkStatusFallback';
import CursorSpark from './components/common/CursorSpark';
import AppInitialSplash from './components/common/AppInitialSplash';
import AmbientHudRings from './components/common/AmbientHudRings';
import CommandPalette from './components/common/CommandPalette';

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppInitialSplash />
      <AmbientHudRings />
      <CommandPalette />
      <CursorSpark />
      <NetworkStatusFallback />
      <Suspense fallback={<div className="route-loading" aria-busy="true" />}>
      <Routes>
        {/* ── 1. Public Marketing Routes & QR Audit Verification ──────────────── */}
        <Route path="/verify/:id" element={<PublicReportVerify />} />
        <Route path="/credential/:hash" element={<PublicCredentialVerify />} />
        <Route path="/verify/credential/:hash" element={<PublicCredentialVerify />} />
        <Route path="/loading-demos" element={<LoadingDemosPage />} />
        <Route path="/loading-demos/:animId" element={<LoadingDemosPage />} />
        <Route path="/ambient-demos" element={<AmbientEffectsDemoPage />} />
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
      </Suspense>
    </BrowserRouter>
  );
}
