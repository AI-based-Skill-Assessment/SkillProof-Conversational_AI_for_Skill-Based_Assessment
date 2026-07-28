import { Link } from 'react-router-dom';
import '../../styles/common/topbar.css';
import ThemeToggle from './ThemeToggle';
import ROUTES from '../../core/routes';

/**
 * Topbar — top navigation bar for authenticated portals.
 *
 * @param {string}  title       - page title shown in topbar
 * @param {boolean} collapsed   - sidebar collapsed state (adjusts left offset)
 * @param {()=>void} onMenuClick - hamburger click for mobile
 * @param {object}  user        - { full_name, email }
 * @param {string}  profileLink - link to profile page
 * @param {string}  notifLink   - link to notifications page
 * @param {number}  notifCount  - unread notification count
 */
export default function Topbar({
  title = '',
  collapsed = false,
  onMenuClick,
  user,
  profileLink,
  notifLink,
  notifCount = 0,
}) {
  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  return (
    <header className={`common-topbar${collapsed ? ' common-topbar--collapsed' : ''}`}>
      <div className="common-topbar__left">
        <button
          className="common-topbar__menu-btn"
          onClick={onMenuClick}
          aria-label="Open navigation menu"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
        {title && <h1 className="common-topbar__title">{title}</h1>}
      </div>

      <div className="common-topbar__right">
        {/* Theme toggle */}
        <ThemeToggle />

        {/* Notifications */}
        {notifLink && (
          <Link
            to={notifLink}
            className="common-topbar__action-btn"
            aria-label={`Notifications${notifCount > 0 ? `, ${notifCount} unread` : ''}`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            {notifCount > 0 && <span className="common-topbar__badge" aria-hidden="true" />}
          </Link>
        )}

        <div className="common-topbar__divider" aria-hidden="true" />

        {/* Avatar → profile */}
        {profileLink ? (
          <Link to={profileLink} className="common-topbar__avatar" aria-label="Profile">
            {initials}
          </Link>
        ) : (
          <div className="common-topbar__avatar">{initials}</div>
        )}
      </div>
    </header>
  );
}
