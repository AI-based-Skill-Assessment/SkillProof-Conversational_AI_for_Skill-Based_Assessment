import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import client from '../../core/api/client';
import { MOCK_ORGANISATIONS } from '../../core/mockData/admin.mock';
import StatusBadge from '../../components/common/StatusBadge';
import { formatDate } from '../../utils/formatDate';
import ROUTES from '../../core/routes';

export default function OrganizationsList() {
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadOrgs() {
      try {
        const res = await client.get('/admin/organisations');
        setOrgs(res.data);
      } catch (err) {
        setOrgs(MOCK_ORGANISATIONS);
      } finally {
        setLoading(false);
      }
    }
    loadOrgs();
  }, []);

  return (
    <div className="anim-fade-in">
      <div className="page-header page-header--row">
        <div>
          <h2 className="page-header__title">Registered Institutions</h2>
          <p className="page-header__subtitle">Manage college linkages and institutional accounts</p>
        </div>
        <div className="page-header__actions">
          <Link to={ROUTES.ADMIN.ORG_CREATE} className="common-button common-button--primary" style={{ background: 'var(--error)', borderColor: 'var(--error)' }}>
            Create Organisation
          </Link>
        </div>
      </div>

      {loading ? (
        <div>Loading organizations...</div>
      ) : (
        <div className="common-table-container">
          <table className="common-table">
            <thead>
              <tr>
                <th>Institution Name</th>
                <th>Email</th>
                <th>Type</th>
                <th>Contacts</th>
                <th>Candidates count</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orgs.map(o => (
                <tr key={o.id}>
                  <td style={{ fontWeight: 600 }}>{o.name}</td>
                  <td>{o.email}</td>
                  <td style={{ textTransform: 'capitalize' }}>{o.org_type}</td>
                  <td>{o.contact_name || 'Dr. Ramesh Kumar'}</td>
                  <td style={{ fontWeight: 600 }}>{o.total_candidates} students</td>
                  <td>
                    <StatusBadge variant={o.status === 'approved' ? 'success' : o.status === 'pending' ? 'warning' : 'error'}>
                      {o.status.toUpperCase()}
                    </StatusBadge>
                  </td>
                  <td>
                    <Link to={ROUTES.ADMIN.ORG_DETAIL(o.id)} className="common-button common-button--secondary common-button--sm">
                      Details
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
