import React, { useState, useEffect } from "react";
import {
  Eye,
  EyeOff,
  CheckCircle,
  AlertTriangle,
  Key,
  Check
} from "lucide-react";

import { settingsService } from "../services/settingsService";
import { applyTheme, loadStoredTheme } from "../utils/theme";

interface SettingsPageProps {
  token: string;
}

export default function SettingsPage({ token }: SettingsPageProps) {
  const [profile, setProfile] = useState({
    username: "",
    email: "",
    role: "Doctor",
    department: "",
    first_name: "",
    last_name: "",
    created_at: "",
  });

  const [loading, setLoading] = useState(true);
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState("");
  const [profileError, setProfileError] = useState("");

  // Change Password states
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [changingPass, setChangingPass] = useState(false);
  const [passSuccess, setPassSuccess] = useState("");
  const [passError, setPassError] = useState("");

  // Preference States
  // NOTE on persistence: language, dark mode, face recognition, email
  // notifications, and high-risk alerts are backed by the Django
  // /api/settings/ endpoint (UserSettings model) and sync across devices.
  // Two-Factor Auth, Session Timeout, Drug Prediction notifications, and
  // System notifications have no corresponding backend field yet, so they
  // are persisted locally (localStorage) only — this is called out in the
  // UI below rather than pretending they are backend-synced.
  const [language, setLanguage] = useState("English");
  const [enableFaceRec, setEnableFaceRec] = useState(true);
  const [enable2FA, setEnable2FA] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState("30 minutes");
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifHighRisk, setNotifHighRisk] = useState(true);
  const [notifPrediction, setNotifPrediction] = useState(true);
  const [notifSystem, setNotifSystem] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [lastLogin, setLastLogin] = useState("");

  // Language codes accepted by the backend UserSettings.language field
  // map to the friendly display labels used in the selects below.
  const LANGUAGE_LABEL_TO_CODE: Record<string, string> = {
    "English": "en",
    "Spanish": "es",
    "French": "fr",
    "German": "de",
  };
  const LANGUAGE_CODE_TO_LABEL: Record<string, string> = {
    en: "English",
    es: "Spanish",
    fr: "French",
    de: "German",
  };

  useEffect(() => {
    // Set a realistic last login session string on load
    const now = new Date();
    setLastLogin("Today, " + now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }));

    // Load locally-persisted-only preferences from local storage
    const local2fa = localStorage.getItem("clinical_settings_2fa");
    if (local2fa !== null) setEnable2FA(local2fa === "true");

    const localTimeout = localStorage.getItem("clinical_settings_timeout");
    if (localTimeout) setSessionTimeout(localTimeout);

    const localNotifPrediction = localStorage.getItem("clinical_settings_notif_prediction");
    if (localNotifPrediction !== null) setNotifPrediction(localNotifPrediction !== "false");

    const localNotifSystem = localStorage.getItem("clinical_settings_notif_system");
    if (localNotifSystem !== null) setNotifSystem(localNotifSystem !== "false");

    // Dark mode is applied immediately from localStorage in main.tsx on
    // startup; reflect that same value in this component's UI state.
    setDarkMode(loadStoredTheme());
  }, []);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const data = await settingsService.getSettings();

        setProfile({
          username: data.profile.username || "",
          email: data.profile.email || "",
          role: data.profile.role || "Doctor",
          department: data.profile.department || "",
          first_name: data.profile.first_name || "",
          last_name: data.profile.last_name || "",
          created_at: data.profile.created_at || "",
        });

        setLanguage(LANGUAGE_CODE_TO_LABEL[data.preferences.language] || "English");
        setEnableFaceRec(!!data.preferences.enableFaceRecognition);
        setNotifEmail(!!data.preferences.notifications?.email);
        setNotifHighRisk(!!data.preferences.notifications?.highRiskAlerts);

        const backendDark = data.preferences.theme === "dark";
        setDarkMode(backendDark);
        applyTheme(backendDark);
      } catch (err) {
        console.error("Failed to load settings.");
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, [token]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdatingProfile(true);
    setProfileSuccess("");
    setProfileError("");

    try {
      await settingsService.updateSettings({
        profile: {
          first_name: profile.first_name,
          last_name: profile.last_name,
          email: profile.email,
          department: profile.department,
        },
      } as any);
      setProfileSuccess("Profile settings updated successfully.");
    } catch (err: any) {
      setProfileError(err.userFriendlyMessage || "Server connection lost.");
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) return;

    setChangingPass(true);
    setPassSuccess("");
    setPassError("");

    try {
      await settingsService.changePassword({ current_password: currentPassword, new_password: newPassword });
      setPassSuccess("Password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err: any) {
      setPassError(err.userFriendlyMessage || "Server communication failed.");
    } finally {
      setChangingPass(false);
    }
  };

  // ── Backend-synced preference updates ─────────────────────────────────────
  // Each of these persists immediately to /api/settings/ (via PUT) as soon
  // as the switch is toggled, in addition to updating local UI state.
  const persistPreferences = async (overrides: Record<string, any>) => {
    try {
      await settingsService.updateSettings({
        preferences: {
          language: LANGUAGE_LABEL_TO_CODE[language] || "en",
          theme: darkMode ? "dark" : "light",
          enableFaceRecognition: enableFaceRec,
          notifications: {
            email: notifEmail,
            highRiskAlerts: notifHighRisk,
            weeklyDigest: false,
          },
          ...overrides,
        },
      } as any);
    } catch (err) {
      console.error("Failed to persist preference change.", err);
    }
  };

  const handleDarkModeToggle = (checked: boolean) => {
    setDarkMode(checked);
    applyTheme(checked);
    persistPreferences({ theme: checked ? "dark" : "light" });
  };

  const handleLanguageChange = (value: string) => {
    setLanguage(value);
    persistPreferences({ language: LANGUAGE_LABEL_TO_CODE[value] || "en" });
  };

  const handleFaceRecToggle = (checked: boolean) => {
    setEnableFaceRec(checked);
    persistPreferences({ enableFaceRecognition: checked });
  };

  const handleNotifEmailToggle = (checked: boolean) => {
    setNotifEmail(checked);
    persistPreferences({
      notifications: {
        email: checked,
        highRiskAlerts: notifHighRisk,
        weeklyDigest: false,
      },
    });
  };

  const handleNotifHighRiskToggle = (checked: boolean) => {
    setNotifHighRisk(checked);
    persistPreferences({
      notifications: {
        email: notifEmail,
        highRiskAlerts: checked,
        weeklyDigest: false,
      },
    });
  };

  // ── Local-only preference updates (no backend field exists yet) ──────────
  const handle2FAToggle = (checked: boolean) => {
    setEnable2FA(checked);
    localStorage.setItem("clinical_settings_2fa", String(checked));
  };

  const handleSessionTimeoutChange = (value: string) => {
    setSessionTimeout(value);
    localStorage.setItem("clinical_settings_timeout", value);
  };

  const handleNotifPredictionToggle = (checked: boolean) => {
    setNotifPrediction(checked);
    localStorage.setItem("clinical_settings_notif_prediction", String(checked));
  };

  const handleNotifSystemToggle = (checked: boolean) => {
    setNotifSystem(checked);
    localStorage.setItem("clinical_settings_notif_system", String(checked));
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-80px)]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent" />
        <p className="text-slate-500 text-xs font-mono mt-4">PULLING CLINIC PREFERENCES...</p>
      </div>
    );
  }

  return (
    <div id="settings-view" className="p-8 max-w-4xl mx-auto space-y-1">
      
      {/* Settings Title */}
      <div className="pb-2">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight font-display">
          Settings
        </h1>
      </div>

      {/* ---------------------------------------- */}
      <hr className="border-t border-slate-200/80 my-6" />

      {/* 👤 Profile */}
      <div className="space-y-6">
        <div className="flex items-center space-x-2.5 text-slate-900 font-bold text-sm">
          <span className="text-base">👤</span>
          <h2 className="uppercase tracking-wider font-display font-extrabold text-slate-800">Profile</h2>
        </div>

        {profileSuccess && (
          <div className="p-3 bg-emerald-50 border-l-4 border-emerald-500 text-emerald-800 text-xs flex items-center space-x-2 rounded max-w-3xl">
            <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500" />
            <span>{profileSuccess}</span>
          </div>
        )}

        {profileError && (
          <div className="p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs flex items-center space-x-2 rounded max-w-3xl">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
            <span>{profileError}</span>
          </div>
        )}

        <form onSubmit={handleUpdateProfile} className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-3xl">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">First Name</label>
            <input
              type="text"
              required
              value={profile.first_name}
              onChange={(e) => setProfile({ ...profile, first_name: e.target.value })}
              className="w-full px-3.5 py-2 bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg text-xs font-medium text-slate-800 transition-all outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Last Name</label>
            <input
              type="text"
              required
              value={profile.last_name}
              onChange={(e) => setProfile({ ...profile, last_name: e.target.value })}
              className="w-full px-3.5 py-2 bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg text-xs font-medium text-slate-800 transition-all outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Department</label>
            <input
              type="text"
              required
              value={profile.department}
              onChange={(e) => setProfile({ ...profile, department: e.target.value })}
              className="w-full px-3.5 py-2 bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg text-xs font-medium text-slate-800 transition-all outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Email</label>
            <input
              type="email"
              required
              value={profile.email}
              onChange={(e) => setProfile({ ...profile, email: e.target.value })}
              className="w-full px-3.5 py-2 bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg text-xs font-medium text-slate-800 transition-all outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Role</label>
            <select
              value={profile.role || "Doctor"}
              disabled
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-500 transition-all outline-none cursor-not-allowed"
            >
              <option value="Doctor">Doctor</option>
              <option value="Nurse">Nurse</option>
              <option value="Admin">Admin</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Language</label>
            <select
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value)}
              className="w-full px-3.5 py-2 bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg text-xs font-medium text-slate-800 transition-all outline-none cursor-pointer"
            >
              <option value="English">English (US/UK)</option>
              <option value="Spanish">Español (ES)</option>
              <option value="French">Français (FR)</option>
              <option value="German">Deutsch (DE)</option>
            </select>
          </div>

          <div className="md:col-span-2 flex justify-start pt-2">
            <button
              type="submit"
              disabled={updatingProfile}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold rounded-lg text-xs transition-colors flex items-center justify-center space-x-2 shadow-sm cursor-pointer"
            >
              {updatingProfile ? (
                <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              <span>Save</span>
            </button>
          </div>
        </form>
      </div>

      {/* ---------------------------------------- */}
      <hr className="border-t border-slate-200/80 my-8" />

      {/* 🔒 Security */}
      <div className="space-y-6">
        <div className="flex items-center space-x-2.5 text-slate-900 font-bold text-sm">
          <span className="text-base">🔒</span>
          <h2 className="uppercase tracking-wider font-display font-extrabold text-slate-800">Security</h2>
        </div>

        {passSuccess && (
          <div className="p-3 bg-emerald-50 border-l-4 border-emerald-500 text-emerald-800 text-xs flex items-center space-x-2 rounded max-w-3xl">
            <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500" />
            <span>{passSuccess}</span>
          </div>
        )}

        {passError && (
          <div className="p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs flex items-center space-x-2 rounded max-w-3xl">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
            <span>{passError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl">
          {/* Change Password */}
          <div className="bg-slate-50 p-5 rounded-xl border border-slate-100 space-y-4">
            <h3 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
              <Key className="h-3.5 w-3.5 text-indigo-600" />
              Change Password
            </h3>

            <form onSubmit={handleChangePassword} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Current Password</label>
                <div className="relative">
                  <input
                    type={showCurrentPass ? "text" : "password"}
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full pl-3 pr-10 py-1.5 bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg text-xs font-mono text-slate-800 transition-all outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                  >
                    {showCurrentPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">New Password</label>
                <div className="relative">
                  <input
                    type={showNewPass ? "text" : "password"}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-3 pr-10 py-1.5 bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg text-xs font-mono text-slate-800 transition-all outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                  >
                    {showNewPass ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={changingPass}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-[10px] uppercase tracking-wider transition-colors flex justify-center items-center cursor-pointer shadow-sm"
              >
                {changingPass && <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent mr-2" />}
                Change Password
              </button>
            </form>
          </div>

          {/* Security Preferences */}
          <div className="space-y-4">
            {/* Enable Face Recognition */}
            <label className="flex items-start justify-between p-4 bg-white border border-slate-200/80 rounded-xl hover:border-slate-300 transition-all cursor-pointer">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-800 block">Enable Face Recognition</span>
                <span className="text-[10px] text-slate-400 font-medium">Biometric secure scanning</span>
              </div>
              <div className="relative inline-flex items-center">
                <input
                  type="checkbox"
                  checked={enableFaceRec}
                  onChange={(e) => handleFaceRecToggle(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="relative w-9 h-5 bg-slate-200 rounded-full peer-focus:outline-none peer-checked:bg-indigo-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
              </div>
            </label>

            {/* Enable Two-Factor Authentication */}
            <label className="flex items-start justify-between p-4 bg-white border border-slate-200/80 rounded-xl hover:border-slate-300 transition-all cursor-pointer">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-slate-800 block">Enable Two-Factor Authentication</span>
                <span className="text-[10px] text-slate-400 font-medium">Verify through authenticator codes (saved on this device only — no backend field yet)</span>
              </div>
              <div className="relative inline-flex items-center">
                <input
                  type="checkbox"
                  checked={enable2FA}
                  onChange={(e) => handle2FAToggle(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="relative w-9 h-5 bg-slate-200 rounded-full peer-focus:outline-none peer-checked:bg-indigo-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
              </div>
            </label>

            {/* Session Timeout */}
            <div className="p-4 bg-white border border-slate-200/80 rounded-xl space-y-2 hover:border-slate-300 transition-all">
              <div>
                <label htmlFor="session-timeout-select" className="text-xs font-bold text-slate-800 block cursor-pointer">Session Timeout</label>
                <span className="text-[10px] text-slate-400 font-medium">Auto-lock after period of inactivity (device-local)</span>
              </div>
              <select
                id="session-timeout-select"
                value={sessionTimeout}
                onChange={(e) => handleSessionTimeoutChange(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 outline-none cursor-pointer focus:bg-white focus:border-indigo-500 transition-all"
              >
                <option value="15 minutes">15 minutes</option>
                <option value="30 minutes">30 minutes</option>
                <option value="1 hour">1 hour</option>
                <option value="Never">Never</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ---------------------------------------- */}
      <hr className="border-t border-slate-200/80 my-8" />

      {/* 🔔 Notifications */}
      <div className="space-y-6">
        <div className="flex items-center space-x-2.5 text-slate-900 font-bold text-sm">
          <span className="text-base">🔔</span>
          <h2 className="uppercase tracking-wider font-display font-extrabold text-slate-800">Notifications</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
          {/* Email Notifications */}
          <label className="flex items-start justify-between p-4 bg-white border border-slate-200/80 rounded-xl hover:border-slate-300 transition-all cursor-pointer">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-slate-800 block">Email Notifications</span>
              <span className="text-[10px] text-slate-400 font-medium">Activity updates to clinician mailbox</span>
            </div>
            <div className="relative inline-flex items-center">
              <input
                type="checkbox"
                checked={notifEmail}
                onChange={(e) => handleNotifEmailToggle(e.target.checked)}
                className="sr-only peer"
              />
              <div className="relative w-9 h-5 bg-slate-200 rounded-full peer-focus:outline-none peer-checked:bg-indigo-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
            </div>
          </label>

          {/* High-Risk Drug Alerts */}
          <label className="flex items-start justify-between p-4 bg-white border border-slate-200/80 rounded-xl hover:border-slate-300 transition-all cursor-pointer">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-slate-800 block">High-Risk Drug Alerts</span>
              <span className="text-[10px] text-slate-400 font-medium">Immediate critical contraindication notices</span>
            </div>
            <div className="relative inline-flex items-center">
              <input
                type="checkbox"
                checked={notifHighRisk}
                onChange={(e) => handleNotifHighRiskToggle(e.target.checked)}
                className="sr-only peer"
              />
              <div className="relative w-9 h-5 bg-slate-200 rounded-full peer-focus:outline-none peer-checked:bg-indigo-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
            </div>
          </label>

          {/* Drug Prediction Complete */}
          <label className="flex items-start justify-between p-4 bg-white border border-slate-200/80 rounded-xl hover:border-slate-300 transition-all cursor-pointer">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-slate-800 block">Drug Prediction Complete</span>
              <span className="text-[10px] text-slate-400 font-medium">Notification when model processing completes (device-local)</span>
            </div>
            <div className="relative inline-flex items-center">
              <input
                type="checkbox"
                checked={notifPrediction}
                onChange={(e) => handleNotifPredictionToggle(e.target.checked)}
                className="sr-only peer"
              />
              <div className="relative w-9 h-5 bg-slate-200 rounded-full peer-focus:outline-none peer-checked:bg-indigo-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
            </div>
          </label>

          {/* System Notifications */}
          <label className="flex items-start justify-between p-4 bg-white border border-slate-200/80 rounded-xl hover:border-slate-300 transition-all cursor-pointer">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-slate-800 block">System Notifications</span>
              <span className="text-[10px] text-slate-400 font-medium">Platform maintenance, backups, & log alerts (device-local)</span>
            </div>
            <div className="relative inline-flex items-center">
              <input
                type="checkbox"
                checked={notifSystem}
                onChange={(e) => handleNotifSystemToggle(e.target.checked)}
                className="sr-only peer"
              />
              <div className="relative w-9 h-5 bg-slate-200 rounded-full peer-focus:outline-none peer-checked:bg-indigo-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
            </div>
          </label>
        </div>
      </div>

      {/* ---------------------------------------- */}
      <hr className="border-t border-slate-200/80 my-8" />

      {/* 🌙 Appearance */}
      <div className="space-y-6">
        <div className="flex items-center space-x-2.5 text-slate-900 font-bold text-sm">
          <span className="text-base">🌙</span>
          <h2 className="uppercase tracking-wider font-display font-extrabold text-slate-800">Appearance</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-3xl">
          {/* Dark Mode */}
          <label className="flex items-start justify-between p-4 bg-white border border-slate-200/80 rounded-xl hover:border-slate-300 transition-all cursor-pointer">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-slate-800 block">Dark Mode</span>
              <span className="text-[10px] text-slate-400 font-medium">Toggle midnight color theme preset</span>
            </div>
            <div className="relative inline-flex items-center">
              <input
                type="checkbox"
                checked={darkMode}
                onChange={(e) => handleDarkModeToggle(e.target.checked)}
                className="sr-only peer"
              />
              <div className="relative w-9 h-5 bg-slate-200 rounded-full peer-focus:outline-none peer-checked:bg-indigo-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
            </div>
          </label>

          {/* Language selector */}
          <div className="p-4 bg-white border border-slate-200/80 rounded-xl space-y-2 hover:border-slate-300 transition-all">
            <div>
              <label htmlFor="appearance-language-select" className="text-xs font-bold text-slate-800 block cursor-pointer">Language</label>
              <span className="text-[10px] text-slate-400 font-medium">System localization and dictionary preferences</span>
            </div>
            <select
              id="appearance-language-select"
              value={language}
              onChange={(e) => handleLanguageChange(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 outline-none cursor-pointer focus:bg-white focus:border-indigo-500 transition-all"
            >
              <option value="English">English (US/UK)</option>
              <option value="Spanish">Español (ES)</option>
              <option value="French">Français (FR)</option>
              <option value="German">Deutsch (DE)</option>
            </select>
          </div>
        </div>
      </div>

      {/* ---------------------------------------- */}
      <hr className="border-t border-slate-200/80 my-8" />

      {/* 📋 Account Information */}
      <div className="space-y-6">
        <div className="flex items-center space-x-2.5 text-slate-900 font-bold text-sm">
          <span className="text-base">📋</span>
          <h2 className="uppercase tracking-wider font-display font-extrabold text-slate-800">Account Information</h2>
        </div>

        <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-5 max-w-3xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Role</span>
              <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                {profile.role || "Doctor"}
              </p>
            </div>

            <div className="space-y-1 border-t md:border-t-0 md:border-l border-slate-200/80 pt-4 md:pt-0 md:pl-6">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Last Login</span>
              <p className="text-xs font-semibold text-slate-700 font-mono">
                {lastLogin}
              </p>
            </div>

            <div className="space-y-1 border-t md:border-t-0 md:border-l border-slate-200/80 pt-4 md:pt-0 md:pl-6">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Account Created</span>
              <p className="text-xs font-semibold text-slate-700 font-mono">
                {profile.created_at ? new Date(profile.created_at).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                }) : "—"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ---------------------------------------- */}
      <hr className="border-t border-slate-200/80 my-8" />

    </div>
  );
}
