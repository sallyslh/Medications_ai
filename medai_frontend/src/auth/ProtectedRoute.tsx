import React from "react";
import { useAuth } from "./useAuth";
import Login from "../components/Login";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ("Doctor" | "Nurse" | "Admin")[];
}

/**
 * Gatekeeper component for securing sub-pages or sections.
 * Displays a professional clinical loading screen during session check.
 * Redirects to Login screen on authentication failure.
 * Shows a clean clinical restriction card if role-based conditions are not met.
 */
export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div id="auth-startup-loading" className="flex flex-col items-center justify-center h-screen bg-slate-50">
        <div className="relative flex flex-col items-center space-y-4">
          <div className="relative">
            <div className="animate-ping absolute inset-0 rounded-full h-12 w-12 bg-indigo-100" />
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent relative" />
          </div>
          <div className="text-center">
            <h3 className="font-bold text-slate-800 font-display text-base">Verifying Clinician Session</h3>
            <p className="text-[10px] text-slate-400 font-mono mt-1 uppercase tracking-wider">
              SECURE HIPAA-COMPLIANT SYSTEM HANDSHAKE
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Return standard Login screen wrapper directly
    return <Login />;
  }

  // Ensure role permissions match allowed list if explicitly set
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return (
      <div id="auth-role-restricted" className="flex flex-col items-center justify-center h-full min-h-[400px] p-8 text-center bg-slate-50">
        <div className="max-w-md p-8 bg-white border border-rose-200 rounded-xl shadow-sm space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 border border-rose-200">
            <svg
              className="h-6 w-6 text-rose-600"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
              />
            </svg>
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900 font-display">Access Restricted</h3>
            <p className="text-xs text-slate-500 leading-relaxed font-sans">
              Your clinical profile ({user.role}) is not authorized to interact with this panel.
              Please contact the medical systems administrator for credential updates.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
