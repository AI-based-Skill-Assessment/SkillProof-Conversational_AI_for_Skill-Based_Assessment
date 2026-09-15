import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import client from '../../core/api/client';
import { useAuth } from '../../core/auth/AuthContext';
import { Card, CardBody } from '../../components/common/Card';
import StatusBadge from '../../components/common/StatusBadge';
import { formatDateTime } from '../../utils/formatDate';
import {
  buildNotificationsFromData,
  markNotificationAsRead,
  markAllNotificationsAsRead
} from '../../utils/notificationService';

export default function Notifications() {
  const { user } = useAuth();
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');

  useEffect(() => {
    async function loadNotifications() {
      try {
        setLoading(true);
        const res = await client.get('/sessions');
        const sessionList = res.data || [];
        const built = buildNotificationsFromData({ user, sessions: sessionList });
        setNotifs(built);
      } catch (err) {
        console.warn('Failed to load session notifications:', err);
        const built = buildNotificationsFromData({ user, sessions: [] });
        setNotifs(built);
      } finally {
        setLoading(false);
      }
    }

    loadNotifications();
  }, [user]);

  function handleMarkRead(id) {
    markNotificationAsRead(id);
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  }

  function handleMarkAllRead() {
    const unreadIds = notifs.filter(n => !n.is_read).map(n => n.id);
    markAllNotificationsAsRead(unreadIds);
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
  }

  const filtered = notifs.filter(n => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'assessment') return n.category === 'assessment';
    if (activeFilter === 'security') return n.category === 'security' || n.category === 'document';
    if (activeFilter === 'credential') return n.category === 'credential';
    return true;
  });

  const unreadCount = notifs.filter(n => !n.is_read).length;

  return (
    <div className="anim-fade-in" style={{ maxWidth: 760, margin: '0 auto' }}>
      <div className="page-header page-header--row" style={{ alignItems: 'center' }}>
        <div>
          <h2 className="page-header__title">Notifications</h2>
          <p className="page-header__subtitle">Real-time updates on your assessments, cryptographic credentials, and biometric audits</p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="common-button common-button--secondary"
            style={{ fontSize: 12, padding: '6px 14px' }}
          >
            Mark All Read ({unreadCount})
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="notification-filters" role="tablist" aria-label="Notification categories">
        {[
          { key: 'all', label: 'All' },
          { key: 'assessment', label: 'Assessments' },
          { key: 'security', label: 'Security & Documents' },
          { key: 'credential', label: 'Credentials' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveFilter(tab.key)}
            className={`notification-filter${activeFilter === tab.key ? ' notification-filter--active' : ''}`}
            role="tab"
            aria-selected={activeFilter === tab.key}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <Card>
        <CardBody style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0 }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
              <div className="loading-spinner" style={{ margin: '0 auto 12px' }} />
              <p>Loading activity notifications...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon" aria-hidden="true">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                  <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
                </svg>
              </div>
              <h3 className="empty-state__title">No notifications found</h3>
              <p className="empty-state__text">There is nothing new in this category yet.</p>
            </div>
          ) : (
            filtered.map((n, idx) => (
              <div
                key={n.id}
                style={{
                  display: 'flex',
                  gap: 16,
                  padding: '16px 20px',
                  borderBottom: idx === filtered.length - 1 ? 'none' : '1px solid var(--border)',
                  background: n.is_read ? 'transparent' : 'rgba(18, 163, 126, 0.03)',
                  transition: 'background 200ms ease'
                }}
              >
                <div style={{ marginTop: 2 }}>
                  <StatusBadge
                    variant={
                      n.category === 'assessment' ? 'success' :
                      n.category === 'credential' ? 'primary' :
                      n.category === 'security' ? 'info' : 'secondary'
                    }
                    dot={!n.is_read}
                  >
                    {n.category.toUpperCase()}
                  </StatusBadge>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                      {n.title}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {formatDateTime(n.created_at)}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.5 }}>
                    {n.message}
                  </div>
                  {n.link && (
                    <div style={{ marginTop: 8 }}>
                      <Link
                        to={n.link}
                        onClick={() => handleMarkRead(n.id)}
                        style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary)', textDecoration: 'none' }}
                      >
                        View Details →
                      </Link>
                    </div>
                  )}
                </div>
                {!n.is_read && (
                  <button
                    onClick={() => handleMarkRead(n.id)}
                    style={{
                      fontSize: 11,
                      color: 'var(--text-secondary)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: 600,
                      height: 'fit-content',
                      padding: '4px 8px',
                      borderRadius: 'var(--radius-sm)'
                    }}
                    title="Mark as read"
                  >
                    ✓ Read
                  </button>
                )}
              </div>
            ))
          )}
        </CardBody>
      </Card>
    </div>
  );
}
