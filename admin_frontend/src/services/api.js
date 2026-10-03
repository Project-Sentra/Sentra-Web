/**
 * api.js - Authenticated Axios HTTP Clients + session helpers
 * ============================================================
 * Two pre-configured Axios instances that attach the admin JWT
 * (stored at login) to every request:
 *
 *   api     → Flask backend   (VITE_API_URL, default http://127.0.0.1:5000/api)
 *   lprApi  → SentraAI service (VITE_LPR_URL, default http://127.0.0.1:5001/api)
 *
 * SentraAI does not issue its own tokens; it verifies the same JWT with
 * the backend, so one login works for both services.
 *
 * On a 401 from either service (expired/invalid token) the session is
 * cleared and the browser is sent to /signin.
 *
 * Usage in components:
 *   import api from '../services/api';
 *   const { data } = await api.get('/facilities');   // GET /api/facilities
 */

import axios from 'axios';

export const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api';
export const LPR_URL = import.meta.env.VITE_LPR_URL || 'http://127.0.0.1:5001/api';

const ADMIN_ROLES = ['admin', 'operator'];

// ── Session helpers ──────────────────────────────────────────────────

export function getAccessToken() {
  return localStorage.getItem('accessToken');
}

/** True if a token is stored and the stored role is admin/operator. */
export function isAdminSession() {
  return Boolean(getAccessToken()) && ADMIN_ROLES.includes(localStorage.getItem('userRole'));
}

export function clearSession() {
  [
    'accessToken',
    'refreshToken',
    'userEmail',
    'userId',
    'userDbId',
    'userRole',
    'userFullName',
  ].forEach((key) => localStorage.removeItem(key));
}

// ── Clients ──────────────────────────────────────────────────────────

function createClient(baseURL) {
  const client = axios.create({
    baseURL,
    timeout: 10000, // 10 second timeout
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Attach the JWT (stored at login) to every outgoing request.
  client.interceptors.request.use((config) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  // Expired/invalid token → clear the session and go to sign in.
  // Login/signup requests are excluded so their error messages can be shown.
  client.interceptors.response.use(
    (response) => response,
    (error) => {
      const url = error.config?.url || '';
      const isAuthCall = url.includes('/auth/login') || url.includes('/auth/signup');
      if (error.response?.status === 401 && !isAuthCall && getAccessToken()) {
        clearSession();
        if (typeof window !== 'undefined' && window.location.pathname !== '/signin') {
          window.location.assign('/signin?expired=1');
        }
      }
      return Promise.reject(error);
    },
  );

  return client;
}

export const api = createClient(API_URL);
export const lprApi = createClient(LPR_URL);

export default api;
