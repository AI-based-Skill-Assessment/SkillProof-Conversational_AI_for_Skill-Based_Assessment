import { useState, useEffect } from 'react';
import { MOCK_NOTIFICATIONS } from '../../core/mockData/user.mock';
import { Card, CardHeader, CardTitle, CardBody } from '../../components/common/Card';
import StatusBadge from '../../components/common/StatusBadge';
import { formatDateTime } from '../../utils/formatDate';

export default function Notifications() {
  const [notifs, setNotifs] = useState(MOCK_NOTIFICATIONS);

  function handleMarkRead(id) {
    setNotifs(prev =>
      prev.map(n => n.id === id ? { ...n, is_read: true } : n)
    );
  }

  return (
    <div className="anim-fade-in" style={{ maxWidth: 640, margin: '0 auto' }}>
      <div className="page-header">
        <h2 className="page-header__title">Notifications</h2>
        <p className="page-header__subtitle">Stay updated on your verification reviews and placement linkages</p>
      </div>

      <Card>
        <CardBody style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {notifs.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-secondary)' }}>
              No notifications yet.
            </div>
          ) : (
            notifs.map(n => (
              <div
                key={n.id}
                style={{
                  display: 'flex', gap: 16, borderBottom: '1px solid var(--border)', paddingBottom: 16,
                  opacity: n.is_read ? 0.65 : 1
                }}
              >
                <div style={{ marginTop: 2 }}>
                  <StatusBadge variant={n.category === 'assessment' ? 'success' : 'info'} dot={false}>
                    {n.category.toUpperCase()}
                  </StatusBadge>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{n.title}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{n.message}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6 }}>{formatDateTime(n.created_at)}</div>
                </div>
                {!n.is_read && (
                  <button
                    onClick={() => handleMarkRead(n.id)}
                    style={{ fontSize: 11, color: 'var(--primary)', height: 'fit-content', fontWeight: 600 }}
                  >
                    Mark read
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
