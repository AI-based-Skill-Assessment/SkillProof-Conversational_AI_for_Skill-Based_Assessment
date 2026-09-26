import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useTheme } from '../../core/theme';
import { useAuth } from '../../core/auth/AuthContext';
import soundEffects from '../../core/audio/soundEffects';
import ROUTES from '../../core/routes';

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isSoundMuted, setIsSoundMuted] = useState(soundEffects.isMuted());

  const navigate = useNavigate();
  const location = useLocation();
  const { isDark, toggleTheme } = useTheme();
  const { user } = useAuth();
  const inputRef = useRef(null);

  // Global keydown listener for Ctrl+K / Cmd+K
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen(prev => {
          if (!prev) {
            soundEffects.playBeep();
          }
          return !prev;
        });
      } else if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Command palette items
  const items = [
    // ── Quick Actions ──
    {
      id: 'ambient-demos',
      title: 'Visual Lab: Left-Side Ambient Effects',
      subtitle: 'Preview & test 5 proposed left-side ambient animations live',
      category: 'Visual Lab',
      icon: '🌌',
      action: () => navigate(ROUTES.AMBIENT_DEMOS)
    },
    {
      id: 'new-assessment',
      title: 'Start New Assessment',
      subtitle: 'Choose Certificate or Skill-Only track',
      category: 'Assessments',
      icon: '⚡',
      action: () => navigate(ROUTES.USER.NEW_ASSESSMENT)
    },
    {
      id: 'declare-skills',
      title: 'Declare Custom Skills',
      subtitle: 'Path B: Instant evaluation without documents',
      category: 'Assessments',
      icon: '🧠',
      action: () => navigate(ROUTES.USER.SKILL_ASSESSMENT)
    },
    {
      id: 'upload-cert',
      title: 'Upload Certificate Documents',
      subtitle: 'Path A: Verify via OCR & MCA registry',
      category: 'Assessments',
      icon: '📄',
      action: () => navigate(ROUTES.USER.CERTIFICATE_ASSESSMENT)
    },
    {
      id: 'my-reports',
      title: 'My Reports & Scorecards',
      subtitle: 'View your verified skill ratings & telemetry',
      category: 'Navigation',
      icon: '📊',
      action: () => navigate(ROUTES.USER.REPORTS)
    },
    {
      id: 'user-dashboard',
      title: 'Candidate Dashboard',
      subtitle: 'Overview of assessments & pending verifications',
      category: 'Navigation',
      icon: '🏠',
      action: () => navigate(ROUTES.USER.DASHBOARD)
    },
    {
      id: 'face-id',
      title: 'Register Face Biometrics',
      subtitle: 'Update or verify 3D face mesh profile',
      category: 'Security',
      icon: '👤',
      action: () => navigate(ROUTES.USER.FACE_REGISTRATION)
    },
    {
      id: 'voice-id',
      title: 'Register Voice Biometrics',
      subtitle: 'Record voice acoustic embedding profile',
      category: 'Security',
      icon: '🎙️',
      action: () => navigate(ROUTES.USER.VOICE_REGISTRATION)
    },
    {
      id: 'user-profile',
      title: 'My Profile & Settings',
      subtitle: 'Manage account, password, and preferences',
      category: 'Navigation',
      icon: '⚙️',
      action: () => navigate(ROUTES.USER.PROFILE)
    },
    // ── Preferences & Tools ──
    {
      id: 'toggle-theme',
      title: isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode',
      subtitle: `Currently using ${isDark ? 'Dark' : 'Light'} theme`,
      category: 'Preferences',
      icon: isDark ? '☀️' : '🌙',
      action: () => {
        toggleTheme();
        soundEffects.playClick();
      }
    },
    {
      id: 'toggle-sound',
      title: isSoundMuted ? 'Unmute Futuristic UI Sounds' : 'Mute UI Sound Effects',
      subtitle: isSoundMuted ? 'Enable synthetic audio feedback' : 'Disable click and verification chimes',
      category: 'Preferences',
      icon: isSoundMuted ? '🔇' : '🔊',
      action: () => {
        const next = soundEffects.toggleMute();
        setIsSoundMuted(next);
      }
    },
    // ── Org & Admin Jumps ──
    {
      id: 'org-portal',
      title: 'Organization Portal',
      subtitle: 'Recruiter candidate review and analytics',
      category: 'Portals',
      icon: '🏢',
      action: () => navigate(ROUTES.ORG.DASHBOARD)
    },
    {
      id: 'admin-portal',
      title: 'Administrator Console',
      subtitle: 'System health, organizations, and global settings',
      category: 'Portals',
      icon: '🛡️',
      action: () => navigate(ROUTES.ADMIN.DASHBOARD)
    }
  ];

  // Filter items
  const filtered = items.filter(item => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      item.title.toLowerCase().includes(q) ||
      item.subtitle.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q)
    );
  });

  // Handle keyboard navigation
  function handleInputKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % (filtered.length || 1));
      soundEffects.playClick();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + (filtered.length || 1)) % (filtered.length || 1));
      soundEffects.playClick();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        executeItem(filtered[selectedIndex]);
      }
    }
  }

  function executeItem(item) {
    soundEffects.playClick();
    setIsOpen(false);
    item.action();
  }

  if (!isOpen) return null;

  return createPortal(
    <div
      className="cmd-palette-backdrop"
      onClick={() => setIsOpen(false)}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '12vh',
        animation: 'cmdFadeIn 180ms ease'
      }}
    >
      <div
        className="cmd-palette-modal"
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 620,
          background: isDark ? 'rgba(18, 22, 34, 0.95)' : 'rgba(255, 255, 255, 0.98)',
          border: isDark ? '1px solid rgba(7, 152, 212, 0.35)' : '1px solid rgba(0, 0, 0, 0.12)',
          borderRadius: 16,
          boxShadow: isDark
            ? '0 24px 60px rgba(0, 0, 0, 0.6), 0 0 30px rgba(7, 152, 212, 0.2)'
            : '0 24px 60px rgba(0, 0, 0, 0.2)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '70vh'
        }}
      >
        {/* Search Bar Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '16px 20px',
            borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.08)',
            gap: 12
          }}
        >
          <span style={{ fontSize: 18, color: 'var(--primary, #0798d4)' }}>🔍</span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or search (e.g., assessment, face, dark mode)..."
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleInputKeyDown}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: 15,
              fontWeight: 500,
              color: isDark ? '#ffffff' : '#111827',
              fontFamily: 'inherit'
            }}
          />
          <kbd
            style={{
              fontSize: 11,
              padding: '3px 7px',
              borderRadius: 6,
              background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)',
              color: isDark ? '#94a3b8' : '#64748b',
              fontWeight: 600,
              border: isDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(0, 0, 0, 0.1)'
            }}
          >
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div
          style={{
            overflowY: 'auto',
            padding: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4
          }}
        >
          {filtered.length === 0 ? (
            <div
              style={{
                padding: '32px 16px',
                textAlign: 'center',
                color: isDark ? '#94a3b8' : '#64748b',
                fontSize: 14
              }}
            >
              No matching commands or pages found.
            </div>
          ) : (
            filtered.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => executeItem(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 10,
                    cursor: 'pointer',
                    transition: 'all 120ms ease',
                    background: isSelected
                      ? isDark
                        ? 'rgba(7, 152, 212, 0.18)'
                        : 'rgba(7, 152, 212, 0.1)'
                      : 'transparent',
                    border: isSelected
                      ? isDark
                        ? '1px solid rgba(7, 152, 212, 0.35)'
                        : '1px solid rgba(7, 152, 212, 0.25)'
                      : '1px solid transparent'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 18 }}>{item.icon}</span>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: isSelected
                            ? isDark
                              ? '#38bdf8'
                              : '#0284c7'
                            : isDark
                            ? '#f1f5f9'
                            : '#0f172a'
                        }}
                      >
                        {item.title}
                      </span>
                      <span
                        style={{
                          fontSize: 12,
                          color: isDark ? '#94a3b8' : '#64748b',
                          marginTop: 1
                        }}
                      >
                        {item.subtitle}
                      </span>
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: 6,
                      background: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
                      color: isDark ? '#64748b' : '#94a3b8'
                    }}
                  >
                    {item.category}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div
          style={{
            padding: '10px 18px',
            borderTop: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 12,
            color: isDark ? '#64748b' : '#94a3b8'
          }}
        >
          <div style={{ display: 'flex', gap: 14 }}>
            <span><kbd style={{ fontWeight: 700 }}>↑↓</kbd> to navigate</span>
            <span><kbd style={{ fontWeight: 700 }}>↵</kbd> to select</span>
          </div>
          <span>SkillProof Spotlight</span>
        </div>
      </div>

      <style>{`
        @keyframes cmdFadeIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>,
    document.body
  );
}
