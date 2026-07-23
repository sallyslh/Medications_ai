import React, { useState, useEffect } from "react";
import { supportService } from "../services/supportService";
import { dashboardService } from "../services/dashboardService";
import {
  HelpCircle,
  Search,
  Mail,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  FileText,
  Send,
  Phone,
  ShieldAlert,
  RefreshCw,
  Cpu,
  Database,
  Lock,
  Laptop,
  Activity,
  Info,
  Layers,
  Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { SupportTicket } from "../types";
import { reportCriticalError } from "../utils/errorReporter";

interface HelpPageProps {
  token: string;
}

interface SystemStatus {
  status: string;
  services: {
    clinical_services: string;
    ai_prediction_service: string;
    database: string;
    authentication_server: string;
  };
  last_checked: string;
}

export default function HelpPage({ token }: HelpPageProps) {
  const [faqs, setFaqs] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [faqsLoading, setFaqsLoading] = useState(true);

  // Ticket Form States
  const [category, setCategory] = useState("AI Prediction");
  const [priority, setPriority] = useState("Medium");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [browser, setBrowser] = useState("");
  const [os, setOs] = useState("");
  const [stepsToReproduce, setStepsToReproduce] = useState("");

  const [ticketSubmitting, setTicketSubmitting] = useState(false);
  const [ticketSuccess, setTicketSuccess] = useState("");
  const [ticketError, setTicketError] = useState("");

  // Saved tickets history
  const [myTickets, setMyTickets] = useState<SupportTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);

  // Accordion state for FAQs
  const [openFaqId, setOpenFaqId] = useState<string | null>("faq-1");

  // System Status State
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [statusChecking, setStatusChecking] = useState(false);

  // Simulation status states
  const [simulationRunning, setSimulationRunning] = useState<string | null>(null);
  const [simulationMsg, setSimulationMsg] = useState("");

  const fetchFaqs = async () => {
    try {
      setFaqsLoading(true);
      const data = await supportService.getFAQ();
      setFaqs(data);
    } catch (err) {
      console.error("Failed to load FAQs.");
    } finally {
      setFaqsLoading(false);
    }
  };

  const fetchTickets = async () => {
    try {
      setTicketsLoading(true);
      const data = await supportService.getTickets();
      setMyTickets(data);
    } catch (err) {
      console.error("Failed to load tickets.");
    } finally {
      setTicketsLoading(false);
    }
  };

  const fetchSystemStatus = async () => {
    try {
      setStatusChecking(true);
      const data = await dashboardService.getSystemStatus();
      setSystemStatus(data as unknown as SystemStatus);
    } catch (err) {
      console.error("Failed to fetch system status");
    } finally {
      setStatusChecking(false);
    }
  };

  useEffect(() => {
    fetchFaqs();
    fetchTickets();
    fetchSystemStatus();
    // Refresh status periodically
    const interval = setInterval(fetchSystemStatus, 30000);
    return () => clearInterval(interval);
  }, [token]);

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject || !description) {
      setTicketError("Subject and Description are required fields.");
      return;
    }

    setTicketSubmitting(true);
    setTicketSuccess("");
    setTicketError("");

    try {
      // Gather browser / OS info automatically if empty
      const detectedBrowser = browser || navigator.userAgent.split(" ").slice(-2).join(" ");
      const detectedOs = os || navigator.platform;

      const data = await supportService.createTicket({
        title: subject,
        description,
        category,
        priority,
        browser: detectedBrowser,
        os: detectedOs,
        steps_to_reproduce: stepsToReproduce,
      });
      setMyTickets((prev) => [data, ...prev]);
      setTicketSuccess("Support ticket submitted successfully.");
      // Reset form fields
      setSubject("");
      setDescription("");
      setBrowser("");
      setOs("");
      setStepsToReproduce("");
    } catch (err: any) {
      setTicketError(err.userFriendlyMessage || "Failed to submit ticket.");
    } finally {
      setTicketSubmitting(false);
    }
  };

  // Simulate a critical error and watch the automatic ticket creation
  const triggerSimulation = async (type: "ai" | "db" | "auth") => {
    setSimulationRunning(type);
    setSimulationMsg("");

    let title = "";
    let desc = "";
    let priorityVal: "High" | "Critical" = "High";
    let cat = "Other";

    if (type === "ai") {
      title = "AI Model Unresponsive Exception";
      desc = "The primary server-side Gemini drug prediction module threw a timeout (504 Gateway Timeout) on continuous request threads. Connection with Google Vertex API failed to respond within 15000ms thresholds.";
      priorityVal = "High";
      cat = "AI Prediction";
    } else if (type === "db") {
      title = "Database Connection Lost Error";
      desc = "SQL Connection Pool dropped to 0 active clients. PostgreSQL reported connection refused at port 5432. Automatic failover attempts exhausted. Core transactional integrity is offline.";
      priorityVal = "Critical";
      cat = "Database";
    } else {
      title = "Authentication Token Verification Failure";
      desc = "JSON Web Token (JWT) verification keys returned unexpected signature validation exceptions. Repeated internal server exceptions (500) generated while decoding cryptographic signatures.";
      priorityVal = "Critical";
      cat = "Security";
    }

    try {
      await reportCriticalError(title, desc, priorityVal, cat);
      setSimulationMsg(`Success! Automatic ${priorityVal} support ticket generated.`);
      await fetchTickets(); // reload tickets
    } catch (err) {
      setSimulationMsg("Simulation failed to submit.");
    } finally {
      setTimeout(() => {
        setSimulationRunning(null);
      }, 1500);
    }
  };

  const filteredFaqs = faqs.filter(
    (faq) =>
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div id="help-it-support-portal" className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 text-slate-800">
      
      {/* Page Header */}
      <div id="portal-header-section" className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-100 pb-6 gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2 py-1 bg-sky-50 text-sky-700 text-[10px] font-bold uppercase tracking-wider rounded border border-sky-100">
              Hospital Portal
            </span>
            <span className="px-2 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-bold uppercase tracking-wider rounded border border-indigo-100">
              IT Operations
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold font-display text-slate-900 tracking-tight mt-2">
            Clinical Help & IT Support
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Search clinical guides, report technical exceptions, and monitor systems status on the hospital network.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              fetchFaqs();
              fetchTickets();
              fetchSystemStatus();
            }}
            className="p-2 bg-white text-slate-600 hover:text-slate-900 rounded-lg border border-slate-200 hover:border-slate-300 shadow-sm transition-all duration-200 cursor-pointer flex items-center space-x-1 text-xs font-semibold"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Sync Portal</span>
          </button>
        </div>
      </div>

      {/* Grid Layout */}
      <div id="portal-grid" className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column - Docs, Search, FAQs, and Ticket History (7 Cols) */}
        <div id="left-portal-lane" className="lg:col-span-7 space-y-8">
          
          {/* Section 1 & 2: Search and Clinical FAQs */}
          <section id="faq-section" className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-50 bg-slate-50/50">
              <h2 className="font-bold text-slate-950 font-display flex items-center text-base">
                <HelpCircle className="h-5 w-5 mr-2 text-sky-600" />
                Clinical & System Guidelines
              </h2>
              <p className="text-slate-500 text-xs mt-1">
                Expand system operational procedures or search guidelines in real time.
              </p>

              {/* SECTION 1 - SEARCH HELP */}
              <div id="search-container" className="relative rounded-lg shadow-sm mt-4">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Search className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  id="clinical-doc-search"
                  placeholder="Search clinical guidelines, FAQs or troubleshooting..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="block w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-xs text-slate-400 hover:text-slate-600 font-semibold"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* SECTION 2 - CLINICAL FAQ ACCORDION */}
            <div id="faq-accordion-container" className="p-6 divide-y divide-slate-100">
              {faqsLoading ? (
                <div className="py-8 text-center text-slate-400 text-sm flex flex-col items-center justify-center space-y-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-sky-500 border-t-transparent" />
                  <span>Retrieving guidelines...</span>
                </div>
              ) : filteredFaqs.length > 0 ? (
                filteredFaqs.map((faq) => {
                  const isOpen = openFaqId === faq.id;
                  return (
                    <div key={faq.id} className="py-4 first:pt-0 last:pb-0">
                      <button
                        onClick={() => setOpenFaqId(isOpen ? null : faq.id)}
                        className="w-full flex justify-between items-center text-left py-1 text-sm font-semibold text-slate-800 hover:text-sky-700 transition-colors focus:outline-none"
                      >
                        <span className="pr-4">{faq.question}</span>
                        <span className="shrink-0">
                          {isOpen ? (
                            <ChevronUp className="h-4 w-4 text-slate-500 bg-slate-100 rounded-full p-0.5" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-slate-400 bg-slate-50 rounded-full p-0.5 hover:bg-slate-100" />
                          )}
                        </span>
                      </button>
                      
                      <AnimatePresence initial={false}>
                        {isOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2, ease: "easeInOut" }}
                            className="overflow-hidden"
                          >
                            <div className="mt-2.5 text-xs leading-relaxed text-slate-600 bg-slate-50 p-3.5 rounded-lg border border-slate-100/80 font-sans whitespace-pre-line">
                              {faq.answer}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center text-slate-400 text-xs font-medium">
                  No operational FAQs match your search query.
                </div>
              )}
            </div>
          </section>

          {/* SECTION 4 - TICKET HISTORY */}
          <section id="ticket-history-section" className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-slate-950 font-display flex items-center text-base">
                  <FileText className="h-5 w-5 mr-2 text-indigo-600" />
                  Technical Support Tickets
                </h2>
                <p className="text-slate-500 text-xs mt-1">
                  Historical ticket logs and dynamic updates submitted from this terminal.
                </p>
              </div>
              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-bold font-mono rounded">
                Total: {myTickets.length}
              </span>
            </div>

            <div className="p-6 divide-y divide-slate-100">
              {ticketsLoading ? (
                <div className="py-8 text-center text-slate-400 text-sm flex flex-col items-center justify-center space-y-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-indigo-500 border-t-transparent" />
                  <span>Synchronizing tickets...</span>
                </div>
              ) : myTickets.length > 0 ? (
                myTickets.map((ticket) => {
                  const isExpanded = expandedTicketId === ticket.id;
                  const isAuto = ticket.id.startsWith("st-auto");
                  
                  // Priority Badge setup
                  const priorityStyles = () => {
                    switch (ticket.priority) {
                      case "Critical":
                        return "bg-red-50 text-red-700 border-red-100";
                      case "High":
                        return "bg-amber-50 text-amber-700 border-amber-100";
                      case "Medium":
                        return "bg-blue-50 text-blue-700 border-blue-100";
                      default:
                        return "bg-slate-50 text-slate-600 border-slate-100";
                    }
                  };

                  // Status Badge setup
                  const statusStyles = () => {
                    switch (ticket.status) {
                      case "Resolved":
                        return "bg-emerald-50 text-emerald-800 border-emerald-100";
                      case "In Progress":
                        return "bg-sky-50 text-sky-800 border-sky-100 animate-pulse";
                      case "Closed":
                        return "bg-slate-100 text-slate-700 border-slate-200";
                      default:
                        return "bg-amber-50 text-amber-800 border-amber-100";
                    }
                  };

                  return (
                    <div key={ticket.id} className="py-4 first:pt-0 last:pb-0 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">
                              Ticket: {ticket.id}
                            </span>
                            {isAuto && (
                              <span className="px-1.5 py-0.5 bg-red-100 text-red-800 border border-red-200 text-[9px] font-bold uppercase rounded flex items-center">
                                <Activity className="h-2 w-2 mr-1" />
                                Auto-Created
                              </span>
                            )}
                          </div>
                          <h4 className="font-semibold text-slate-900 text-sm mt-0.5 hover:text-indigo-600 transition-colors">
                            {ticket.title}
                          </h4>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Logged by <span className="font-semibold">{ticket.username}</span> • {new Date(ticket.created_at).toLocaleString()}
                          </p>
                        </div>

                        {/* Badges container */}
                        <div className="flex items-center space-x-2 shrink-0">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${priorityStyles()}`}>
                            {ticket.priority || "Medium"}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${statusStyles()}`}>
                            {ticket.status === "Pending" ? "Open" : ticket.status}
                          </span>
                        </div>
                      </div>

                      {/* Summary description preview */}
                      <p className={`text-xs text-slate-600 leading-relaxed font-sans ${isExpanded ? "" : "line-clamp-2"}`}>
                        {ticket.description}
                      </p>

                      {/* Expandable detailed parameters */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-3 bg-slate-50 p-4 rounded-lg border border-slate-100/80 space-y-3 text-xs">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-sans">
                                <div>
                                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                    Issue Category
                                  </span>
                                  <span className="font-semibold text-slate-800">
                                    {ticket.category || "General Technical Support"}
                                  </span>
                                </div>
                                <div>
                                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                    Assigned Priority
                                  </span>
                                  <span className="font-semibold text-slate-800">
                                    {ticket.priority || "Medium"}
                                  </span>
                                </div>
                                {ticket.browser && (
                                  <div>
                                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                      Browser / Device Environment
                                    </span>
                                    <span className="font-semibold text-slate-700 font-mono text-[11px]">
                                      {ticket.browser}
                                    </span>
                                  </div>
                                )}
                                {ticket.os && (
                                  <div>
                                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                      Operating System
                                    </span>
                                    <span className="font-semibold text-slate-700 font-mono text-[11px]">
                                      {ticket.os}
                                    </span>
                                  </div>
                                )}
                              </div>
                              {ticket.steps_to_reproduce && (
                                <div className="border-t border-slate-200/60 pt-3">
                                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                    Steps to Reproduce
                                  </span>
                                  <p className="text-slate-600 font-mono text-[11px] bg-white p-2 rounded border border-slate-100 mt-1 leading-normal whitespace-pre-line">
                                    {ticket.steps_to_reproduce}
                                  </p>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Expand / Collapse Button */}
                      <div className="flex justify-start">
                        <button
                          onClick={() => setExpandedTicketId(isExpanded ? null : ticket.id)}
                          className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 focus:outline-none flex items-center space-x-1 hover:underline cursor-pointer"
                        >
                          <span>{isExpanded ? "Collapse Details" : "Expand Ticket Details"}</span>
                          {isExpanded ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-12 text-center text-slate-400 text-xs font-mono">
                  No technical support tickets have been registered for this account.
                </div>
              )}
            </div>
          </section>

        </div>

        {/* Right Column - Submit Ticket, Contacts, System Status & Compliance Notice (5 Cols) */}
        <div id="right-portal-lane" className="lg:col-span-5 space-y-8">
          
          {/* SECTION 7 - COMPLIANCE NOTICE */}
          <section id="compliance-notice-section" className="bg-sky-50/80 border border-sky-100 rounded-xl p-5 shadow-sm space-y-3">
            <div className="flex items-start space-x-3">
              <ShieldAlert className="h-5 w-5 text-sky-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-sky-900 text-sm tracking-tight">HIPAA & Security Compliance Notice</h3>
                <p className="text-slate-600 text-xs mt-1 leading-relaxed">
                  Do not include plain-text Protected Health Information (PHI) inside technical support tickets. 
                  Always refer to patients using secure <strong className="text-sky-950">Patient IDs</strong> only.
                </p>
              </div>
            </div>
          </section>

          {/* SECTION 3 - REPORT TECHNICAL ISSUE FORM */}
          <section id="issue-form-section" className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 space-y-5">
            <div>
              <h2 className="font-bold text-slate-900 font-display flex items-center text-base">
                <AlertTriangle className="h-5 w-5 mr-2 text-amber-500 animate-pulse" />
                Report Technical Issue
              </h2>
              <p className="text-slate-500 text-xs mt-1">
                Log a compliant ticket directly with Hospital Clinical IT Systems.
              </p>
            </div>

            {/* Success and Error Banners */}
            {ticketSuccess && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs font-sans rounded-lg flex items-start space-x-2">
                <CheckCircle className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
                <div>
                  <p className="font-bold">Submitted Successfully</p>
                  <p className="mt-0.5 text-slate-600">{ticketSuccess}</p>
                </div>
              </div>
            )}

            {ticketError && (
              <div className="p-3.5 bg-red-50 border border-red-100 text-red-800 text-xs font-sans rounded-lg flex items-start space-x-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
                <div>
                  <p className="font-bold">Submission Error</p>
                  <p className="mt-0.5 text-slate-600">{ticketError}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmitTicket} className="space-y-4 font-sans text-xs">
              <div className="grid grid-cols-2 gap-3">
                {/* Category Dropdown */}
                <div>
                  <label htmlFor="issue-category" className="block font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                    Issue Category *
                  </label>
                  <select
                    id="issue-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="mt-1 block w-full bg-white border border-slate-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="Login Problem">Login Problem</option>
                    <option value="AI Prediction">AI Prediction</option>
                    <option value="Database">Database</option>
                    <option value="Performance">Performance</option>
                    <option value="Security">Security</option>
                    <option value="Patient Records">Patient Records</option>
                    <option value="User Permissions">User Permissions</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {/* Priority Selection */}
                <div>
                  <label htmlFor="issue-priority" className="block font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                    Priority Level *
                  </label>
                  <select
                    id="issue-priority"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="mt-1 block w-full bg-white border border-slate-200 rounded-lg p-2 text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>
              </div>

              {/* Subject Title */}
              <div>
                <label htmlFor="issue-subject" className="block font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                  Subject Line *
                </label>
                <input
                  type="text"
                  id="issue-subject"
                  required
                  placeholder="e.g., AI latency or patient file lookup error"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="mt-1 block w-full border border-slate-200 rounded-lg p-2 text-xs placeholder-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* Description */}
              <div>
                <label htmlFor="issue-description" className="block font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                  Detailed Description *
                </label>
                <textarea
                  id="issue-description"
                  required
                  rows={4}
                  placeholder="Describe the exact issue in detail. Please do NOT include plain-text patient names or clinical PHI."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1 block w-full border border-slate-200 rounded-lg p-2 text-xs placeholder-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* Browser and OS Optional Accordion */}
              <div className="border border-slate-100 rounded-lg p-3 space-y-3 bg-slate-50/50">
                <span className="block font-bold text-slate-600 text-[10px] uppercase">
                  Technical Environment (Optional)
                </span>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="issue-browser" className="block text-[9px] text-slate-400 uppercase font-semibold">
                      Browser
                    </label>
                    <input
                      type="text"
                      id="issue-browser"
                      placeholder="e.g., Chrome 125"
                      value={browser}
                      onChange={(e) => setBrowser(e.target.value)}
                      className="mt-1 block w-full bg-white border border-slate-200 rounded p-1.5 text-xs focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="issue-os" className="block text-[9px] text-slate-400 uppercase font-semibold">
                      Operating System
                    </label>
                    <input
                      type="text"
                      id="issue-os"
                      placeholder="e.g., Windows 11"
                      value={os}
                      onChange={(e) => setOs(e.target.value)}
                      className="mt-1 block w-full bg-white border border-slate-200 rounded p-1.5 text-xs focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="issue-reproduce" className="block text-[9px] text-slate-400 uppercase font-semibold">
                    Steps to Reproduce
                  </label>
                  <textarea
                    id="issue-reproduce"
                    rows={2}
                    placeholder="1. Go to predictions. 2. Select patient PT-1001. 3. Output fails with internal timeout..."
                    value={stepsToReproduce}
                    onChange={(e) => setStepsToReproduce(e.target.value)}
                    className="mt-1 block w-full bg-white border border-slate-200 rounded p-1.5 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={ticketSubmitting}
                className="w-full mt-2 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg tracking-wide shadow transition-colors flex justify-center items-center cursor-pointer disabled:opacity-50"
              >
                {ticketSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent mr-2" />
                    <span>Submitting Ticket...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5 mr-1.5" />
                    <span>Submit Support Ticket</span>
                  </>
                )}
              </button>
            </form>
          </section>

          {/* SECTION 6 - SYSTEM STATUS PANEL & AUDIT TOOLS */}
          <section id="system-status-section" className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-slate-900 font-display flex items-center text-sm uppercase tracking-wider text-slate-400">
                  <Activity className="h-4 w-4 mr-2 text-indigo-500" />
                  Hospital Network System Status
                </h2>
              </div>
              {statusChecking && (
                <div className="animate-spin rounded-full h-3 w-3 border border-slate-300 border-t-indigo-500" />
              )}
            </div>

            {/* Live Services Grid */}
            <div className="space-y-2.5 text-xs font-sans">
              <div className="flex items-center justify-between p-2.5 bg-emerald-50/50 border border-emerald-100/40 rounded-lg">
                <span className="font-medium text-slate-700 flex items-center">
                  <Activity className="h-3.5 w-3.5 mr-2 text-emerald-500" />
                  Clinical Application Status
                </span>
                <span className="font-bold text-emerald-700 flex items-center">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse mr-1.5" />
                  All Clinical Services Operational
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="bg-slate-50 p-2.5 rounded border border-slate-100 flex flex-col justify-between">
                  <span className="text-[10px] text-slate-400 font-bold uppercase flex items-center">
                    <Sparkles className="h-3 w-3 mr-1 text-sky-500" />
                    Medical AI
                  </span>
                  <span className="font-bold text-slate-800 text-[11px] mt-1 flex items-center">
                    {systemStatus?.services?.ai_prediction_service === "Online" ? (
                      <>
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1" />
                        AI Online
                      </>
                    ) : (
                      <>
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 mr-1" />
                        AI Degraded
                      </>
                    )}
                  </span>
                </div>

                <div className="bg-slate-50 p-2.5 rounded border border-slate-100 flex flex-col justify-between">
                  <span className="text-[10px] text-slate-400 font-bold uppercase flex items-center">
                    <Database className="h-3 w-3 mr-1 text-indigo-500" />
                    Database
                  </span>
                  <span className="font-bold text-slate-800 text-[11px] mt-1 flex items-center">
                    {systemStatus?.services?.database === "Online" ? (
                      <>
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1" />
                        Connected
                      </>
                    ) : (
                      <>
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500 mr-1 animate-ping" />
                        Offline
                      </>
                    )}
                  </span>
                </div>

                <div className="bg-slate-50 p-2.5 rounded border border-slate-100 flex flex-col justify-between">
                  <span className="text-[10px] text-slate-400 font-bold uppercase flex items-center">
                    <Lock className="h-3 w-3 mr-1 text-teal-500" />
                    Auth server
                  </span>
                  <span className="font-bold text-slate-800 text-[11px] mt-1 flex items-center">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1" />
                    Online
                  </span>
                </div>
              </div>
            </div>

            {/* AUDIT SYSTEM: TRIGGER FAILURE SIMULATION */}
            <div className="border-t border-slate-100 pt-4 space-y-2">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Hospital IT System Failure Audit
              </span>
              <p className="text-[10px] text-slate-500 leading-normal font-sans">
                Audit system reliability by simulating critical failures. This instantly logs an automatic high-priority ticket in compliance with healthcare monitoring standards.
              </p>

              <div className="grid grid-cols-3 gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => triggerSimulation("ai")}
                  disabled={simulationRunning !== null}
                  className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-[9px] text-slate-700 font-bold rounded cursor-pointer transition-colors text-center disabled:opacity-50"
                >
                  {simulationRunning === "ai" ? "Triggering..." : "Simulate AI Down"}
                </button>
                <button
                  type="button"
                  onClick={() => triggerSimulation("db")}
                  disabled={simulationRunning !== null}
                  className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-[9px] text-slate-700 font-bold rounded cursor-pointer transition-colors text-center disabled:opacity-50"
                >
                  {simulationRunning === "db" ? "Triggering..." : "Simulate DB Offline"}
                </button>
                <button
                  type="button"
                  onClick={() => triggerSimulation("auth")}
                  disabled={simulationRunning !== null}
                  className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-[9px] text-slate-700 font-bold rounded cursor-pointer transition-colors text-center disabled:opacity-50"
                >
                  {simulationRunning === "auth" ? "Triggering..." : "Simulate Auth Failure"}
                </button>
              </div>

              {simulationMsg && (
                <div className="text-[10px] font-bold text-indigo-600 bg-indigo-50 p-2 rounded text-center animate-fade-in font-mono">
                  {simulationMsg}
                </div>
              )}
            </div>
          </section>

          {/* SECTION 5 - EMERGENCY IT CONTACT */}
          <section id="emergency-contact-section" className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-xl shadow-md p-6 space-y-4">
            <div>
              <span className="text-[9px] bg-red-500/20 text-red-300 border border-red-500/30 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                IT Operations Command
              </span>
              <h3 className="font-bold font-display text-base tracking-tight mt-1.5 text-white">
                Emergency IT Support Desk
              </h3>
              <p className="text-indigo-200 text-[11px] font-sans mt-1">
                Direct lines for surgical suites, critical care terminals, and pharmacy databases.
              </p>
            </div>

            <div className="space-y-3 pt-1 text-xs font-sans">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-white/10 rounded-lg text-white">
                  <Mail className="h-4 w-4" />
                </div>
                <div>
                  <span className="block text-[10px] text-indigo-300 uppercase font-bold tracking-wider">
                    Official Email
                  </span>
                  <a href="mailto:support@medai-hospital.org" className="text-white hover:underline font-semibold font-mono">
                    support@medai-hospital.org
                  </a>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <div className="p-2 bg-white/10 rounded-lg text-white">
                  <Phone className="h-4 w-4" />
                </div>
                <div>
                  <span className="block text-[10px] text-indigo-300 uppercase font-bold tracking-wider">
                    Internal Extension
                  </span>
                  <span className="font-mono text-white font-bold">
                    EXT-5555
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-3 bg-red-500/10 border border-red-500/20 rounded-lg p-2.5">
                <div className="p-1.5 bg-red-600 rounded-lg text-white animate-pulse">
                  <Phone className="h-4 w-4" />
                </div>
                <div>
                  <span className="block text-[9px] text-red-300 uppercase font-bold tracking-wider">
                    Emergency IT Hotline
                  </span>
                  <span className="font-mono text-red-200 font-bold">
                    1-800-555-MEDAI (24/7 pager)
                  </span>
                </div>
              </div>
            </div>
          </section>

        </div>

      </div>
    </div>
  );
}
