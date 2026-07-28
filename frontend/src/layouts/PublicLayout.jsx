import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import ROUTES from '../core/routes';
import ThemeToggle from '../components/common/ThemeToggle';
import '../styles/pages/public.css';

import { useAuth } from '../core/auth/AuthContext';

export default function PublicLayout() {
  const { isAuthenticated, role, logout } = useAuth();
  const location = useLocation();
  const currentYear = new Date().getFullYear();

  const getDashboardRoute = () => {
    if (role === 'user') return `${ROUTES.USER.DASHBOARD}?pending=true`;
    if (role === 'org') return ROUTES.ORG.DASHBOARD;
    if (role === 'admin') return ROUTES.ADMIN.DASHBOARD;
    return ROUTES.USER.DASHBOARD;
  };

  return (
    <div className="public-layout">
      {/* Navbar */}
      <nav className="public-navbar" aria-label="Main Navigation">
        <Link to={ROUTES.HOME} className="public-navbar__logo">
          <div className="public-navbar__logo-icon">SP</div>
          <span>SkillProof</span>
        </Link>

        <div className="public-navbar__links">
          <NavLink
            to={ROUTES.HOME}
            className={({ isActive }) => `public-navbar__link${isActive ? ' public-navbar__link--active' : ''}`}
            end
          >
            Home
          </NavLink>
          <NavLink
            to={ROUTES.FOR_ORGANISATIONS}
            className={({ isActive }) => `public-navbar__link${isActive ? ' public-navbar__link--active' : ''}`}
          >
            For Organisations
          </NavLink>
          <NavLink
            to={ROUTES.HOW_IT_WORKS}
            className={({ isActive }) => `public-navbar__link${isActive ? ' public-navbar__link--active' : ''}`}
          >
            How it Works
          </NavLink>
          <NavLink
            to={ROUTES.SECURITY}
            className={({ isActive }) => `public-navbar__link${isActive ? ' public-navbar__link--active' : ''}`}
          >
            Security & Privacy
          </NavLink>

          <div style={{ display: 'inline-flex', gap: 12, alignItems: 'center' }}>
            <ThemeToggle />
            {isAuthenticated ? (
              <>
                <Link to={getDashboardRoute()} className="common-button common-button--primary common-button--sm">
                  Go to Dashboard
                </Link>
                <button onClick={logout} className="common-button common-button--outline common-button--sm">
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link
                  to={location.pathname === ROUTES.FOR_ORGANISATIONS ? ROUTES.ORG.SIGNIN : ROUTES.USER.SIGNIN}
                  className="common-button common-button--outline common-button--sm"
                >
                  Sign In
                </Link>
                <Link to={ROUTES.USER.SIGNUP} className="common-button common-button--primary common-button--sm">
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Main body */}
      <main className="public-layout__main">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="public-footer">
        <div className="public-footer__content">
          <div className="public-navbar__logo" style={{ marginBottom: 12 }}>
            <div className="public-navbar__logo-icon">SP</div>
            <span>SkillProof</span>
          </div>
          <div className="public-footer__links">
            <Link to={ROUTES.HOME} className="public-footer__link">Home</Link>
            <Link to={ROUTES.FOR_ORGANISATIONS} className="public-footer__link">For Organisations</Link>
            <Link to={ROUTES.HOW_IT_WORKS} className="public-footer__link">How it Works</Link>
            <Link to={ROUTES.SECURITY} className="public-footer__link">Security Policy</Link>
            <Link to={ROUTES.ADMIN.LOGIN} className="public-footer__link">Admin Login</Link>
          </div>
          <p className="public-footer__copy">
            © {currentYear} SkillProof. All rights reserved. Conversational AI for Skill-Based Assessment.
          </p>
        </div>
      </footer>
    </div>
  );
}
