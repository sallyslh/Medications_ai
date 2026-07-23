/**
 * authService.ts — Authentication API calls.
 *
 * All requests go through the shared Axios instance defined in api.ts,
 * which automatically attaches JWT headers and handles token refresh.
 *
 * Django endpoints consumed:
 *   POST /api/auth/login/
 *   POST /api/auth/logout/
 *   POST /api/auth/refresh/
 *   POST /api/auth/register/
 *   GET  /api/profile/
 */

import { api } from './api';
import { saveTokens, removeTokens, loadRefreshToken } from '../utils/tokenStorage';
import { User } from '../types';

export interface LoginResponse {
  access: string;
  refresh: string;
  user: User;
}

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
  role: string;
  department: string;
  first_name: string;
  last_name: string;
}

export const authService = {
  /**
   * POST /api/auth/login/
   * Authenticates credentials and stores the returned JWT pair.
   */
  async login(usernameOrEmail: string, password: string): Promise<LoginResponse> {
    const response = await api.post<LoginResponse>('/api/auth/login/', {
      username: usernameOrEmail,
      password,
    });
    const { access, refresh } = response.data;
    if (access && refresh) {
      saveTokens(access, refresh);
    }
    return response.data;
  },

  /**
   * POST /api/auth/register/
   * Registers a new clinician account, then immediately logs in.
   */
  async register(payload: RegisterPayload): Promise<LoginResponse> {
    const response = await api.post<LoginResponse>('/api/auth/register/', payload);
    // If the backend returns tokens on registration, persist them
    if (response.data?.access && response.data?.refresh) {
      saveTokens(response.data.access, response.data.refresh);
    }
    return response.data;
  },

  /**
   * POST /api/auth/logout/
   * Blacklists the refresh token on the server, then purges local storage.
   */
  async logout(): Promise<void> {
    const refresh = loadRefreshToken();
    try {
      if (refresh) {
        await api.post('/api/auth/logout/', { refresh });
      }
    } catch (err) {
      // Graceful degradation: purge tokens locally even if the server call fails
      console.warn('[authService] Server-side logout failed; purging local tokens.', err);
    } finally {
      removeTokens();
    }
  },

  /**
   * GET /api/profile/
   * Returns the authenticated user's profile.
   */
  async getProfile(): Promise<User> {
    const response = await api.get<User>('/api/profile/');
    return response.data;
  },

  /**
   * POST /api/auth/refresh/
   * Exchanges a valid refresh token for a new access (+ rotated refresh) token.
   */
  async refreshAccessToken(
    refresh: string
  ): Promise<{ access: string; refresh?: string }> {
    const response = await api.post<{ access: string; refresh?: string }>(
      '/api/auth/refresh/',
      { refresh }
    );
    return response.data;
  },
};
