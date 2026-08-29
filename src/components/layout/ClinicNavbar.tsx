import React, { useState, useRef, useEffect } from 'react';
import {
  Calendar,
  Users,
  Stethoscope,
  Settings,
  PhoneCall,
  Bot,
  UserCheck,
  Shield,
  Phone,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Building2,
  Sparkles,
  LayoutDashboard,
  Check,
  Clock,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { can } from '../../lib/permissions';
import { ConfirmModal } from '../common/ConfirmModal';
import { ClinicLogo } from '../common/ClinicLogo';

export type ClinicTab =
  | 'dashboard'
  | 'appointments'
  | 'patients'
  | 'doctors'
  | 'services'
  | 'schedules'
  | 'calls'
  | 'ai_receptionist'
  | 'staff'
  | 'audit_logs';

interface ClinicNavbarProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  onOpenSimulator?: () => void;
}

type DropdownId = 'patients' | 'doctors' | 'settings' | 'user' | null;

export const ClinicNavbar: React.FC<ClinicNavbarProps> = ({
  activeTab,
  onSelectTab,
  onOpenSimulator,
}) => {
  const { user, clinic, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<DropdownId>(null);
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);

  const navContainerRef = useRef<HTMLDivElement | null>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (navContainerRef.current && !navContainerRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleDropdown = (id: DropdownId) => {
    setActiveDropdown((prev) => (prev === id ? null : id));
  };

  const handleSelect = (tab: ClinicTab) => {
    onSelectTab(tab);
    setActiveDropdown(null);
    setMobileMenuOpen(false);
  };

  // Group definitions
  const patientItems: Array<{
    id: ClinicTab;
    label: string;
    description: string;
    icon: React.ReactNode;
    show: boolean;
  }> = [
    {
      id: 'appointments',
      label: 'Appointments',
      description: 'Calendar, bookings & rescheduling',
      icon: <Calendar className="w-4 h-4 text-[#0052FF]" />,
      show: can(user, 'view_appointments'),
    },
    {
      id: 'patients',
      label: 'Patient Directory',
      description: 'Profiles, medical history & contacts',
      icon: <Users className="w-4 h-4 text-emerald-600" />,
      show: can(user, 'view_patients'),
    },
    {
      id: 'calls',
      label: 'Call Records',
      description: 'Inbound calls & AI transcripts',
      icon: <PhoneCall className="w-4 h-4 text-cyan-600" />,
      show: can(user, 'view_calls'),
    },
  ];

  const doctorItems: Array<{
    id: ClinicTab;
    label: string;
    description: string;
    icon: React.ReactNode;
    show: boolean;
  }> = [
    {
      id: 'doctors',
      label: 'Physician Directory',
      description: 'Doctors, specialties & fees',
      icon: <Stethoscope className="w-4 h-4 text-[#0052FF]" />,
      show: can(user, 'view_doctors'),
    },
    {
      id: 'schedules',
      label: 'Schedules & Leaves',
      description: 'Weekly shifts & leave blocking',
      icon: <Clock className="w-4 h-4 text-indigo-600" />,
      show: can(user, 'view_schedules'),
    },
    {
      id: 'services',
      label: 'Clinical Services',
      description: 'Procedures, durations & pricing',
      icon: <Sparkles className="w-4 h-4 text-amber-600" />,
      show: can(user, 'view_services'),
    },
  ];

  const settingItems: Array<{
    id: ClinicTab;
    label: string;
    description: string;
    icon: React.ReactNode;
    show: boolean;
  }> = [
    {
      id: 'staff',
      label: 'Staff & Roles',
      description: 'Practice staff & permissions',
      icon: <UserCheck className="w-4 h-4 text-[#0052FF]" />,
      show: can(user, 'view_staff'),
    },
    {
      id: 'audit_logs',
      label: 'Security Audit Trail',
      description: 'System actions & compliance logs',
      icon: <Shield className="w-4 h-4 text-slate-700" />,
      show: can(user, 'view_audit_logs'),
    },
  ];

  const visiblePatientItems = patientItems.filter((i) => i.show);
  const visibleDoctorItems = doctorItems.filter((i) => i.show);
  const visibleSettingItems = settingItems.filter((i) => i.show);

  // Active state determinations
  const isPatientGroupActive = visiblePatientItems.some((i) => i.id === activeTab);
  const isDoctorGroupActive = visibleDoctorItems.some((i) => i.id === activeTab);
  const isSettingGroupActive = visibleSettingItems.some((i) => i.id === activeTab);
  const isDashboardActive = activeTab === 'dashboard';
  const isAiReceptionistActive = activeTab === 'ai_receptionist';

  // Selected item labels for dynamic button hints
  const activePatientItem = visiblePatientItems.find((i) => i.id === activeTab);
  const activeDoctorItem = visibleDoctorItems.find((i) => i.id === activeTab);
  const activeSettingItem = visibleSettingItems.find((i) => i.id === activeTab);

  return (
    <>
      <header className="bg-white border-b border-[#E2E8F0] sticky top-0 z-30 w-full shadow-xs">
        <div className="w-full px-4 sm:px-6 lg:px-8" ref={navContainerRef}>
          <div className="flex justify-between items-center h-16 gap-3 sm:gap-6 w-full">
            
            {/* Left: Brand Logo & Clinic Tag */}
            <div className="flex items-center gap-3 shrink-0">
              <div
                className="cursor-pointer select-none shrink-0"
                onClick={() => handleSelect('dashboard')}
                title="CLINICFIRST Dashboard"
              >
                <ClinicLogo size="md" />
              </div>

              {clinic && (
                <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-xl border border-[#E2E8F0] bg-slate-50/90 text-xs font-medium text-[#0F172A] shrink-0">
                  <Building2 className="w-3.5 h-3.5 text-[#0052FF] shrink-0" />
                  <span className="truncate max-w-[150px] font-semibold">{clinic.name}</span>
                </div>
              )}
            </div>

            {/* Center: Clean Grouped Desktop Navigation */}
            <nav className="hidden lg:flex items-center space-x-1.5 shrink-0">
              
              {/* 1. Dashboard (Direct Tab) */}
              <button
                onClick={() => handleSelect('dashboard')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all duration-150 cursor-pointer shrink-0 select-none ${
                  isDashboardActive
                    ? 'bg-blue-50 text-[#0052FF] border border-blue-200/80 shadow-2xs'
                    : 'text-[#64748B] hover:text-[#0F172A] hover:bg-slate-50 border border-transparent'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Dashboard</span>
              </button>

              {/* 2. Patients Group Dropdown */}
              {visiblePatientItems.length > 0 && (
                <div className="relative shrink-0">
                  <button
                    onClick={() => toggleDropdown('patients')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all duration-150 cursor-pointer shrink-0 select-none ${
                      isPatientGroupActive || activeDropdown === 'patients'
                        ? 'bg-blue-50 text-[#0052FF] border border-blue-200/80 shadow-2xs'
                        : 'text-[#64748B] hover:text-[#0F172A] hover:bg-slate-50 border border-transparent'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>
                      {isPatientGroupActive && activePatientItem
                        ? activePatientItem.label
                        : 'Patients'}
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform duration-200 ${
                        activeDropdown === 'patients' ? 'rotate-180 text-[#0052FF]' : 'text-[#94A3B8]'
                      }`}
                    />
                  </button>

                  {/* Dropdown Menu */}
                  {activeDropdown === 'patients' && (
                    <div className="absolute left-0 mt-2 w-72 bg-white border border-[#E2E8F0] rounded-2xl shadow-xl p-2 z-50 animate-fade-enter">
                      <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                        Patient Management
                      </div>
                      <div className="space-y-1">
                        {visiblePatientItems.map((item) => {
                          const isItemActive = activeTab === item.id;
                          return (
                            <button
                              key={item.id}
                              onClick={() => handleSelect(item.id)}
                              className={`w-full flex items-start gap-3 p-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                                isItemActive
                                  ? 'bg-blue-50/80 border border-blue-100'
                                  : 'hover:bg-slate-50 border border-transparent'
                              }`}
                            >
                              <div className="p-1.5 rounded-lg bg-slate-100 shrink-0 mt-0.5">
                                {item.icon}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <span
                                    className={`text-xs font-bold truncate ${
                                      isItemActive ? 'text-[#0052FF]' : 'text-[#0F172A]'
                                    }`}
                                  >
                                    {item.label}
                                  </span>
                                  {isItemActive && <Check className="w-3.5 h-3.5 text-[#0052FF]" />}
                                </div>
                                <p className="text-[11px] text-[#64748B] line-clamp-1">
                                  {item.description}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 3. Doctors Group Dropdown */}
              {visibleDoctorItems.length > 0 && (
                <div className="relative shrink-0">
                  <button
                    onClick={() => toggleDropdown('doctors')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all duration-150 cursor-pointer shrink-0 select-none ${
                      isDoctorGroupActive || activeDropdown === 'doctors'
                        ? 'bg-blue-50 text-[#0052FF] border border-blue-200/80 shadow-2xs'
                        : 'text-[#64748B] hover:text-[#0F172A] hover:bg-slate-50 border border-transparent'
                    }`}
                  >
                    <Stethoscope className="w-3.5 h-3.5" />
                    <span>
                      {isDoctorGroupActive && activeDoctorItem
                        ? activeDoctorItem.label
                        : 'Doctors'}
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform duration-200 ${
                        activeDropdown === 'doctors' ? 'rotate-180 text-[#0052FF]' : 'text-[#94A3B8]'
                      }`}
                    />
                  </button>

                  {/* Dropdown Menu */}
                  {activeDropdown === 'doctors' && (
                    <div className="absolute left-0 mt-2 w-72 bg-white border border-[#E2E8F0] rounded-2xl shadow-xl p-2 z-50 animate-fade-enter">
                      <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                        Clinical & Physicians
                      </div>
                      <div className="space-y-1">
                        {visibleDoctorItems.map((item) => {
                          const isItemActive = activeTab === item.id;
                          return (
                            <button
                              key={item.id}
                              onClick={() => handleSelect(item.id)}
                              className={`w-full flex items-start gap-3 p-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                                isItemActive
                                  ? 'bg-blue-50/80 border border-blue-100'
                                  : 'hover:bg-slate-50 border border-transparent'
                              }`}
                            >
                              <div className="p-1.5 rounded-lg bg-slate-100 shrink-0 mt-0.5">
                                {item.icon}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <span
                                    className={`text-xs font-bold truncate ${
                                      isItemActive ? 'text-[#0052FF]' : 'text-[#0F172A]'
                                    }`}
                                  >
                                    {item.label}
                                  </span>
                                  {isItemActive && <Check className="w-3.5 h-3.5 text-[#0052FF]" />}
                                </div>
                                <p className="text-[11px] text-[#64748B] line-clamp-1">
                                  {item.description}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 4. AI Receptionist (Hero Direct Tab with AI Badge) */}
              {can(user, 'view_ai_receptionist') && (
                <button
                  onClick={() => handleSelect('ai_receptionist')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all duration-150 cursor-pointer shrink-0 select-none ${
                    isAiReceptionistActive
                      ? 'bg-blue-50 text-[#0052FF] border border-blue-200/80 shadow-2xs'
                      : 'text-[#64748B] hover:text-[#0F172A] hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  <Bot className="w-3.5 h-3.5" />
                  <span>AI Receptionist</span>
                  <span className="text-[10px] font-bold bg-cyan-100 text-cyan-800 px-1.5 py-0.5 rounded leading-none">
                    AI
                  </span>
                </button>
              )}

              {/* 5. Settings Group Dropdown */}
              {visibleSettingItems.length > 0 && (
                <div className="relative shrink-0">
                  <button
                    onClick={() => toggleDropdown('settings')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all duration-150 cursor-pointer shrink-0 select-none ${
                      isSettingGroupActive || activeDropdown === 'settings'
                        ? 'bg-blue-50 text-[#0052FF] border border-blue-200/80 shadow-2xs'
                        : 'text-[#64748B] hover:text-[#0F172A] hover:bg-slate-50 border border-transparent'
                    }`}
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>
                      {isSettingGroupActive && activeSettingItem
                        ? activeSettingItem.label
                        : 'Settings'}
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform duration-200 ${
                        activeDropdown === 'settings' ? 'rotate-180 text-[#0052FF]' : 'text-[#94A3B8]'
                      }`}
                    />
                  </button>

                  {/* Dropdown Menu */}
                  {activeDropdown === 'settings' && (
                    <div className="absolute right-0 xl:left-0 mt-2 w-72 bg-white border border-[#E2E8F0] rounded-2xl shadow-xl p-2 z-50 animate-fade-enter">
                      <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                        Practice Administration
                      </div>
                      <div className="space-y-1">
                        {visibleSettingItems.map((item) => {
                          const isItemActive = activeTab === item.id;
                          return (
                            <button
                              key={item.id}
                              onClick={() => handleSelect(item.id)}
                              className={`w-full flex items-start gap-3 p-2.5 rounded-xl text-left transition-colors cursor-pointer ${
                                isItemActive
                                  ? 'bg-blue-50/80 border border-blue-100'
                                  : 'hover:bg-slate-50 border border-transparent'
                              }`}
                            >
                              <div className="p-1.5 rounded-lg bg-slate-100 shrink-0 mt-0.5">
                                {item.icon}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <span
                                    className={`text-xs font-bold truncate ${
                                      isItemActive ? 'text-[#0052FF]' : 'text-[#0F172A]'
                                    }`}
                                  >
                                    {item.label}
                                  </span>
                                  {isItemActive && <Check className="w-3.5 h-3.5 text-[#0052FF]" />}
                                </div>
                                <p className="text-[11px] text-[#64748B] line-clamp-1">
                                  {item.description}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </nav>

            {/* Right: Quick Action, User Profile Dropdown, Standalone Logout */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              
              {/* Test AI Call Button */}
              {onOpenSimulator && (
                <button
                  onClick={onOpenSimulator}
                  className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-[#0052FF] text-xs font-semibold border border-blue-200 transition-colors cursor-pointer shrink-0 select-none"
                  title="Open live AI Voice Call Simulator"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Test AI Call</span>
                </button>
              )}

              {/* User Profile Trigger & Dropdown Menu */}
              <div className="relative shrink-0">
                <button
                  onClick={() => toggleDropdown('user')}
                  className="flex items-center gap-2 p-1 sm:px-2 sm:py-1 rounded-xl hover:bg-slate-100 transition-all border border-transparent hover:border-[#E2E8F0] cursor-pointer shrink-0"
                  title="User profile & clinic account"
                  aria-label="Open user menu"
                >
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-[#0052FF] font-bold flex items-center justify-center text-xs shrink-0 ring-2 ring-blue-500/20">
                    {user?.name?.charAt(0) || 'U'}
                  </div>
                  <div className="hidden xl:flex flex-col text-left">
                    <span className="text-xs font-bold text-[#0F172A] tracking-tight truncate max-w-[120px]">
                      {user?.name}
                    </span>
                    <span className="text-[10px] text-[#64748B] font-medium">
                      {user?.role === 'CLINIC_ADMIN' ? 'Clinic Admin' : 'Staff'}
                    </span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-[#64748B] hidden sm:block" />
                </button>

                {/* Dropdown Card */}
                {activeDropdown === 'user' && (
                  <div className="absolute right-0 mt-2 w-64 bg-white border border-[#E2E8F0] rounded-2xl shadow-xl py-2 z-50 animate-fade-enter">
                    {/* User Header */}
                    <div className="px-4 py-3 border-b border-[#F1F5F9] bg-slate-50/50 rounded-t-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 text-[#0052FF] font-bold flex items-center justify-center text-sm ring-2 ring-blue-500/20">
                          {user?.name?.charAt(0) || 'U'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-[#0F172A] truncate">{user?.name}</p>
                          <p className="text-[11px] text-[#64748B] truncate">{user?.email || 'Authenticated User'}</p>
                          <div className="mt-1">
                            <span className="inline-block px-2 py-0.5 text-[9px] font-bold rounded-full bg-blue-50 text-[#0052FF] border border-blue-100">
                              {user?.role === 'CLINIC_ADMIN' ? 'Clinic Admin' : 'Clinic Staff'}
                            </span>
                          </div>
                        </div>
                      </div>
                      {clinic && (
                        <div className="mt-2 pt-2 border-t border-[#E2E8F0] flex items-center gap-1.5 text-[11px] text-[#475569] font-medium">
                          <Building2 className="w-3.5 h-3.5 text-[#0052FF] shrink-0" />
                          <span className="truncate">{clinic.name}</span>
                        </div>
                      )}
                    </div>

                    {/* Quick Menu Actions */}
                    <div className="py-1">
                      <button
                        onClick={() => handleSelect('staff')}
                        className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-[#0F172A] hover:bg-slate-50 transition-colors"
                      >
                        <UserCheck className="w-4 h-4 text-[#64748B]" />
                        <span>Practice Staff & Roles</span>
                      </button>

                      <button
                        onClick={() => handleSelect('ai_receptionist')}
                        className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-[#0F172A] hover:bg-slate-50 transition-colors"
                      >
                        <Bot className="w-4 h-4 text-[#64748B]" />
                        <span>AI Receptionist Setup</span>
                      </button>

                      <button
                        onClick={() => handleSelect('audit_logs')}
                        className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-[#0F172A] hover:bg-slate-50 transition-colors"
                      >
                        <Shield className="w-4 h-4 text-[#64748B]" />
                        <span>Security Audit Trail</span>
                      </button>
                    </div>

                    {/* Prominent Sign Out Button */}
                    <div className="pt-1 border-t border-[#F1F5F9] px-2">
                      <button
                        onClick={() => {
                          setActiveDropdown(null);
                          setConfirmLogoutOpen(true);
                        }}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                      >
                        <LogOut className="w-4 h-4 text-rose-600" />
                        <span>Log Out of Clinic</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Direct Visible Logout Icon Button */}
              <button
                onClick={() => setConfirmLogoutOpen(true)}
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#64748B] hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors border border-transparent hover:border-rose-100 cursor-pointer shrink-0"
                title="Log out of account"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden xl:inline">Logout</span>
              </button>

              {/* Mobile Hamburger Toggle */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded-xl text-[#0F172A] hover:bg-slate-100 cursor-pointer shrink-0"
                aria-label="Toggle navigation menu"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Dropdown Menu Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-[#E2E8F0] px-4 pt-3 pb-6 space-y-4 bg-white max-h-[85vh] overflow-y-auto shadow-xl">
            {/* User Details & Clinic Banner */}
            <div className="p-3 bg-slate-50 border border-[#E2E8F0] rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-full bg-blue-100 text-[#0052FF] font-bold flex items-center justify-center text-xs shrink-0">
                  {user?.name?.charAt(0) || 'U'}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#0F172A] truncate">{user?.name}</p>
                  <p className="text-[10px] text-[#64748B] truncate">{clinic?.name || 'Clinic'}</p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-[#0052FF] border border-blue-100 shrink-0">
                {user?.role === 'CLINIC_ADMIN' ? 'Admin' : 'Staff'}
              </span>
            </div>

            {/* Test AI Call Button for Mobile */}
            {onOpenSimulator && (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenSimulator();
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-[#0052FF] text-xs font-bold rounded-xl border border-blue-200 transition-colors cursor-pointer"
              >
                <Phone className="w-4 h-4" />
                <span>Test AI Receptionist Call</span>
              </button>
            )}

            {/* 1. Dashboard */}
            <div>
              <div className="py-1 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                Overview
              </div>
              <button
                onClick={() => handleSelect('dashboard')}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-medium rounded-xl text-left transition-colors cursor-pointer ${
                  activeTab === 'dashboard'
                    ? 'bg-blue-50 text-[#0052FF] font-bold'
                    : 'text-[#0F172A] hover:bg-slate-50'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Dashboard</span>
              </button>
            </div>

            {/* 2. Patients & Calls Group */}
            <div>
              <div className="py-1 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                Patients & Appointments
              </div>
              <div className="space-y-1">
                {visiblePatientItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item.id)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-medium rounded-xl text-left transition-colors cursor-pointer ${
                      activeTab === item.id
                        ? 'bg-blue-50 text-[#0052FF] font-bold'
                        : 'text-[#0F172A] hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      {item.icon}
                      <span>{item.label}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Doctors & Clinical Group */}
            <div>
              <div className="py-1 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                Doctors & Clinical
              </div>
              <div className="space-y-1">
                {visibleDoctorItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item.id)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-medium rounded-xl text-left transition-colors cursor-pointer ${
                      activeTab === item.id
                        ? 'bg-blue-50 text-[#0052FF] font-bold'
                        : 'text-[#0F172A] hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      {item.icon}
                      <span>{item.label}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 4. AI Receptionist Hero */}
            <div>
              <div className="py-1 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                AI Receptionist
              </div>
              <button
                onClick={() => handleSelect('ai_receptionist')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-medium rounded-xl text-left transition-colors cursor-pointer ${
                  activeTab === 'ai_receptionist'
                    ? 'bg-blue-50 text-[#0052FF] font-bold'
                    : 'text-[#0F172A] hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Bot className="w-4 h-4 text-[#0052FF]" />
                  <span>AI Receptionist Setup</span>
                </div>
                <span className="text-[10px] font-bold bg-cyan-100 text-cyan-800 px-1.5 py-0.5 rounded">
                  AI
                </span>
              </button>
            </div>

            {/* 5. Settings & Operations */}
            <div>
              <div className="py-1 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                Practice Settings
              </div>
              <div className="space-y-1">
                {visibleSettingItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item.id)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs font-medium rounded-xl text-left transition-colors cursor-pointer ${
                      activeTab === item.id
                        ? 'bg-blue-50 text-[#0052FF] font-bold'
                        : 'text-[#0F172A] hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      {item.icon}
                      <span>{item.label}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Mobile Prominent Log Out Button */}
            <div className="pt-3 border-t border-[#E2E8F0]">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  setConfirmLogoutOpen(true);
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold rounded-xl border border-rose-200 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-rose-600" />
                <span>Sign Out / Log Out</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Confirmation Modal for Log Out */}
      <ConfirmModal
        isOpen={confirmLogoutOpen}
        onClose={() => setConfirmLogoutOpen(false)}
        onConfirm={() => {
          setConfirmLogoutOpen(false);
          logout();
        }}
        title="Confirm Logout"
        message="Are you sure you want to log out of CLINICFIRST?"
        confirmText="Yes, Log Out"
        destructive={true}
      />
    </>
  );
};
