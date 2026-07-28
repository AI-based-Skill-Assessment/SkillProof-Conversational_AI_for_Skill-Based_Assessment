import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useToast } from '../../components/common/Toast';
import client from '../../core/api/client';
import { MOCK_ORGANISATIONS } from '../../core/mockData/admin.mock';
import { Card, CardHeader, CardTitle, CardBody } from '../../components/common/Card';
import StatusBadge from '../../components/common/StatusBadge';
import { formatDate } from '../../utils/formatDate';
import Button from '../../components/common/Button';
import ROUTES from '../../core/routes';

export default function OrganizationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [org, setOrg] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOrg() {
      try {
        const res = await client.get(`/admin/organisations/${id}`);
        setOrg(res.data);
      } catch (err) {
        // Fallback mock
        const mock = MOCK_ORGANISATIONS.find(o => o.id === id) || MOCK_ORGANISATIONS[0];
        setOrg(mock);
      } finally {
        setLoading(false);
      }
    }
    fetchOrg();
  }, [id]);

  async function handleStatus(action) {
    try {
      // endpoints: approve, suspend, reactivate, reject
      const res = await client.post(`/admin/organisations/${id}/${action}`);
      setOrg(res.data);
      toast.success('Status updated', `Institution has been marked as ${res.data.status}.`);
    } catch (err) {
      toast.error('Action failed', 'Failed updating status.');
    }
  }

  async function handleDelete() {
    try {
      await client.delete(`/admin/organisations/${id}`);
      toast.success('Deleted', 'Institution has been removed.');
      navigate(ROUTES.ADMIN.ORGS_LIST);
    } catch (err) {
      toast.error('Delete failed', 'Could not delete organization.');
    }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Loading organization detail...</div>;

  return (
    <div className="anim-fade-in" style={{ maxWidth: 720, margin: '0 auto' }}>
      <div className="page-header page-header--row">
        <div>
          <h2 className="page-header__title">Institution Details</h2>
          <p className="page-header__subtitle">Manage approved statuses, view contacts, or suspend active access keys</p>
        </div>
        <div className="page-header__actions">
          <Button variant="secondary" onClick={() => navigate(ROUTES.ADMIN.ORGS_LIST)}>
            Back
          </Button>
          <Link to={ROUTES.ADMIN.ORG_EDIT(id)} className="common-button common-button--secondary">
            Edit
          </Link>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <Card>
          <CardHeader>
            <CardTitle>{org.name}</CardTitle>
            <StatusBadge variant={org.status === 'approved' ? 'success' : org.status === 'pending' ? 'warning' : 'error'}>
              {org.status.toUpperCase()}
            </StatusBadge>
          </CardHeader>
          <CardBody style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16, fontSize: 14 }}>
            <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Official Email:</div>
            <div>{org.email}</div>

            <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Primary Contact:</div>
            <div>{org.contact_name || 'Dr. Ramesh Kumar'}</div>

            <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Contact Phone:</div>
            <div>{org.contact_phone || '+91-9876543210'}</div>

            <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Website Link:</div>
            <div>
              <a href={org.website} target="_blank" rel="noopener noreferrer">{org.website || 'https://www.nitt.edu'}</a>
            </div>

            <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Candidates Linked:</div>
            <div style={{ fontWeight: 600 }}>{org.total_candidates} candidates connected</div>

            <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Created At:</div>
            <div>{formatDate(org.created_at)}</div>
          </CardBody>
        </Card>

        {/* Administration Actions Panel */}
        <Card>
          <CardHeader><CardTitle>Governance Actions</CardTitle></CardHeader>
          <CardBody style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {org.status === 'pending' && (
              <>
                <Button onClick={() => handleStatus('approve')}>Approve Registration</Button>
                <Button variant="danger" onClick={() => handleStatus('reject')}>Reject</Button>
              </>
            )}
            {org.status === 'approved' && (
              <Button variant="danger" onClick={() => handleStatus('suspend')}>Suspend Access</Button>
            )}
            {org.status === 'suspended' && (
              <Button onClick={() => handleStatus('reactivate')}>Reactivate Access</Button>
            )}
            <Button variant="danger" onClick={handleDelete} style={{ marginLeft: 'auto' }}>
              Delete Account
            </Button>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
