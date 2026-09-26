import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../components/common/Toast';
import { useAuth } from '../../core/auth/AuthContext';
import client from '../../core/api/client';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import { Card, CardHeader, CardTitle, CardBody } from '../../components/common/Card';

export default function Organizations() {
  const toast = useToast();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load candidate's real linkages from database
  const loadConnections = useCallback(async () => {
    try {
      setLoading(true);
      const res = await client.get('/auth/user/orgs/connections');
      setConnections(res.data || []);
    } catch (err) {
      console.warn('Failed to load DB connections:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load available accredited organisations for candidate to discover
  const loadDiscoverOrgs = useCallback(async (query = '') => {
    try {
      setSearching(true);
      const res = await client.get('/auth/orgs/search', { params: { q: query } });
      setSearchResults(res.data || []);
    } catch (err) {
      console.warn('Could not query organisations:', err);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    loadConnections();
    loadDiscoverOrgs('');
  }, [loadConnections, loadDiscoverOrgs]);

  // Live search handler
  function handleQueryChange(e) {
    const val = e.target.value;
    setSearchQuery(val);
    loadDiscoverOrgs(val);
  }

  function handleSearchSubmit(e) {
    e.preventDefault();
    loadDiscoverOrgs(searchQuery);
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
        <p className="page-header__subtitle">Manage institution linkages and permit placement cells to access your verified reports</p>
      </div>

      <div className="grid-2">
        {/* Connected orgs */}
        <Card tilt hoverable>
          <CardHeader>
            <CardTitle>Linked Institutions ({connections.length})</CardTitle>
          </CardHeader>
          <CardBody style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {loading ? (
              <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '24px 0' }}>
                Loading your institution linkages...
              </div>
            ) : connections.length === 0 ? (
              <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '24px 0', fontSize: 13 }}>
                No connected institutions yet. Search on the right to link your university or company.
              </div>
            ) : (
              connections.map(c => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                      {c.connected_at ? `Requested on: ${c.connected_at}` : 'Connected'} • {c.reports_shared} reports shared
                    </div>
                  </div>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: 12,
                    background: c.status === 'approved' ? 'rgba(16, 185, 129, 0.15)' : c.status === 'rejected' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                    color: c.status === 'approved' ? '#10b981' : c.status === 'rejected' ? '#ef4444' : '#f59e0b',
                    border: `1px solid ${c.status === 'approved' ? 'rgba(16, 185, 129, 0.3)' : c.status === 'rejected' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`
                  }}>
                    {c.status.toUpperCase()}
                  </span>
                </div>
              ))
            )}
          </CardBody>
        </Card>

        {/* Search & connect */}
        <Card tilt hoverable>
          <CardHeader>
            <CardTitle>Discover & Connect with Institutions</CardTitle>
          </CardHeader>
          <CardBody>
            <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              <Input
                id="org-search-q"
                placeholder="Search college, university, or company..."
                value={searchQuery}
                onChange={handleQueryChange}
              />
              <Button type="submit" loading={searching}>
                Search
              </Button>
            </form>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {searching ? (
                <div style={{ color: 'var(--text-secondary)', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>
                  Searching institutions...
                </div>
              ) : searchResults.length === 0 ? (
                <div style={{ color: 'var(--text-secondary)', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>
                  {searchQuery ? 'No matching approved institutions found.' : 'No institutions available at this time.'}
                </div>
              ) : (
                searchResults.map(org => {
                  const conn = connections.find(c => c.org_id === org.id || c.name === org.name);
                  const isPending = conn && conn.status === 'pending';
                  const isApproved = conn && conn.status === 'approved';

                  return (
                    <div key={org.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{org.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                          {org.org_type || 'college'} {org.website ? `• ${org.website}` : ''}
                        </div>
                      </div>

                      {isApproved ? (
                        <span style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '3px 10px',
                          borderRadius: 12,
                          background: 'rgba(16, 185, 129, 0.15)',
                          color: '#10b981',
                          border: '1px solid rgba(16, 185, 129, 0.3)'
                        }}>
                          CONNECTED
                        </span>
                      ) : isPending ? (
                        <span style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '3px 10px',
                          borderRadius: 12,
                          background: 'rgba(245, 158, 11, 0.15)',
                          color: '#f59e0b',
                          border: '1px solid rgba(245, 158, 11, 0.3)'
                        }}>
                          REQUESTED
                        </span>
                      ) : (
                        <Button size="sm" onClick={() => handleConnect(org)}>
                          Connect
                        </Button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
