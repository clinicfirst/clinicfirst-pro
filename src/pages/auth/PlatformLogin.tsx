import React, { useState, useEffect } from 'react';
import {
  Shield,
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  Eye,
  EyeOff,
  Server,
  Building2,
  Stethoscope,
  PhoneCall,
  Calendar,
  KeyRound,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/common/Button';
import { apiRequest } from '../../api';

interface PlatformLoginProps {
  onSwitchToClinicLogin?: () => void;
  onSwitchToClinic?: () => void;
}

export const PlatformLogin: React.FC<PlatformLoginProps> = ({
  onSwitchToClinicLogin,
  onSwitchToClinic,
}) => {
  const switchPortal = onSwitchToClinic || onSwitchToClinicLogin;
  const { loginPlatform } = useAuth();
  
  const [email, setEmail] = useState('admin@clinicfirst.ai');
  const [password, setPassword] = useState('PlatformAdmin2026!');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [stats, setStats] = useState<{
    totalClinics: number;
    activeClinics: number;
    totalDoctors: number;
    todayAppointments: number;
    totalCalls: number;
    activeAiAgents: number;
  }>({
    totalClinics: 0,
    activeClinics: 0,
    totalDoctors: 0,
    todayAppointments: 0,
    totalCalls: 0,
    activeAiAgents: 0,
  });

  useEffect(() => {
    apiRequest<any>('/api/auth/stats')
      .then((data) => {
        if (data) {
          setStats({
            totalClinics: data.totalClinics || 0,
            activeClinics: data.activeClinics || 0,
            totalDoctors: data.totalDoctors || 0,
            todayAppointments: data.todayAppointments || 0,
            totalCalls: data.totalCalls || 0,
            activeAiAgents: data.activeAiAgents || 0,
          });
        }
      })
      .catch((err) => {
        console.warn('Failed to load real-time platform stats:', err);
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await loginPlatform(email.trim(), password);
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A2540] text-white flex flex-col justify-between selection:bg-white/20 relative font-sans">
      {/* Top Header Bar */}
      <header className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between z-10 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-white text-[#0A2540] flex items-center justify-center font-black text-base shadow-sm">
            CF
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-white tracking-tight text-lg">
                CLINICFIRST
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide bg-white/10 text-white border border-white/20">
                PLATFORM ADMIN
              </span>
            </div>
            <p className="text-xs text-slate-300 font-medium">
              Multi-Tenant Clinic Administration & AI Receptionist Control
            </p>
          </div>
        </div>

        {/* Security badge */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-white/10 border border-white/20 rounded-full text-xs text-white">
          <Shield className="w-3.5 h-3.5 text-white" />
          <span className="font-semibold text-xs">Tenant Isolation Active</span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 flex items-center justify-center z-10">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* Left Column: Real Database Infrastructure Overview */}
          <div className="hidden lg:flex lg:col-span-6 flex-col justify-center space-y-6 pr-4">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-white/10 border border-white/15 text-xs font-semibold text-white">
                <Building2 className="w-3.5 h-3.5" />
                <span>Multi-Tenant Master Entity</span>
              </div>
              <h1 className="text-3xl xl:text-4xl font-extrabold text-white tracking-tight leading-tight">
                Platform Admin Portal
              </h1>
              <p className="text-sm text-slate-200 leading-relaxed max-w-lg">
                Manage clinics, oversee provisioned doctors and staff, configure AI Receptionist parameters, and inspect multi-clinic operations in real-time.
              </p>
            </div>

            {/* Real Live Database Metrics Card */}
            <div className="bg-white/10 border border-white/15 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <Server className="w-4 h-4 text-white" />
                  <div>
                    <h4 className="text-xs font-bold text-white">Live Production Database</h4>
                    <p className="text-[11px] text-slate-300">Real-time persistent clinic data</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-xs font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>ONLINE</span>
                </div>
              </div>

              {/* Real Database Metrics */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="text-xl font-bold text-white font-mono">
                    {stats.activeClinics}
                  </div>
                  <div className="text-[11px] text-slate-300 mt-0.5">Active Clinics</div>
                </div>
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="text-xl font-bold text-white font-mono">
                    {stats.totalDoctors}
                  </div>
                  <div className="text-[11px] text-slate-300 mt-0.5">Doctors</div>
                </div>
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <div className="text-xl font-bold text-white font-mono">
                    {stats.totalCalls}
                  </div>
                  <div className="text-[11px] text-slate-300 mt-0.5">AI Calls Recorded</div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-300">
              <KeyRound className="w-4 h-4 text-white shrink-0" />
              <span>Platform Admin credentials have master access to manage all clinic tenants.</span>
            </div>
          </div>

          {/* Right Column: Platform Login Card */}
          <div className="w-full lg:col-span-6 max-w-md mx-auto">
            <div className="bg-white text-[#0A0A0A] border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-xl relative">
              
              <div className="space-y-1.5 mb-6">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-[#0A2540]/10 text-[#0A2540] text-xs font-bold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Platform Root Admin</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[#0A0A0A]">
                  Sign In to Master Platform
                </h2>
                <p className="text-xs text-gray-500 font-medium">
                  Enter authorized credentials to access multi-clinic control.
                </p>
              </div>

              {/* Login Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs font-semibold text-rose-700 flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Email */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                    Admin Email
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@clinicfirst.ai"
                      className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-white border border-gray-300 rounded-lg focus:border-[#0A2540] focus:ring-2 focus:ring-[#0A2540]/15 text-[#0A0A0A] placeholder-gray-400 outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full pl-10 pr-10 py-2.5 text-sm bg-white border border-gray-300 rounded-lg focus:border-[#0A2540] focus:ring-2 focus:ring-[#0A2540]/15 text-[#0A0A0A] placeholder-gray-400 outline-none transition-all font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 cursor-pointer"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Submit Action */}
                <div className="pt-2">
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    className="w-full bg-[#0A2540] hover:bg-[#081d32] text-white shadow-sm font-bold text-sm py-2.5 cursor-pointer"
                    loading={loading}
                    icon={<ArrowRight className="w-4 h-4" />}
                  >
                    Enter Platform Dashboard
                  </Button>
                </div>
              </form>

              {/* Demo Account Fill Helper Chip */}
              <div className="mt-5 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    setEmail('admin@clinicfirst.ai');
                    setPassword('PlatformAdmin2026!');
                  }}
                  className="w-full text-left p-2.5 rounded-lg bg-gray-50 border border-gray-200 hover:border-[#0A2540] text-xs text-[#0A0A0A] transition-all flex items-center justify-between cursor-pointer"
                >
                  <div>
                    <span className="font-semibold block text-[#0A0A0A]">Fill Platform Admin Credentials</span>
                    <span className="text-[11px] text-gray-500">admin@clinicfirst.ai</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-[#0A2540] px-2 py-0.5 bg-white border border-gray-200 rounded">
                    Auto-Fill
                  </span>
                </button>
              </div>

              {/* Back to Clinic Login */}
              <div className="mt-4 pt-3 text-center">
                <button
                  type="button"
                  id="switch-to-clinic-btn"
                  onClick={switchPortal}
                  className="text-xs text-[#0A2540] hover:underline font-semibold cursor-pointer py-1 px-2"
                >
                  ← Return to Clinic Staff & Admin Login
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 border-t border-white/10 flex items-center justify-between text-xs text-slate-300 z-10">
        <span>CLINICFIRST Multi-Tenant SaaS Platform</span>
        <span className="hidden sm:inline">Platform Administrator Portal</span>
      </footer>
    </div>
  );
};



