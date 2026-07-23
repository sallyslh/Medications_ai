const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";

/**
 * Saves both access and refresh tokens to local storage (development/production fallback).
 * Can be easily replaced with HttpOnly secure cookie management in future production systems.
 */
export function saveTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

/**
 * Loads the current JWT Access Token.
 */
export function loadAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

/**
 * Loads the current JWT Refresh Token.
 */
export function loadRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

/**
 * Clears stored JWT access and refresh tokens.
 */
export function removeTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

/**
 * Validates if an access token exists (basic structural check).
 */
export function checkAuthentication(): boolean {
  const token = loadAccessToken();
  return !!token && token.length > 0;
}
