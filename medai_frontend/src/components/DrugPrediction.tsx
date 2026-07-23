import React, { useState, useEffect, useRef } from "react";
import { Brain, Search, Sparkles, User, HelpCircle, Activity, ChevronRight, CheckCircle, AlertTriangle } from "lucide-react";
import { Patient, Prediction } from "../types";
import { patientService } from "../services/patientService";
import { predictionService } from "../services/predictionService";

interface DrugPredictionProps {
  token: string;
  selectedPatient?: Patient | null;
  onClearSelectedPatient?: () => void;
}

export default function DrugPrediction({ token, selectedPatient, onClearSelectedPatient }: DrugPredictionProps) {
  const [predictionMode, setPredictionMode] = useState<"existing" | "new" | "general">("existing");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(false);

  // Mode 1: Existing Patient States
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [existingSymptoms, setExistingSymptoms] = useState("");

  // Mode 2: New Patient States
  const [newName, setNewName] = useState("");
  const [newAge, setNewAge] = useState("");
  const [newGender, setNewGender] = useState("Male");
  const [newCurrentDrugs, setNewCurrentDrugs] = useState("");
  const [newSymptoms, setNewSymptoms] = useState("");
  const [saveNewPatient, setSaveNewPatient] = useState(true);

  // Mode 3: General Prediction States
  const [genAge, setGenAge] = useState("");
  const [genGender, setGenGender] = useState("Male");
  const [genConditions, setGenConditions] = useState("");
  const [genSymptoms, setGenSymptoms] = useState("");

  // Global AI States
  const [analysing, setAnalysing] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Prediction | null>(null);
  const [prescribing, setPrescribing] = useState(false);
  const [prescribeSuccess, setPrescribeSuccess] = useState("");

  const [selectedDrug, setSelectedDrug] = useState<string | null>(null);
  const [selectedAt, setSelectedAt] = useState<string | null>(null);
  const [selectedByClinician, setSelectedByClinician] = useState<string | null>(null);

  // Prediction Queue States
  const [activeTab, setActiveTab] = useState<"results" | "queue">("queue");
  const [queue, setQueue] = useState<Prediction[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: "success" | "error" | "info"; predictionId: string }>>([]);

  const prevStatusesRef = useRef<Record<string, string>>({});

  useEffect(() => {
    if (result) {
      setSelectedDrug(result.selected_drug || null);
      setSelectedAt(result.selected_at || null);
      setSelectedByClinician(result.selected_by_clinician || null);
    } else {
      setSelectedDrug(null);
      setSelectedAt(null);
      setSelectedByClinician(null);
    }
  }, [result]);

  // Load patients directory for dropdown selector
  const fetchPatients = async () => {
    setLoadingPatients(true);
    try {
      const data = await patientService.getPatients();
      setPatients(data);
    } catch (err) {
      console.error("Failed to load patient directory list.");
    } finally {
      setLoadingPatients(false);
    }
  };

  const fetchQueue = async (silent = false) => {
    if (!silent) setLoadingQueue(true);
    try {
      const data = await predictionService.getQueue();
      setQueue(data);

      // Detect status transitions (e.g. Pending/Running -> Completed/Failed)
      // and surface a toast notification for each one.
      data.forEach((pred: Prediction) => {
        const prevStatus = prevStatusesRef.current[pred.id];
        const currentStatus = pred.status || "Completed";

        if (prevStatus && prevStatus !== currentStatus) {
          if (currentStatus === "Completed") {
            const newToast = {
              id: `${pred.id}-${Date.now()}`,
              message: `Drug prediction for Patient ${pred.patient_name} is complete.`,
              type: "success" as const,
              predictionId: pred.id
            };
            setToasts(prev => [newToast, ...prev]);
          } else if (currentStatus === "Failed") {
            const newToast = {
              id: `${pred.id}-${Date.now()}`,
              message: `Drug prediction for Patient ${pred.patient_name} has failed: ${pred.error_message || "Unknown error"}`,
              type: "error" as const,
              predictionId: pred.id
            };
            setToasts(prev => [newToast, ...prev]);
          }
        }
      });

      // Update previous statuses ref
      const newStatuses: Record<string, string> = {};
      data.forEach((pred: Prediction) => {
        newStatuses[pred.id] = pred.status || "Completed";
      });
      prevStatusesRef.current = newStatuses;
    } catch (err) {
      console.error("Failed to load prediction queue.", err);
    } finally {
      if (!silent) setLoadingQueue(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, [token]);

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(() => {
      fetchQueue(true);
    }, 2000);
    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    if (selectedPatient) {
      setPredictionMode("existing");
      setSelectedPatientId(selectedPatient.id);
    }
  }, [selectedPatient]);

  const handlePredict = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setPrescribeSuccess("");

    let body: any = { predictionMode };

    if (predictionMode === "existing") {
      if (!selectedPatientId || !existingSymptoms) {
        setError("Please select a patient and input symptoms.");
        return;
      }
      body.patient_id = selectedPatientId;
      body.symptoms = existingSymptoms;
    } else if (predictionMode === "new") {
      if (!newName || !newAge || !newSymptoms) {
        setError("Please fill out Name, Age, and Symptoms.");
        return;
      }
      body.full_name = newName;
      body.age = newAge;
      body.gender = newGender;
      body.current_drugs = newCurrentDrugs.split(",").map((d) => d.trim()).filter((d) => d.length > 0);
      body.symptoms = newSymptoms;
      body.save_patient = saveNewPatient;
    } else if (predictionMode === "general") {
      if (!genAge || !genSymptoms) {
        setError("Please fill out Age and Symptoms.");
        return;
      }
      body.age = genAge;
      body.gender = genGender;
      body.conditions = genConditions.split(",").map((c) => c.trim()).filter((c) => c.length > 0);
      body.symptoms = genSymptoms;
    }

    setAnalysing(true);

    try {
      await predictionService.createPrediction(body);
      setActiveTab("queue");
      await fetchQueue(true);
    } catch (err) {
      setError("Failed to communicate with medical server to queue prediction.");
    } finally {
      setAnalysing(false);
    }
  };

  const handleRetry = async (predictionId: string) => {
    setError("");
    try {
      await predictionService.retryPrediction(predictionId);
    } catch (err) {
      setError("Failed to communicate with medical server to retry prediction.");
    }
  };

  const handleViewResult = (pred: Prediction) => {
    setResult(pred);
    setActiveTab("results");
  };

  const handleToastClick = async (toast: { predictionId: string; id: string }) => {
    setToasts(prev => prev.filter(t => t.id !== toast.id));
    try {
      const data = await predictionService.getPredictionDetails(toast.predictionId);
      setResult(data);
      setActiveTab("results");
    } catch (err) {
      console.error("Failed to load specific prediction result", err);
    }
  };

  const handleSelectDrug = async (drugName: string, confidence: number, explanation: string) => {
    if (!result) return;

    setPrescribing(true);
    setError("");
    setPrescribeSuccess("");

    try {
      const resp = await predictionService.selectRecommendedDrug(result.id, {
        drug_name: drugName,
        confidence_score: confidence,
        explanation: explanation,
      });
      setPrescribeSuccess(resp.message || "Drug selection confirmed.");
      setSelectedDrug(resp.selected_drug);
      setSelectedAt(resp.selected_at);
      setResult(prev => prev ? {
        ...prev,
        selected_drug: resp.selected_drug,
        selected_confidence: confidence,
        selected_explanation: explanation,
        selected_at: resp.selected_at,
      } : prev);
    } catch (err: any) {
      setError(err.userFriendlyMessage || "Failed to communicate with medical server.");
    } finally {
      setPrescribing(false);
    }
  };

  const currentPatientObj = patients.find((p) => p.id === selectedPatientId);

  return (
    <div id="drug-prediction-view" className="p-8 max-w-7xl mx-auto space-y-8">
      
      {/* Header */}
      <div className="flex justify-between items-center border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-3xl font-bold font-display text-slate-900 tracking-tight">AI Drug Predictor</h1>
          <p className="text-slate-500 text-sm">Advanced server-side medical intelligence providing medication suggestions and clinical rationales.</p>
        </div>
        {selectedPatient && (
          <button
            onClick={() => {
              if (onClearSelectedPatient) onClearSelectedPatient();
              setSelectedPatientId("");
            }}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
          >
            Clear Selected Patient
          </button>
        )}
      </div>

      {/* Toast Notifications */}
      {toasts.length > 0 && (
        <div className="space-y-2 max-w-xl ml-auto">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              onClick={() => handleToastClick(toast)}
              className={`p-4 rounded-xl border shadow-md flex items-center justify-between gap-3 cursor-pointer transform hover:scale-[1.01] transition-all ${
                toast.type === "success"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-950"
                  : toast.type === "error"
                  ? "bg-rose-50 border-rose-200 text-rose-950"
                  : "bg-sky-50 border-sky-200 text-sky-950"
              }`}
            >
              <div className="flex items-center space-x-2.5">
                {toast.type === "success" ? (
                  <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
                ) : toast.type === "error" ? (
                  <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
                ) : (
                  <Sparkles className="h-5 w-5 text-sky-600 shrink-0" />
                )}
                <div>
                  <p className="text-xs font-semibold">{toast.message}</p>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5 uppercase tracking-wider">
                    {toast.type === "info" ? "Queued in background • Click to view queue" : "Analysis completed • Click to view result"}
                  </p>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setToasts(prev => prev.filter(t => t.id !== toast.id));
                }}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold px-1"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Side: Input Panel (5 Cols) */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          
          {/* Mode Selector Header */}
          <div className="grid grid-cols-3 border-b border-slate-100 bg-slate-50/50 text-xs font-semibold text-slate-500">
            <button
              onClick={() => { setPredictionMode("existing"); setError(""); setResult(null); setPrescribeSuccess(""); }}
              className={`py-3.5 border-r border-slate-100 transition-colors ${predictionMode === "existing" ? "bg-white text-sky-600 border-b-2 border-b-sky-500 font-bold" : "hover:bg-slate-50"}`}
            >
              Existing Patient
            </button>
            <button
              onClick={() => { setPredictionMode("new"); setError(""); setResult(null); setPrescribeSuccess(""); }}
              className={`py-3.5 border-r border-slate-100 transition-colors ${predictionMode === "new" ? "bg-white text-sky-600 border-b-2 border-b-sky-500 font-bold" : "hover:bg-slate-50"}`}
            >
              New Patient
            </button>
            <button
              onClick={() => { setPredictionMode("general"); setError(""); setResult(null); setPrescribeSuccess(""); }}
              className={`py-3.5 transition-colors ${predictionMode === "general" ? "bg-white text-sky-600 border-b-2 border-b-sky-500 font-bold" : "hover:bg-slate-50"}`}
            >
              General Enquiry
            </button>
          </div>

          <form onSubmit={handlePredict} className="p-6 space-y-4">
            
            {error && (
              <div className="p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs flex items-center space-x-2 rounded">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Existing Patient form */}
            {predictionMode === "existing" && (
              <>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Select Registered Patient</label>
                  <select
                    required
                    value={selectedPatientId}
                    onChange={(e) => setSelectedPatientId(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 bg-white"
                  >
                    <option value="">-- Choose Patient --</option>
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name} ({p.patient_id}) - {p.age}y {p.gender}
                      </option>
                    ))}
                  </select>
                </div>

                {currentPatientObj && (
                  <div className="bg-sky-50/50 p-3.5 rounded-lg border border-sky-100 text-xs text-slate-600 space-y-1.5">
                    <p className="font-semibold text-slate-800">Selected Clinical Context:</p>
                    <p><span className="font-medium text-slate-500">History:</span> {currentPatientObj.conditions.join(", ") || "No background conditions."}</p>
                    <p><span className="font-medium text-slate-500">Active Meds:</span> {currentPatientObj.current_drugs.join(", ") || "No active medications."}</p>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Enter New Symptoms or Diagnosis</label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Describe acute symptoms or newly identified patient conditions in clinical detail..."
                    value={existingSymptoms}
                    onChange={(e) => setExistingSymptoms(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </>
            )}

            {/* New Patient Form */}
            {predictionMode === "new" && (
              <>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Patient Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="James Carter"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Age (Years)</label>
                    <input
                      type="number"
                      required
                      placeholder="52"
                      value={newAge}
                      onChange={(e) => setNewAge(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Biological Gender</label>
                    <select
                      value={newGender}
                      onChange={(e) => setNewGender(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 bg-white"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Current Drugs</label>
                  <input
                    type="text"
                    placeholder="e.g. Aspirin, Metformin (comma separated)"
                    value={newCurrentDrugs}
                    onChange={(e) => setNewCurrentDrugs(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-sky-500"
                  />
                  <p className="mt-1 text-[10px] text-slate-400">Used to flag drug interactions with the AI recommendation.</p>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">New Symptoms or Diagnosis</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Describe newly developed symptoms requiring pharmacological treatment..."
                    value={newSymptoms}
                    onChange={(e) => setNewSymptoms(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div className="flex items-center space-x-2 pt-1">
                  <input
                    type="checkbox"
                    id="save_patient_checkbox"
                    checked={saveNewPatient}
                    onChange={(e) => setSaveNewPatient(e.target.checked)}
                    className="h-4 w-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300"
                  />
                  <label htmlFor="save_patient_checkbox" className="text-xs font-semibold text-slate-600 cursor-pointer uppercase tracking-wide">
                    Save patient in directory on success
                  </label>
                </div>
              </>
            )}

            {/* General prediction */}
            {predictionMode === "general" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Patient Age</label>
                    <input
                      type="number"
                      required
                      placeholder="35"
                      value={genAge}
                      onChange={(e) => setGenAge(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Gender</label>
                    <select
                      value={genGender}
                      onChange={(e) => setGenGender(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 bg-white"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Chronic Conditions</label>
                  <input
                    type="text"
                    placeholder="Type diabetes, osteoporosis, etc."
                    value={genConditions}
                    onChange={(e) => setGenConditions(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Symptoms / Clinical Manifestations</label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Describe symptoms or clinical notes needing immediate drug evaluation..."
                    value={genSymptoms}
                    onChange={(e) => setGenSymptoms(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={analysing}
              className="w-full mt-4 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-sm transition-colors focus:outline-none flex justify-center items-center shadow-md shadow-indigo-600/10 cursor-pointer"
            >
              {analysing ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2.5" />
                  <span>Submitting request to Queue...</span>
                </>
              ) : (
                <>
                  <Brain className="h-5 w-5 mr-2" />
                  <span>Run Clinical AI Prediction</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Side: Tabbed Interface (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col">
          
          {/* Tabs bar */}
          <div className="flex border-b border-slate-200 bg-white rounded-t-xl overflow-hidden">
            <button
              onClick={() => setActiveTab("results")}
              className={`flex-1 py-3 text-center text-sm font-semibold border-b-2 transition-colors flex justify-center items-center gap-2 ${
                activeTab === "results"
                  ? "border-sky-500 text-sky-600 font-bold bg-sky-50/10"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/50"
              }`}
            >
              <Brain className="h-4 w-4" />
              <span>Active Results</span>
            </button>
            <button
              onClick={() => setActiveTab("queue")}
              className={`flex-1 py-3 text-center text-sm font-semibold border-b-2 transition-colors flex justify-center items-center gap-2 relative ${
                activeTab === "queue"
                  ? "border-sky-500 text-sky-600 font-bold bg-sky-50/10"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/50"
              }`}
            >
              <Activity className="h-4 w-4" />
              <span>Prediction Queue</span>
              {queue.filter(p => p.status === "Pending" || p.status === "Running").length > 0 && (
                <span className="bg-sky-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold animate-pulse">
                  {queue.filter(p => p.status === "Pending" || p.status === "Running").length} active
                </span>
              )}
            </button>
          </div>

          {/* Tab 1: Queue Panel */}
          {activeTab === "queue" && (
            <div className="bg-white rounded-b-xl border-x border-b border-slate-200 p-6 space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <h3 className="font-bold text-slate-800 font-display text-base">Asynchronous Decision Support Queue</h3>
                <span className="text-slate-400 font-mono text-[10px] uppercase">
                  Real-time status updates
                </span>
              </div>

              {loadingQueue && queue.length === 0 ? (
                <div className="text-center py-12 text-slate-400 font-medium">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-sky-500 border-t-transparent mx-auto mb-3" />
                  Retrieving active queue...
                </div>
              ) : queue.length === 0 ? (
                <div className="text-center py-12 text-slate-400 font-medium space-y-1 bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
                  <p>Queue is empty.</p>
                  <p className="text-xs text-slate-400">Run a clinical prediction on the left to queue an evaluation.</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
                  {queue.map((item) => {
                    let estTime = "N/A";
                    if (item.status === "Pending") {
                      estTime = "~4s remaining";
                    } else if (item.status === "Running") {
                      estTime = item.progress && item.progress < 50 ? "~3s remaining" : "~1s remaining";
                    } else if (item.status === "Completed") {
                      estTime = "Completed";
                    } else if (item.status === "Failed") {
                      estTime = "Failed";
                    }

                    return (
                      <div
                        key={item.id}
                        className={`p-4 border rounded-xl shadow-sm transition-all flex flex-col space-y-3 ${
                          item.status === "Completed"
                            ? "bg-white border-slate-200 hover:border-slate-300"
                            : item.status === "Failed"
                            ? "bg-rose-50/10 border-rose-200"
                            : "bg-sky-50/10 border-sky-100 ring-1 ring-sky-500/5"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              <span className="font-bold text-slate-900 font-display text-sm">{item.patient_name}</span>
                              <span className="text-slate-400 font-mono text-[10px]">ID: {item.patient_id}</span>
                            </div>
                            <p className="text-xs text-slate-500 font-medium flex items-center gap-1">
                              Requested {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} • clinician: {item.doctor_name}
                            </p>
                          </div>

                          <div className="shrink-0">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                item.status === "Completed"
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                  : item.status === "Failed"
                                  ? "bg-rose-50 text-rose-800 border-rose-200"
                                  : item.status === "Running"
                                  ? "bg-sky-50 text-sky-800 border-sky-200 animate-pulse"
                                  : "bg-amber-50 text-amber-800 border-amber-200"
                              }`}
                            >
                              {item.status}
                            </span>
                          </div>
                        </div>

                        {/* Progress */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center text-[10px] font-semibold">
                            <span className="text-slate-400 uppercase tracking-wide">Analysis Progress</span>
                            <span className="text-slate-500 font-mono">{estTime}</span>
                          </div>
                          
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-1.5 rounded-full transition-all duration-300 ${
                                item.status === "Completed"
                                  ? "bg-emerald-500"
                                  : item.status === "Failed"
                                  ? "bg-rose-500"
                                  : "bg-sky-500"
                              }`}
                              style={{ width: `${item.progress || 0}%` }}
                            />
                          </div>
                        </div>

                        {/* Failed error detail */}
                        {item.status === "Failed" && item.error_message && (
                          <div className="p-2.5 bg-rose-50 border border-rose-100 rounded-lg text-xs text-rose-800 flex items-start gap-1.5 font-sans leading-relaxed">
                            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                            <div>
                              <span className="font-bold">Failure rationale:</span> {item.error_message}
                            </div>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-50">
                          {item.status === "Completed" && (
                            <button
                              onClick={() => handleViewResult(item)}
                              className="px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                            >
                              <Sparkles className="h-3.5 w-3.5 text-sky-500" />
                              <span>View Result</span>
                            </button>
                          )}
                          {item.status === "Failed" && (
                            <button
                              onClick={() => handleRetry(item.id)}
                              className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                            >
                              <Activity className="h-3.5 w-3.5" />
                              <span>Retry Prediction</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Results Display Panel */}
          {activeTab === "results" && (
            <div className="bg-white rounded-b-xl border-x border-b border-slate-200 p-6 space-y-6">
              
              {result ? (
                <div id="prediction-result-panel" className="space-y-6">
                  
                  {/* Clinician Final Decision Banner */}
                  {selectedDrug ? (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm animate-fade-in">
                      <div className="flex items-start space-x-3.5">
                        <div className="bg-emerald-500 text-white rounded-full p-2 shrink-0">
                          <CheckCircle className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-[10px] text-emerald-800 font-bold uppercase tracking-wider font-mono">Clinician Prescription Decided</p>
                          <h4 className="text-xl font-black text-emerald-950">{selectedDrug}</h4>
                          <p className="text-xs text-slate-500 mt-1">
                            Selected & confirmed by <span className="font-semibold text-slate-700">{selectedByClinician}</span> on {selectedAt ? new Date(selectedAt).toLocaleString() : "Unknown date"}
                          </p>
                        </div>
                      </div>
                      <div className="shrink-0">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Clinical Record Updated
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-start space-x-3.5 shadow-sm">
                      <div className="bg-amber-500 text-white rounded-full p-2 shrink-0">
                        <AlertTriangle className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-[10px] text-amber-800 font-bold uppercase tracking-wider font-mono">Awaiting Clinical Decision</p>
                        <p className="text-xs text-amber-950 mt-1 font-medium leading-relaxed">
                          Below are 2-3 distinct AI medication recommendations for this case. The final clinical decision rests entirely with the certified doctor or nurse. Select the safest drug to save it to the patient's active medical records.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Prescribe Success Alert */}
                  {prescribeSuccess && (
                    <div className="p-4 bg-emerald-50 border-l-4 border-emerald-500 text-emerald-800 text-xs flex items-center space-x-2 rounded-r-lg shadow-sm">
                      <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500" />
                      <span>{prescribeSuccess}</span>
                    </div>
                  )}

                  {/* Render Multiple Recommendation Cards */}
                  <div className="space-y-6">
                    {(result.recommendations && result.recommendations.length > 0
                      ? result.recommendations
                      : [
                          {
                            drug_name: result.predicted_drug,
                            confidence_score: result.confidence_score,
                            explanation: result.explanation,
                            alternative_drugs: result.alternative_drugs || [],
                            side_effects: result.side_effects || [],
                            interaction_status: result.interaction_status || "safe",
                            interaction_warning: result.interaction_warning || "",
                          }
                        ]
                    ).map((rec, index) => {
                      const isSelected = selectedDrug === rec.drug_name;
                      const isAlreadyPrescribed = currentPatientObj?.current_drugs?.some(
                        (d) => d.toLowerCase() === rec.drug_name.toLowerCase()
                      );

                      return (
                        <div 
                          key={index} 
                          className={`bg-white rounded-xl border transition-all duration-200 shadow-sm overflow-hidden ${
                            isSelected 
                              ? "border-emerald-500 ring-2 ring-emerald-500/20" 
                              : "border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          {/* Card Header */}
                          <div className={`p-5 flex items-start justify-between ${isSelected ? "bg-emerald-50/20" : "bg-slate-50/50"}`}>
                            <div className="space-y-1">
                              <div className="flex items-center space-x-2">
                                <span className="text-xs font-bold text-slate-400 font-mono">RECOMMENDATION #{index + 1}</span>
                                {isSelected && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    Selected Choice
                                  </span>
                                )}
                              </div>
                              <h4 className="text-xl font-bold text-slate-900 font-display">{rec.drug_name}</h4>
                              {rec.interaction_status === "warning" ? (
                                <p className="text-[10px] font-semibold text-rose-600 flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3 shrink-0" />
                                  {rec.interaction_warning}
                                </p>
                              ) : rec.interaction_status === "unavailable" ? (
                                <p className="text-[10px] font-semibold text-slate-400 flex items-center gap-1">
                                  <HelpCircle className="h-3 w-3 shrink-0" />
                                  Interaction data unavailable — not verified
                                </p>
                              ) : (
                                <p className="text-[10px] font-semibold text-emerald-600 flex items-center gap-1">
                                  <CheckCircle className="h-3 w-3 shrink-0" />
                                  Safe — no known interactions
                                </p>
                              )}
                            </div>

                            <div className="text-right shrink-0">
                              <div className="flex items-center space-x-2 justify-end">
                                <span className={`text-xl font-black font-display ${isSelected ? "text-emerald-600" : "text-indigo-600"}`}>
                                  {rec.confidence_score}%
                                </span>
                              </div>
                              <p className="text-[9px] text-slate-400 font-mono">AI CONFIDENCE</p>
                            </div>
                          </div>

                          {/* Card Body */}
                          <div className="p-5 space-y-4">
                            <div className="space-y-1.5">
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Clinical Explanation & Rationale</p>
                              <p className="text-sm text-slate-700 leading-relaxed font-sans">{rec.explanation}</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                              {/* Side Effects */}
                              <div className="space-y-1.5 bg-rose-50/20 p-3 rounded-lg border border-rose-100/30">
                                <p className="text-xs font-bold text-rose-800 uppercase tracking-wider font-mono flex items-center">
                                  <AlertTriangle className="h-3.5 w-3.5 mr-1.5 text-rose-500" /> Key Side Effects
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                  {rec.side_effects.map((se, idx) => (
                                    <span key={idx} className="px-2 py-0.5 bg-rose-50 text-rose-950 border border-rose-100 rounded text-[10px] font-mono">
                                      {se}
                                    </span>
                                  ))}
                                  {rec.side_effects.length === 0 && (
                                    <span className="text-slate-400 text-[10px] italic">None flagged.</span>
                                  )}
                                </div>
                              </div>

                              {/* Alternatives */}
                              <div className="space-y-1.5 bg-slate-50 p-3 rounded-lg border border-slate-100">
                                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider font-mono flex items-center">
                                  <CheckCircle className="h-3.5 w-3.5 mr-1.5 text-slate-400" /> Suitable Alternatives
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                  {rec.alternative_drugs.map((alt, idx) => {
                                    // Defensive: older saved predictions stored this field as a
                                    // plain string[] before alternatives carried interaction data.
                                    // Those have no status at all, which folds naturally into
                                    // "unavailable" below — we don't know, same as a failed check.
                                    const isLegacy = typeof alt === "string";
                                    const altName = isLegacy ? alt : alt.drug_name;
                                    const altStatus = isLegacy ? "unavailable" : (alt.interaction_status || "unavailable");
                                    const altWarning = isLegacy ? "" : (alt.interaction_warning || "");

                                    const style =
                                      altStatus === "warning"
                                        ? "bg-rose-50 text-rose-800 border-rose-200"
                                        : altStatus === "safe"
                                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                        : "bg-white text-slate-500 border-slate-200";

                                    return (
                                      <span
                                        key={idx}
                                        className={`px-2 py-0.5 rounded text-[10px] font-mono border flex items-center gap-1 ${style}`}
                                        title={altWarning || undefined}
                                      >
                                        {altStatus === "warning" ? (
                                          <AlertTriangle className="h-3 w-3 shrink-0" />
                                        ) : altStatus === "safe" ? (
                                          <CheckCircle className="h-3 w-3 shrink-0" />
                                        ) : (
                                          <HelpCircle className="h-3 w-3 shrink-0" />
                                        )}
                                        <span className="font-sans font-semibold">{altName}</span>
                                        {altStatus === "warning" && <span className="font-sans">— {altWarning}</span>}
                                        {altStatus === "safe" && <span className="font-sans">— Safe</span>}
                                        {altStatus === "unavailable" && <span className="font-sans">— Not verified</span>}
                                      </span>
                                    );
                                  })}
                                  {rec.alternative_drugs.length === 0 && (
                                    <span className="text-slate-400 text-[10px] italic">None indexed.</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Footer with Select Button */}
                          <div className="px-5 py-3.5 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between gap-4">
                            <p className="text-[10px] text-slate-400 font-mono uppercase">
                              {isAlreadyPrescribed ? "ACTIVE IN PATIENT HISTORY" : "DECISION REQUIRED"}
                            </p>
                            
                            {isAlreadyPrescribed ? (
                              <button
                                disabled
                                className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold flex items-center space-x-1"
                              >
                                <CheckCircle className="h-3.5 w-3.5 text-emerald-600 animate-pulse" />
                                <span>Active Medication in Record</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => handleSelectDrug(rec.drug_name, rec.confidence_score, rec.explanation)}
                                disabled={prescribing}
                                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs transition-colors flex items-center justify-center space-x-1.5 shadow-sm cursor-pointer"
                              >
                                {prescribing ? (
                                  <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent" />
                                ) : (
                                  <>
                                    <Activity className="h-3.5 w-3.5" />
                                    <span>Select & Add to Patient History</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Audit Footer */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-[10px] text-slate-400 font-mono text-center">
                    AUDITED ON {new Date(result.created_at).toLocaleString()} • RECORDS LOCKED FOR HIPAA AUDITING Compliance
                  </div>

                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200 border-dashed rounded-xl p-12 text-center text-slate-400 flex flex-col items-center justify-center space-y-3 min-h-[400px]">
                  <HelpCircle className="h-10 w-10 text-slate-300 stroke-1" />
                  <div className="space-y-1">
                    <p className="font-semibold text-sm text-slate-500">No Active Result Selected</p>
                    <p className="text-xs">Submit a prediction request or click "View Result" on any completed item in the queue tab.</p>
                  </div>
                </div>
              )}

            </div>
          )}

        </div>

      </div>
    </div>
  );
}
