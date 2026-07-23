import { api } from "./api";
import { Patient } from "../types";

export const patientService = {
  /**
   * Fetches the complete patient directory, supporting search and filters.
   */
  async getPatients(params?: {
    search?: string;
    name?: string;
    patient_id?: string;
    condition?: string;
    drug?: string;
  }): Promise<Patient[]> {
    const response = await api.get<Patient[]>("/api/patients/", { params });
    return response.data;
  },

  /**
   * Retrieves a single patient file along with full diagnostic history.
   */
  async getPatientById(id: string): Promise<Patient & { history?: any }> {
    const response = await api.get<Patient & { history?: any }>(`/api/patients/${id}/`);
    return response.data;
  },

  /**
   * Registers a new patient within the clinic database.
   */
  async createPatient(patientData: Partial<Patient>): Promise<Patient> {
    const response = await api.post<Patient>("/api/patients/", patientData);
    return response.data;
  },

  /**
   * Updates an existing patient profile or active medication logs.
   */
  async updatePatient(id: string, patientData: Partial<Patient>): Promise<Patient> {
    const response = await api.put<Patient>(`/api/patients/${id}/`, patientData);
    return response.data;
  },

  /**
   * Deletes a patient file (requires high clinical privilege/admin rights).
   */
  async deletePatient(id: string): Promise<{ success: boolean; message: string }> {
    const response = await api.delete<{ success: boolean; message: string }>(`/api/patients/${id}/`);
    return response.data;
  }
};
