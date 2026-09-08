/**
 * core/api/client.js
 * Axios instance with JWT Bearer interceptor, base URL, and error handling.
 */
import axios from 'axios';

const client = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Helper to extract role based on path explicitly
function getRoleFromPath(pathname) {
  if (pathname.startsWith('/admin')) return 'admin';
  if (pathname.startsWith('/org')) return 'org';
  if (pathname.startsWith('/user')) return 'user';
  return null; // Public routes have no authenticated role
}

// ── Request interceptor — attach JWT ────────────────────────────────────────────
client.interceptors.request.use(
  (config) => {
    const role = getRoleFromPath(window.location.pathname);
    if (!role) return config;
    const token = localStorage.getItem(`skillproof_${role}_access_token`);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor — handle 401 & 403 ───────────────────────────────────
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;
    const detail = error.response?.data?.detail || '';
    const role = getRoleFromPath(window.location.pathname);

    // 1. Force logout immediately if account is suspended, rejected, or deleted/not found
    if (role === 'org' && (
      (status === 403 && (
        detail.includes('suspended') || 
        detail.includes('rejected') || 
        detail.includes('Must be approved') ||
        detail.includes('pending')
      )) ||
      (status === 401 && detail.includes('Organisation not found'))
    )) {
      localStorage.removeItem(`skillproof_${role}_access_token`);
      localStorage.removeItem(`skillproof_${role}_refresh_token`);
      localStorage.removeItem(`skillproof_${role}_user`);
      window.location.href = `/org/signin?expired=true`;
      return Promise.reject(error);
    }

    if (role === 'user' && status === 401 && detail.includes('User not found or inactive')) {
      localStorage.removeItem(`skillproof_${role}_access_token`);
      localStorage.removeItem(`skillproof_${role}_refresh_token`);
      localStorage.removeItem(`skillproof_${role}_user`);
      window.location.href = `/user/signin?expired=true`;
      return Promise.reject(error);
    }

    // If request is on a public page with no role, do not attempt role-specific refresh or logout
    if (!role) {
      return Promise.reject(error);
    }

    // 2. Token Refresh Logic
    if (status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem(`skillproof_${role}_refresh_token`);

      if (refreshToken) {
        try {
          let endpoint = '/auth/user/refresh';
          if (role === 'org') endpoint = '/auth/org/refresh';
          if (role === 'admin') endpoint = '/auth/admin/refresh';
          
          const res = await axios.post(`/api/v1${endpoint}`, { refresh_token: refreshToken });
          const newToken = res.data.access_token;
          
          localStorage.setItem(`skillproof_${role}_access_token`, newToken);
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return client(originalRequest);
        } catch (refreshError) {
          if (refreshError.response && (refreshError.response.status === 400 || refreshError.response.status === 401)) {
            localStorage.removeItem(`skillproof_${role}_access_token`);
            localStorage.removeItem(`skillproof_${role}_refresh_token`);
            localStorage.removeItem(`skillproof_${role}_user`);
            window.location.href = `/${role === 'user' ? 'user/signin' : role === 'org' ? 'org/signin' : 'admin'}`;
          }
        }
      }
    }

    return Promise.reject(error);
  }
);

export default client;
