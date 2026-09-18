import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import ROUTES from '../../core/routes';

export default function PortalSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  const portals = [
    { label: 'Candidate Portal', path: ROUTES.USER.SIGNIN, role: 'user' },
    { label: 'Institution Portal', path: ROUTES.ORG.SIGNIN, role: 'org' },
    { label: 'System Admin', path: ROUTES.ADMIN.LOGIN, role: 'admin' },
  ];

  const currentPortal = portals.find(p => location.pathname.startsWith(`/${p.role}`)) || portals[0];

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div 
      ref={dropdownRef} 
      style={{ 
        position: 'absolute', 
        top: '24px', 
        right: '24px', 
        zIndex: 1000 
      }}
    >
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(18, 18, 29, 0.4)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 'var(--radius-md)',
          padding: '8px 16px',
          color: 'var(--text-primary)',
          fontSize: 'var(--text-sm)',
          fontWeight: 600,
          cursor: 'pointer',
          backdropFilter: 'blur(12px)',
          transition: 'all 0.2s ease'
        }}
      >
        <span>{currentPortal.label}</span>
        <span style={{ fontSize: '10px' }}>▼</span>
      </button>

      {isOpen && (
        <div 
          className="anim-scale-in"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            background: 'var(--surface-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            overflow: 'hidden',
            minWidth: '200px'
          }}
        >
          {portals.map(portal => (
            <button
              key={portal.path}
              type="button"
              onClick={() => {
                setIsOpen(false);
                navigate(portal.path);
              }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '12px 16px',
                background: currentPortal.path === portal.path ? 'var(--nav-active-bg)' : 'transparent',
                color: currentPortal.path === portal.path ? 'var(--primary)' : 'var(--text-secondary)',
                border: 'none',
                borderBottom: '1px solid var(--border)',
                cursor: 'pointer',
                fontSize: 'var(--text-sm)',
                fontWeight: currentPortal.path === portal.path ? 700 : 500,
                transition: 'background 0.2s ease, color 0.2s ease'
              }}
              onMouseEnter={(e) => {
                if (currentPortal.path !== portal.path) {
                   e.currentTarget.style.background = 'var(--surface)';
                   e.currentTarget.style.color = 'var(--text-primary)';
                }
              }}
              onMouseLeave={(e) => {
                if (currentPortal.path !== portal.path) {
                   e.currentTarget.style.background = 'transparent';
                   e.currentTarget.style.color = 'var(--text-secondary)';
                }
              }}
            >
              {portal.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
