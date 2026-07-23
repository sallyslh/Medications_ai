/**
 * errorReporter.ts — Automatic critical error reporting via the Django API.
 *
 * Uses the shared Axios instance (api.ts) so JWT headers are sent automatically.
 * Maps to the real /api/help/ticket/ endpoint (POST) that the support app exposes.
 * Falls back silently if the network is unavailable.
 */

import { api } from '../services/api';

export async function reportCriticalError(
  title: string,
  errorDetails: string,
  priority: 'High' | 'Critical' = 'High',
  category: string = 'Other'
): Promise<void> {
  try {
    await api.post('/api/help/ticket/', {
      title,
      description: errorDetails,
      priority,
      category,
      // Mark as auto-generated so the support team can triage differently
      browser: navigator.userAgent,
      os: navigator.platform,
    });
  } catch (err) {
    // Non-critical — swallow silently to avoid recursive error loops
    console.error('[errorReporter] Failed to report error to API:', err);
  }
}
