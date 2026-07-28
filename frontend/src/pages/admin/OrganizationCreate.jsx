import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../components/common/Toast';
import client from '../../core/api/client';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import Select from '../../components/common/Select';
import ROUTES from '../../core/routes';

export default function OrganizationCreate() {
  const navigate = useNavigate();
  const toast = useToast();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('TempPass@2024');
  const [type, setType] = useState('college');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name || !email) return;

    try {
      setLoading(true);
      await client.post('/admin/organisations', {
        name,
        email,
        password,
        org_type: type,
        contact_name: contactName,
        contact_phone: contactPhone,
        website,
        address
      });

      toast.success('Organisation Created', 'Account created and approved successfully.');
      navigate(ROUTES.ADMIN.ORGS_LIST);
    } catch (err) {
      toast.error('Creation failed', err.response?.data?.detail || 'An organisation with this email already exists.');
    } finally {
      setLoading(false);
    }
  }

  const typeOptions = [
    { value: 'college', label: 'College' },
    { value: 'university', label: 'University' },
    { value: 'placement_cell', label: 'Placement Cell' },
    { value: 'company', label: 'Company / Corporate' },
    { value: 'other', label: 'Other' },
  ];

  return (
    <div className="anim-fade-in" style={{ maxWidth: 640, margin: '0 auto' }}>
      <div className="page-header">
        <h2 className="page-header__title">Pre-approve New Institution</h2>
        <p className="page-header__subtitle">Register an institution that bypasses the pending validation gate</p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ gridColumn: 'span 2' }}>
          <Input
            label="College Name"
            type="text"
            id="admin-create-org-name"
            placeholder="e.g. NIT Trichy"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <Input
          label="Official Email"
          type="email"
          id="admin-create-org-email"
          placeholder="placement@nitt.edu"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <Input
          label="Password (Temporary)"
          type="text"
          id="admin-create-org-pass"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <Select
          label="Institution Type"
          id="admin-create-org-type"
          options={typeOptions}
          value={type}
          onChange={(e) => setType(e.target.value)}
        />

        <Input
          label="Primary Contact Name"
          type="text"
          id="admin-create-org-contact"
          value={contactName}
          onChange={(e) => setContactName(e.target.value)}
        />

        <Input
          label="Contact Phone"
          type="text"
          id="admin-create-org-phone"
          value={contactPhone}
          onChange={(e) => setContactPhone(e.target.value)}
        />

        <Input
          label="Website URL"
          type="text"
          id="admin-create-org-web"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />

        <div style={{ gridColumn: 'span 2' }}>
          <Input
            label="Physical Address"
            type="text"
            id="admin-create-org-addr"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            textarea
          />
        </div>

        <div style={{ gridColumn: 'span 2', display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 12 }}>
          <Button variant="secondary" onClick={() => navigate(ROUTES.ADMIN.ORGS_LIST)}>
            Cancel
          </Button>
          <Button type="submit" loading={loading} style={{ background: 'var(--error)', borderColor: 'var(--error)' }}>
            Create and Approve
          </Button>
        </div>
      </form>
    </div>
  );
}
