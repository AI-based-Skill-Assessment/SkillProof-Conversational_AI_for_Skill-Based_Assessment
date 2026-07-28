/**
 * core/auth/ProtectedRoute.jsx
 * Role-based route guard. Redirects unauthenticated users to the correct sign-in page.
 * Renders a spinner during initial auth hydration.
 */
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import ROUTES from '../routes';

/**
 * @param {string} requiredRole - 'user' | 'org' | 'admin'
 * @param {React.ReactNode} children
 */
export function ProtectedRoute({ requiredRole, children }) {
  const { isAuthenticated, role, loading, user } = useAuth();
  const location = useLocation();

  // ── Wait for localStorage hydration ──────────────────────────────────────
  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: 'var(--background)'
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          border: '3px solid var(--border)',
          borderTopColor: 'var(--primary)',
          animation: 'spin 700ms linear infinite'
        }} />
      </div>
    );
  }

  // ── Not authenticated → redirect to sign-in ────────────────────────────────
  if (!isAuthenticated) {
    const signInMap = {
      user:  ROUTES.USER.SIGNIN,
      org:   ROUTES.ORG.SIGNIN,
      admin: ROUTES.ADMIN.LOGIN,
    };
    const target = signInMap[requiredRole] || ROUTES.USER.SIGNIN;
    return <Navigate to={target} state={{ from: location }} replace />;
  }

  // ── Wrong role → redirect to their correct portal ─────────────────────────
  if (requiredRole && role !== requiredRole) {
    const homeMap = {
      user:  ROUTES.USER.DASHBOARD,
      org:   ROUTES.ORG.DASHBOARD,
      admin: ROUTES.ADMIN.DASHBOARD,
    };
    const fallback = homeMap[role] || ROUTES.HOME;
    return <Navigate to={fallback} replace />;
  }

  // ── Candidate Onboarding Checks ──────────────────────────────────────────
  if (requiredRole === 'user' && role === 'user') {
    const currentStep = user?.onboarding_step || 'account_type';
    const path = location.pathname;

    if (currentStep !== 'completed') {
      const stepMap = {
        'account_type': ROUTES.USER.ACCOUNT_TYPE,
        'face_registration': ROUTES.USER.FACE_REGISTRATION,
        'voice_registration': ROUTES.USER.VOICE_REGISTRATION,
      };
      const correctRoute = stepMap[currentStep] || ROUTES.USER.ACCOUNT_TYPE;

      if (path !== correctRoute) {
        const isDirectDashboardClick = new URLSearchParams(location.search).get('pending') === 'true';
        const target = isDirectDashboardClick ? `${correctRoute}?pending=true` : correctRoute;
        return <Navigate to={target} replace />;
      }
    } else {
      const isOnboardingRoute = [
        ROUTES.USER.ACCOUNT_TYPE,
        ROUTES.USER.FACE_REGISTRATION,
        ROUTES.USER.VOICE_REGISTRATION
      ].includes(path);

      if (isOnboardingRoute) {
        return <Navigate to={ROUTES.USER.DASHBOARD} replace />;
      }
    }
  }

  // ── Organisation Onboarding & Pending Approval Checks ─────────────────────
  if (requiredRole === 'org' && role === 'org') {
    const isGoogle = user?.is_google_auth === true;
    const onboardCompleted = user?.google_onboarding_completed === true;
    const status = user?.status || 'pending';
    const path = location.pathname;

    if (isGoogle && !onboardCompleted) {
      if (path !== ROUTES.ORG.GOOGLE_ONBOARD) {
        return <Navigate to={ROUTES.ORG.GOOGLE_ONBOARD} replace />;
      }
    } else if (status === 'pending') {
      if (path !== ROUTES.ORG.PENDING) {
        return <Navigate to={ROUTES.ORG.PENDING} replace />;
      }
    } else {
      const isRestrictedRoute = [ROUTES.ORG.GOOGLE_ONBOARD, ROUTES.ORG.PENDING].includes(path);
      if (isRestrictedRoute) {
        return <Navigate to={ROUTES.ORG.DASHBOARD} replace />;
      }
    }
  }

  return children;
}

/**
 * Inverse guard — redirects already-authenticated users AWAY from auth pages.
 * e.g. prevents /user/signin showing when already logged in.
 */
export function GuestRoute({ role: expectedPortalRole, children }) {
  const { isAuthenticated, role, loading } = useAuth();

  if (loading) return null;

  if (isAuthenticated) {
    const homeMap = {
      user:  ROUTES.USER.DASHBOARD,
      org:   ROUTES.ORG.DASHBOARD,
      admin: ROUTES.ADMIN.DASHBOARD,
    };
    return <Navigate to={homeMap[role] || ROUTES.HOME} replace />;
  }

  return children;
}

export default ProtectedRoute;
