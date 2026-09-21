import { useState, useEffect } from 'react';
import { useToast } from '../../components/common/Toast';
import { useAuth } from '../../core/auth/AuthContext';
import { MOCK_ORGANISATIONS_CONNECTED } from '../../core/mockData/user.mock';
import client from '../../core/api/client';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import { Card, CardHeader, CardTitle, CardBody } from '../../components/common/Card';

const STORAGE_KEY_CONNS = 'skillproof_user_connections';
const STORAGE_KEY_REQUESTS = 'skillproof_org_requests';

export default function Organizations() {
  const toast = useToast();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load candidate's real linkages from PostgreSQL
  useEffect(() => {
    async function loadConnections() {
      try {
        setLoading(true);
        const res = await client.get('/auth/user/orgs/connections');
        setConnections(res.data);
      } catch (err) {
        console.warn('Failed to load DB connections, falling back to local state:', err);
      } finally {
        setLoading(false);
      }
    }
    loadConnections();
  }, []);

  async function handleSearch(e) {
    e.preventDefault();
    if (searchQuery.length < 2) return;

    try {
      setSearching(true);
      const res = await client.get('/auth/orgs/search', { params: { q: searchQuery } });
      setSearchResults(res.data);
      if (res.data.length === 0) {
        toast.info('No results', 'No matching approved organizations found.');
      }
    } catch (err) {
      toast.error('Search failed', 'Could not query organizations.');
    } finally {
      setSearching(false);
    }
  }

  async function handleConnect(org) {
    const existing = connections.find(c => c.org_id === org.id || c.name === org.name);
    if (existing && existing.status !== 'rejected' && existing.status !== 'revoked') {
      toast.info('Already Requested', `You already have an active/pending connection request with ${org.name}.`);
      return;
    }

    try {
      const res = await client.post(`/auth/user/orgs/${org.id}/connect`);
      const updatedConnection = {
        id: res.data.id,
        org_id: org.id,
        name: org.name,
        org_type: org.org_type || 'college',
        status: res.data.status || 'pending',
        reports_shared: 0,
        connected_at: new Date().toISOString().split('T')[0],
      };
      setConnections(prev => [updatedConnection, ...prev.filter(c => c.org_id !== org.id && c.name !== org.name)]);
      toast.success('Connection Request Sent', `Submitted to ${org.name} for placement cell authorization.`);
    } catch (err) {
      toast.error('Connection Failed', err.response?.data?.detail || 'Could not send connection request.');
    }
  }


  return (
    <div className="anim-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="page-header">
        <h2 className="page-header__title">Connected Organizations</h2>
        <p className="page-header__subtitle">Manage institution linkages and permit placement cells to access your certified reports</p>
      </div>

      <div className="grid-2">
        {/* Connected orgs */}
        <Card tilt hoverable>
          <CardHeader><CardTitle>Linked Institutions</CardTitle></CardHeader>
          <CardBody style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {connections.map(c => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                    Connected on: {c.connected_at} • {c.reports_shared} reports shared
                  </div>
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 10,
                  background: c.status === 'approved' ? 'var(--success-bg)' : 'var(--warning-bg)',
                  color: c.status === 'approved' ? 'var(--success)' : 'var(--warning)'
                }}>
                  {c.status.toUpperCase()}
                </span>
              </div>
            ))}
          </CardBody>
        </Card>

        {/* Search & connect */}
        <Card tilt hoverable>
          <CardHeader><CardTitle>Connect with an Institution</CardTitle></CardHeader>
          <CardBody>
            <form onSubmit={handleSearch} style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              <Input
                id="org-search-q"
                placeholder="Search college or company name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Button type="submit" loading={searching}>
                Search
              </Button>
            </form>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {searchResults.length === 0 ? (
                <div style={{ color: 'var(--text-secondary)', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>
                  Search by name to discover and link accredited placement cells.
                </div>
              ) : (
                searchResults.map(org => (
                  <div key={org.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{org.name}</div>
                      {org.website && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{org.website}</div>}
                    </div>
                    <Button size="sm" onClick={() => handleConnect(org)}>
                      Connect
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
