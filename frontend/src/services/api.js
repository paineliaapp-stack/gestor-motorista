/**
 * services/api.js
 * Centralized API client for Autor.AI backend.
 */

import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 180000, // 120s for AI generation
  headers: {
    'Content-Type': 'application/json',
  },
});


// Request interceptor — add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('autor_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — normalize errors
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message =
      error.response?.data?.error ||
      error.message ||
      'An unexpected error occurred';
    return Promise.reject(new Error(message));
  }
);

// ─── News ─────────────────────────────────────────────────────────────────────

export const newsApi = {
  /**
   * Fetch trending news articles.
   * @param {Object} params - { category, q, country }
   */
  getTrending: (params = {}) =>
    api.get('/news', { params }),

  /**
   * Get available categories.
   */
  getCategories: () =>
    api.get('/news/categories'),
};

// ─── Script Generation ────────────────────────────────────────────────────────

export const generateApi = {
  /**
   * Generate a full script.
   * @param {Object} body - { article, platform, style, version }
   */
  createScript: (body) =>
    api.post('/generate', body),

  /**
   * Regenerate hooks only.
   * @param {Object} body - { article, platform, style, existingHooks }
   */
  regenerateHooks: (body) =>
    api.post('/generate/hooks', body),

  /**
   * Get platform and style options.
   */
  getOptions: () =>
    api.get('/generate/options'),
};

// ─── Health ───────────────────────────────────────────────────────────────────
export const healthApi = {
  check: () => api.get('/health'),
};

export default api;
