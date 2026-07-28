import { useState } from 'react';
import { useToast } from '../../components/common/Toast';
import { MOCK_ORGANISATIONS_CONNECTED } from '../../core/mockData/user.mock';
import client from '../../core/api/client';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import { Card, CardHeader, CardTitle, CardBody } from '../../components/common/Card';

export default function Organizations() {
  const toast = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [connections, setConnections] = useState(MOCK_ORGANISATIONS_CONNECTED);
  const [searching, setSearching] = useState(false);

  async function handleSearch(e) {
    e.preventDefault();
    if (searchQuery.length < 2) return;

    try {
      setSearching(true);
      const res = await client.get('/auth/orgs/search', { params: { q: searchQuery } });
      setSearchResults(res.data);
      if (res.data.length === 0) {
        toast.info('No results', 'No matching approved organisations found.');
      }
    } catch (err) {
      toast.error('Search failed', 'Could not query organisations.');
    } finally {
      setSearching(false);
    }
  }

  function handleConnect(org) {
    toast.success('Connection Sent', `Pending authorization from ${org.name}.`);
    // Add to local mock connections list
    setConnections(prev => [
      ...prev,
      {
        id: org.id,
        name: org.name,
        org_type: org.org_type,
        status: 'pending',
        reports_shared: 0,
        connected_at: new Date().toISOString().split('T')[0],
      }
    ]);
  }

  return (
    <div className="anim-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="page-header">
        <h2 className="page-header__title">Connected Organisations</h2>
        <p className="page-header__subtitle">Manage college linkages and permit placement cells to access your scores</p>
      </div>

      <div className="grid-2">
        {/* Connected orgs */}
        <Card>
          <CardHeader><CardTitle>Linked Institutions</CardTitle></CardHeader>
          <CardBody style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {connections.map(c => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
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
        <Card>
          <CardHeader><CardTitle>Connect with an Institution</CardTitle></CardHeader>
          <CardBody>
            <form onSubmit={handleSearch} style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              <Input
                id="org-search-q"
                placeholder="Search college name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Button type="submit" loading={searching}>
                Search
              </Button>
            </form>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {searchResults.map(org => (
                <div key={org.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{org.name}</div>
                    {org.website && <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{org.website}</div>}
                  </div>
                  <Button size="sm" onClick={() => handleConnect(org)}>
                    Connect
                  </Button>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
