import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Modal from '../../components/common/Modal';
import Alert from '../../components/common/Alert';
import StatusBadge from '../../components/common/StatusBadge';
import { useToast } from '../../components/common/Toast';
import { formatDate } from '../../utils/formatDate';
import { formatScore } from '../../utils/formatScore';
import { apiErrorMessage } from '../../utils/apiError';
import ROUTES from '../../core/routes';
import client from '../../core/api/client';

const EMPTY_FORM = { title: '', role: '', skills: '', deadline: '', min_score: '', description: '' };

export function driveStatusBadge(d) {
  if (d.status === 'closed') return <StatusBadge variant="neutral">Closed</StatusBadge>;
  if (!d.accepting) return <StatusBadge variant="warning">Deadline passed</StatusBadge>;
  return <StatusBadge variant="success">Open</StatusBadge>;
}

function validationMessage(err) {
  const detail = err?.response?.data?.detail;
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg.replace(/^Value error, /, '');
  return apiErrorMessage(err, 'drive').replace('Could not load drive: ', '');
}

export default function Drives() {
  const toast = useToast();
  const navigate = useNavigate();
  const [drives, setDrives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await client.get('/org/drives');
        setDrives(res.data || []);
      } catch (err) {
        setError(apiErrorMessage(err, 'drives'));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }));

  async function handleCreate(e) {
    e?.preventDefault();
    setFormError('');
    const skills = form.skills.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
    if (form.title.trim().length < 3) return setFormError('Give the drive a title (at least 3 characters).');
    if (skills.length === 0) return setFormError('Add at least one skill, separated by commas.');

    const payload = {
      title: form.title.trim(),
      role: form.role.trim() || null,
      description: form.description.trim() || null,
      skills,
      // datetime-local has no timezone; send it as the user's local time in ISO/UTC
      deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
      min_score: form.min_score === '' ? null : Number(form.min_score),
    };
    try {
      setSaving(true);
      const res = await client.post('/org/drives', payload);
      toast.success('Drive created', `Share code ${res.data.invite_code} with your candidates.`);
      setOpen(false);
      setForm(EMPTY_FORM);
      navigate(ROUTES.ORG.DRIVE_DETAIL(res.data.id));
    } catch (err) {
      setFormError(validationMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="anim-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="page-header page-header--row">
        <div>
          <h2 className="page-header__title">Placement Drives</h2>
          <p className="page-header__subtitle">
            Create an assessment, share its invite link, and get a ranked, proctored shortlist
          </p>
        </div>
        <div className="page-header__actions">
          <Button onClick={() => setOpen(true)}>+ New Drive</Button>
        </div>
      </div>

      {error && <Alert type="error">{error}</Alert>}

      <div className="common-table-container">
        <table className="common-table">
          <thead>
            <tr>
              <th>Drive</th>
              <th>Skills</th>
              <th>Invite code</th>
              <th>Deadline</th>
              <th>Joined</th>
              <th>Completed</th>
              <th>Shortlisted</th>
              <th>Avg score</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: 32, color: 'var(--text-secondary)' }}>Loading…</td></tr>
            )}
            {!loading && drives.length === 0 && (
              <tr>
                <td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
                  No drives yet. Create one, share the invite link with students, and their results will be ranked here.
                </td>
              </tr>
            )}
            {drives.map(d => (
              <tr key={d.id}>
                <td>
                  <Link to={ROUTES.ORG.DRIVE_DETAIL(d.id)} style={{ fontWeight: 600 }}>{d.title}</Link>
                  {d.role && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{d.role}</div>}
                </td>
                <td>{d.skills.join(', ')}</td>
                <td><code style={{ fontWeight: 700, letterSpacing: '0.08em' }}>{d.invite_code}</code></td>
                <td>{d.deadline ? formatDate(d.deadline) : 'None'}</td>
                <td style={{ fontVariantNumeric: 'tabular-nums' }}>{d.joined}</td>
                <td style={{ fontVariantNumeric: 'tabular-nums' }}>{d.completed}</td>
                <td style={{ fontVariantNumeric: 'tabular-nums' }}>{d.shortlisted}</td>
                <td>{d.average_score != null ? `${formatScore(d.average_score)}%` : '—'}</td>
                <td>{driveStatusBadge(d)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={open}
        onClose={() => !saving && setOpen(false)}
        title="New placement drive"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleCreate} loading={saving}>Create drive</Button>
          </>
        }
      >
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {formError && <Alert type="error">{formError}</Alert>}
          <Input label="Title" required value={form.title} onChange={set('title')} placeholder="e.g. Campus Drive 2026: Software Engineer" />
          <Input label="Role (optional)" value={form.role} onChange={set('role')} placeholder="e.g. Graduate Engineer Trainee" />
          <Input
            label="Skills to assess"
            required
            value={form.skills}
            onChange={set('skills')}
            placeholder="e.g. Python, SQL, Data Structures"
            helper="Separate skills with commas (up to 8). The AI interview covers exactly these."
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
            <Input label="Deadline (optional)" type="datetime-local" value={form.deadline} onChange={set('deadline')} />
            <Input
              label="Pass mark (optional)"
              type="number"
              min="0"
              max="100"
              value={form.min_score}
              onChange={set('min_score')}
              placeholder="e.g. 60"
              helper="Candidates at or above this score are marked as passing."
            />
          </div>
          <Input label="Description (optional)" textarea value={form.description} onChange={set('description')} placeholder="Shown to candidates before they start" />
          <button type="submit" hidden aria-hidden="true" />
        </form>
      </Modal>
    </div>
  );
}
