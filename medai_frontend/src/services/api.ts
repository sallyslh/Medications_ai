/**
 * api.ts — Centralized Axios instance for all Django REST API communication.
 *
 * Architecture:
 *   React (this file) → Axios → Django REST Framework → PostgreSQL
 *
 * JWT flow:
 *   1. Request interceptor attaches "Authorization: Bearer <access>" to every call.
 *   2. Response interceptor catches 401 responses, silently refreshes the access
 *      token via /api/auth/refresh/, then retries the original request once.
 *   3. If refresh fails (token expired / blacklisted), it calls the registered
 *      logout callback so the AuthProvider can clean up React state.
 *
 * All API calls in every component/service MUST use this `api` instance —
 * never the raw `fetch()` API or a separate Axios instance.
 */

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import {
  loadAccessToken,
  loadRefreshToken,
  saveTokens,
  removeTokens,
} from '../utils/tokenStorage';

/**
 * Base URL is empty string in dev — Vite proxy forwards /api/* → Django :8000.
 * In production set VITE_API_BASE_URL to the Django origin (e.g. https://api.yourdomain.com).
 */
const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';//(import.meta as any).env?.VITE_API_BASE_URL ?? '';

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 5000, //
  headers: {
    'Content-Type': 'application/json',
    accept : 'application/json' //
  },
});

export default api; //

/** Queued requests waiting for a token refresh to complete. */
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

/** Callback registered by AuthProvider to perform React-layer logout on session expiry. */
let onLogoutCallback: (() => void) | null = null;

/**
 * Called once by AuthProvider on mount.
 * Connects the Axios layer back to React auth state.
 */
export const registerOnLogout = (cb: () => void): void => {
  onLogoutCallback = cb;
};

const processQueue = (error: unknown, token: string | null = null): void => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token as string);
    }
  });
  failedQueue = [];
};

// ── Request interceptor ──────────────────────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = loadAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor ─────────────────────────────────────────────────────
api.interceptors.response.use(
  (response) => response,

  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (!originalRequest) {
      return Promise.reject(error);
    }

    const status = error.response?.status;

    // ── Automatic silent token refresh on 401 ─────────────────────────────
    if (status === 401 && !originalRequest._retry) {
      const isAuthEndpoint =
        originalRequest.url?.includes('/api/auth/refresh') ||
        originalRequest.url?.includes('/api/auth/login');

      // Don't retry auth endpoints — they legitimately fail
      if (isAuthEndpoint) {
        removeTokens();
        onLogoutCallback?.();
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Queue this request until the refresh resolves
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = loadRefreshToken();
      if (!refreshToken) {
        isRefreshing = false;
        removeTokens();
        onLogoutCallback?.();
        return Promise.reject(error);
      }

      try {
        const response = await axios.post<{ access: string; refresh?: string }>(
          `${BASE_URL}/api/auth/refresh/`,
          { refresh: refreshToken }
        );

        const { access, refresh } = response.data;
        saveTokens(access, refresh ?? refreshToken);
        processQueue(null, access);

        originalRequest.headers.Authorization = `Bearer ${access}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        removeTokens();
        onLogoutCallback?.();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // ── Enrich error with a human-readable message ─────────────────────────
    let message = 'An unexpected error occurred.';
    if (error.response) {
      const data = error.response.data as Record<string, unknown>;
      if (status === 403) {
        message =
          (data?.detail as string) ||
          'You do not have permission to perform this action (403 Forbidden).';
      } else if (status === 404) {
        message = 'The requested resource was not found (404).';
      } else if (status === 500) {
        message =
          'The server encountered an internal error. Please try again (500).';
      } else {
        message =
          (data?.detail as string) ||
          (data?.message as string) ||
          (data?.error as string) ||
          message;
      }
    } else if (error.request) {
      message =
        'Network connectivity issue. Please check your connection to the server.';
    }

    (error as AxiosError & { userFriendlyMessage: string }).userFriendlyMessage =
      message;

    return Promise.reject(error);
  }
);
