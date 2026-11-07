import { Suspense, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import ROUTES from '../core/routes';
import Logo from '../components/common/Logo';
import ThemeToggle from '../components/common/ThemeToggle';
import TechBackground from '../components/common/TechBackground';
import '../styles/pages/public.css';

import { useAuth } from '../core/auth/AuthContext';

export default function PublicLayout() {
  const { isAuthenticated, role, logout } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the mobile menu whenever the page changes
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);
  const currentYear = new Date().getFullYear();

  const getDashboardRoute = () => {
    if (role === 'user') return `${ROUTES.USER.DASHBOARD}?pending=true`;
    if (role === 'org') return ROUTES.ORG.DASHBOARD;
    if (role === 'admin') return ROUTES.ADMIN.DASHBOARD;
    return ROUTES.USER.DASHBOARD;
  };

  return (
    <div className="public-layout">
      {/* Cyber Dot-Matrix & Ambient Vignette Background */}
      <TechBackground />

      {/* Navbar */}
      <nav className="public-navbar" aria-label="Main Navigation">
        <Link to={ROUTES.HOME} className="public-navbar__logo">
          <Logo size={36} className="public-navbar__logo-icon" color="var(--primary)" />
          <span>SkillProof</span>
        </Link>

        <button
          type="button"
          className="public-navbar__menu-btn"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          aria-controls="public-navbar-links"
          onClick={() => setMenuOpen(o => !o)}
        >
          {menuOpen ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          )}
        </button>

        <div id="public-navbar-links" className={`public-navbar__links${menuOpen ? ' public-navbar__links--open' : ''}`}>
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
            For Organizations
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

          <div className="public-navbar__actions">
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
        <Suspense fallback={<div className="route-loading" aria-busy="true" />}><Outlet /></Suspense>
      </main>

      {/* Footer */}
      <footer className="public-footer">
        <div className="public-footer__content">
          <div className="public-navbar__logo" style={{ marginBottom: 12 }}>
            <Logo size={36} className="public-navbar__logo-icon" color="var(--primary)" />
            <span>SkillProof</span>
          </div>
          <div className="public-footer__links">
            <Link to={ROUTES.HOME} className="public-footer__link">Home</Link>
            <Link to={ROUTES.FOR_ORGANISATIONS} className="public-footer__link">For Organizations</Link>
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
