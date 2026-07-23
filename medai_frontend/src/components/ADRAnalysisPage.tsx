import React, { useState, useEffect } from "react";
import { HeartPulse, Search, Plus, Trash2, ShieldCheck, AlertTriangle, AlertOctagon, HelpCircle, User, Activity } from "lucide-react";
import { Patient, ADRReport } from "../types";
import { patientService } from "../services/patientService";
import { predictionService } from "../services/predictionService";

interface ADRAnalysisProps {
  token: string;
  selectedPatient?: Patient | null;
  onClearSelectedPatient?: () => void;
}

export default function ADRAnalysis({ token, selectedPatient, onClearSelectedPatient }: ADRAnalysisProps) {
  const [analysisMode, setAnalysisMode] = useState<"existing" | "manual">("existing");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(false);

  // Mode 1: Existing Patient
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [newMedication, setNewMedication] = useState("");

  // Mode 2: Manual Analysis
  const [manualAge, setManualAge] = useState("");
  const [manualGender, setManualGender] = useState("Male");
  const [manualConditions, setManualConditions] = useState("");
  const [manualDrugsInput, setManualDrugsInput] = useState("");
  const [manualDrugsList, setManualDrugsList] = useState<string[]>([]);

  // Execution States
  const [auditing, setAuditing] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ADRReport | null>(null);

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

  useEffect(() => {
    fetchPatients();
  }, [token]);

  useEffect(() => {
    if (selectedPatient) {
      setAnalysisMode("existing");
      setSelectedPatientId(selectedPatient.id);
    }
  }, [selectedPatient]);

  const addManualDrug = () => {
    if (!manualDrugsInput.trim()) return;
    const drugs = manualDrugsInput
      .split(",")
      .map((d) => d.trim())
      .filter((d) => d.length > 0 && !manualDrugsList.includes(d));
    setManualDrugsList([...manualDrugsList, ...drugs]);
    setManualDrugsInput("");
  };

  const removeManualDrug = (drug: string) => {
    setManualDrugsList(manualDrugsList.filter((d) => d !== drug));
  };

  const handleAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuditing(true);
    setError("");
    setResult(null);

    let body: any = {
      is_manual: analysisMode === "manual",
    };

    if (analysisMode === "existing") {
      if (!selectedPatientId) {
        setError("Please select a registered patient.");
        setAuditing(false);
        return;
      }
      const pObj = patients.find((p) => p.id === selectedPatientId);
      if (!pObj) {
        setError("Selected patient was not found.");
        setAuditing(false);
        return;
      }

      const activeDrugs = [...pObj.current_drugs];
      if (newMedication.trim()) {
        activeDrugs.push(newMedication.trim());
      }

      if (activeDrugs.length === 0) {
        setError("No medications selected for analysis. Please specify current or new drugs.");
        setAuditing(false);
        return;
      }

      body.patient_id = selectedPatientId;
      body.checked_drugs = activeDrugs;
    } else {
      // Manual mode
      if (manualDrugsList.length === 0) {
        setError("Please add at least one medication to analyze.");
        setAuditing(false);
        return;
      }
      body.checked_drugs = manualDrugsList;
      body.manual_profile = {
        age: manualAge || "45",
        gender: manualGender,
        conditions: manualConditions.split(",").map((c) => c.trim()).filter((c) => c.length > 0),
      };
    }

    try {
      const data = await predictionService.checkADR(body);
      setResult(data);

    } catch (err) {
      setError("Medical API server connection failure.");
    } finally {
      setAuditing(false);
    }
  };

  const currentPatientObj = patients.find((p) => p.id === selectedPatientId);

  return (
    <div id="adr-analysis-view" className="p-8 max-w-7xl mx-auto space-y-8">
      
      {/* Header */}
      <div className="flex justify-between items-center border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-3xl font-bold font-display text-slate-900 tracking-tight">ADR Adverse Interaction Analysis</h1>
          <p className="text-slate-500 text-sm">Real-time patient safety analysis flagging potential high-risk (red) drug-drug or drug-condition complications.</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Input Panel (5 Cols) */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          
          <div className="grid grid-cols-2 border-b border-slate-100 bg-slate-50/50 text-xs font-semibold text-slate-500">
            <button
              onClick={() => { setAnalysisMode("existing"); setError(""); setResult(null); }}
              className={`py-3.5 border-r border-slate-100 transition-colors ${analysisMode === "existing" ? "bg-white text-sky-600 border-b-2 border-b-sky-500 font-bold" : "hover:bg-slate-50"}`}
            >
              Existing Patient Analysis
            </button>
            <button
              onClick={() => { setAnalysisMode("manual"); setError(""); setResult(null); }}
              className={`py-3.5 transition-colors ${analysisMode === "manual" ? "bg-white text-sky-600 border-b-2 border-b-sky-500 font-bold" : "hover:bg-slate-50"}`}
            >
              Manual Custom Analysis
            </button>
          </div>

          <form onSubmit={handleAudit} className="p-6 space-y-4">
            
            {error && (
              <div className="p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs flex items-center space-x-2 rounded">
                <AlertOctagon className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {analysisMode === "existing" ? (
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
                        {p.full_name} ({p.patient_id})
                      </option>
                    ))}
                  </select>
                </div>

                {currentPatientObj && (
                  <div className="bg-sky-50/40 p-4 rounded-xl border border-sky-100 text-xs text-slate-600 space-y-2">
                    <p className="font-bold text-slate-800">Loaded Medications Directory:</p>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {currentPatientObj.current_drugs.map((d, i) => (
                        <span key={i} className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-800 rounded font-mono font-semibold">
                          {d}
                        </span>
                      ))}
                      {currentPatientObj.current_drugs.length === 0 && (
                        <span className="text-slate-400 italic">No recorded baseline medications.</span>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Introduce New Medication (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Ibuprofen, Aspirin, Albuterol..."
                    value={newMedication}
                    onChange={(e) => setNewMedication(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Leave empty to analyze the safety of current baseline drugs alone.</p>
                </div>
              </>
            ) : (
              // MANUAL ANALYSIS INPUTS
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Patient Age</label>
                    <input
                      type="number"
                      placeholder="e.g., 45"
                      value={manualAge}
                      onChange={(e) => setManualAge(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Gender</label>
                    <select
                      value={manualGender}
                      onChange={(e) => setManualGender(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 bg-white"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Diagnosed Chronic Conditions</label>
                  <input
                    type="text"
                    placeholder="e.g. Asthma, Diabetes (comma separated)"
                    value={manualConditions}
                    onChange={(e) => setManualConditions(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Add Medications to Analyze</label>
                  <div className="flex space-x-2 mt-1">
                    <input
                      type="text"
                      placeholder="e.g. Metformin, Warfarin"
                      value={manualDrugsInput}
                      onChange={(e) => setManualDrugsInput(e.target.value)}
                      className="block flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={addManualDrug}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg text-xs"
                    >
                      Add
                    </button>
                  </div>
                </div>

                {manualDrugsList.length > 0 && (
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Medications Registry List:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {manualDrugsList.map((d, i) => (
                        <span key={i} className="inline-flex items-center px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-800 rounded font-mono font-semibold text-xs">
                          {d}
                          <button type="button" onClick={() => removeManualDrug(d)} className="ml-1 text-indigo-400 hover:text-indigo-600 font-sans font-bold">×</button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            <button
              type="submit"
              disabled={auditing}
              className="w-full mt-4 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-sm transition-colors focus:outline-none flex justify-center items-center shadow-md shadow-emerald-600/10 cursor-pointer"
            >
              {auditing ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2.5" />
                  <span>Analyzing Interaction Vectors...</span>
                </>
              ) : (
                <>
                  <HeartPulse className="h-5 w-5 mr-2" />
                  <span>Analyze Drug Interaction Safety</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Output Panel (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {auditing ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center flex flex-col items-center justify-center space-y-4 shadow-sm min-h-[400px]">
              <div className="relative">
                <div className="animate-ping absolute inset-0 rounded-full h-12 w-12 bg-red-100" />
                <HeartPulse className="relative h-12 w-12 text-rose-500 animate-pulse" />
              </div>
              <div className="space-y-1">
                <p className="font-bold text-slate-800 font-display">Simulating Interaction Pathways</p>
                <p className="text-xs text-slate-400 font-mono">RETRIEVING PHARMACOKINETICS & BIOCHEMICAL CONFLICT FLAGGINGS</p>
              </div>
            </div>
          ) : result ? (
            <div id="adr-result-card" className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
              
              {/* Risk Banner - Color Code strict enforcement */}
              <div className={`p-6 flex items-start justify-between ${
                result.risk_level === "High"
                  ? "bg-red-50/70 border-b border-red-100"
                  : result.risk_level === "Moderate"
                  ? "bg-amber-50/70 border-b border-amber-100"
                  : "bg-emerald-50/70 border-b border-emerald-100"
              }`}>
                <div className="space-y-1.5">
                  <span className="text-[10px] text-slate-400 font-mono block">MEDAI ANALYSIS INSTANCE STATUS</span>
                  <div className="flex items-center space-x-2">
                    {result.risk_level === "High" ? (
                      <AlertOctagon className="h-6 w-6 text-red-600 animate-bounce" />
                    ) : result.risk_level === "Moderate" ? (
                      <AlertTriangle className="h-6 w-6 text-amber-600" />
                    ) : (
                      <ShieldCheck className="h-6 w-6 text-emerald-600" />
                    )}
                    <h3 className={`text-xl font-black font-display uppercase tracking-wider ${
                      result.risk_level === "High"
                        ? "text-red-900"
                        : result.risk_level === "Moderate"
                        ? "text-amber-900"
                        : "text-emerald-900"
                    }`}>
                      {result.risk_level} ADR Risk Detected
                    </h3>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs font-mono font-bold block text-slate-400">PATIENT OBJECTIVE</span>
                  <p className="font-bold text-slate-800 text-sm font-display">{result.patient_name}</p>
                </div>
              </div>

              {/* Checked Drugs List */}
              <div className="p-6 space-y-2">
                <h4 className="font-bold text-slate-400 text-[10px] uppercase tracking-wider">Evaluation Regimen</h4>
                <div className="flex flex-wrap gap-1.5">
                  {result.checked_drugs.map((d, i) => (
                    <span key={i} className="px-2.5 py-1 bg-slate-100 border border-slate-200 text-slate-700 font-mono text-xs font-semibold rounded">
                      {d}
                    </span>
                  ))}
                </div>
              </div>

              {/* Explanation of risks */}
              <div className="p-6 space-y-2">
                <h4 className="font-bold text-slate-400 text-xs uppercase tracking-wider font-display">Pathophysiological Risk Analysis</h4>
                <p className="text-sm text-slate-700 leading-relaxed">{result.explanation}</p>
              </div>

              {/* Clinician Action Directive */}
              <div className="p-6 space-y-2">
                <h4 className="font-bold text-slate-400 text-xs uppercase tracking-wider font-display">Actionable Clinical Directive</h4>
                <p className="text-sm text-slate-700 leading-relaxed font-semibold">{result.recommendation}</p>
              </div>

              {/* Alternatives */}
              {result.alternative_drug && (
                <div className="p-6 bg-emerald-50/20 space-y-2">
                  <h4 className="font-bold text-emerald-800 text-xs uppercase tracking-wider font-display">Safer Clinical Alternatives</h4>
                  <div className="inline-flex items-center space-x-2 bg-emerald-50 border border-emerald-100 text-emerald-900 px-3.5 py-1.5 rounded-lg font-mono font-bold text-xs mt-1">
                    <ShieldCheck className="h-4 w-4 text-emerald-600 mr-1" />
                    <span>{result.alternative_drug}</span>
                  </div>
                </div>
              )}

              {/* Analysis Footer */}
              <div className="p-4 bg-slate-50 text-[10px] text-slate-400 font-mono text-center">
                ANALYZED ON {new Date(result.created_at).toLocaleString()} • RECORDS REPLICATED IN HISTORIC ADVERSE DRUG ANALYSIS
              </div>

            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-200 border-dashed rounded-xl p-12 text-center text-slate-400 flex flex-col items-center justify-center space-y-3 min-h-[400px]">
              <HelpCircle className="h-10 w-10 text-slate-300 stroke-1" />
              <div className="space-y-1">
                <p className="font-semibold text-sm text-slate-500">Awaiting Interaction Parameters</p>
                <p className="text-xs">Specify medication regimens on the left and run ADR Analysis to analyze compatibility.</p>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
