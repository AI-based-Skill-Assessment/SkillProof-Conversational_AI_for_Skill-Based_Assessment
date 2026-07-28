import { useEffect, useState } from 'react';
import client from '../../core/api/client';
import { MOCK_ACTIVITY } from '../../core/mockData/admin.mock';
import { formatDateTime } from '../../utils/formatDate';

export default function Activity() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLogs() {
      try {
        const res = await client.get('/admin/activity');
        setLogs(res.data);
      } catch (err) {
        setLogs(MOCK_ACTIVITY);
      } finally {
        setLoading(false);
      }
    }
    loadLogs();
  }, []);

  return (
    <div className="anim-fade-in">
      <div className="page-header">
        <h2 className="page-header__title">System Activity Logs</h2>
        <p className="page-header__subtitle">Real-time status transitions and user activities audit logs</p>
      </div>

      {loading ? (
        <div>Loading logs...</div>
      ) : (
        <div className="common-table-container">
          <table className="common-table">
            <thead>
              <tr>
                <th>Session ID</th>
                <th>Candidate / Initiator</th>
                <th>Platform Event</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, idx) => (
                <tr key={log.session_id || idx}>
                  <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{log.session_id}</td>
                  <td style={{ fontWeight: 600 }}>{log.candidate}</td>
                  <td>{log.event}</td>
                  <td>{formatDateTime(log.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
