import { api } from "./api";
import { DashboardStats } from "../types";

export const dashboardService = {
  /**
   * Retrieves high-level analytics, notification logs, and system alerts.
   */
  async getStats(): Promise<DashboardStats> {
    const response = await api.get<DashboardStats>("/api/dashboard/");
    return response.data;
  },

  /**
   * Evaluates the health and connectivity of the backend databases and services.
   */
  async getSystemStatus(): Promise<{
    status: string;
    services: Record<string, string>;
    last_checked: string;
  }> {
    const response = await api.get<{
      status: string;
      services: Record<string, string>;
      last_checked: string;
    }>("/api/system/status/");
    return response.data;
  }
};
