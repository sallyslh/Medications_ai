/**
 * theme.ts — Applies the Dark Mode preference to the whole application.
 *
 * Dark mode is applied via a `dark` class on the <html> element. The actual
 * dark color overrides live in index.css (scoped under `html.dark`), so the
 * existing component markup / design system never has to change — this
 * just flips a single class.
 *
 * Persistence:
 *   - Immediately mirrored to localStorage so the theme survives a refresh
 *     even before the authenticated /api/settings/ call resolves.
 *   - Also synced to the backend (UserSettings.theme) via settingsService
 *     whenever the user is authenticated, so the preference follows the
 *     clinician across devices.
 */

const DARK_MODE_KEY = "clinical_settings_darkmode";

export function applyTheme(isDark: boolean): void {
  const root = document.documentElement;
  if (isDark) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
  localStorage.setItem(DARK_MODE_KEY, String(isDark));
}

export function loadStoredTheme(): boolean {
  return localStorage.getItem(DARK_MODE_KEY) === "true";
}
