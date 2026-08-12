import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/common/Sidebar';
import Topbar from '../components/common/Topbar';
import { useAuth } from '../core/auth/AuthContext';
import ROUTES from '../core/routes';
import '../styles/layouts/app-layout.css';

const Icons = {
  Dashboard: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  Orgs: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  Users: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>,
  Assessments: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  Activity: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  Settings: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  Logout: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
};

const NAV_ITEMS = [
  { to: ROUTES.ADMIN.DASHBOARD,   label: 'Dashboard',     icon: <Icons.Dashboard /> },
  { type: 'section', label: 'Management' },
  { to: ROUTES.ADMIN.ORGS_LIST,   label: 'Organisations', icon: <Icons.Orgs /> },
  { to: ROUTES.ADMIN.USERS,       label: 'Candidates',    icon: <Icons.Users /> },
  { to: ROUTES.ADMIN.ASSESSMENTS, label: 'Assessments',   icon: <Icons.Assessments /> },
  { to: ROUTES.ADMIN.ACTIVITY,    label: 'System Logs',   icon: <Icons.Activity /> },
  { type: 'section', label: 'System' },
  { to: ROUTES.ADMIN.SETTINGS,    label: 'Settings',      icon: <Icons.Settings /> },
];

export default function AdminLayout({ pageTitle = 'System Admin' }) {
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
        portalLabel="SkillProof Admin"
        logoLink={ROUTES.ADMIN.DASHBOARD}
      />
      <div className={`app-layout__content${collapsed ? ' app-layout__content--collapsed' : ''}`}>
        <Topbar
          title={pageTitle}
          collapsed={collapsed}
          onMenuClick={() => setMobileOpen(o => !o)}
          user={{ full_name: 'System Admin', email: user?.email }}
          logoLink={ROUTES.ADMIN.DASHBOARD}
        />
        <main className="app-layout__page">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
