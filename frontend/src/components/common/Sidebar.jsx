import { NavLink, useNavigate } from 'react-router-dom';
import '../../styles/common/sidebar.css';

/**
 * Sidebar — collapsible navigation sidebar.
 *
 * @param {Array}   navItems    - [{ label, icon, to, badge? }]
 * @param {Array}   footerItems - same shape
 * @param {boolean} collapsed   - is sidebar collapsed?
 * @param {boolean} mobileOpen  - is sidebar open on mobile?
 * @param {()=>void} onToggle   - toggle collapse
 * @param {()=>void} onMobileClose
 * @param {string}  portalLabel - 'SkillProof' or custom brand label
 */
export default function Sidebar({
  navItems = [],
  footerItems = [],
  collapsed = false,
  mobileOpen = false,
  onToggle,
  onMobileClose,
  portalLabel = 'SkillProof',
}) {
  return (
    <>
      {/* Mobile overlay */}
      <div
        className={`common-sidebar-overlay${mobileOpen ? ' common-sidebar-overlay--visible' : ''}`}
        onClick={onMobileClose}
        aria-hidden="true"
      />

      <aside
        className={[
          'common-sidebar',
          collapsed && 'common-sidebar--collapsed',
          mobileOpen && 'common-sidebar--mobile-open',
        ].filter(Boolean).join(' ')}
        aria-label="Main navigation"
      >
        {/* Brand */}
        <div className="common-sidebar__brand">
          <NavLink to="/" className="common-sidebar__logo" aria-label="SkillProof home">
            <div className="common-sidebar__logo-icon">SP</div>
            {!collapsed && <span className="common-sidebar__logo-text">{portalLabel}</span>}
          </NavLink>
          <button className="common-sidebar__toggle" onClick={onToggle} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {collapsed
                ? <path d="M9 18l6-6-6-6"/>
                : <path d="M15 18l-6-6 6-6"/>
              }
            </svg>
          </button>
        </div>

        {/* Main nav */}
        <nav className="common-sidebar__nav">
          {navItems.map((item) =>
            item.type === 'section' ? (
              <div key={item.label} className="common-sidebar__section-label">{item.label}</div>
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `common-sidebar__nav-item${isActive ? ' common-sidebar__nav-item--active' : ''}`
                }
                onClick={onMobileClose}
                title={collapsed ? item.label : undefined}
              >
                <span className="common-sidebar__nav-item__icon" aria-hidden="true">{item.icon}</span>
                {!collapsed && (
                  <>
                    <span className="common-sidebar__nav-item__label">{item.label}</span>
                    {item.badge > 0 && (
                      <span className="common-sidebar__nav-item__badge">{item.badge}</span>
                    )}
                  </>
                )}
              </NavLink>
            )
          )}
        </nav>

        {/* Footer nav */}
        {footerItems.length > 0 && (
          <div className="common-sidebar__footer">
            {footerItems.map((item) =>
              item.onClick ? (
                <button
                  key={item.label}
                  className="common-sidebar__nav-item"
                  onClick={item.onClick}
                  title={collapsed ? item.label : undefined}
                >
                  <span className="common-sidebar__nav-item__icon" aria-hidden="true">{item.icon}</span>
                  {!collapsed && <span className="common-sidebar__nav-item__label">{item.label}</span>}
                </button>
              ) : (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `common-sidebar__nav-item${isActive ? ' common-sidebar__nav-item--active' : ''}`
                  }
                  onClick={onMobileClose}
                  title={collapsed ? item.label : undefined}
                >
                  <span className="common-sidebar__nav-item__icon" aria-hidden="true">{item.icon}</span>
                  {!collapsed && <span className="common-sidebar__nav-item__label">{item.label}</span>}
                </NavLink>
              )
            )}
          </div>
        )}
      </aside>
    </>
  );
}
