/**
 * Global camera / microphone safety net.
 *
 * Wraps navigator.mediaDevices.getUserMedia once so that EVERY stream the app
 * opens is recorded. Pages still stop their own streams as before; this exists
 * to catch the ones they miss — e.g. a stream that arrives after the page was
 * already left (getUserMedia is async), or the first of React StrictMode's two
 * development mounts.
 *
 *  - A stream that resolves while the user is NOT on a camera/mic page is
 *    stopped immediately.
 *  - stopAllMedia() stops every stream still running; UserLayout calls it
 *    whenever the user navigates to a non-media page.
 */

const activeStreams = new Set();
let installed = false;

// Pages that legitimately use the camera or microphone
const MEDIA_ROUTE_PATTERNS = [
  /^\/user\/face-registration/,
  /^\/user\/voice-registration/,
  /^\/user\/biometric-check/,
  /^\/user\/interview\/[^/]+\/check\/?$/,
  /^\/user\/interview\/[^/]+\/?$/,           // the live interview (NOT /processing)
];

export function isMediaRoute(pathname = window.location.pathname) {
  return MEDIA_ROUTE_PATTERNS.some(re => re.test(pathname));
}

function stopStream(stream) {
  try {
    stream.getTracks().forEach(t => {
      try { t.stop(); } catch (e) { /* already stopped */ }
    });
  } catch (e) { /* not a MediaStream */ }
  activeStreams.delete(stream);
}

function pruneEnded() {
  activeStreams.forEach(s => {
    if (s.getTracks().every(t => t.readyState === 'ended')) activeStreams.delete(s);
  });
}

export function installMediaRegistry() {
  if (installed || typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return;
  installed = true;

  const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = async (constraints) => {
    const stream = await original(constraints);
    pruneEnded();
    if (!isMediaRoute()) {
      // The page that asked for it is gone — release the hardware right away.
      // The (now stopped) stream is still returned so callers don't crash.
      stopStream(stream);
      return stream;
    }
    activeStreams.add(stream);
    return stream;
  };
}

/** Stop every camera/mic stream the app still has open. */
export function stopAllMedia() {
  Array.from(activeStreams).forEach(stopStream);
}
