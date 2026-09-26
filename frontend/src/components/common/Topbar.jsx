import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Logo from './Logo';
import '../../styles/common/topbar.css';
import ThemeToggle from './ThemeToggle';
import soundEffects from '../../core/audio/soundEffects';
import ROUTES from '../../core/routes';

export default function Topbar({
  title = '',
  collapsed = false,
  onMenuClick,
  user,
  profileLink,
  notifLink,
  notifCount = 0,
  logoLink = '/',
  isInterview = false,
  isDemo = false,
}) {
  const navigate = useNavigate();
  const { id } = useParams();
  const [showEndModal, setShowEndModal] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [soundMuted, setSoundMuted] = useState(soundEffects.isMuted());

  // Avatar Display Logic:
  // 1. Use Google profile picture if present
  // 2. Otherwise use the first character of the candidate's first name
  const profilePic = user?.profile_picture_url || user?.picture || null;
  const firstNameChar = user?.full_name
    ? user.full_name.trim().split(' ')[0].charAt(0).toUpperCase()
    : user?.name
    ? user.name.trim().split(' ')[0].charAt(0).toUpperCase()
    : user?.email
    ? user.email.charAt(0).toUpperCase()
    : 'U';

  const handleConfirmEnd = () => {
    setIsEnding(true);
    setTimeout(() => {
      setShowEndModal(false);
      setIsEnding(false);
      if (id) {
        navigate(ROUTES.USER.INTERVIEW_PROCESSING(id));
      } else {
        navigate(ROUTES.USER.DASHBOARD);
      }
    }, 1500);
  };

  if (isInterview) {
    return (
      <header className="common-topbar common-topbar--full" style={{ left: 0, paddingLeft: 24, paddingRight: 24 }}>
        <div className="common-topbar__left" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Logo size={32} color="var(--primary)" />
            <span style={{ fontWeight: 800, fontSize: 19, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
              SkillProof
            </span>
          </div>
          <span style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--primary)',
            background: 'rgba(18, 163, 126, 0.1)',
            border: '1px solid rgba(18, 163, 126, 0.25)',
            padding: '2px 10px',
            borderRadius: 12,
            letterSpacing: '0.04em',
            textTransform: 'uppercase'
          }}>
            SECURE INTERVIEW SESSION
          </span>
        </div>

        <div className="common-topbar__right" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <ThemeToggle />

          <button
            type="button"
            onClick={() => setShowEndModal(true)}
            style={{
              background: 'rgba(239, 68, 68, 0.12)',
              color: '#ef4444',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 'var(--radius-md)',
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 200ms ease'
            }}
          >
            <span>⏹</span> End Assessment
          </button>
        </div>

        {/* End Assessment Confirmation Modal */}
        {showEndModal && createPortal(
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20
          }}>
            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-xl)',
              padding: 28,
              maxWidth: 440,
              width: '100%',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              flexDirection: 'column',
              gap: 16
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 28 }}>⚠️</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>End Assessment Early?</h3>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>Are you sure you want to finish the interview session now?</p>
                </div>
              </div>

              <div style={{ fontSize: 13, color: 'var(--text-secondary)', background: 'rgba(255, 255, 255, 0.03)', padding: 14, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                Your completed answers will be evaluated to generate your final skill scorecard and report.
              </div>

              {isEnding ? (
                <div style={{ textAlign: 'center', padding: '12px 0', color: 'var(--primary)', fontWeight: 600, fontSize: 14 }}>
                  <span style={{ display: 'inline-block', animation: 'spin 1s infinite linear', marginRight: 8 }}>⏳</span>
                  Processing responses & generating scorecard...
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => setShowEndModal(false)}
                    style={{
                      padding: '8px 18px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border)',
                      background: 'var(--surface)',
                      color: 'var(--text-primary)',
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: 'pointer'
                    }}
                  >
                    Continue Interview
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmEnd}
                    style={{
                      padding: '8px 18px',
                      borderRadius: 'var(--radius-md)',
                      border: 'none',
                      background: '#ef4444',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: 'pointer'
                    }}
                  >
                    Confirm & End Session
                  </button>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
      </header>
    );
  }

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

        {/* Mobile-only Logo linking back to dashboard */}
        <Link to={logoLink} className="common-topbar__mobile-logo" aria-label="SkillProof Dashboard">
          <Logo size={32} color="var(--primary)" />
        </Link>

        {title && <h1 className="common-topbar__title">{title}</h1>}
      </div>

      <div className="common-topbar__right">
        {/* Demo Data Indicator */}
        {isDemo && (
          <span style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--primary)',
            background: 'rgba(18, 163, 126, 0.12)',
            border: '1px solid rgba(18, 163, 126, 0.3)',
            padding: '3px 10px',
            borderRadius: 12,
            letterSpacing: '0.05em',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5
          }}>
            <span style={{ fontSize: 8 }}>⚡</span> DEMO MODE
          </span>
        )}

        {/* Command Palette Trigger Pill */}
        <button
          type="button"
          onClick={() => {
            soundEffects.playClick();
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
          }}
          className="common-topbar__search-btn"
          title="Command Palette (Ctrl + K / Cmd + K)"
        >
          <span style={{ fontSize: 13 }}>🔍</span>
          <span className="hide-on-mobile">Search</span>
          <kbd className="common-topbar__search-kbd">
            Ctrl+K
          </kbd>
        </button>

        {/* Futuristic Sound Effects Toggle */}
        <button
          type="button"
          onClick={() => {
            const muted = soundEffects.toggleMute();
            // Trigger state re-render
            setSoundMuted(muted);
          }}
          className="common-topbar__action-btn"
          style={{ cursor: 'pointer' }}
          title={soundMuted ? 'Unmute Futuristic UI Sounds' : 'Mute UI Sounds'}
          aria-label="Toggle Sound Effects"
        >
          <span style={{ fontSize: 16 }}>{soundMuted ? '🔇' : '🔊'}</span>
        </button>

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
          <Link to={profileLink} className="common-topbar__avatar" aria-label="Profile" style={{ overflow: 'hidden', padding: 0 }}>
            {profilePic && !imgError ? (
              <img
                src={profilePic}
                alt="Profile"
                onError={() => setImgError(true)}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              firstNameChar
            )}
          </Link>
        ) : (
          <div className="common-topbar__avatar" style={{ overflow: 'hidden', padding: 0 }}>
            {profilePic && !imgError ? (
              <img
                src={profilePic}
                alt="Profile"
                onError={() => setImgError(true)}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              firstNameChar
            )}
          </div>
        )}
      </div>
    </header>
  );
}
