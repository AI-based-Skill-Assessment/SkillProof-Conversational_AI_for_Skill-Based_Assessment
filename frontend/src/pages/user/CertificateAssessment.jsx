import { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useAuth } from '../../core/auth/AuthContext';
import { useToast } from '../../components/common/Toast';
import client from '../../core/api/client';
import Button from '../../components/common/Button';
import ROUTES from '../../core/routes';
import '../../styles/pages/portal.css';

export default function CertificateAssessment() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const { setIsDemo } = useOutletContext() || {};

  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);

  function handleFileSelect(e) {
    const selected = Array.from(e.target.files || []);
    if (files.length + selected.length > 10) {
      toast.error('Limit Exceeded', 'You can upload a maximum of 10 certificates for a single assessment.');
      return;
    }
    setFiles(prev => [...prev, ...selected].slice(0, 10));
  }

  function removeFile(index) {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (files.length === 0) {
      toast.error('File Required', 'Please upload at least 1 certificate file (up to 10).');
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      files.forEach((f) => {
        formData.append('files', f);
      });

      // Auto-prepopulate from user profile session
      if (user?.full_name) formData.append('candidate_name', user.full_name);
      if (user?.email) formData.append('candidate_email', user.email);

      const res = await client.post('/ingest', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // Turn off demo mode instantly across topbar and app context
      if (setIsDemo) setIsDemo(false);

      toast.success('Certificates Ingested', `Successfully uploaded ${files.length} certificate(s). Ready for review.`);
      navigate(ROUTES.USER.ASSESSMENT_REVIEW(res.data.id));
    } catch (err) {
      console.error(err);
      toast.error('Upload Failed', err.response?.data?.detail || 'Failed to ingest certificates. Please check file format.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="anim-fade-in" style={{ maxWidth: 680, margin: '0 auto' }}>
      <div className="page-header">
        <h2 className="page-header__title">Upload Certificates (Up to 10)</h2>
        <p className="page-header__subtitle">
          Upload up to 10 course/internship certificate PDF or Image files for a single consolidated 15-20 min AI interview session.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{
          border: '2px dashed var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '36px 20px',
          textAlign: 'center',
          background: 'var(--surface)',
          cursor: 'pointer'
        }}>
          <input
            type="file"
            id="cert-file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg,.docx"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          <label htmlFor="cert-file" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span style={{ fontSize: 36 }}>📂</span>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 15 }}>
              Click or drag files here to upload certificates
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Supports PDF, PNG, JPG, DOCX (Upload up to 10 certificates max)
            </span>
          </label>
        </div>

        {/* Selected Files List */}
        {files.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--surface)', padding: 16, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
              Selected Certificates ({files.length}/10)
            </span>

            {files.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
                  <span>📄</span>
                  <span>{f.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>({(f.size / 1024).toFixed(1)} KB)</span>
                </div>

                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  style={{
                    background: 'rgba(239, 68, 68, 0.12)',
                    color: '#ef4444',
                    border: 'none',
                    borderRadius: '50%',
                    width: 24,
                    height: 24,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 'bold'
                  }}
                  title="Remove certificate"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

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
