import React, { createContext, useState, useEffect, ReactNode } from "react";
import { User } from "../types";
import { authService } from "../services/authService";
import { 
  saveTokens, 
  removeTokens, 
  loadAccessToken, 
  loadRefreshToken, 
  checkAuthentication 
} from "../utils/tokenStorage";
import { registerOnLogout } from "../services/api";

export interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (usernameOrEmail: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAccessToken: () => Promise<void>;
  updateUser: (updatedUser: User) => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(loadAccessToken());
  const [refreshToken, setRefreshToken] = useState<string | null>(loadRefreshToken());
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Auto-recovery/startup check
  useEffect(() => {
    const initializeAuth = async () => {
      const hasToken = checkAuthentication();
      if (!hasToken) {
        setIsLoading(false);
        return;
      }

      try {
        // Attempt to fetch current user profile using current token
        const profile = await authService.getProfile();
        setUser(profile);
        setAccessToken(loadAccessToken());
        setRefreshToken(loadRefreshToken());
        setIsAuthenticated(true);
      } catch (err) {
        console.error("[AuthProvider] Session recovery failed (token may be expired):", err);
        // If profile fetch fails, let the token storage check for a refresh token
        const refresh = loadRefreshToken();
        if (refresh) {
          try {
            console.log("[AuthProvider] Attempting silent startup token refresh...");
            const refreshRes = await authService.refreshAccessToken(refresh);
            if (refreshRes.access) {
              saveTokens(refreshRes.access, refreshRes.refresh || refresh);
              setAccessToken(refreshRes.access);
              setRefreshToken(refreshRes.refresh || refresh);
              // Re-fetch profile
              const newProfile = await authService.getProfile();
              setUser(newProfile);
              setIsAuthenticated(true);
            } else {
              handleLocalLogout();
            }
          } catch (refreshErr) {
            console.error("[AuthProvider] Startup silent refresh failed:", refreshErr);
            handleLocalLogout();
          }
        } else {
          handleLocalLogout();
        }
      } finally {
        setIsLoading(false);
      }
    };

    // Register Axios automatic logout handler
    registerOnLogout(() => {
      console.warn("[AuthProvider] Invalidation event received from API interceptor. Logging out.");
      handleLocalLogout();
    });

    initializeAuth();
  }, []);

  const handleLocalLogout = () => {
    removeTokens();
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
    setIsAuthenticated(false);
  };

  const login = async (usernameOrEmail: string, password: string) => {
    setIsLoading(true);
    try {
      const data = await authService.login(usernameOrEmail, password);
      setUser(data.user);
      setAccessToken(data.access);
      setRefreshToken(data.refresh);
      setIsAuthenticated(true);
    } catch (err) {
      handleLocalLogout();
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await authService.logout();
    } catch (err) {
      console.error("[AuthProvider] Server logout failed:", err);
    } finally {
      handleLocalLogout();
      setIsLoading(false);
    }
  };

  const refreshAccessToken = async () => {
    const refresh = loadRefreshToken();
    if (!refresh) {
      handleLocalLogout();
      throw new Error("No refresh token available");
    }

    try {
      const data = await authService.refreshAccessToken(refresh);
      saveTokens(data.access, data.refresh || refresh);
      setAccessToken(data.access);
      if (data.refresh) {
        setRefreshToken(data.refresh);
      }
    } catch (err) {
      handleLocalLogout();
      throw err;
    }
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        refreshToken,
        isAuthenticated,
        isLoading,
        login,
        logout,
        refreshAccessToken,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
