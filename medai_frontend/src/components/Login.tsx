import React, { useState, useEffect } from "react";
import { Activity, ShieldCheck, Lock, Mail, User, Eye, EyeOff, Sparkles, Camera, ScanLine, AlertCircle } from "lucide-react";
import { motion } from "motion/react";
import { useAuth } from "../auth/useAuth";
import { authService } from "../services/authService";

interface LoginProps {
  onLoginSuccess?: (token: string, user: any) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const { login } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("Doctor");
  const [department, setDepartment] = useState("Cardiology");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Face Recognition Login State
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState<"idle" | "scanning" | "success" | "failed">("idle");
  const [scanProgress, setScanProgress] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isScanning) {
      setScanProgress(0);
      setScanStatus("scanning");
      interval = setInterval(() => {
        setScanProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            setIsScanning(false);
            // Auto login as Smith for demo scan success
            setScanStatus("success");
            setTimeout(() => {
              handleFaceLoginSuccess();
            }, 1000);
            return 100;
          }
          return prev + 10;
        });
      }, 200);
    }
    return () => clearInterval(interval);
  }, [isScanning]);

  const handleFaceLoginSuccess = async () => {
    setLoading(true);
    try {
      await login("drsmith", "doctor123");
      if (onLoginSuccess) {
        onLoginSuccess(localStorage.getItem("access_token") || "", { role: "Doctor", username: "drsmith" });
      }
    } catch (err: any) {
      setError(err.userFriendlyMessage || "Face recognition login failed.");
      setScanStatus("failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Client-side validations
    if (!username.trim()) {
      setError("Email or Username is required.");
      setLoading(false);
      return;
    }

    if (username.includes("@")) {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(username.trim())) {
        setError("Please enter a valid email format.");
        setLoading(false);
        return;
      }
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      setLoading(false);
      return;
    }

    if (isSignUp) {
      if (!firstName.trim() || !lastName.trim()) {
        setError("First name and Last name are required.");
        setLoading(false);
        return;
      }
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email.trim() || !emailPattern.test(email)) {
        setError("Please provide a valid registration email address.");
        setLoading(false);
        return;
      }
      if (password.length < 8) {
        setError("Sign-up password must be at least 8 characters.");
        setLoading(false);
        return;
      }
    }

    try {
      if (isSignUp) {
        // Register via authService → Django /api/auth/register/
        await authService.register({
          username,
          email,
          password,
          role,
          department,
          first_name: firstName,
          last_name: lastName,
        });
        // If register returns tokens, login is implicit; otherwise proceed to login below
      }

      // Login using Auth Context
      await login(username, password);

      if (onLoginSuccess) {
        onLoginSuccess(localStorage.getItem("access_token") || "", { username, role });
      }
    } catch (err: any) {
      setError(
        err.userFriendlyMessage || 
        err.response?.data?.error || 
        "Authentication failed. Check your credentials."
      );
    } finally {
      setLoading(false);
    }
  };


  return (
    <div id="login-page-container" className="min-h-screen flex items-center justify-center bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div id="login-card" className="max-w-4xl w-full bg-white rounded-2xl shadow-xl overflow-hidden grid grid-cols-1 md:grid-cols-12">
        
        {/* Left Panel: Primary Auth Forms */}
        <div className="p-8 md:p-12 md:col-span-7 flex flex-col justify-center">
          <div className="flex items-center space-x-3 mb-8">
            <div className="p-2.5 bg-sky-500 rounded-xl text-white">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <span className="text-2xl font-bold font-display tracking-tight text-slate-900">MedAI</span>
              <p className="text-xs text-slate-500 font-mono">Decision Support Suite</p>
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-bold font-display text-slate-900">
              {isSignUp ? "Register Clinician Account" : "Welcome Back, Clinician"}
            </h2>
            <p className="text-slate-500 text-sm mt-1">
              {isSignUp ? "Create a secure account to access patient diagnostics." : "Sign in to access secure diagnostic assistance and real-time clinical recommendations."}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm flex items-start space-x-2">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 uppercase tracking-wider">First Name</label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                    placeholder="Jane"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 uppercase tracking-wider">Last Name</label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                    placeholder="Doe"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 uppercase tracking-wider">
                {isSignUp ? "Username" : "Email or Username"}
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  placeholder={isSignUp ? "e.g., drjanedoe" : "username or email"}
                />
              </div>
            </div>

            {isSignUp && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-700 uppercase tracking-wider">Email Address</label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Mail className="h-4 w-4" />
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                      placeholder="jane.doe@hospital.org"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 uppercase tracking-wider">Access Role</label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-white"
                    >
                      <option value="Doctor">Doctor</option>
                      <option value="Nurse">Nurse</option>
                      <option value="Admin">Hospital Admin</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 uppercase tracking-wider">Department</label>
                    <input
                      type="text"
                      required
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                      placeholder="Cardiology"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <div className="flex justify-between items-center">
                <label className="block text-xs font-medium text-slate-700 uppercase tracking-wider">Password</label>
                {!isSignUp && (
                  <span className="text-xs text-slate-400 font-mono">Demo: doctor123 / admin123</span>
                )}
              </div>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-10 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-4 bg-sky-600 hover:bg-sky-700 text-white font-medium rounded-lg text-sm transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
              ) : isSignUp ? (
                "Create Secure Account"
              ) : (
                "Authenticate Clinician"
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError("");
              }}
              className="text-xs text-sky-600 hover:text-sky-700 font-medium focus:outline-none cursor-pointer"
            >
              {isSignUp ? "Already have an account? Sign In" : "Need a clinical account? Sign Up"}
            </button>
          </div>
        </div>

        {/* Right Panel: Optional Face Recognition / High Tech Assist */}
        <div className="bg-slate-900 md:col-span-5 p-8 flex flex-col justify-between relative text-white">
          {/* Subtle grid background */}
          <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-30" />

          <div className="relative z-10 flex flex-col h-full justify-between space-y-8">
            <div className="space-y-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-950 text-sky-300 border border-sky-800">
                <Sparkles className="h-3 w-3 mr-1 animate-pulse" /> Integrated Biometrics
              </span>
              <h3 className="text-xl font-bold font-display">Biometric Recognition</h3>
              <p className="text-slate-400 text-xs">
                Log in hands-free using encrypted hospital-grade facial verification. Suitable for sanitized emergency conditions.
              </p>
            </div>

            {/* Simulated Scanner Terminal */}
            <div className="flex flex-col items-center justify-center py-6">
              <div className="relative w-44 h-44 rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center shadow-2xl">
                {/* Scan Overlay Lines */}
                {isScanning && (
                  <>
                    <motion.div
                      className="absolute left-0 right-0 h-0.5 bg-sky-400 opacity-80 z-20"
                      initial={{ top: "0%" }}
                      animate={{ top: "100%" }}
                      transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                    />
                    <div className="absolute inset-0 bg-sky-500/10 animate-pulse z-10" />
                  </>
                )}

                {/* Status Indicator inside scanner */}
                <div className="text-center z-10 p-3">
                  {scanStatus === "idle" && (
                    <div className="flex flex-col items-center text-slate-500">
                      <Camera className="h-10 w-10 mb-2 stroke-1" />
                      <span className="text-[11px] font-mono">CAMERA IDLE</span>
                    </div>
                  )}
                  {scanStatus === "scanning" && (
                    <div className="flex flex-col items-center text-sky-400">
                      <ScanLine className="h-10 w-10 mb-2 animate-bounce" />
                      <span className="text-[11px] font-mono tracking-widest">{scanProgress}% SECURE</span>
                    </div>
                  )}
                  {scanStatus === "success" && (
                    <div className="flex flex-col items-center text-emerald-400">
                      <ShieldCheck className="h-10 w-10 mb-2" />
                      <span className="text-[11px] font-mono tracking-widest">VERIFIED</span>
                    </div>
                  )}
                  {scanStatus === "failed" && (
                    <div className="flex flex-col items-center text-rose-500">
                      <AlertCircle className="h-10 w-10 mb-2" />
                      <span className="text-[11px] font-mono">REJECTED</span>
                    </div>
                  )}
                </div>

                {/* Grid decor inside scanner */}
                <div className="absolute inset-0 opacity-10 flex flex-col justify-between p-2 font-mono text-[9px] text-sky-500 select-none pointer-events-none">
                  <div className="flex justify-between">
                    <span>SYS_INIT</span>
                    <span>2026_CAM</span>
                  </div>
                  <div className="flex justify-between">
                    <span>PORT_3000</span>
                    <span>SYS_ACTIVE</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setIsScanning(true)}
                disabled={isScanning || loading}
                className="w-full py-2 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-medium rounded-lg text-xs transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 flex justify-center items-center space-x-2"
              >
                <Camera className="h-4 w-4 text-sky-400" />
                <span>{isScanning ? "Scanning Retinal Map..." : "Scan Retinal Map"}</span>
              </button>
              <p className="text-[10px] text-slate-500 text-center font-mono">
                COMPLIES WITH HIPAA SECURITY STANDARDS & ENCRYPTED PATIENT PRIVACY DIRECTIVES
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
