/**
 * core/auth/AuthContext.jsx
 * Authentication context for all three portals.
 * Stores JWT tokens in localStorage, restores session on mount.
 * Calls real backend auth endpoints; no mock auth.
 */
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import client from '../api/client';
import { EP } from '../api/endpoints';

const AuthContext = createContext(null);

const LS = {
  ACCESS:  'skillproof_access_token',
  REFRESH: 'skillproof_refresh_token',
  ROLE:    'skillproof_role',
  USER:    'skillproof_user',
};

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);   // profile object
  const [role, setRole]       = useState(null);   // 'user' | 'org' | 'admin'
  const [loading, setLoading] = useState(true);   // initial hydration
  const [warningActive, setWarningActive] = useState(false);
  const [countdown, setCountdown] = useState(60);

  // ── Restore session on mount ──────────────────────────────────────────────
  useEffect(() => {
    const storedUser = localStorage.getItem(LS.USER);
    const storedRole = localStorage.getItem(LS.ROLE);
    const token      = localStorage.getItem(LS.ACCESS);

    if (storedUser && storedRole && token) {
      try {
        setUser(JSON.parse(storedUser));
        setRole(storedRole);
      } catch {
        _clearStorage();
      }
    }
    setLoading(false);
  }, []);


  // ── Helper: clear all auth storage ────────────────────────────────────────
  function _clearStorage() {
    localStorage.removeItem(LS.ACCESS);
    localStorage.removeItem(LS.REFRESH);
    localStorage.removeItem(LS.ROLE);
    localStorage.removeItem(LS.USER);
  }

  // ── Helper: save tokens + profile ─────────────────────────────────────────
  function _saveSession(tokens, profile, portalRole) {
    localStorage.setItem(LS.ACCESS,  tokens.access_token);
    localStorage.setItem(LS.REFRESH, tokens.refresh_token);
    localStorage.setItem(LS.ROLE,    portalRole);
    localStorage.setItem(LS.USER,    JSON.stringify(profile));
    setUser(profile);
    setRole(portalRole);
  }

  // ── User (candidate) auth ─────────────────────────────────────────────────
  const userRegister = useCallback(async ({ full_name, email, password }) => {
    const res = await client.post(EP.AUTH.USER_REGISTER, { full_name, email, password });
    // After register, fetch profile
    localStorage.setItem(LS.ACCESS,  res.data.access_token);
    localStorage.setItem(LS.REFRESH, res.data.refresh_token);
    const profile = await client.get(EP.AUTH.ME);
    _saveSession(res.data, profile.data, 'user');
    return profile.data;
  }, []);

  const userLogin = useCallback(async ({ email, password }) => {
    const res = await client.post(EP.AUTH.USER_LOGIN, { email, password });
    localStorage.setItem(LS.ACCESS,  res.data.access_token);
    localStorage.setItem(LS.REFRESH, res.data.refresh_token);
    const profile = await client.get(EP.AUTH.ME);
    _saveSession(res.data, profile.data, 'user');
    return profile.data;
  }, []);

  const googleLogin = useCallback(async (credentialToken, isSignup = false) => {
    const res = await client.post('/auth/user/google/verify', {
      credential_token: credentialToken,
      is_signup: isSignup
    });
    localStorage.setItem(LS.ACCESS,  res.data.access_token);
    localStorage.setItem(LS.REFRESH, res.data.refresh_token);
    const profile = await client.get(EP.AUTH.ME);
    _saveSession(res.data, profile.data, 'user');
    return profile.data;
  }, []);

  const orgGoogleLogin = useCallback(async (credentialToken, isSignup = false) => {
    const res = await client.post('/auth/org/google/verify', {
      credential_token: credentialToken,
      is_signup: isSignup
    });
    localStorage.setItem(LS.ACCESS,  res.data.access_token);
    localStorage.setItem(LS.REFRESH, res.data.refresh_token);
    const profile = await client.get('/auth/org/me');
    _saveSession(res.data, profile.data, 'org');
    return profile.data;
  }, []);

  // ── Organisation auth ─────────────────────────────────────────────────────
  const orgLogin = useCallback(async ({ email, password }) => {
    const res = await client.post(EP.AUTH.ORG_LOGIN, { email, password });
    localStorage.setItem(LS.ACCESS,  res.data.access_token);
    localStorage.setItem(LS.REFRESH, res.data.refresh_token);
    const profile = await client.get(EP.AUTH.ORG_ME);
    _saveSession(res.data, profile.data, 'org');
    return profile.data;
  }, []);

  // ── Admin auth ────────────────────────────────────────────────────────────
  // Returns { temp_token, message } — caller must do 2FA step
  const adminLoginStep1 = useCallback(async ({ email, password }) => {
    const res = await client.post(EP.AUTH.ADMIN_LOGIN, { email, password });
    return res.data;  // { temp_token, message }
  }, []);

  const adminLoginStep2 = useCallback(async ({ temp_token, totp_code }) => {
    const res = await client.post(EP.AUTH.ADMIN_2FA, { temp_token, totp_code });
    localStorage.setItem(LS.ACCESS,  res.data.access_token);
    localStorage.setItem(LS.REFRESH, res.data.refresh_token);
    const profile = await client.get(EP.AUTH.ADMIN_ME);
    _saveSession(res.data, profile.data, 'admin');
    return profile.data;
  }, []);

  // ── Logout ─────────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    _clearStorage();
    setUser(null);
    setRole(null);
  }, []);

  // ── Update local user cache ────────────────────────────────────────────────
  const updateUserCache = useCallback((updatedProfile) => {
    setUser(updatedProfile);
    localStorage.setItem(LS.USER, JSON.stringify(updatedProfile));
  }, []);

  // ── Inactivity / Auto-logout tracker ───────────────────────────────────────
  useEffect(() => {
    if (!user || !role) return;
    if (warningActive) return;

    let timeoutId;
    const INACTIVITY_TIMEOUT = 14 * 60 * 1000; // 14 minutes before warning

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setCountdown(60);
        setWarningActive(true);
      }, INACTIVITY_TIMEOUT);
    };

    const events = ['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart'];
    events.forEach(e => window.addEventListener(e, resetTimer));

    resetTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach(e => window.removeEventListener(e, resetTimer));
    };
  }, [user, role, warningActive]);

  // ── Session Countdown Tracker ──────────────────────────────────────────────
  useEffect(() => {
    if (!warningActive) return;
    if (countdown <= 0) {
      const loginMap = {
        user: '/user/signin',
        org: '/org/signin',
        admin: '/admin/login',
      };
      const target = loginMap[role] || '/user/signin';
      logout();
      setWarningActive(false);
      window.location.href = `${target}?expired=true`;
      return;
    }
    const interval = setInterval(() => {
      setCountdown(c => c - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [warningActive, countdown, role, logout]);

  const value = {
    user,
    role,
    loading,
    isAuthenticated: !!user,
    isUser:  role === 'user',
    isOrg:   role === 'org',
    isAdmin: role === 'admin',
    userLogin,
    googleLogin,
    userRegister,
    orgLogin,
    orgGoogleLogin,
    adminLoginStep1,
    adminLoginStep2,
    logout,
    updateUserCache,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      {warningActive && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(8px)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "'Outfit', sans-serif"
        }}>
          <div style={{
            background: 'rgba(18, 18, 29, 0.98)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '20px',
            padding: '36px',
            maxWidth: '420px',
            width: '90%',
            textAlign: 'center',
            boxShadow: '0 24px 64px rgba(0, 0, 0, 0.6)'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏰</div>
            <h3 style={{ fontSize: '22px', fontWeight: 700, color: '#fff', marginBottom: '12px' }}>
              Session Expiring
            </h3>
            <p style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.6)', lineHeight: '1.6', marginBottom: '28px' }}>
              Your session will automatically lock in <strong style={{ color: 'var(--primary, #00f2fe)' }}>{countdown} seconds</strong> due to inactivity. Would you like to extend it?
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => {
                  setWarningActive(false);
                  setCountdown(60);
                }}
                style={{
                  background: 'var(--primary, #00f2fe)',
                  color: '#12121d',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '12px 24px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Extend Session
              </button>
              <button
                onClick={() => {
                  setWarningActive(false);
                  const loginMap = {
                    user: '/user/signin',
                    org: '/org/signin',
                    admin: '/admin/login',
                  };
                  const target = loginMap[role] || '/user/signin';
                  logout();
                  window.location.href = `${target}?expired=true`;
                }}
                style={{
                  background: 'transparent',
                  color: 'rgba(255, 255, 255, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '10px',
                  padding: '12px 24px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export default AuthContext;
