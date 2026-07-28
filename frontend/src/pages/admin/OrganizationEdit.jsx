import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '../../components/common/Toast';
import client from '../../core/api/client';
import { MOCK_ORGANISATIONS } from '../../core/mockData/admin.mock';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import ROUTES from '../../core/routes';

export default function OrganizationEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [name, setName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadOrg() {
      try {
        const res = await client.get(`/admin/organisations/${id}`);
        const o = res.data;
        setName(o.name);
        setContactName(o.contact_name || '');
        setContactPhone(o.contact_phone || '');
        setWebsite(o.website || '');
        setAddress(o.address || '');
      } catch (err) {
        const mock = MOCK_ORGANISATIONS.find(o => o.id === id) || MOCK_ORGANISATIONS[0];
        setName(mock.name);
        setContactName(mock.contact_name || '');
        setContactPhone(mock.contact_phone || '');
        setWebsite(mock.website || '');
        setAddress(mock.address || '');
      }
    }
    loadOrg();
  }, [id]);

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      setLoading(true);
      await client.put(`/admin/organisations/${id}`, {
        name,
        contact_name: contactName,
        contact_phone: contactPhone,
        website,
        address
      });
      toast.success('Updated', 'Institution credentials updated.');
      navigate(ROUTES.ADMIN.ORG_DETAIL(id));
    } catch (err) {
      toast.error('Update failed', 'Could not save modifications.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="anim-fade-in" style={{ maxWidth: 640, margin: '0 auto' }}>
      <div className="page-header">
        <h2 className="page-header__title">Modify Institution Details</h2>
        <p className="page-header__subtitle">Edit addresses, sites, and phone parameters for live accounts</p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ gridColumn: 'span 2' }}>
          <Input
            label="College Name"
            type="text"
            id="admin-edit-org-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <Input
          label="Primary Contact Name"
          type="text"
          id="admin-edit-org-contact"
          value={contactName}
          onChange={(e) => setContactName(e.target.value)}
        />

        <Input
          label="Contact Phone"
          type="text"
          id="admin-edit-org-phone"
          value={contactPhone}
          onChange={(e) => setContactPhone(e.target.value)}
        />

        <Input
          label="Website URL"
          type="text"
          id="admin-edit-org-web"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />

        <div style={{ gridColumn: 'span 2' }}>
          <Input
            label="Physical Address"
            type="text"
            id="admin-edit-org-addr"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            textarea
          />
        </div>

        <div style={{ gridColumn: 'span 2', display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 12 }}>
          <Button variant="secondary" onClick={() => navigate(ROUTES.ADMIN.ORG_DETAIL(id))}>
            Cancel
          </Button>
          <Button type="submit" loading={loading} style={{ background: 'var(--error)', borderColor: 'var(--error)' }}>
            Save Modifications
          </Button>
        </div>
      </form>
    </div>
  );
}
