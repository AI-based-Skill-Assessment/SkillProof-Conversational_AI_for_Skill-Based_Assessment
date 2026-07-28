import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../core/auth/AuthContext';
import { useToast } from '../../components/common/Toast';
import client from '../../core/api/client';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import Select from '../../components/common/Select';
import ROUTES from '../../core/routes';
import '../../styles/pages/portal.css';

export default function GoogleOnboard() {
  const { user, updateUserCache, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [name, setName] = useState(user?.name || '');
  const [type, setType] = useState('college');
  const [contactName, setContactName] = useState('');
  const [website, setWebsite] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (user?.name) {
      setName(user.name);
    }
  }, [user]);

  async function handleSubmit(e) {
    e.preventDefault();
    setErrors({});
    const newErrors = {};

    if (!name) newErrors.name = 'Organisation name is required';
    if (!contactName) newErrors.contactName = 'Primary contact name is required';
    if (!address) newErrors.address = 'Physical address is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      setLoading(true);
      const res = await client.put('/auth/org/google/onboard', {
        name,
        org_type: type,
        contact_name: contactName,
        website: website || null,
        address
      });

      updateUserCache(res.data);
      toast.success('Onboarding Submitted', 'Your details have been successfully registered. Your account is pending admin approval.');
      navigate(ROUTES.ORG.PENDING);
    } catch (err) {
      console.error(err);
      toast.error('Onboarding Failed', err.response?.data?.detail || 'Failed to submit onboarding details.');
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
    <div className="auth-container">
      <div className="auth-card anim-scale-in" style={{ maxWidth: 540 }}>
        <div className="auth-card__brand">
          <div className="public-navbar__logo-icon">SP</div>
          <span>SkillProof</span>
        </div>
        <div className="auth-card__header">
          <h2 className="auth-card__title">Complete Institution Profile</h2>
          <p className="auth-card__subtitle">Please provide the remaining details to activate your account.</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ gridColumn: 'span 2' }}>
            <Input
              label="Organisation / College Name"
              type="text"
              id="org-onboard-name"
              placeholder="e.g. NIT Trichy"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={errors.name}
              required
            />
          </div>

          <Select
            label="Institution Type"
            id="org-onboard-type"
            options={typeOptions}
            value={type}
            onChange={(e) => setType(e.target.value)}
          />

          <Input
            label="Primary Contact Name"
            type="text"
            id="org-onboard-contact"
            placeholder="Dr. Ramesh Kumar"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            error={errors.contactName}
            required
          />

          <div style={{ gridColumn: 'span 2' }}>
            <Input
              label="Website URL (Optional)"
              type="text"
              id="org-onboard-web"
              placeholder="https://www.nitt.edu"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </div>

          <div style={{ gridColumn: 'span 2' }}>
            <Input
              label="Physical Address"
              type="text"
              id="org-onboard-address"
              placeholder="Full physical address of the institution"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              error={errors.address}
              required
            />
          </div>

          <div style={{ gridColumn: 'span 2', display: 'flex', gap: 12, marginTop: 8 }}>
            <Button type="submit" fullWidth loading={loading}>
              Submit for Approval
            </Button>
            <button
              type="button"
              onClick={logout}
              className="common-button common-button--outline"
              style={{ width: '120px' }}
            >
              Sign Out
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
