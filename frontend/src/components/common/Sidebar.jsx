import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import Logo from './Logo';
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
 * @param {string}  logoLink    - link for the brand logo, e.g., dashboard route
 */
export default function Sidebar({
  navItems = [],
  footerItems = [],
  collapsed = false,
  mobileOpen = false,
  onToggle,
  onMobileClose,
  portalLabel = 'SkillProof',
  logoLink = '/',
}) {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [bubbleMessage, setBubbleMessage] = useState(null);
  const [clickCount, setClickCount] = useState(0);
  const [isWiggling, setIsWiggling] = useState(false);

  const FUNNY_MESSAGES = [
    "😏 I knew it... you are a pervert! 😜",
    "📸 Caught in 4K! Stop staring and focus on your assessment!",
    "👀 Why are you still clicking me? Go ace that interview! 🚀",
    "🚨 HR has been notified... Just kidding! 😂",
    "✨ I'm here for emotional support, not your clicks! 💅",
    "🎯 Stop getting distracted and start an assessment!"
  ];

  const handleCharacterClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsWiggling(true);
    setTimeout(() => setIsWiggling(false), 600);

    const msg = FUNNY_MESSAGES[clickCount % FUNNY_MESSAGES.length];
    setBubbleMessage(msg);
    setClickCount((c) => c + 1);
  };

  useEffect(() => {
    if (!bubbleMessage) return;
    const timer = setTimeout(() => {
      setBubbleMessage(null);
    }, 4500);
    return () => clearTimeout(timer);
  }, [bubbleMessage, clickCount]);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const showCollapsed = collapsed && !isMobile;

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
          showCollapsed && 'common-sidebar--collapsed',
          mobileOpen && 'common-sidebar--mobile-open',
        ].filter(Boolean).join(' ')}
        aria-label="Main navigation"
      >
        {/* Brand */}
        <div className="common-sidebar__brand">
          {showCollapsed ? (
            <button
              className="common-sidebar__logo-button"
              onClick={onToggle}
              aria-label="Expand sidebar"
              title="Expand sidebar"
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '100%',
              }}
            >
              <Logo size={44} className="common-sidebar__logo-icon" color="var(--primary)" />
            </button>
          ) : (
            <>
              <NavLink to={logoLink} className="common-sidebar__logo" aria-label="SkillProof home">
                <Logo size={36} className="common-sidebar__logo-icon" color="var(--primary)" />
                <span className="common-sidebar__logo-text">{portalLabel}</span>
              </NavLink>
              <button className="common-sidebar__toggle" onClick={onToggle} aria-label="Collapse sidebar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 18l-6-6 6-6"/>
                </svg>
              </button>
            </>
          )}
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
                title={showCollapsed ? item.label : undefined}
                data-tooltip={item.label}
              >
                <span className="common-sidebar__nav-item__icon" aria-hidden="true">{item.icon}</span>
                {!showCollapsed && (
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

        {/* Sidebar Companion Character Widget */}
        {!showCollapsed && (
          <div className="common-sidebar__character-container">
            {bubbleMessage && (
              <div
                className="common-sidebar__speech-bubble"
                onClick={() => setBubbleMessage(null)}
                role="tooltip"
                aria-live="polite"
              >
                <span className="bubble-text">{bubbleMessage}</span>
                <span className="bubble-tail" />
              </div>
            )}
            <div
              className={`common-sidebar__character-btn ${isWiggling ? 'common-sidebar__character-btn--wobble' : ''}`}
              onClick={handleCharacterClick}
              role="button"
              tabIndex={0}
              title="Click me!"
              aria-label="SkillProof Interactive Guide"
            >
              <img
                src="/assets/sidebar-assistant.png"
                alt="SkillProof Assistant"
                className="common-sidebar__character-img"
                loading="lazy"
              />
            </div>
          </div>
        )}

        {/* Footer nav */}
        {footerItems.length > 0 && (
          <div className="common-sidebar__footer">
            {footerItems.map((item) =>
              item.onClick ? (
                <button
                  key={item.label}
                  className="common-sidebar__nav-item"
                  onClick={item.onClick}
                  title={showCollapsed ? item.label : undefined}
                  data-tooltip={item.label}
                >
                  <span className="common-sidebar__nav-item__icon" aria-hidden="true">{item.icon}</span>
                  {!showCollapsed && <span className="common-sidebar__nav-item__label">{item.label}</span>}
                </button>
              ) : (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `common-sidebar__nav-item${isActive ? ' common-sidebar__nav-item--active' : ''}`
                  }
                  onClick={onMobileClose}
                  title={showCollapsed ? item.label : undefined}
                  data-tooltip={item.label}
                >
                  <span className="common-sidebar__nav-item__icon" aria-hidden="true">{item.icon}</span>
                  {!showCollapsed && <span className="common-sidebar__nav-item__label">{item.label}</span>}
                </NavLink>
              )
            )}
          </div>
        )}
      </aside>
    </>
  );
}
