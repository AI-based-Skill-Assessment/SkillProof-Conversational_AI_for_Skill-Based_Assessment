import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/common/Sidebar';
import Topbar from '../components/common/Topbar';
import { useAuth } from '../core/auth/AuthContext';
import client from '../core/api/client';
import ROUTES from '../core/routes';
import { buildNotificationsFromData } from '../utils/notificationService';
import '../styles/layouts/app-layout.css';

// Nav icons
const Icons = {
  Dashboard: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  Assessment: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  Reports: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  Certificates: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg>,
  Orgs: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  Profile: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  Settings: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  Logout: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
};

const NAV_ITEMS = [
  { to: ROUTES.USER.DASHBOARD,        label: 'Dashboard',       icon: <Icons.Dashboard /> },
  { to: ROUTES.USER.NEW_ASSESSMENT,   label: 'New Assessment', icon: <Icons.Assessment /> },
  { to: ROUTES.USER.REPORTS_LIST,     label: 'My Reports',     icon: <Icons.Reports /> },
  { to: ROUTES.USER.CERTIFICATES,     label: 'Certificates',   icon: <Icons.Certificates /> },
  { to: ROUTES.USER.ORGANIZATIONS,    label: 'Organisations',  icon: <Icons.Orgs /> },
];

export default function UserLayout({ pageTitle = 'SkillProof' }) {
  const { user, updateUserCache, logout } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
  const [notifCount, setNotifCount] = useState(0);

  // Check real database session count on mount and route change to reflect demo and notification states
  useEffect(() => {
    client.get('/sessions').then(res => {
      if (res.data && res.data.length > 0) {
        setIsDemo(false);
        const built = buildNotificationsFromData({ user, sessions: res.data });
        setNotifCount(built.filter(n => !n.is_read).length);
      } else {
        setIsDemo(true);
        const built = buildNotificationsFromData({ user, sessions: [] });
        setNotifCount(built.filter(n => !n.is_read).length);
      }
    }).catch(() => {
      setIsDemo(true);
      const built = buildNotificationsFromData({ user, sessions: [] });
      setNotifCount(built.filter(n => !n.is_read).length);
    });

    // Fetch fresh candidate profile from backend on mount to ensure avatar & profile info are synced
    client.get('/auth/me').then(res => {
      if (res.data && updateUserCache) {
        updateUserCache(res.data);
      }
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Check if user is currently inside an active interview session
  const isInterview = location.pathname.includes('/interview/') && !location.pathname.includes('/check');

  // Global Hardware Media Stream Safety Net:
  // When leaving interview or biometric routes, ensure all webcam & mic tracks are closed at browser hardware level.
  useEffect(() => {
    if (!isInterview && !location.pathname.includes('/face-registration') && !location.pathname.includes('/voice-registration')) {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        // Query active DOM video elements or open streams and shut them down
        document.querySelectorAll('video').forEach(videoEl => {
          if (videoEl.srcObject && videoEl.srcObject.getTracks) {
            videoEl.srcObject.getTracks().forEach(track => {
              try {
                track.stop();
                track.enabled = false;
              } catch (e) {}
            });
            videoEl.srcObject = null;
          }
        });
      }
    }
  }, [location.pathname, isInterview]);

  const FOOTER_ITEMS = [
    { label: 'Logout', icon: <Icons.Logout />, onClick: logout },
  ];

  return (
    <div className="app-layout">
      {!isInterview && (
        <Sidebar
          navItems={NAV_ITEMS}
          footerItems={FOOTER_ITEMS}
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          onToggle={() => setCollapsed(c => !c)}
          onMobileClose={() => setMobileOpen(false)}
          portalLabel="SkillProof"
          logoLink={ROUTES.USER.DASHBOARD}
        />
      )}
      <div className={`app-layout__content${isInterview ? ' app-layout__content--full' : collapsed ? ' app-layout__content--collapsed' : ''}`}>
        <Topbar
          title={pageTitle}
          collapsed={collapsed}
          onMenuClick={() => setMobileOpen(o => !o)}
          user={user}
          profileLink={ROUTES.USER.PROFILE}
          notifLink={ROUTES.USER.NOTIFICATIONS}
          notifCount={notifCount}
          logoLink={ROUTES.USER.DASHBOARD}
          isInterview={isInterview}
          isDemo={isDemo}
        />
        <main className={`app-layout__page${isInterview ? ' app-layout__page--full' : ''}`}>
          <Outlet context={{ isDemo, setIsDemo }} />
        </main>
      </div>
    </div>
  );
}
