import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/common/Sidebar';
import Topbar from '../components/common/Topbar';
import { useAuth } from '../core/auth/AuthContext';
import ROUTES from '../core/routes';
import '../styles/layouts/app-layout.css';

const Icons = {
  Dashboard: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  Candidates: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  Reports: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  QR: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="6" height="6"/><rect x="15" y="3" width="6" height="6"/><rect x="3" y="15" width="6" height="6"/><path d="M21 15v4h-4M15 15h4v2M15 19h4M15 21h4"/></svg>,
  Analytics: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  Profile: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  Settings: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  Logout: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
};

const NAV_ITEMS = [
  { to: ROUTES.ORG.DASHBOARD,   label: 'Dashboard',   icon: <Icons.Dashboard /> },
  { type: 'section', label: 'Candidates' },
  { to: ROUTES.ORG.CANDIDATES,  label: 'Candidates',  icon: <Icons.Candidates /> },
  { to: ROUTES.ORG.REPORTS_LIST,label: 'Reports',     icon: <Icons.Reports /> },
  { to: ROUTES.ORG.QR_VERIFY,   label: 'QR Verify',   icon: <Icons.QR /> },
  { to: ROUTES.ORG.ANALYTICS,   label: 'Analytics',   icon: <Icons.Analytics /> },
  { type: 'section', label: 'Account' },
  { to: ROUTES.ORG.PROFILE,     label: 'Profile',     icon: <Icons.Profile /> },
  { to: ROUTES.ORG.SETTINGS,    label: 'Settings',    icon: <Icons.Settings /> },
];

export default function OrganisationLayout({ pageTitle = 'Organisation Portal' }) {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const FOOTER_ITEMS = [
    { label: 'Logout', icon: <Icons.Logout />, onClick: logout },
  ];

  return (
    <div className="app-layout">
      <Sidebar
        navItems={NAV_ITEMS}
        footerItems={FOOTER_ITEMS}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onToggle={() => setCollapsed(c => !c)}
        onMobileClose={() => setMobileOpen(false)}
        portalLabel="SkillProof Org"
      />
      <div className={`app-layout__content${collapsed ? ' app-layout__content--collapsed' : ''}`}>
        <Topbar
          title={pageTitle}
          collapsed={collapsed}
          onMenuClick={() => setMobileOpen(o => !o)}
          user={user}
          profileLink={ROUTES.ORG.PROFILE}
        />
        <main className="app-layout__page">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
