import { api } from "./api";
import { User } from "../types";

export interface ClinicianSettings {
  profile: User;
  preferences: {
    language: string;
    theme: string;
    enableFaceRecognition: boolean;
    notifications: {
      email: boolean;
      highRiskAlerts: boolean;
      weeklyDigest: boolean;
    };
  };
}

export const settingsService = {
  /**
   * Fetches settings and preferences.
   */
  async getSettings(): Promise<ClinicianSettings> {
    const response = await api.get<ClinicianSettings>("/api/settings/");
    return response.data;
  },

  /**
   * Updates clinician settings and profile information.
   */
  async updateSettings(payload: Partial<ClinicianSettings>): Promise<{ success: boolean; message: string }> {
    const response = await api.put<{ success: boolean; message: string }>("/api/settings/", payload);
    return response.data;
  },

  /**
   * Updates secure account password credentials.
   */
  async changePassword(payload: {
    current_password?: string;
    new_password?: string;
  }): Promise<{ success: boolean; message: string }> {
    const response = await api.put<{ success: boolean; message: string }>("/api/change-password/", payload);
    return response.data;
  }
};
