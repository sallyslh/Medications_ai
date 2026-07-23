export interface User {
  id: string;
  username: string;
  email: string;
  role: "Doctor" | "Nurse" | "Admin";
  department: string;
  first_name: string;
  last_name: string;
  created_at: string;
  updated_at: string;
}

export interface Patient {
  id: string;
  patient_id: string;
  full_name: string;
  age: number;
  gender: string;
  conditions: string[];
  current_drugs: string[];
  created_at: string;
  updated_at: string;
}

// "safe": checked, no conflict. "warning": checked, conflicts with a
// current medication. "unavailable": the check couldn't run at all (e.g.
// the interaction data failed to load) — must be shown as "unknown", never
// as "Safe", since it was never actually verified.
export type InteractionStatus = "safe" | "warning" | "unavailable";

export interface AlternativeDrug {
  drug_name: string;
  confidence_score: number;
  explanation: string;
  interaction_status?: InteractionStatus;
  interaction_warning?: string;
}

export interface Recommendation {
  drug_name: string;
  confidence_score: number;
  explanation: string;
  side_effects: string[];
  alternative_drugs: AlternativeDrug[];
  interaction_status?: InteractionStatus;
  interaction_warning?: string;
}

export interface Prediction {
  id: string;
  patient_id: string;
  patient_name: string;
  doctor_id: string;
  doctor_name: string;
  input_conditions: string;
  predicted_drug: string;
  confidence_score: number;
  explanation: string;
  alternative_drugs: AlternativeDrug[];
  side_effects: string[];
  interaction_status?: InteractionStatus;
  interaction_warning?: string;
  created_at: string;
  recommendations?: Recommendation[];
  selected_drug?: string;
  selected_confidence?: number;
  selected_explanation?: string;
  selected_at?: string;
  selected_by_clinician?: string;
  status?: "Pending" | "Running" | "Completed" | "Failed";
  progress?: number;
  error_message?: string;
}

export interface ADRReport {
  id: string;
  patient_id: string;
  patient_name: string;
  doctor_id: string;
  doctor_name: string;
  checked_drugs: string[];
  risk_level: "Low" | "Moderate" | "High";
  explanation: string;
  recommendation: string;
  alternative_drug: string;
  created_at: string;
}

export interface SupportTicket {
  id: string;
  user_id: string;
  username: string;
  title: string;
  description: string;
  status: "Pending" | "Open" | "In Progress" | "Resolved" | "Closed";
  created_at: string;
  category?: string;
  priority?: string;
  browser?: string;
  os?: string;
  steps_to_reproduce?: string;
}

export interface DashboardStats {
  totals: {
    patients: number;
    predictions: number;
    adrReports: number;
  };
  recentPatients: Patient[];
  recentPredictions: Prediction[];
  notifications: {
    id: string;
    title: string;
    message: string;
    type: string;
    created_at: string;
    read: boolean;
  }[];
}
