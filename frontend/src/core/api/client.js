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

// ── Request interceptor — attach JWT ────────────────────────────────────────────
client.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('skillproof_access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor — handle 401 ──────────────────────────────────────────
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('skillproof_refresh_token');

      if (refreshToken) {
        try {
          const role = localStorage.getItem('skillproof_role') || 'user';
          let endpoint = '/auth/user/refresh';
          if (role === 'org') endpoint = '/auth/org/refresh';
          if (role === 'admin') endpoint = '/auth/admin/refresh';
          const res = await axios.post(`/api/v1${endpoint}`, { refresh_token: refreshToken });
          const newToken = res.data.access_token;
          localStorage.setItem('skillproof_access_token', newToken);
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return client(originalRequest);
        } catch {
          // Refresh failed — clear tokens and reload
          localStorage.removeItem('skillproof_access_token');
          localStorage.removeItem('skillproof_refresh_token');
          localStorage.removeItem('skillproof_role');
          localStorage.removeItem('skillproof_user');
          window.location.href = '/';
        }
      }
    }

    return Promise.reject(error);
  }
);

export default client;
