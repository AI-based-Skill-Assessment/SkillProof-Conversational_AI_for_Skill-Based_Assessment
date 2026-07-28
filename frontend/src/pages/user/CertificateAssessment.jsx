import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../components/common/Toast';
import client from '../../core/api/client';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import ROUTES from '../../core/routes';
import '../../styles/pages/portal.css';

export default function CertificateAssessment() {
  const navigate = useNavigate();
  const toast = useToast();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) {
      toast.error('File Required', 'Please upload your certificate file.');
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('file', file);
      if (name) formData.append('candidate_name', name);
      if (email) formData.append('candidate_email', email);

      // Trigger ingest endpoint with FormData
      const res = await client.post('/ingest', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      toast.success('Ingested Successfully', 'Parsed metadata and ready for review.');
      navigate(ROUTES.USER.ASSESSMENT_REVIEW(res.data.id));
    } catch (err) {
      console.error(err);
      toast.error('Upload Failed', err.response?.data?.detail || 'Failed to ingest certificate. Please check file format.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="anim-fade-in" style={{ maxWidth: 640, margin: '0 auto' }}>
      <div className="page-header">
        <h2 className="page-header__title">Upload Certificate</h2>
        <p className="page-header__subtitle">Upload your course or internship certificate PDF / image</p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Input
          label="Verification Candidate Name (Optional)"
          type="text"
          id="cert-name"
          placeholder="Defaults to profile name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <Input
          label="Verification Candidate Email (Optional)"
          type="email"
          id="cert-email"
          placeholder="Defaults to profile email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <div style={{
          border: '2px dashed var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '40px 20px',
          textAlign: 'center',
          background: 'var(--surface)',
          cursor: 'pointer'
        }}>
          <input
            type="file"
            id="cert-file"
            accept=".pdf,.png,.jpg,.jpeg"
            onChange={(e) => setFile(e.target.files[0])}
            style={{ display: 'none' }}
          />
          <label htmlFor="cert-file" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span style={{ fontSize: 32 }}>📁</span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {file ? file.name : 'Choose file or drag & drop'}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Supports PDF, PNG, JPG, JPEG up to 10MB
            </span>
          </label>
        </div>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 12 }}>
          <Button variant="secondary" onClick={() => navigate(ROUTES.USER.NEW_ASSESSMENT)}>
            Back
          </Button>
          <Button type="submit" loading={loading}>
            Upload and Parse
          </Button>
        </div>
      </form>
    </div>
  );
}
