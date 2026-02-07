/**
 * api.js - Authenticated Axios HTTP Client
 * ==========================================
 * Pre-configured Axios instance for making authenticated API calls
 * to the Flask backend (default: http://127.0.0.1:5000/api).
 *
 * Features:
 *   - Automatically attaches the JWT access token from localStorage
 *     to every outgoing request via the Authorization header.
 *   - Logs 401 errors when the token is invalid or expired.
 *   - Base URL can be overridden via the VITE_API_URL env variable.
 *
 * Usage in components:
 *   import api from '../services/api';
 *   const { data } = await api.get('/spots');        // GET /api/spots
 *   await api.post('/vehicle/entry', { plate_number: 'ABC-1234' });
 *
 * All protected backend endpoints require this client (or manually
 * setting the Authorization header). Use raw `axios` only for
 * public/external endpoints (like the SentraAI LPR service).
 */

import axios from 'axios';

// Create a dedicated Axios instance with the backend base URL
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api',
  timeout: 10000, // 10 second timeout
  headers: {
    'Content-Type': 'application/json'
  }
});

// ── Request Interceptor ──────────────────────────────────────────────
// Attach the JWT token (stored at login) to every outgoing request.
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// ── Response Interceptor ─────────────────────────────────────────────
// Handle expired/invalid tokens globally.
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response && error.response.status === 401) {
      // Token expired or invalid - log it.
      // The SignIn page handles full logout; individual pages can
      // redirect to /signin when they catch a 401 error.
      console.error('Authentication error:', error.response.data);
    }
    return Promise.reject(error);
  }
);

export default api;
