import { api } from "./api";
import { Prediction, ADRReport } from "../types";

export const predictionService = {
  /**
   * Retrieves all predictions from the asynchronous worker queue.
   */
  async getQueue(): Promise<Prediction[]> {
    const response = await api.get<Prediction[]>("/api/predictions/queue/");
    return response.data;
  },

  /**
   * Dispatches a new diagnostic profile for background AI processing.
   */
  async createPrediction(payload: {
    patient_id?: string;
    full_name?: string;
    age?: number;
    gender?: string;
    conditions?: string[];
    symptoms: string;
    save_patient?: boolean;
    predictionMode: "existing" | "new" | "general";
  }): Promise<Prediction> {
    const response = await api.post<Prediction>("/api/predictions/", payload);
    return response.data;
  },

  /**
   * Re-submits a failed prediction to the processing workers.
   */
  async retryPrediction(id: string): Promise<{ success: boolean; message: string; prediction: Prediction }> {
    const response = await api.post<{ success: boolean; message: string; prediction: Prediction }>(
      `/api/predictions/${id}/retry/`
    );
    return response.data;
  },

  /**
   * Retrieves single completed evaluation parameters.
   */
  async getPredictionDetails(id: string): Promise<Prediction> {
    const response = await api.get<Prediction>(`/api/predictions/${id}/`);
    return response.data;
  },

  /**
   * Submits a clinician's final chosen prescription, updating the patient's record.
   */
  async selectRecommendedDrug(
    id: string,
    payload: {
      drug_name: string;
      confidence_score: number;
      explanation: string;
    }
  ): Promise<{ success: boolean; message: string; selected_drug: string; selected_at: string }> {
    const response = await api.post<{ success: boolean; message: string; selected_drug: string; selected_at: string }>(
      `/api/predict/${id}/select/`,
      payload
    );
    return response.data;
  },

  /**
   * Performs an Adverse Drug Reaction (ADR) interaction check.
   */
  async checkADR(payload: {
    patient_id?: string;
    checked_drugs: string[];
    is_manual?: boolean;
    manual_profile?: {
      age?: string;
      gender?: string;
      conditions?: string[];
    };
  }): Promise<ADRReport> {
    const response = await api.post<ADRReport>("/api/adr/check/", payload);
    return response.data;
  },

  /**
   * Fetches ADR report histories.
   */
  async getADRHistory(): Promise<ADRReport[]> {
    const response = await api.get<ADRReport[]>("/api/adr/history/");
    return response.data;
  }
};
