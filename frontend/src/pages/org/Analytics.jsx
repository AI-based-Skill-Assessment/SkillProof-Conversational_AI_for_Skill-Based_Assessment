import { MOCK_ANALYTICS } from '../../core/mockData/org.mock';
import { Card, CardHeader, CardTitle, CardBody } from '../../components/common/Card';
import StatusBadge from '../../components/common/StatusBadge';

export default function Analytics() {
  const data = MOCK_ANALYTICS;

  return (
    <div className="anim-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="page-header">
        <h2 className="page-header__title">Student Verification Analytics</h2>
        <p className="page-header__subtitle">Analyze performance trends, credential distributions, and core competencies</p>
      </div>

      <div className="grid-2">
        {/* Verification breakdown */}
        <Card>
          <CardHeader><CardTitle>Integrity Distribution</CardTitle></CardHeader>
          <CardBody style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {data.verification_distribution.map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 500 }}>{item.label}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 120, height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${(item.value / 47) * 100}%`, height: '100%', background: item.color }} />
                  </div>
                  <span style={{ fontWeight: 600, width: 24, textAlignment: 'right' }}>{item.value}</span>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>

        {/* Top verified skills */}
        <Card>
          <CardHeader><CardTitle>Verified Skills Frequency</CardTitle></CardHeader>
          <CardBody style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {data.top_skills.map(item => (
              <div key={item.skill} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 500 }}>{item.skill}</span>
                <StatusBadge variant="info" dot={false}>
                  {item.count} students verified
                </StatusBadge>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
