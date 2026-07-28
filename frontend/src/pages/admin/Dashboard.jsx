import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import client from '../../core/api/client';
import { MOCK_ADMIN_STATS, MOCK_ORGANISATIONS } from '../../core/mockData/admin.mock';
import { StatCard } from '../../components/common/Card';
import StatusBadge from '../../components/common/StatusBadge';
import { formatDate } from '../../utils/formatDate';
import Button from '../../components/common/Button';
import ROUTES from '../../core/routes';
import '../../styles/pages/portal.css';

export default function Dashboard() {
  const [stats, setStats] = useState(MOCK_ADMIN_STATS);
  const [pendingOrgs, setPendingOrgs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      try {
        setLoading(true);
        // Call live endpoints
        const statsRes = await client.get('/admin/stats');
        setStats(statsRes.data);
        
        const orgsRes = await client.get('/admin/organisations', { params: { status_filter: 'pending' } });
        setPendingOrgs(orgsRes.data);
      } catch (err) {
        console.error('Failed fetching live admin dashboard, running mock demo:', err);
        setStats(MOCK_ADMIN_STATS);
        setPendingOrgs(MOCK_ORGANISATIONS.filter(o => o.status === 'pending'));
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, []);

  async function handleApprove(orgId) {
    try {
      await client.post(`/admin/organisations/${orgId}/approve`);
      // Update local state
      setPendingOrgs(prev => prev.filter(o => o.id !== orgId));
      setStats(prev => ({
        ...prev,
        active_organisations: prev.active_organisations + 1,
        pending_approval: prev.pending_approval - 1
      }));
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="anim-fade-in">
      <div className="page-header page-header--row">
        <div>
          <h2 className="page-header__title">Administration Dashboard</h2>
          <p className="page-header__subtitle">Manage approved institutions, review requests, and monitor assessments</p>
        </div>
        <div className="page-header__actions">
          <Link to={ROUTES.ADMIN.ORG_CREATE} className="common-button common-button--primary" style={{ background: 'var(--error)', borderColor: 'var(--error)' }}>
            Create Organisation
          </Link>
        </div>
      </div>

      {/* Aggregate Stats */}
      <div className="dashboard-grid">
        <StatCard label="Registered Users" value={stats.total_users} icon="👥" />
        <StatCard label="Active Institutions" value={stats.active_organisations} icon="🎓" />
        <StatCard label="Pending Approvals" value={stats.pending_approval} icon="⏳" />
        <StatCard label="Assessments Conducted" value={stats.total_assessments} icon="⚡" />
      </div>

      {/* Pending Approvals Section */}
      <div className="dashboard-section">
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Pending Institution Approvals</h3>
        {loading ? (
          <div>Loading approvals...</div>
        ) : pendingOrgs.length === 0 ? (
          <div style={{ padding: 30, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', color: 'var(--text-secondary)' }}>
            No pending registration requests found.
          </div>
        ) : (
          <div className="common-table-container">
            <table className="common-table">
              <thead>
                <tr>
                  <th>Organisation Name</th>
                  <th>Official Email</th>
                  <th>Primary Contact</th>
                  <th>Submitted Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pendingOrgs.map(o => (
                  <tr key={o.id}>
                    <td style={{ fontWeight: 600 }}>{o.name}</td>
                    <td>{o.email}</td>
                    <td>{o.contact_name || 'Dr. Ramesh Kumar'}</td>
                    <td>{formatDate(o.created_at)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Button size="sm" onClick={() => handleApprove(o.id)}>
                          Approve
                        </Button>
                        <Link to={ROUTES.ADMIN.ORG_DETAIL(o.id)} className="common-button common-button--secondary common-button--sm">
                          Review
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
