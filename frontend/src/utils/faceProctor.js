/**
 * In-browser face proctoring rules (no server, no API: runs on the face-api.js
 * detections the interview page already computes).
 *
 * Turns a stream of per-frame observations into a few *sustained* violations,
 * so a blink, a quick glance or one bad frame is never reported:
 *
 *   multi_face  another person visible for >= 1.5 s
 *   no_face     candidate out of view for >= 5 s   (reported as a camera interruption)
 *   gaze        head turned away for >= 4 s
 *
 * Each type is reported at most once every 30 s, so one long incident counts
 * once, not dozens of times.
 */

export const PROCTOR_RULES = {
  multi_face: { holdMs: 1500, cooldownMs: 30000 },
  no_face:    { holdMs: 5000, cooldownMs: 30000 },
  gaze:       { holdMs: 4000, cooldownMs: 30000 },
};

/**
 * Rough head pose from 68-point landmarks (face-api.js order).
 * yaw:   0.5 = facing camera; < 0.5 turned one way, > 0.5 the other
 * pitch: ~0.45 = level; smaller = looking up, larger = looking down
 * Returns null when landmarks are missing.
 */
export function headPose(points) {
  if (!points || points.length < 68) return null;
  const jawL = points[0];
  const jawR = points[16];
  const nose = points[30];
  const chin = points[8];
  const eyeL = points[36];
  const eyeR = points[45];

  const faceWidth = jawR.x - jawL.x;
  if (Math.abs(faceWidth) < 1) return null;
  const yaw = (nose.x - jawL.x) / faceWidth;

  const eyeY = (eyeL.y + eyeR.y) / 2;
  const faceHeight = chin.y - eyeY;
  if (faceHeight < 1) return null;
  const pitch = (nose.y - eyeY) / faceHeight;

  return { yaw, pitch };
}

/** Is the head clearly turned away from the screen? Thresholds are deliberately lenient. */
export function lookingAway(pose) {
  if (!pose) return null;
  if (pose.yaw < 0.25) return 'left';
  if (pose.yaw > 0.75) return 'right';
  if (pose.pitch < 0.18) return 'up';
  if (pose.pitch > 0.78) return 'down';
  return null;
}

export function createProctorState() {
  return { since: {}, lastReported: {} };
}

/**
 * Feed one observation; returns the violations to report now (usually none).
 * @param state  from createProctorState()
 * @param obs    { faces: number, away: 'left'|'right'|'up'|'down'|null }
 * @param now    timestamp in ms
 */
export function observe(state, obs, now) {
  const active = {
    multi_face: obs.faces > 1,
    no_face: obs.faces === 0,
    gaze: obs.faces === 1 && Boolean(obs.away),
  };
  const events = [];

  for (const [type, isOn] of Object.entries(active)) {
    if (!isOn) {
      delete state.since[type];
      continue;
    }
    if (state.since[type] == null) state.since[type] = now;

    const { holdMs, cooldownMs } = PROCTOR_RULES[type];
    const heldLongEnough = now - state.since[type] >= holdMs;
    const last = state.lastReported[type];
    const cooledDown = last == null || now - last >= cooldownMs;

    if (heldLongEnough && cooledDown) {
      state.lastReported[type] = now;
      events.push({ type, direction: type === 'gaze' ? obs.away : undefined, heldMs: now - state.since[type] });
    }
  }
  return events;
}

/** Payload for POST /biometric/report-violation */
export function violationPayload(sessionId, event) {
  if (event.type === 'multi_face') {
    return { session_id: sessionId, violation_type: 'multi_face', details: 'Another person was visible in the camera (detected in browser).' };
  }
  if (event.type === 'no_face') {
    return { session_id: sessionId, violation_type: 'camera', details: 'Candidate left the camera view for more than 5 seconds.' };
  }
  return {
    session_id: sessionId,
    violation_type: 'gaze',
    details: `Head turned ${event.direction} away from the screen for more than 4 seconds.`,
  };
}
