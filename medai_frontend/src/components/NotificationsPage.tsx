import React, { useState, useEffect } from "react";
import { Bell, AlertTriangle, CheckCircle, ArrowLeft, RefreshCw, Trash2 } from "lucide-react";
import { DashboardStats } from "../types";
import { dashboardService } from "../services/dashboardService";

interface NotificationsPageProps {
  token: string;
  setActiveTab: (tab: string) => void;
}

export default function NotificationsPage({ token, setActiveTab }: NotificationsPageProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [readIds, setReadIds] = useState<string[]>([]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const data = await dashboardService.getStats();
      setStats(data);
    } catch (err: any) {
      setError(err.userFriendlyMessage || "Failed to load notifications.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const toggleRead = (id: string) => {
    if (readIds.includes(id)) {
      setReadIds(readIds.filter((item) => item !== id));
    } else {
      setReadIds([...readIds, id]);
    }
  };

  const markAllAsRead = () => {
    if (stats?.notifications) {
      const allIds = stats.notifications.map((n) => n.id);
      setReadIds(allIds);
    }
  };

  const clearAll = () => {
    if (stats) {
      setStats({
        ...stats,
        notifications: [],
      });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-80px)]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent" />
        <p className="text-slate-500 text-sm font-mono mt-4">PULLING CLINICAL ALERTS...</p>
      </div>
    );
  }

  const notifications = stats?.notifications || [];

  return (
    <div id="notifications-container" className="p-8 max-w-4xl mx-auto space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setActiveTab("dashboard")}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
            title="Back to Dashboard"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold font-display text-slate-900 tracking-tight flex items-center">
              <Bell className="h-7 w-7 mr-2 text-indigo-600 shrink-0 animate-pulse" />
              Clinical Alerts & Notifications
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Active alerts, automatic drug-drug interaction warnings, and hospital-wide updates.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 self-start sm:self-center">
          <button
            onClick={fetchNotifications}
            className="p-2 border border-slate-200 hover:border-slate-300 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors flex items-center space-x-1.5 text-xs font-semibold cursor-pointer"
            title="Refresh list"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Sync</span>
          </button>
          {notifications.length > 0 && (
            <>
              <button
                onClick={markAllAsRead}
                className="p-2 border border-slate-200 hover:border-slate-300 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors flex items-center space-x-1.5 text-xs font-semibold cursor-pointer"
              >
                <span>Read All</span>
              </button>
              <button
                onClick={clearAll}
                className="p-2 border border-red-200 hover:border-red-300 rounded-lg text-red-600 hover:text-red-700 hover:bg-red-50/40 transition-colors flex items-center space-x-1.5 text-xs font-semibold cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Dismiss All</span>
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm flex items-center space-x-2 rounded-r-lg">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {/* Notifications List */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 divide-y divide-slate-100 overflow-hidden">
        {notifications.length > 0 ? (
          notifications.map((n) => {
            const isRead = readIds.includes(n.id);
            return (
              <div
                key={n.id}
                className={`p-5 flex items-start space-x-4 transition-colors ${
                  isRead ? "bg-slate-50/50 opacity-70" : "bg-white"
                }`}
              >
                <div className="shrink-0 mt-1">
                  {n.type === "danger" ? (
                    <div className="p-2.5 bg-red-50 rounded-lg text-red-600 border border-red-100">
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                  ) : n.type === "success" ? (
                    <div className="p-2.5 bg-emerald-50 rounded-lg text-emerald-600 border border-emerald-100">
                      <CheckCircle className="h-5 w-5" />
                    </div>
                  ) : (
                    <div className="p-2.5 bg-sky-50 rounded-lg text-sky-600 border border-sky-100">
                      <Bell className="h-5 w-5" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-sm font-bold ${isRead ? "text-slate-600" : "text-slate-900"}`}>
                      {n.title}
                    </p>
                    <span className="text-xs text-slate-400 font-mono shrink-0">
                      {new Date(n.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 mt-1 leading-relaxed">{n.message}</p>
                  
                  <div className="mt-3 flex items-center space-x-3">
                    <button
                      onClick={() => toggleRead(n.id)}
                      className="text-xs text-slate-500 hover:text-indigo-600 font-medium transition-colors cursor-pointer"
                    >
                      {isRead ? "Mark as unread" : "Mark as read"}
                    </button>
                  </div>
                </div>

                {/* Severity indicator dot */}
                {!isRead && (
                  <div className="shrink-0 self-center">
                    <span
                      className={`h-2.5 w-2.5 rounded-full block ${
                        n.type === "danger"
                          ? "bg-red-500"
                          : n.type === "success"
                          ? "bg-emerald-500"
                          : "bg-sky-500"
                      }`}
                    />
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="p-16 text-center space-y-3">
            <div className="p-4 bg-slate-50 text-slate-400 inline-block rounded-full border border-slate-100">
              <CheckCircle className="h-8 w-8" />
            </div>
            <h3 className="font-bold text-slate-800 text-base">All Clear!</h3>
            <p className="text-slate-400 text-sm max-w-sm mx-auto">
              No outstanding alerts or critical interaction warnings require your attention at this time.
            </p>
            <button
              onClick={() => setActiveTab("dashboard")}
              className="mt-2 text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100/60 px-4 py-2 rounded-lg transition-all cursor-pointer"
            >
              Return to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
