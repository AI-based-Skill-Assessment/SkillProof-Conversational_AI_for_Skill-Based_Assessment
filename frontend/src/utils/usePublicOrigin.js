import { useEffect, useState } from 'react';

const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/**
 * The base URL to put in links and QR codes that OTHER devices will open
 * (invite links, verification QR codes).
 *
 * "localhost" only means "this computer", so a link like
 * http://localhost:5173/... opened on a phone points at the phone itself.
 * When the app is opened via localhost, this asks the backend for the laptop's
 * Wi-Fi/LAN address and uses that instead (works for any device on the same
 * network). On a real domain or a LAN address it just returns that origin.
 *
 * Returns { origin, isLocalOnly }: isLocalOnly is true once the lookup finished
 * without finding a LAN address, so the page can warn that the link only works
 * on this computer.
 */
export default function usePublicOrigin() {
  const { protocol, hostname, port, origin } = window.location;
  const isLoopback = LOOPBACK.has(hostname);
  const [lanOrigin, setLanOrigin] = useState(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!isLoopback) return;
    let cancelled = false;
    fetch('/server-info')
      .then(r => (r.ok ? r.json() : null))
      .then(info => {
        if (cancelled || !info?.lan_ip || LOOPBACK.has(info.lan_ip)) return;
        const p = port || info.frontend_port;
        setLanOrigin(`${protocol}//${info.lan_ip}${p ? `:${p}` : ''}`);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setChecked(true); });
    return () => { cancelled = true; };
  }, [isLoopback, protocol, port]);

  if (!isLoopback) return { origin, isLocalOnly: false };
  return { origin: lanOrigin || origin, isLocalOnly: checked && !lanOrigin };
}
