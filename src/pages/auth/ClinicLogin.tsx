import React, { useState, useEffect } from 'react';
import {
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  Eye,
  EyeOff,
  Building2,
  Stethoscope,
  PhoneCall,
  Calendar,
  Sparkles,
  Zap,
  Users,
  Globe,
  Bot,
  Activity,
  UserCheck,
  Star,
  Quote,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/common/Button';
import { ClinicLogo } from '../../components/common/ClinicLogo';
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
  const [selectedRole, setSelectedRole] = useState<'admin' | 'staff' | 'doctor' | 'platform'>('admin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(true);

  const [stats, setStats] = useState<{
    totalClinics: number;
    activeClinics: number;
    totalDoctors: number;
    todayAppointments: number;
    totalCalls: number;
    primaryClinic?: {
      name: string;
      doctorsCount: number;
      servicesCount: number;
    };
  }>({
    totalClinics: 0,
    activeClinics: 0,
    totalDoctors: 0,
    todayAppointments: 0,
    totalCalls: 0,
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
            primaryClinic: data.primaryClinic,
          });
        }
      })
      .catch((err) => {
        console.warn('Failed to load clinic stats:', err);
      });
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
    <div className="min-h-screen bg-white text-[#0F172A] flex flex-col justify-between selection:bg-blue-500/20 relative font-sans">
      {/* Top Header Bar */}
      <header className="w-full px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between border-b border-[#E2E8F0]/80">
        <ClinicLogo size="md" />

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-slate-50 border border-[#E2E8F0] rounded-full text-xs text-[#64748B]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#0052FF]" />
            <span className="font-semibold text-[#0F172A]">HIPAA Ready</span>
            <span className="text-slate-300">•</span>
            <span>AES-256</span>
          </div>

          <button
            onClick={switchPortal}
            className="text-xs font-bold text-[#0052FF] hover:text-blue-700 px-3 py-1.5 rounded-xl border border-blue-100 hover:bg-blue-50 transition-colors"
          >
            Platform Master
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 flex items-center justify-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          
          {/* Left Column: Hero & Value Proposition */}
          <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-xs font-bold text-[#0052FF] w-fit">
              <Sparkles className="w-3.5 h-3.5 text-[#00C2CB]" />
              <span>24/7 AI-Powered Receptionist for Modern Clinics</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#0F172A] tracking-tight leading-[1.15]">
              Never Miss a Call. Never Miss an{' '}
              <span className="text-[#00C2CB]">Appointment.</span>
            </h1>

            <p className="text-sm sm:text-base text-[#64748B] leading-relaxed max-w-lg">
              Our intelligent AI receptionist answers every patient call instantly, schedules appointments into your calendar, answers queries, and transfers urgent cases — 24 hours a day, 7 days a week.
            </p>

            {/* Feature Badges */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-[#E2E8F0] text-xs font-semibold text-[#0F172A]">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                24/7 Call Handling
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-[#E2E8F0] text-xs font-semibold text-[#0F172A]">
                <Calendar className="w-3.5 h-3.5 text-[#0052FF]" />
                Smart Booking
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-[#E2E8F0] text-xs font-semibold text-[#0F172A]">
                <Users className="w-3.5 h-3.5 text-purple-600" />
                Patient Friendly
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-[#E2E8F0] text-xs font-semibold text-[#0F172A]">
                <Globe className="w-3.5 h-3.5 text-[#00C2CB]" />
                Multi-language
              </span>
            </div>

            {/* Testimonial Quote */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-[#E2E8F0] relative">
              <Quote className="w-6 h-6 text-[#00C2CB]/30 absolute top-3 right-3" />
              <p className="text-xs text-[#334155] italic leading-relaxed">
                "Clinic-1st has cut our missed calls to zero. Our front desk is no longer overwhelmed, and patients love the instant booking."
              </p>
              <div className="mt-2.5 flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-[#0052FF] text-white text-[10px] font-bold flex items-center justify-center">
                  RM
                </div>
                <div>
                  <span className="text-xs font-bold text-[#0F172A]">Dr. Rajesh Mehta</span>
                  <span className="text-[10px] text-[#64748B] block">Founder, Apex Health</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Clean Authentication Form */}
          <div className="w-full lg:col-span-6 max-w-md mx-auto">
            <div className="bg-white border border-[#E2E8F0] rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-900/5">
              
              {/* Header */}
              <div className="space-y-4 mb-6">
                <div>
                  <h2 className="text-xl sm:text-2xl font-extrabold text-[#0F172A] tracking-tight">
                    Clinic Sign In
                  </h2>
                  <p className="text-xs text-[#64748B] mt-1">
                    Select a preset role or sign in with your credentials.
                  </p>
                </div>

                {/* Instant Role Switcher */}
                <div className="space-y-1.5">
                  <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-50 border border-[#E2E8F0] rounded-xl">
                    <button
                      type="button"
                      onClick={() => handleRoleSelect('admin')}
                      className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        selectedRole === 'admin'
                          ? 'bg-white text-[#0052FF] shadow-xs border border-[#E2E8F0]'
                          : 'text-[#64748B] hover:text-[#0F172A]'
                      }`}
                    >
                      <Building2 className="w-4 h-4 mb-1 text-[#0052FF]" />
                      <span className="text-[11px]">Clinic Admin</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRoleSelect('staff')}
                      className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        selectedRole === 'staff'
                          ? 'bg-white text-[#0052FF] shadow-xs border border-[#E2E8F0]'
                          : 'text-[#64748B] hover:text-[#0F172A]'
                      }`}
                    >
                      <UserCheck className="w-4 h-4 mb-1 text-[#00C2CB]" />
                      <span className="text-[11px]">Front Desk</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRoleSelect('doctor')}
                      className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        selectedRole === 'doctor'
                          ? 'bg-white text-[#0052FF] shadow-xs border border-[#E2E8F0]'
                          : 'text-[#64748B] hover:text-[#0F172A]'
                      }`}
                    >
                      <Stethoscope className="w-4 h-4 mb-1 text-purple-600" />
                      <span className="text-[11px]">Doctor</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Login Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700">
                    {error}
                  </div>
                )}

                {/* Email */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#475569]">
                    Email Address
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
                      placeholder="admin@apexcardiology.com"
                      className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-white border border-[#E2E8F0] rounded-xl focus:border-[#0052FF] focus:ring-2 focus:ring-blue-500/10 text-[#0F172A] outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#475569]">
                      Password
                    </label>
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
                      className="w-full pl-10 pr-10 py-2.5 text-sm bg-white border border-[#E2E8F0] rounded-xl focus:border-[#0052FF] focus:ring-2 focus:ring-blue-500/10 text-[#0F172A] outline-none transition-all font-mono"
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

                {/* Remember Me */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <label className="flex items-center gap-2 text-[#475569] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-[#CBD5E1] text-[#0052FF] focus:ring-[#0052FF]"
                    />
                    <span className="font-medium">Remember terminal</span>
                  </label>

                  <span className="text-[11px] font-mono text-[#64748B]">v2.4 Production</span>
                </div>

                {/* Submit Action */}
                <div className="pt-2">
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    className="w-full !bg-[#0052FF] hover:!bg-blue-700 font-bold text-sm py-3 cursor-pointer shadow-md shadow-blue-500/20"
                    loading={loading}
                    icon={<ArrowRight className="w-4 h-4" />}
                  >
                    Sign In to Clinic
                  </Button>
                </div>
              </form>

              {/* Platform SuperAdmin Switcher */}
              <div className="mt-6 pt-5 border-t border-[#F1F5F9] flex items-center justify-between text-xs">
                <span className="text-[#64748B]">Multi-tenant administrator?</span>
                <button
                  type="button"
                  id="switch-to-platform-btn"
                  onClick={switchPortal}
                  className="font-bold text-[#0052FF] hover:underline cursor-pointer flex items-center gap-1"
                >
                  <span>Platform Console</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full px-4 sm:px-6 lg:px-8 py-4 border-t border-[#E2E8F0]/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#64748B]">
        <div>
          © 2026 CLINICFIRST Technologies, Inc. All rights reserved.
        </div>
        <div className="flex items-center gap-4 font-semibold text-[#0F172A]">
          <span className="cursor-pointer hover:underline">HIPAA Attestation</span>
          <span>•</span>
          <span className="cursor-pointer hover:underline">Security</span>
          <span>•</span>
          <span className="cursor-pointer hover:underline">Support</span>
        </div>
      </footer>
    </div>
  );
};
