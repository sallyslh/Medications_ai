import React, { useState, useEffect } from "react";
import {
  Users,
  Brain,
  HeartPulse,
  Plus,
  CheckCircle,
  Bell,
  AlertTriangle,
  ChevronRight,
  Activity,
  LayoutDashboard,
} from "lucide-react";
import { DashboardStats, Patient } from "../types";
import { dashboardService } from "../services/dashboardService";
import { patientService } from "../services/patientService";

interface DashboardProps {
  token: string;
  setActiveTab: (tab: string) => void;
  onPatientSelect?: (id: string) => void;
  onPredictSelect?: (patient: Patient) => void;
  onADRSelect?: (patient: Patient) => void;
}

export default function Dashboard({
  token,
  setActiveTab,
  onPatientSelect,
  onPredictSelect,
  onADRSelect,
}: DashboardProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Quick Add Patient Form States
  const [fullName, setFullName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("Male");
  const [conditions, setConditions] = useState("");
  const [currentDrugs, setCurrentDrugs] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const fetchDashboardStats = async () => {
    try {
      const data = await dashboardService.getStats();
      setStats(data);
    } catch (err: any) {
      setError(err.userFriendlyMessage || "Failed to load dashboard statistics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !age || !gender) {
      setError("Please fill out Name, Age, and Gender.");
      return;
    }

    setSubmitting(true);
    setSuccessMsg("");
    setError("");

    const conditionsArray = conditions
      .split(",")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
    const drugsArray = currentDrugs
      .split(",")
      .map((d) => d.trim())
      .filter((d) => d.length > 0);

    try {
      const data = await patientService.createPatient({
        full_name: fullName,
        age: parseInt(age, 10),
        gender,
        conditions: conditionsArray,
        current_drugs: drugsArray,
      });

      setSuccessMsg(`Patient ${data.full_name} added successfully!`);
      setFullName("");
      setAge("");
      setConditions("");
      setCurrentDrugs("");
      fetchDashboardStats();
    } catch (err: any) {
      setError(err.userFriendlyMessage || "Failed to save patient.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-80px)] space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-sky-500 border-t-transparent" />
        <p className="text-slate-500 text-sm font-mono tracking-wider">
          SYNCHRONIZING CLINICAL DATABASE...
        </p>
      </div>
    );
  }

  return (
    <div id="dashboard-container" className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-3xl font-bold font-display text-slate-900 tracking-tight flex items-center">
            <LayoutDashboard className="h-8 w-8 mr-2.5 text-sky-600 shrink-0" />
            Clinical Overview
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Real-time decision support, active patient tracking, and AI-powered drug interaction analysis.
          </p>
        </div>
        <div className="flex items-center space-x-4 self-start md:self-center">
          <button
            onClick={() => setActiveTab("notifications")}
            className="relative p-2.5 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-600 hover:text-slate-900 rounded-xl transition-all duration-200 shadow-sm cursor-pointer group"
            title="View Notifications"
          >
            <Bell className="h-5 w-5 group-hover:animate-bounce" />
            {stats?.notifications && stats.notifications.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border border-white shadow-sm">
                {stats.notifications.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border-l-4 border-rose-500 text-rose-800 text-sm flex items-center space-x-2 rounded-r-lg">
          <AlertTriangle className="h-5 w-5 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Stats Cards */}
      <div id="stats-grid" className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Patients</p>
            <p className="text-3xl font-bold text-slate-900">{stats?.totals.patients || 0}</p>
          </div>
          <div className="p-3 bg-sky-50 text-sky-600 rounded-lg">
            <Users className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Number of predictions</p>
            <p className="text-3xl font-bold text-slate-900">{stats?.totals.predictions || 0}</p>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
            <Brain className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Interaction Analysis</p>
            <p className="text-3xl font-bold text-slate-900">{stats?.totals.adrReports || 0}</p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <HeartPulse className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Quick Navigation Buttons */}
      <div id="quick-actions-grid" className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <button onClick={() => setActiveTab("patients")} className="flex items-center justify-between p-5 bg-white border border-slate-200 hover:border-sky-500 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 text-left group cursor-pointer">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-sky-50 text-sky-600 rounded-xl group-hover:bg-sky-100 transition-colors"><Users className="h-5 w-5" /></div>
            <div><h3 className="font-bold text-slate-900 text-sm">Patient</h3></div>
          </div>
          <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-sky-600 group-hover:translate-x-0.5 transition-all" />
        </button>

        <button onClick={() => setActiveTab("prediction")} className="flex items-center justify-between p-5 bg-white border border-slate-200 hover:border-indigo-500 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 text-left group cursor-pointer">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl group-hover:bg-indigo-100 transition-colors"><Brain className="h-5 w-5" /></div>
            <div><h3 className="font-bold text-slate-900 text-sm">Drug Prediction</h3></div>
          </div>
          <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
        </button>

        <button onClick={() => setActiveTab("adr")} className="flex items-center justify-between p-5 bg-white border border-slate-200 hover:border-emerald-500 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 text-left group cursor-pointer">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-emerald-100 transition-colors"><HeartPulse className="h-5 w-5" /></div>
            <div><h3 className="font-bold text-slate-900 text-sm">ADR analysis</h3></div>
          </div>
          <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
        </button>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
          {/* Recent Patient Admissions */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/40">
              <h3 className="font-bold text-slate-900 flex items-center text-sm">
                <Users className="h-4 w-4 mr-2 text-slate-500" /> Recent Patient Admissions
              </h3>
              <button onClick={() => setActiveTab("patients")} className="text-xs font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1 transition-colors">
                View directory <ChevronRight className="h-3 w-3" />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="px-6 py-3">Patient ID</th>
                    <th className="px-6 py-3">Name</th>
                    <th className="px-6 py-3">Specs</th>
                    <th className="px-6 py-3">Conditions</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                  {stats?.recentPatients.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/30 transition-colors">
                      <td className="px-6 py-3.5 font-mono text-xs text-sky-700 font-bold">{p.patient_id}</td>
                      <td className="px-6 py-3.5 font-bold text-slate-900">{p.full_name}</td>
                      <td className="px-6 py-3.5 text-xs text-slate-500">{p.age}y / {p.gender}</td>
                      <td className="px-6 py-3.5">
                      <div className="flex flex-wrap gap-1">
                          {Array.isArray(p.conditions) &&
                            p.conditions.slice(0, 2).map((c, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200"
                              >
                                {c}
                              </span>
                            ))}

                          {Array.isArray(p.conditions) && p.conditions.length > 2 && (
                            <span className="text-[10px] text-slate-400 font-semibold self-center">
                              +{p.conditions.length - 2} more
                            </span>
                          )}

                          {!Array.isArray(p.conditions) && p.conditions && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                              {p.conditions}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <div className="flex justify-end space-x-2">
                          <button onClick={() => onPatientSelect && onPatientSelect(p.id)} className="text-xs px-2.5 py-1 text-slate-600 hover:text-sky-600 hover:bg-sky-50 border border-slate-200 hover:border-sky-200 rounded-lg font-semibold transition-all">Profile</button>
                          <button onClick={() => onPredictSelect && onPredictSelect(p)} className="text-xs px-2.5 py-1 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-lg font-semibold transition-all">Predict</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {(!stats || stats.recentPatients.length === 0) && (
                    <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400">No active patient files recorded.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent AI Predictions */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/40">
              <h3 className="font-bold text-slate-900 flex items-center text-sm">
                <Brain className="h-4 w-4 mr-2 text-slate-500" /> Recent AI Recommendations
              </h3>
              <button onClick={() => setActiveTab("prediction")} className="text-xs font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1 transition-colors">
                View history <ChevronRight className="h-3 w-3" />
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="px-6 py-3">Patient</th>
                    <th className="px-6 py-3">Recommended drugs</th>
                    <th className="px-6 py-3">Confidence Margin</th>
                    <th className="px-6 py-3 text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                  {stats?.recentPredictions.map((pr) => (
                    <tr key={pr.id} className="hover:bg-slate-50/30 transition-colors">
                      <td className="px-6 py-3.5 font-bold text-slate-900">{pr.patient_name}</td>
                      <td className="px-6 py-3.5"><span className="font-mono bg-indigo-50 text-indigo-700 text-xs px-2 py-0.5 rounded border border-indigo-100 font-semibold">{pr.predicted_drug}</span></td>
                      <td className="px-6 py-3.5"><span className="text-xs font-semibold text-slate-700">{pr.confidence_score}%</span></td>
                      <td className="px-6 py-3.5 text-xs text-slate-400 font-mono text-right">{new Date(pr.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {(!stats || stats.recentPredictions.length === 0) && (
                    <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-400">No recent AI decisions filed.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Quick Add Patient Form */}
        <div className="lg:col-span-4 space-y-8">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h3 className="font-bold text-slate-900 flex items-center mb-4 text-sm">
              <Activity className="h-4 w-4 mr-2 text-sky-500 shrink-0" /> Quick Add Patient
            </h3>
            {successMsg && (
              <div className="mb-4 p-3 bg-emerald-50 border-l-4 border-emerald-500 text-emerald-800 text-xs flex items-center space-x-2 rounded-r-lg">
                <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500" />
                <span>{successMsg}</span>
              </div>
            )}
            <form onSubmit={handleQuickAdd} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Full Name</label>
                <input type="text" required placeholder="e.g. James Anderson" value={fullName} onChange={(e) => setFullName(e.target.value)} className="mt-1 block w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 bg-slate-50/50 hover:bg-slate-50 transition-colors" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Age</label>
                  <input type="number" required placeholder="62" value={age} onChange={(e) => setAge(e.target.value)} className="mt-1 block w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 bg-slate-50/50 hover:bg-slate-50 transition-colors" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gender</label>
                  <select value={gender} onChange={(e) => setGender(e.target.value)} className="mt-1 block w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 bg-white hover:bg-slate-50 transition-colors cursor-pointer font-medium">
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Conditions (comma-separated)</label>
                <input type="text" placeholder="Hypertension, Diabetes" value={conditions} onChange={(e) => setConditions(e.target.value)} className="mt-1 block w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 bg-slate-50/50 hover:bg-slate-50 transition-colors" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Drugs (comma-separated)</label>
                <input type="text" placeholder="Metformin, Lisinopril" value={currentDrugs} onChange={(e) => setCurrentDrugs(e.target.value)} className="mt-1 block w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 bg-slate-50/50 hover:bg-slate-50 transition-colors" />
              </div>
              <button type="submit" disabled={submitting} className="w-full mt-2 py-2 px-4 bg-sky-600 hover:bg-sky-700 disabled:bg-sky-400 text-white font-bold rounded-lg text-xs transition-colors flex justify-center items-center shadow-sm cursor-pointer">
                {submitting ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> : <><Plus className="h-4 w-4 mr-1.5" /> Register Patient</>}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
