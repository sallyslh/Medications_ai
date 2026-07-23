import { useState } from "react";
import Sidebar from "./components/Sidebar";
import Dashboard from "./components/Dashboard";
import PatientsPage from "./components/PatientsPage";
import DrugPrediction from "./components/DrugPrediction";
import ADRAnalysis from "./components/ADRAnalysisPage";
import SettingsPage from "./components/SettingsPage";
import HelpPage from "./components/HelpPage";
import NotificationsPage from "./components/NotificationsPage";
import { Patient } from "./types";
import { AuthProvider } from "./auth/AuthProvider";
import { useAuth } from "./auth/useAuth";
import { ProtectedRoute } from "./auth/ProtectedRoute";

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

function AppContent() {
  const { user, accessToken, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("dashboard");

  // State to support page-to-page link context (e.g. clicking "Predict" on a patient file)
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  // Navigates and pre-fills prediction component
  const handlePredictForPatient = (patient: Patient) => {
    setSelectedPatient(patient);
    setActiveTab("prediction");
  };

  // Navigates and pre-fills ADR component
  const handleADRForPatient = (patient: Patient) => {
    setSelectedPatient(patient);
    setActiveTab("adr");
  };

  // View a patient file in the medical directories list
  const handleViewPatientDetails = (patientId: string) => {
    setSelectedPatientId(patientId);
    setActiveTab("patients");
  };

  const handleLogout = async () => {
    setSelectedPatientId(null);
    setSelectedPatient(null);
    setActiveTab("dashboard");
    await logout();
  };

  // Active Screen Selector Switch
  const renderContent = () => {
    // Provide a safe fallback token for child elements
    const token = accessToken || "";

    switch (activeTab) {
      case "dashboard":
        return (
          <Dashboard
            token={token}
            setActiveTab={setActiveTab}
            onPatientSelect={handleViewPatientDetails}
            onPredictSelect={handlePredictForPatient}
            onADRSelect={handleADRForPatient}
          />
        );
      case "patients":
        return (
          <PatientsPage
            token={token}
            userRole={user?.role || "Clinician"}
            selectedPatientId={selectedPatientId}
            onClearSelectedPatient={() => setSelectedPatientId(null)}
            onPredictSelect={handlePredictForPatient}
            onADRSelect={handleADRForPatient}
          />
        );
      case "prediction":
        return (
          <DrugPrediction
            token={token}
            selectedPatient={selectedPatient}
            onClearSelectedPatient={() => setSelectedPatient(null)}
          />
        );
      case "adr":
        return (
          <ADRAnalysis
            token={token}
            selectedPatient={selectedPatient}
            onClearSelectedPatient={() => setSelectedPatient(null)}
          />
        );
      case "settings":
        return <SettingsPage token={token} />;
      case "help":
        return <HelpPage token={token} />;
      case "notifications":
        return <NotificationsPage token={token} setActiveTab={setActiveTab} />;
      default:
        return (
          <div className="flex items-center justify-center h-full text-slate-500 font-mono">
            VIRTUAL CLINICAL SCREEN NOT FOUND
          </div>
        );
    }
  };

  return (
    <ProtectedRoute>
      <div id="medai-app-shell" className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden font-sans">
        {/* Navigation Sidebar */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={(tab) => {
            setActiveTab(tab);
            // If we navigate away manually, clear contextual selection
            if (tab !== "patients") {
              setSelectedPatientId(null);
            }
            if (tab !== "prediction" && tab !== "adr") {
              setSelectedPatient(null);
            }
          }}
          user={user}
          onLogout={handleLogout}
        />

        {/* Main Panel Content Area */}
        <main id="app-main-content" className="flex-1 overflow-y-auto bg-slate-50">
          {renderContent()}
        </main>
      </div>
    </ProtectedRoute>
  );
}
