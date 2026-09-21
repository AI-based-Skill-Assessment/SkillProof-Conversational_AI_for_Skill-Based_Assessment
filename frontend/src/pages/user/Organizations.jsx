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

  const [connections, setConnections] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CONNS);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      // Clean up legacy dummy org records
      return parsed.filter(c => c.name !== 'TechCorp Solutions Pvt Ltd');
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_CONNS, JSON.stringify(connections));
  }, [connections]);

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

  function handleConnect(org) {
    // Check if already connected or pending
    if (connections.some(c => c.id === org.id || c.name === org.name)) {
      toast.info('Already Requested', `You already have a connection with ${org.name}.`);
      return;
    }

    const newConnection = {
      id: org.id || `org-${Date.now()}`,
      name: org.name,
      org_type: org.org_type || 'college',
      status: 'pending',
      reports_shared: 0,
      connected_at: new Date().toISOString().split('T')[0],
    };

    const newRequest = {
      id: `req-${Date.now()}`,
      candidate_id: user?.id || 'cand-current',
      candidate_name: user?.full_name || 'Current Student Candidate',
      candidate_email: user?.email || 'candidate@student.edu',
      org_id: org.id,
      org_name: org.name,
      status: 'pending',
      requested_at: new Date().toISOString().split('T')[0],
      assessments_count: 1,
      face_registered: user?.face_registered ?? true,
      voice_registered: user?.voice_registered ?? true,
      average_score: 85,
    };

    // Save to org incoming requests
    try {
      const existingReqs = JSON.parse(localStorage.getItem(STORAGE_KEY_REQUESTS) || '[]');
      existingReqs.unshift(newRequest);
      localStorage.setItem(STORAGE_KEY_REQUESTS, JSON.stringify(existingReqs));
    } catch (e) {
      console.error(e);
    }

    setConnections(prev => [newConnection, ...prev]);
    toast.success('Connection Request Sent', `Submitted to ${org.name} for placement cell authorization.`);
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
