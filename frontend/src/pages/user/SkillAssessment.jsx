import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../core/auth/AuthContext';
import { useToast } from '../../components/common/Toast';
import client from '../../core/api/client';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import ROUTES from '../../core/routes';
import '../../styles/pages/portal.css';

export default function SkillAssessment() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();

  const [role, setRole] = useState('');
  const [skills, setSkills] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!role || !skills) {
      toast.error('Required Fields', 'Please enter your target role and skills.');
      return;
    }

    const startTime = Date.now();
    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('role', role);
      formData.append('skill_text', skills);
      if (user?.full_name) formData.append('candidate_name', user.full_name);
      if (user?.email) formData.append('candidate_email', user.email);

      // Trigger ingest endpoint with skill_text + role
      const res = await client.post('/ingest', formData);

      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 1100 - elapsed);
      setTimeout(() => {
        toast.success('Declared Successfully', 'Skills mapped to new session.');
        navigate(ROUTES.USER.ASSESSMENT_REVIEW(res.data.id));
      }, remaining);
    } catch (err) {
      console.error(err);
      toast.error('Submission Failed', err.response?.data?.detail || 'Failed to submit skill declaration.');
      setLoading(false);
    }
  }

  return (
    <div className="anim-fade-in" style={{ maxWidth: 640, margin: '0 auto' }}>
      <div className="page-header">
        <h2 className="page-header__title">Declare Skills</h2>
        <p className="page-header__subtitle">Directly evaluate custom skills without certificate documents</p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Input
          label="Target Role / Designation"
          type="text"
          id="skill-role"
          placeholder="e.g. Python Developer"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          required
        />

        <Input
          label="Declared Skills (comma separated)"
          type="text"
          id="skill-list"
          placeholder="e.g. Python, Machine Learning, SQL"
          value={skills}
          onChange={(e) => setSkills(e.target.value)}
          helper="List the skills you want to be tested on."
          required
        />

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 12 }}>
          <Button variant="secondary" onClick={() => navigate(ROUTES.USER.NEW_ASSESSMENT)}>
            Back
          </Button>
          <Button type="submit" loading={loading}>
            Save and Review
          </Button>
        </div>
      </form>
    </div>
  );
}
