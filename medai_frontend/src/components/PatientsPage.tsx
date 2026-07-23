import React, { useState, useEffect } from "react";
import {
  Search, Eye, Edit, Trash2, Brain, HeartPulse, User, Calendar,
  Activity, X, Plus, CheckCircle, AlertCircle, UserPlus, Loader2
} from "lucide-react";
import { Patient, Prediction, ADRReport } from "../types";
import { patientService } from "../services/patientService";

interface PatientsPageProps {
  token: string;
  userRole: string;
  selectedPatientId?: string | null;
  onClearSelectedPatient?: () => void;
  onPredictSelect: (patient: Patient) => void;
  onADRSelect: (patient: Patient) => void;
}

// ── Gender options (Male / Female only — matches backend validation) ──────────
const GENDER_OPTIONS = ["Male", "Female"];

export default function PatientsPage({
  token,
  userRole,
  selectedPatientId,
  onClearSelectedPatient,
  onPredictSelect,
  onADRSelect,
}: PatientsPageProps) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Search Fields
  const [searchQuery, setSearchQuery] = useState("");
  const [searchId, setSearchId] = useState("");
  const [searchCondition, setSearchCondition] = useState("");
  const [searchDrug, setSearchDrug] = useState("");

  // Detailed view state
  const [activePatientId, setActivePatientId] = useState<string | null>(selectedPatientId || null);
  const [detailedPatient, setDetailedPatient] = useState<any | null>(null);
  const [fetchingDetails, setFetchingDetails] = useState(false);

  // Edit / Update State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAge, setEditAge] = useState("");
  const [editGender, setEditGender] = useState("Male");
  const [editConditions, setEditConditions] = useState("");
  const [editDrugs, setEditDrugs] = useState("");
  const [updating, setUpdating] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState("");
  const [updateError, setUpdateError] = useState("");

  // ── Add New Patient Modal State ────────────────────────────────────────────
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addAge, setAddAge] = useState("");
  const [addGender, setAddGender] = useState("Male");
  const [addConditions, setAddConditions] = useState("");
  const [addDrugs, setAddDrugs] = useState("");
  const [adding, setAdding] = useState(false);
  const [addSuccess, setAddSuccess] = useState("");
  const [addErrors, setAddErrors] = useState<Record<string, string>>({});

  const fetchPatients = async () => {
    setLoading(true);
    setError("");
    try {
      const params: Record<string, string> = {};
      if (searchQuery) params["search"] = searchQuery;
      if (searchId) params["patient_id"] = searchId;
      if (searchCondition) params["condition"] = searchCondition;
      if (searchDrug) params["drug"] = searchDrug;
      const data = await patientService.getPatients(params);
      setPatients(data);
    } catch (err: any) {
      setError(err.userFriendlyMessage || "Medical server connection failed.");
    } finally {
      setLoading(false);
    }
  };

  const fetchPatientDetails = async (id: string) => {
    setFetchingDetails(true);
    try {
      const data = await patientService.getPatientById(id);
      setDetailedPatient(data);
    } catch (err: any) {
      setError(err.userFriendlyMessage || "Failed to load patient history.");
    } finally {
      setFetchingDetails(false);
    }
  };

  useEffect(() => { fetchPatients(); }, [searchQuery, searchId, searchCondition, searchDrug]);
  useEffect(() => { if (selectedPatientId) setActivePatientId(selectedPatientId); }, [selectedPatientId]);
  useEffect(() => {
    if (activePatientId) fetchPatientDetails(activePatientId);
    else setDetailedPatient(null);
  }, [activePatientId]);

  const handleOpenEdit = (p: Patient) => {
    setEditName(p.full_name);
    setEditAge(p.age.toString());
    setEditGender(GENDER_OPTIONS.includes(p.gender) ? p.gender : "Male");
    setEditConditions(p.conditions.join(", "));
    setEditDrugs(p.current_drugs.join(", "));
    setUpdateSuccess("");
    setUpdateError("");
    setIsEditModalOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailedPatient) return;
    setUpdating(true);
    setUpdateSuccess("");
    setUpdateError("");
    const conditionsArray = editConditions.split(",").map((c) => c.trim()).filter(Boolean);
    const drugsArray = editDrugs.split(",").map((d) => d.trim()).filter(Boolean);
    try {
      await patientService.updatePatient(detailedPatient.id, {
        full_name: editName,
        age: parseInt(editAge, 10),
        gender: editGender,
        conditions: conditionsArray,
        current_drugs: drugsArray,
      });
      setUpdateSuccess("Patient record updated successfully!");
      fetchPatientDetails(detailedPatient.id);
      fetchPatients();
      setTimeout(() => { setIsEditModalOpen(false); setUpdateSuccess(""); }, 1400);
    } catch (err: any) {
      const detail = (err.response?.data as any);
      if (detail && typeof detail === "object" && !detail.detail) {
        const msgs = Object.entries(detail).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`).join(" | ");
        setUpdateError(msgs);
      } else {
        setUpdateError(err.userFriendlyMessage || "Server request failed.");
      }
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (userRole !== "Admin") {
      alert("Strict compliance directive: Permanent deletion of clinical files is restricted to Hospital Administrators only.");
      return;
    }
    if (!confirm("Confirm Permanent File Purge? Warning: This action is irreversible and cascades to clear predictive and ADR interaction reports for auditing.")) return;
    try {
      await patientService.deletePatient(id);
      setActivePatientId(null);
      setDetailedPatient(null);
      if (onClearSelectedPatient) onClearSelectedPatient();
      fetchPatients();
    } catch (err: any) {
      setError(err.userFriendlyMessage || "Server connection failed.");
    }
  };

  // ── Add Patient handlers ───────────────────────────────────────────────────
  const openAddModal = () => {
    setAddName(""); setAddAge(""); setAddGender("Male");
    setAddConditions(""); setAddDrugs("");
    setAddSuccess(""); setAddErrors({});
    setAdding(false);
    setIsAddModalOpen(true);
  };

  const handleAddPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    setAddErrors({});
    setAddSuccess("");

    // Client-side validation before hitting the API
    const clientErrors: Record<string, string> = {};
    if (!addName.trim()) clientErrors.full_name = "Full name is required.";
    const ageNum = parseInt(addAge, 10);
    if (!addAge.trim() || isNaN(ageNum) || ageNum < 0 || ageNum > 150)
      clientErrors.age = "Age must be a number between 0 and 150.";
    if (!addGender) clientErrors.gender = "Gender is required.";

    if (Object.keys(clientErrors).length > 0) {
      setAddErrors(clientErrors);
      setAdding(false);
      return;
    }

    try {
      await patientService.createPatient({
        full_name: addName.trim(),
        age: ageNum,
        gender: addGender,
        conditions: addConditions.split(",").map((c) => c.trim()).filter(Boolean),
        current_drugs: addDrugs.split(",").map((d) => d.trim()).filter(Boolean),
      });
      setAddSuccess("Patient registered successfully!");
      fetchPatients();
      setTimeout(() => { setIsAddModalOpen(false); setAddSuccess(""); }, 1500);
    } catch (err: any) {
      // Parse DRF field-level validation errors
      const data = (err.response?.data as any);
      if (data && typeof data === "object") {
        const fieldErrors: Record<string, string> = {};
        Object.entries(data).forEach(([key, val]) => {
          fieldErrors[key] = Array.isArray(val) ? (val as string[]).join(" ") : String(val);
        });
        setAddErrors(fieldErrors);
      } else {
        setAddErrors({ __all__: err.userFriendlyMessage || "Server request failed." });
      }
    } finally {
      setAdding(false);
    }
  };

  return (
    <div id="patients-view-container" className="p-8 max-w-7xl mx-auto space-y-8">

      {/* Header */}
      <div className="flex justify-between items-center border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-3xl font-bold font-display text-slate-900 tracking-tight">Patient Records</h1>
          <p className="text-slate-500 text-sm">Secure medical directory, clinical histories, and treatment logs.</p>
        </div>
        {activePatientId && (
          <button
            onClick={() => { setActivePatientId(null); setDetailedPatient(null); if (onClearSelectedPatient) onClearSelectedPatient(); }}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
          >
            ← Back to Patient Directory
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm flex items-center space-x-2 rounded-r-lg">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {/* DETAILED PATIENT VIEW */}
      {activePatientId && detailedPatient ? (
        <div id="detailed-patient-card" className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* Left panel */}
          <div className="lg:col-span-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex flex-col items-center text-center pb-6 border-b border-slate-100">
              <div className="w-20 h-20 rounded-full bg-sky-50 text-sky-600 border border-sky-100 flex items-center justify-center font-bold text-3xl mb-4 shadow-inner">
                {detailedPatient.full_name[0]}
              </div>
              <h2 className="text-xl font-bold text-slate-900 font-display">{detailedPatient.full_name}</h2>
              <span className="text-xs font-mono font-bold text-sky-700 bg-sky-50 px-2.5 py-1 rounded-full border border-sky-100 mt-2">
                {detailedPatient.patient_id}
              </span>
            </div>

            <div className="space-y-4 text-sm">
              <h3 className="font-bold text-xs uppercase text-slate-400 tracking-wider">Patient Specifications</h3>
              <div className="flex justify-between items-center py-2 border-b border-slate-50">
                <span className="text-slate-500 font-medium">Age</span>
                <span className="font-semibold text-slate-800">{detailedPatient.age} years old</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-50">
                <span className="text-slate-500 font-medium">Biological Gender</span>
                <span className="font-semibold text-slate-800">{detailedPatient.gender}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-50">
                <span className="text-slate-500 font-medium">Registered On</span>
                <span className="font-semibold text-slate-800 text-xs font-mono">{new Date(detailedPatient.created_at).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-slate-500 font-medium">Last Modified</span>
                <span className="font-semibold text-slate-800 text-xs font-mono">{new Date(detailedPatient.updated_at).toLocaleDateString()}</span>
              </div>
            </div>

            <div className="space-y-3 pt-6 border-t border-slate-100">
              <button
                onClick={() => handleOpenEdit(detailedPatient)}
                className="w-full py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition-colors flex justify-center items-center space-x-2"
              >
                <Edit className="h-3.5 w-3.5" />
                <span>Update Clinical Profile</span>
              </button>
              {userRole === "Admin" && (
                <button
                  onClick={() => handleDelete(detailedPatient.id)}
                  className="w-full py-2 px-4 bg-red-50 hover:bg-red-100 text-red-600 font-semibold rounded-lg text-xs transition-colors flex justify-center items-center space-x-2 border border-red-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Purge Clinical Record</span>
                </button>
              )}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  onClick={() => onPredictSelect(detailedPatient)}
                  className="py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-[11px] transition-colors flex justify-center items-center space-x-1"
                >
                  <Brain className="h-3 w-3" />
                  <span>Predict Drug</span>
                </button>
                <button
                  onClick={() => onADRSelect(detailedPatient)}
                  className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-[11px] transition-colors flex justify-center items-center space-x-1"
                >
                  <HeartPulse className="h-3 w-3" />
                  <span>Check ADR</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right panel */}
          <div className="lg:col-span-8 space-y-8">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-bold mb-3 flex items-center text-xs uppercase tracking-wider text-slate-400">
                  <Activity className="h-4 w-4 mr-2 text-sky-500" /> Diagnosed Conditions
                </h3>
                <div className="flex flex-wrap gap-2">
                  {detailedPatient.conditions.map((c: string, idx: number) => (
                    <span key={idx} className="px-3 py-1 bg-sky-50 text-sky-800 text-xs font-semibold rounded-full border border-sky-100">{c}</span>
                  ))}
                  {detailedPatient.conditions.length === 0 && <span className="text-slate-400 text-xs font-mono">No diagnosed baseline conditions.</span>}
                </div>
              </div>
              <div>
                <h3 className="font-bold mb-3 flex items-center text-xs uppercase tracking-wider text-slate-400">
                  <Plus className="h-4 w-4 mr-2 text-indigo-500" /> Active Medications
                </h3>
                <div className="flex flex-wrap gap-2">
                  {detailedPatient.current_drugs.map((d: string, idx: number) => (
                    <span key={idx} className="px-3 py-1 bg-indigo-50 text-indigo-800 text-xs font-semibold rounded-full border border-indigo-100">{d}</span>
                  ))}
                  {detailedPatient.current_drugs.length === 0 && <span className="text-slate-400 text-xs font-mono">No active drug regimens.</span>}
                </div>
              </div>
            </div>

            {/* Previous Predictions */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50">
                <h3 className="font-bold text-slate-900 font-display text-sm">Previous Clinical AI Predictions</h3>
              </div>
              <div className="divide-y divide-slate-100">
                {detailedPatient.history?.predictions?.map((pr: Prediction) => (
                  <div key={pr.id} className="p-6 space-y-3 hover:bg-slate-50/20">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-slate-900">Recommended: <span className="font-mono bg-sky-50 text-sky-800 border border-sky-100 px-2 py-0.5 rounded text-xs">{pr.predicted_drug}</span></p>
                        <p className="text-xs text-slate-400 font-mono">Evaluated by {pr.doctor_name} • {new Date(pr.created_at).toLocaleDateString()}</p>
                      </div>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-100">
                        {pr.confidence_score}% Confidence
                      </span>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg text-xs leading-relaxed text-slate-600">
                      <span className="font-bold block text-slate-800 mb-1">Clinical Rationale:</span>
                      {pr.explanation}
                    </div>
                    {pr.side_effects && pr.side_effects.length > 0 && (
                      <div className="flex flex-wrap gap-2 items-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Monitor Side Effects:</span>
                        {pr.side_effects.map((se, i) => (
                          <span key={i} className="text-[10px] bg-red-50 text-red-700 px-2 py-0.5 rounded border border-red-100/40">{se}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {(!detailedPatient.history?.predictions || detailedPatient.history.predictions.length === 0) && (
                  <div className="p-8 text-center text-slate-400 text-xs font-mono">No prediction audit files recorded for this patient.</div>
                )}
              </div>
            </div>

            {/* Previous ADR Reports */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50">
                <h3 className="font-bold text-slate-900 font-display text-sm">Previous Adverse Drug Reaction (ADR) Reports</h3>
              </div>
              <div className="divide-y divide-slate-100">
                {detailedPatient.history?.adrReports?.map((r: ADRReport) => (
                  <div key={r.id} className="p-6 space-y-3 hover:bg-slate-50/20">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <p className="text-xs text-slate-400 font-mono">Checked: {r.checked_drugs.join(" + ")}</p>
                        <p className="text-xs text-slate-400 font-mono">Audited by {r.doctor_name} • {new Date(r.created_at).toLocaleDateString()}</p>
                      </div>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                        r.risk_level === "High" ? "bg-red-50 text-red-800 border-red-100 animate-pulse"
                        : r.risk_level === "Moderate" ? "bg-amber-50 text-amber-800 border-amber-100"
                        : "bg-emerald-50 text-emerald-800 border-emerald-100"
                      }`}>
                        {r.risk_level} Risk Level
                      </span>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-lg text-xs leading-relaxed text-slate-600 space-y-2">
                      <p><span className="font-bold text-slate-800">Pharmacological Mechanisms:</span> {r.explanation}</p>
                      <p><span className="font-bold text-slate-800">Clinician Actionable Directive:</span> {r.recommendation}</p>
                    </div>
                    {r.alternative_drug && (
                      <p className="text-xs text-slate-600 font-medium">
                        Safer Suggested Regimen: <span className="font-mono font-semibold bg-emerald-50 text-emerald-800 border border-emerald-100 px-2 py-0.5 rounded text-xs">{r.alternative_drug}</span>
                      </p>
                    )}
                  </div>
                ))}
                {(!detailedPatient.history?.adrReports || detailedPatient.history.adrReports.length === 0) && (
                  <div className="p-8 text-center text-slate-400 text-xs font-mono">No drug interaction reports recorded for this patient.</div>
                )}
              </div>
            </div>
          </div>
        </div>

      ) : (
        // MASTER DIRECTORY TABLE
        <div id="patients-master-directory" className="space-y-6">

          {/* Filter Row */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { icon: Search, placeholder: "Search by Name...", value: searchQuery, onChange: setSearchQuery },
              { icon: User, placeholder: "ID (e.g. PAT-1234)...", value: searchId, onChange: setSearchId },
              { icon: Activity, placeholder: "Condition (e.g. Diabetes)...", value: searchCondition, onChange: setSearchCondition },
              { icon: Calendar, placeholder: "Drug (e.g. Aspirin)...", value: searchDrug, onChange: setSearchDrug },
            ].map(({ icon: Icon, placeholder, value, onChange }, i) => (
              <div key={i} className="relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Icon className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  placeholder={placeholder}
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  className="block w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
                />
              </div>
            ))}
          </div>

          {/* Master Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="px-6 py-3.5">ID</th>
                    <th className="px-6 py-3.5">Name</th>
                    <th className="px-6 py-3.5">Age/Gender</th>
                    <th className="px-6 py-3.5">Conditions</th>
                    <th className="px-6 py-3.5">Current Drugs</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                  {patients.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/30">
                      <td className="px-6 py-4 font-mono text-xs text-sky-700 font-bold">{p.patient_id}</td>
                      <td className="px-6 py-4 font-semibold text-slate-900">{p.full_name}</td>
                      <td className="px-6 py-4 text-xs text-slate-500">{p.age}y / {p.gender}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {Array.isArray(p.conditions) && p.conditions.length > 0 ? (
                            p.conditions.map((c, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-sky-50 text-sky-800 border border-sky-100"
                              >
                                {c}
                              </span>
                            ))
                          ) : (
                            <span className="text-slate-400 text-xs font-mono">None</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {p.current_drugs.map((d, i) => (
                            <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-indigo-50 text-indigo-800 border border-indigo-100">{d}</span>
                          ))}
                          {p.current_drugs.length === 0 && <span className="text-slate-400 text-xs font-mono">None</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => setActivePatientId(p.id)}
                          className="text-xs px-3 py-1.5 text-sky-600 hover:text-white hover:bg-sky-600 border border-sky-200 hover:border-sky-600 rounded-lg font-semibold transition-all inline-flex items-center space-x-1"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>View Details</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {patients.length === 0 && !loading && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-400">No patient files found matching the search criteria.</td>
                    </tr>
                  )}
                  {loading && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-400">Loading patients records directory...</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* ── Add New Patient Button ────────────────────────────────────── */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/30 flex items-center justify-between">
              <p className="text-xs text-slate-400 font-medium">
                {patients.length > 0 ? `${patients.length} patient${patients.length !== 1 ? "s" : ""} found` : ""}
              </p>
              <button
                onClick={openAddModal}
                className="inline-flex items-center space-x-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs rounded-lg transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                <UserPlus className="h-4 w-4" />
                <span>New Patient</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT PATIENT MODAL ─────────────────────────────────────────────── */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-900 font-display text-base">Update Patient Record</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleUpdate} className="p-6 space-y-4">
              {updateSuccess && (
                <div className="p-3 bg-emerald-50 border-l-4 border-emerald-500 text-emerald-700 text-xs flex items-center space-x-2 rounded-r">
                  <CheckCircle className="h-4 w-4 shrink-0" />
                  <span>{updateSuccess}</span>
                </div>
              )}
              {updateError && (
                <div className="p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs flex items-center space-x-2 rounded-r">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{updateError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Patient Full Name</label>
                <input type="text" required value={editName} onChange={(e) => setEditName(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Age (Years)</label>
                  <input type="number" required min={0} max={150} value={editAge} onChange={(e) => setEditAge(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Gender</label>
                  <select value={editGender} onChange={(e) => setEditGender(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 bg-white focus:outline-none">
                    {GENDER_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Diagnosed Conditions (comma-separated)</label>
                <input type="text" value={editConditions} onChange={(e) => setEditConditions(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  placeholder="e.g. Hypertension, Diabetes Type II" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Current Medications (comma-separated)</label>
                <input type="text" value={editDrugs} onChange={(e) => setEditDrugs(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  placeholder="e.g. Lisinopril, Metformin" />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={updating}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-lg flex items-center space-x-2 transition-colors disabled:opacity-60">
                  {updating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Save Updates</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── ADD NEW PATIENT MODAL ──────────────────────────────────────────── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <UserPlus className="h-4 w-4 text-indigo-600" />
                <h3 className="font-bold text-slate-900 font-display text-base">Register New Patient</h3>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddPatient} className="p-6 space-y-4">
              {addSuccess && (
                <div className="p-3 bg-emerald-50 border-l-4 border-emerald-500 text-emerald-700 text-xs flex items-center space-x-2 rounded-r">
                  <CheckCircle className="h-4 w-4 shrink-0" />
                  <span>{addSuccess}</span>
                </div>
              )}
              {addErrors.__all__ && (
                <div className="p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs flex items-center space-x-2 rounded-r">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{addErrors.__all__}</span>
                </div>
              )}

              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input type="text" required value={addName} onChange={(e) => setAddName(e.target.value)}
                  className={`mt-1 block w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors ${addErrors.full_name ? "border-red-400 bg-red-50/30" : "border-slate-200"}`}
                  placeholder="e.g. John Doe" />
                {addErrors.full_name && <p className="mt-1 text-xs text-red-600">{addErrors.full_name}</p>}
              </div>

              {/* Age & Gender */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Age <span className="text-red-500">*</span>
                  </label>
                  <input type="number" required min={0} max={150} value={addAge} onChange={(e) => setAddAge(e.target.value)}
                    className={`mt-1 block w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors ${addErrors.age ? "border-red-400 bg-red-50/30" : "border-slate-200"}`}
                    placeholder="e.g. 45" />
                  {addErrors.age && <p className="mt-1 text-xs text-red-600">{addErrors.age}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    Gender <span className="text-red-500">*</span>
                  </label>
                  <select value={addGender} onChange={(e) => setAddGender(e.target.value)}
                    className={`mt-1 block w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 bg-white focus:outline-none transition-colors ${addErrors.gender ? "border-red-400 bg-red-50/30" : "border-slate-200"}`}>
                    {GENDER_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                  {addErrors.gender && <p className="mt-1 text-xs text-red-600">{addErrors.gender}</p>}
                </div>
              </div>

              {/* Conditions */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Diagnosed Conditions</label>
                <input type="text" value={addConditions} onChange={(e) => setAddConditions(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder="e.g. Hypertension, Diabetes Type II (comma-separated)" />
                {addErrors.conditions && <p className="mt-1 text-xs text-red-600">{addErrors.conditions}</p>}
              </div>

              {/* Medications */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Current Medications</label>
                <input type="text" value={addDrugs} onChange={(e) => setAddDrugs(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder="e.g. Lisinopril, Metformin (comma-separated)" />
                {addErrors.current_drugs && <p className="mt-1 text-xs text-red-600">{addErrors.current_drugs}</p>}
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={adding || !!addSuccess}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg flex items-center space-x-2 transition-colors disabled:opacity-60 shadow-sm">
                  {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                  <span>{adding ? "Registering..." : "Register Patient"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
