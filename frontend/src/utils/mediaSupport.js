/**
 * Browsers only allow camera and microphone on secure pages: https:// or
 * http://localhost. Opening the app as http://<laptop-ip>:5173 on a phone is
 * NOT secure, so navigator.mediaDevices is missing and every camera page fails.
 */
export function cameraAvailable() {
  return Boolean(window.isSecureContext && navigator.mediaDevices?.getUserMedia);
}

export const CAMERA_BLOCKED_MESSAGE =
  'Camera and microphone are blocked on this connection. Browsers only allow them on https:// pages ' +
  '(or on the computer running SkillProof). Open this page through an https link (see "Testing on a phone" ' +
  'in the README) or use the computer running SkillProof.';
