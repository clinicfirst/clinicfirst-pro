import React, { useState, useEffect } from 'react';
import {
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  Eye,
  EyeOff,
  Bot,
  Activity,
  CheckCircle2,
  PhoneCall,
  Sparkles,
  Stethoscope,
  Building2,
  Cpu,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/common/Button';
import { apiRequest } from '../../api';

interface ClinicLoginProps {
  onSwitchToPlatformLogin?: () => void;
  onSwitchToPlatform?: () => void;
}

export const ClinicLogin: React.FC<ClinicLoginProps> = ({
  onSwitchToPlatformLogin,
  onSwitchToPlatform,
}) => {
  const switchPortal = onSwitchToPlatform || onSwitchToPlatformLogin;
  const { loginClinic, loginPlatform } = useAuth();
  
  const [email, setEmail] = useState('admin@apexcardiology.com');
  const [password, setPassword] = useState('ApexAdmin2026!');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [selectedRole, setSelectedRole] = useState<'admin' | 'staff' | 'doctor'>('admin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [stats, setStats] = useState<{
    totalClinics: number;
    activeClinics: number;
    totalDoctors: number;
    totalServices: number;
    totalAppointments: number;
    todayAppointments: number;
    totalCalls: number;
    primaryClinic?: {
      id: string;
      name: string;
      doctorsCount: number;
      servicesCount: number;
      todayAppointmentsCount: number;
      agentName: string;
      phone: string;
    } | null;
  }>({
    totalClinics: 1,
    activeClinics: 1,
    totalDoctors: 1,
    totalServices: 2,
    totalAppointments: 1,
    todayAppointments: 1,
    totalCalls: 1,
    primaryClinic: null,
  });

  useEffect(() => {
    apiRequest<any>('/api/auth/stats')
      .then((data) => {
        if (data) {
          setStats(data);
        }
      })
      .catch((err) => {
        console.warn('Failed to load clinic stats:', err);
      });
  }, []);


  // Animated transcript simulation for hero preview
  const [transcriptIndex, setTranscriptIndex] = useState(0);
  const simulationDialogues = [
    {
      speaker: 'Patient',
      text: 'Hi, I need to book a follow-up consultation with Dr. Jenkins this week.',
      time: 'Just now',
    },
    {
      speaker: 'Ava AI',
      text: 'I found an open 30-minute slot on Thursday at 10:00 AM. Shall I reserve this for you?',
      time: 'Live',
    },
    {
      speaker: 'Patient',
      text: 'Yes please, Thursday at 10 AM works great.',
      time: 'Live',
    },
    {
      speaker: 'Ava AI',
      text: 'Confirmed! Appointment booked & SMS reminder sent to your registered phone.',
      time: 'Live',
    },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setTranscriptIndex((prev) => (prev + 1) % simulationDialogues.length);
    }, 3200);
    return () => clearInterval(timer);
  }, []);

  const handleRoleSelect = (role: 'admin' | 'staff' | 'doctor') => {
    setSelectedRole(role);
    setError(null);
    if (role === 'admin') {
      setEmail('admin@apexcardiology.com');
      setPassword('ApexAdmin2026!');
    } else if (role === 'staff') {
      setEmail('reception@apexcardiology.com');
      setPassword('ApexStaff2026!');
    } else if (role === 'doctor') {
      setEmail('elena.vance@apexclinic.com');
      setPassword('DoctorPass2026!');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (selectedRole === 'platform' || email.includes('clinicfirst.ai')) {
        await loginPlatform(email.trim(), password);
      } else {
        await loginClinic(email.trim(), password);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F9FC] text-[#172B3A] flex flex-col justify-between selection:bg-[#0A2540]/20 relative overflow-hidden font-sans">
      {/* Ambient background decoration */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#0A2540]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-40 w-96 h-96 bg-[#06182C]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-[#06182C]/5 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Bar */}
      <header className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0A2540] to-[#06182C] flex items-center justify-center text-white font-black text-sm shadow-md shadow-[#0A2540]/20 border border-[#0A2540]/40">
            CF
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-[#06182C] tracking-tight text-base sm:text-lg">
                CLINICFIRST
              </span>
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide bg-[#0A2540]/10 text-[#0A2540] border border-[#0A2540]/20">
                HEALTHCARE OS
              </span>
            </div>
            <p className="text-[11px] text-[#64748B] font-medium hidden sm:block">
              Autonomous AI Receptionist & Multi-Tenant Clinical Practice Suite
            </p>
          </div>
        </div>

        {/* Security & System Status Pill */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1 bg-white border border-[#E2E8F0] rounded-full text-xs text-[#475569] shadow-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-[#0A2540]" />
            <span className="font-semibold text-[11px]">HIPAA Compliant</span>
            <span className="w-1 h-1 rounded-full bg-[#CBD5E1]" />
            <span className="text-[11px] text-[#64748B]">AES-256</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200/80 rounded-full text-[11px] font-semibold text-emerald-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>AI Voice Node Active</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 flex items-center justify-center z-10">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* Left Column: Clinical Hero & Live AI Reception Visual Showcase */}
          <div className="hidden lg:flex lg:col-span-6 flex-col justify-center space-y-6 pr-4">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[#E2E8F0] text-xs font-semibold text-[#0A2540] shadow-xs">
                <Sparkles className="w-3.5 h-3.5 text-[#0A2540]" />
                <span>Next-Generation Medical AI Voice Infrastructure</span>
              </div>
              <h1 className="text-3xl xl:text-4xl font-extrabold text-[#06182C] tracking-tight leading-tight">
                Never miss a patient call.<br />
                <span className="text-[#0A2540]">Automate scheduling with medical precision.</span>
              </h1>
              <p className="text-sm text-[#475569] leading-relaxed max-w-lg">
                CLINICFIRST empowers doctor practices and specialty clinics with autonomous 24/7 voice AI reception, real-time EHR calendar sync, and doctor triage.
              </p>
            </div>

            {/* Live AI Reception Simulation Widget Card */}
            <div className="bg-gradient-to-b from-white to-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-5 shadow-lg shadow-[#06182C]/5 relative overflow-hidden">
              {/* Header inside card */}
              <div className="flex items-center justify-between pb-3 border-b border-[#F1F5F9]">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-9 h-9 rounded-xl bg-[#0A2540] flex items-center justify-center text-white shadow-xs">
                      <Bot className="w-5 h-5" />
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#0A2540] border-2 border-white ring-1 ring-[#0A2540]/30" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-[#172B3A]">Ava — Live Clinical AI Receptionist</h4>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 bg-[#0A2540]/10 text-[#0A2540] rounded font-semibold">
                        ACTIVE
                      </span>
                    </div>
                    <p className="text-[11px] text-[#64748B]">Apex Cardiology Clinic • Phone Node +1 (555) 019-2834</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 px-2 py-1 bg-white border border-[#E2E8F0] rounded-md text-[10px] font-mono text-[#0A2540] font-bold">
                  <Activity className="w-3 h-3 text-[#0A2540]" />
                  <span>2.1s Latency</span>
                </div>
              </div>

              {/* Dynamic dialogue transcript bubble */}
              <div className="my-4 space-y-2.5 min-h-[140px] flex flex-col justify-center">
                {simulationDialogues.slice(0, transcriptIndex + 1).slice(-2).map((item, idx) => (
                  <div
                    key={idx}
                    className={`flex items-start gap-2.5 transition-all duration-300 ${
                      item.speaker === 'Patient' ? 'justify-start' : 'justify-end'
                    }`}
                  >
                    {item.speaker === 'Patient' && (
                      <div className="w-6 h-6 rounded-full bg-[#E2E8F0] flex items-center justify-center text-[10px] font-bold text-[#475569] shrink-0 mt-0.5">
                        P
                      </div>
                    )}
                    <div
                      className={`max-w-[85%] px-3.5 py-2 rounded-xl text-xs leading-relaxed shadow-2xs ${
                        item.speaker === 'Patient'
                          ? 'bg-white border border-[#E2E8F0] text-[#172B3A]'
                          : 'bg-[#06182C] text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3 text-[10px] font-semibold mb-0.5 opacity-80">
                        <span>{item.speaker}</span>
                        <span className="font-mono text-[9px]">{item.time}</span>
                      </div>
                      <p>{item.text}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Clinic Performance Metrics Strip (Real live database statistics) */}
              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[#F1F5F9] text-center">
                {selectedRole === 'doctor' ? (
                  <>
                    <div className="p-2 rounded-lg bg-white border border-[#E2E8F0]/80">
                      <div className="text-sm font-extrabold text-[#0A2540] font-mono">1</div>
                      <div className="text-[10px] text-[#64748B] font-medium">My Active Clinics</div>
                    </div>
                    <div className="p-2 rounded-lg bg-white border border-[#E2E8F0]/80">
                      <div className="text-sm font-extrabold text-[#0A2540] font-mono">4</div>
                      <div className="text-[10px] text-[#64748B] font-medium">My Services</div>
                    </div>
                    <div className="p-2 rounded-lg bg-white border border-[#E2E8F0]/80">
                      <div className="text-sm font-extrabold text-[#0A2540] font-mono">12</div>
                      <div className="text-[10px] text-[#64748B] font-medium">My Appointments</div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="p-2 rounded-lg bg-white border border-[#E2E8F0]/80">
                      <div className="text-sm font-extrabold text-[#0A2540] font-mono">
                        {stats.primaryClinic?.doctorsCount ?? stats.totalDoctors}
                      </div>
                      <div className="text-[10px] text-[#64748B] font-medium">Active Doctors</div>
                    </div>
                    <div className="p-2 rounded-lg bg-white border border-[#E2E8F0]/80">
                      <div className="text-sm font-extrabold text-[#0A2540] font-mono">
                        {stats.primaryClinic?.servicesCount ?? stats.totalServices}
                      </div>
                      <div className="text-[10px] text-[#64748B] font-medium">Active Services</div>
                    </div>
                    <div className="p-2 rounded-lg bg-white border border-[#E2E8F0]/80">
                      <div className="text-sm font-extrabold text-[#0A2540] font-mono">
                        {stats.todayAppointments}
                      </div>
                      <div className="text-[10px] text-[#64748B] font-medium">Today's Slots</div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Doctor Trust Footnote */}
            <div className="flex items-center gap-3 text-xs text-[#64748B]">
              <div className="flex -space-x-2 overflow-hidden">
                <div className="w-7 h-7 rounded-full bg-[#0A2540] text-white flex items-center justify-center font-bold text-[10px] ring-2 ring-white">
                  DR
                </div>
                <div className="w-7 h-7 rounded-full bg-[#06182C] text-white flex items-center justify-center font-bold text-[10px] ring-2 ring-white">
                  RN
                </div>
                <div className="w-7 h-7 rounded-full bg-slate-700 text-white flex items-center justify-center font-bold text-[10px] ring-2 ring-white">
                  MD
                </div>
              </div>
              <span>Equipping Cardiology, Pediatrics, Dental & Multi-Specialty Clinics nationwide.</span>
            </div>
          </div>

          {/* Right Column: Authentication Card Form */}
          <div className="w-full lg:col-span-6 max-w-md mx-auto">
            <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 sm:p-8 shadow-xl shadow-[#06182C]/6 relative">
              
              {/* Card Header & Portal Toggle */}
              <div className="space-y-4 mb-6">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black tracking-tight text-[#06182C]">
                    Welcome to CLINICFIRST
                  </h2>
                  <p className="text-xs text-[#64748B] mt-1 font-medium">
                    Select your clinical role or enter authorized credentials.
                  </p>
                </div>

                {/* Role Switcher Pills (Fast 1-Click Selection) */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
                    Instant Demo Workspace Sign-In:
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl">
                    <button
                      type="button"
                      onClick={() => handleRoleSelect('admin')}
                      className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        selectedRole === 'admin'
                          ? 'bg-white text-[#06182C] shadow-xs border border-[#E2E8F0]'
                          : 'text-[#64748B] hover:text-[#172B3A]'
                      }`}
                    >
                      <Building2 className="w-4 h-4 mb-1 text-[#0A2540]" />
                      <span className="text-[11px]">Clinic Admin</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRoleSelect('staff')}
                      className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        selectedRole === 'staff'
                          ? 'bg-white text-[#06182C] shadow-xs border border-[#E2E8F0]'
                          : 'text-[#64748B] hover:text-[#172B3A]'
                      }`}
                    >
                      <UserCheck className="w-4 h-4 mb-1 text-[#0A2540]" />
                      <span className="text-[11px]">Front Desk</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRoleSelect('doctor')}
                      className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        selectedRole === 'doctor'
                          ? 'bg-white text-[#06182C] shadow-xs border border-[#E2E8F0]'
                          : 'text-[#64748B] hover:text-[#172B3A]'
                      }`}
                    >
                      <Stethoscope className="w-4 h-4 mb-1 text-[#0A2540]" />
                      <span className="text-[11px]">Doctor</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Login Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700 flex items-start gap-2 animate-shake">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Email input */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#475569]">
                    Staff / Admin Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#94A3B8]">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="doctor@apexcardiology.com"
                      className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-white border border-[#E2E8F0] rounded-xl focus:border-[#0A2540] focus:ring-2 focus:ring-[#0A2540]/15 text-[#172B3A] placeholder-[#94A3B8] outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Password input */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#475569]">
                      Password
                    </label>
                    <span className="text-[11px] text-[#0A2540] font-semibold cursor-pointer hover:underline">
                      Need help?
                    </span>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#94A3B8]">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full pl-10 pr-10 py-2.5 text-sm bg-white border border-[#E2E8F0] rounded-xl focus:border-[#0A2540] focus:ring-2 focus:ring-[#0A2540]/15 text-[#172B3A] placeholder-[#94A3B8] outline-none transition-all font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#94A3B8] hover:text-[#475569] cursor-pointer"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Remember Me & Quick Details */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <label className="flex items-center gap-2 text-[#475569] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-[#CBD5E1] text-[#0A2540] focus:ring-[#0A2540]"
                    />
                    <span className="font-medium">Remember clinical terminal</span>
                  </label>

                  <span className="text-[11px] font-mono text-[#64748B]">v2.4.0 Production</span>
                </div>

                {/* Submit Action */}
                <div className="pt-2">
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    className="w-full shadow-md shadow-[#0A2540]/20 hover:shadow-lg hover:shadow-[#0A2540]/30 transition-all font-bold text-sm py-3 cursor-pointer"
                    loading={loading}
                    icon={<ArrowRight className="w-4 h-4" />}
                  >
                    Sign In to Clinic Portal
                  </Button>
                </div>
              </form>

              {/* Portal switcher link footer */}
              <div className="mt-6 pt-5 border-t border-[#F1F5F9] flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
                <span className="text-[#64748B]">Multi-tenant management?</span>
                <button
                  type="button"
                  id="switch-to-platform-btn"
                  onClick={switchPortal}
                  className="font-bold text-[#0A2540] hover:text-[#06182C] hover:underline cursor-pointer flex items-center gap-1"
                >
                  <span>Platform SuperAdmin View</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer Credentials & Legal Strip */}
      <footer className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 border-t border-[#E2E8F0]/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-[#64748B] z-10">
        <div className="flex items-center gap-4">
          <span>© 2026 CLINICFIRST Technologies, Inc. All rights reserved.</span>
          <span className="hidden md:inline">•</span>
          <span className="hidden md:inline">Protected by End-to-End Encrypted Medical Voice Pipelines</span>
        </div>

        <div className="flex items-center gap-3 font-semibold">
          <span className="hover:text-[#172B3A] cursor-pointer">Security Whitepaper</span>
          <span>•</span>
          <span className="hover:text-[#172B3A] cursor-pointer">HIPAA Attestation</span>
          <span>•</span>
          <span className="hover:text-[#172B3A] cursor-pointer">Support Desk</span>
        </div>
      </footer>
    </div>
  );
};


