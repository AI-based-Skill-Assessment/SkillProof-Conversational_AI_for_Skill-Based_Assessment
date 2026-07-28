import { useEffect, useState } from 'react';
import client from '../../core/api/client';
import { MOCK_USERS } from '../../core/mockData/admin.mock';
import StatusBadge from '../../components/common/StatusBadge';
import { formatDate } from '../../utils/formatDate';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUsers() {
      try {
        const res = await client.get('/admin/users');
        setUsers(res.data);
      } catch (err) {
        setUsers(MOCK_USERS);
      } finally {
        setLoading(false);
      }
    }
    loadUsers();
  }, []);

  return (
    <div className="anim-fade-in">
      <div className="page-header">
        <h2 className="page-header__title">Candidate Registries</h2>
        <p className="page-header__subtitle">Monitor and verify candidate profile details and biometric template readiness</p>
      </div>

      {loading ? (
        <div>Loading candidates...</div>
      ) : (
        <div className="common-table-container">
          <table className="common-table">
            <thead>
              <tr>
                <th>Candidate Name</th>
                <th>Email Address</th>
                <th>Registered At</th>
                <th>Type</th>
                <th>Face ID</th>
                <th>Voice ID</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 600 }}>{u.full_name}</td>
                  <td>{u.email}</td>
                  <td>{formatDate(u.created_at)}</td>
                  <td style={{ textTransform: 'capitalize' }}>{u.account_type.replace('_', ' ')}</td>
                  <td>
                    <StatusBadge variant={u.face_registered ? 'success' : 'neutral'} dot={false}>
                      {u.face_registered ? 'Face ready' : 'Not set'}
                    </StatusBadge>
                  </td>
                  <td>
                    <StatusBadge variant={u.voice_registered ? 'success' : 'neutral'} dot={false}>
                      {u.voice_registered ? 'Voice ready' : 'Not set'}
                    </StatusBadge>
                  </td>
                  <td>
                    <StatusBadge variant={u.is_active ? 'success' : 'neutral'}>
                      {u.is_active ? 'Active' : 'Inactive'}
                    </StatusBadge>
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
