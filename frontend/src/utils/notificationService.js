/**
 * utils/notificationService.js
 * Generates live contextual notifications from backend sessions, biometrics, and user data.
 * Manages read/unread states via localStorage.
 */

const STORAGE_KEY = 'skillproof_read_notifications';

export function getReadNotificationIds() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function markNotificationAsRead(id) {
  try {
    const existing = getReadNotificationIds();
    if (!existing.includes(id)) {
      const updated = [...existing, id];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    }
  } catch (e) {}
}

export function markAllNotificationsAsRead(ids) {
  try {
    const existing = getReadNotificationIds();
    const merged = Array.from(new Set([...existing, ...ids]));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch (e) {}
}

/**
 * Builds dynamic notification list from real sessions and user state.
 */
export function buildNotificationsFromData({ user, sessions = [] }) {
  const notifs = [];
  const readIds = new Set(getReadNotificationIds());

  // 1. Biometric registration notifications
  if (user?.face_enrolled || user?.is_face_registered) {
    const id = 'notif-bio-face';
    notifs.push({
      id,
      category: 'security',
      title: 'Biometric Face ID Enrolled',
      message: 'Your 128-dimensional facial biometric descriptor is active for anti-proxy interview verification.',
      created_at: user.created_at || new Date().toISOString(),
      is_read: readIds.has(id),
      link: '/user/profile',
    });
  }

  if (user?.voice_enrolled || user?.is_voice_registered) {
    const id = 'notif-bio-voice';
    notifs.push({
      id,
      category: 'security',
      title: 'Voice Signature Registered',
      message: 'Acoustic voice embedding is enrolled for active speaker integrity checks.',
      created_at: user.created_at || new Date().toISOString(),
      is_read: readIds.has(id),
      link: '/user/profile',
    });
  }

  // 2. Notifications per Assessment Session
  sessions.forEach(s => {
    const role = s.extracted_role || (s.intake_mode === 'certificate' ? 'Certificate Verification' : 'Skill Assessment');
    const org = s.extracted_company ? ` at ${s.extracted_company}` : '';
    const date = s.created_at || new Date().toISOString();
    const sc = (s.scores && s.scores[0]) || {};
    const scoreVal = sc.overall_skill_score;

    // Document Authenticity Audit Notification
    if (s.certificate_filename || s.document?.fetch_status === 'verified') {
      const docId = `notif-doc-${s.id}`;
      notifs.push({
        id: docId,
        category: 'document',
        title: 'Document Verified & Audited',
        message: `Authenticity confirmed for "${s.certificate_filename || 'Uploaded Certificate'}" with cryptographically checked metadata.`,
        created_at: date,
        is_read: readIds.has(docId),
        link: `/user/reports/${s.id}`,
      });
    }

    // Scorecard & Evaluation Notification
    if (s.status === 'scored' || scoreVal !== undefined) {
      const scoreId = `notif-score-${s.id}`;
      const isEarly = s.scores?.length > 0 && s.scores[0]?.verdict === 'UNVERIFIED_EARLY_EXIT';
      notifs.push({
        id: scoreId,
        category: 'assessment',
        title: isEarly ? `Assessment Report Incomplete (${role})` : `Scorecard Ready: ${role}${org}`,
        message: isEarly
          ? `Assessment for ${role} concluded early without technical interview submissions.`
          : `Overall technical evaluation: ${Math.round(scoreVal ?? 0)}%. Your detailed scorecard and verification transcript are ready.`,
        created_at: date,
        is_read: readIds.has(scoreId),
        link: `/user/reports/${s.id}`,
      });

      // QR Credential Notification
      const qrNotifId = `notif-qr-${s.id}`;
      notifs.push({
        id: qrNotifId,
        category: 'credential',
        title: `Verifiable QR Credential Live (SP-${s.id.slice(0, 8).toUpperCase()})`,
        message: `Public audit link and secure QR badge generated. External employers and evaluators can verify your results directly.`,
        created_at: date,
        is_read: readIds.has(qrNotifId),
        link: `/user/certificates`,
      });
    } else {
      // Ingested / Ready for Assessment Notification
      const pendingId = `notif-pending-${s.id}`;
      notifs.push({
        id: pendingId,
        category: 'assessment',
        title: `Verification Session Created: ${role}`,
        message: `Your technical assessment session has been initialized. Complete the AI interview to certify your skills.`,
        created_at: date,
        is_read: readIds.has(pendingId),
        link: `/user/assessment/${s.id}/review`,
      });
    }
  });

  // Welcome Notification for every registered candidate
  const welcomeId = 'notif-welcome';
  notifs.push({
    id: welcomeId,
    category: 'system',
    title: 'Welcome to SkillProof',
    message: 'Your cryptographically secured AI skill verification and tamper-proof credential account is ready.',
    created_at: user?.created_at || new Date().toISOString(),
    is_read: readIds.has(welcomeId),
    link: '/user/dashboard',
  });

  // Sort descending by date
  return notifs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}
