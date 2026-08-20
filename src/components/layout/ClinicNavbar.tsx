import React, { useState, useRef, useEffect } from 'react';
import {
  Clock,
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
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { can } from '../../lib/permissions';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';

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

export const ClinicNavbar: React.FC<ClinicNavbarProps> = ({
  activeTab,
  onSelectTab,
  onOpenSimulator,
}) => {
  const { user, clinic, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [manageMenuOpen, setManageMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setManageMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Primary operational tabs (strictly 5 core items in the top bar)
  const primaryNavItems: Array<{ id: ClinicTab; label: string; icon: React.ReactNode; show: boolean }> = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <Clock className="w-4 h-4" />,
      show: true,
    },
    {
      id: 'appointments',
      label: 'Appointments',
      icon: <Calendar className="w-4 h-4" />,
      show: can(user, 'view_appointments'),
    },
    {
      id: 'patients',
      label: 'Patients',
      icon: <Users className="w-4 h-4" />,
      show: can(user, 'view_patients'),
    },
    {
      id: 'doctors',
      label: 'Doctors',
      icon: <Stethoscope className="w-4 h-4" />,
      show: can(user, 'view_doctors'),
    },
    {
      id: 'ai_receptionist',
      label: 'AI Receptionist',
      icon: <Bot className="w-4 h-4" />,
      show: can(user, 'view_ai_receptionist'),
    },
  ];

  // Secondary operational & management tabs (grouped neatly under "More")
  const secondaryNavItems: Array<{ id: ClinicTab; label: string; icon: React.ReactNode; show: boolean }> = [
    {
      id: 'calls',
      label: 'Calls',
      icon: <PhoneCall className="w-4 h-4" />,
      show: can(user, 'view_calls'),
    },
    {
      id: 'schedules',
      label: 'Schedules',
      icon: <Clock className="w-4 h-4" />,
      show: can(user, 'view_schedules'),
    },
    {
      id: 'services',
      label: 'Services',
      icon: <Settings className="w-4 h-4" />,
      show: can(user, 'view_services'),
    },
    {
      id: 'staff',
      label: 'Staff',
      icon: <UserCheck className="w-4 h-4" />,
      show: can(user, 'view_staff'),
    },
    {
      id: 'audit_logs',
      label: 'Audit Trail',
      icon: <Shield className="w-4 h-4" />,
      show: can(user, 'view_audit_logs'),
    },
  ];

  const visiblePrimary = primaryNavItems.filter((item) => item.show);
  const visibleSecondary = secondaryNavItems.filter((item) => item.show);
  const allNavItems = [...primaryNavItems, ...secondaryNavItems].filter((item) => item.show);
  const isSecondaryActive = visibleSecondary.some((item) => item.id === activeTab);
  const activeSecondaryItem = visibleSecondary.find((item) => item.id === activeTab);

  return (
    <header className="bg-white/95 backdrop-blur-md border-b border-[#E2E8F0] sticky top-0 z-30 w-full shadow-xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 gap-3">
          {/* Left: Brand & Clinic Name */}
          <div 
            className="flex items-center gap-2 sm:gap-3 shrink-0 cursor-pointer group"
            onClick={() => onSelectTab('dashboard')}
          >
            <div className="w-8 h-8 rounded-lg bg-[#0F4C5C] flex items-center justify-center text-white font-bold tracking-wider text-xs shrink-0 shadow-xs group-hover:bg-[#083B4A] transition-colors">
              CF
            </div>
            <div className="min-w-0">
              <span className="font-extrabold text-[#0F4C5C] tracking-tight text-xs sm:text-sm uppercase block truncate group-hover:text-[#083B4A] transition-colors">
                CLINICFIRST
              </span>
              {clinic && (
                <span className="block text-[10px] sm:text-[11px] text-[#64748B] font-medium truncate max-w-[100px] sm:max-w-[140px]">
                  {clinic.name}
                </span>
              )}
            </div>
          </div>

          {/* Center: Desktop Navigation Bar (5 Primary items + More dropdown) */}
          <nav className="hidden lg:flex items-center space-x-1 shrink-0">
            {visiblePrimary.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 ease-out cursor-pointer shrink-0 whitespace-nowrap active:scale-[0.98] ${
                    isActive
                      ? 'bg-[#0F4C5C] text-white shadow-xs'
                      : 'text-[#172B3A] hover:text-[#0F4C5C] hover:bg-[#0F4C5C]/8'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              );
            })}

            {/* "More / Operations" Dropdown */}
            {visibleSecondary.length > 0 && (
              <div className="relative shrink-0" ref={dropdownRef}>
                <button
                  onClick={() => setManageMenuOpen(!manageMenuOpen)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 ease-out cursor-pointer whitespace-nowrap active:scale-[0.98] ${
                    isSecondaryActive || manageMenuOpen
                      ? 'bg-[#0F4C5C] text-white shadow-xs'
                      : 'text-[#172B3A] hover:text-[#0F4C5C] hover:bg-[#0F4C5C]/8'
                  }`}
                >
                  {isSecondaryActive && activeSecondaryItem ? activeSecondaryItem.icon : <Settings className="w-4 h-4" />}
                  <span>{isSecondaryActive && activeSecondaryItem ? activeSecondaryItem.label : 'More'}</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${manageMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                {manageMenuOpen && (
                  <div className="absolute right-0 mt-1.5 w-48 bg-white border border-[#E2E8F0] rounded-xl shadow-xl py-1 z-50 animate-fade-enter">
                    <div className="px-3 py-1.5 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider border-b border-[#F1F5F9]">
                      Clinic Settings & Operations
                    </div>
                    {visibleSecondary.map((item) => {
                      const isActive = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            onSelectTab(item.id);
                            setManageMenuOpen(false);
                          }}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-left transition-colors duration-150 cursor-pointer ${
                            isActive
                              ? 'bg-[#F8FAFC] text-[#0F4C5C] font-semibold'
                              : 'text-[#172B3A] hover:bg-[#0F4C5C]/8 hover:text-[#0F4C5C]'
                          }`}
                        >
                          {item.icon}
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </nav>

          {/* Right: User Profile + Logout + Mobile Menu Button */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="hidden sm:flex flex-col items-end pl-2 shrink-0">
              <span className="text-xs font-semibold text-[#172B3A] truncate max-w-[130px]">{user?.name}</span>
              <div className="flex items-center gap-1 mt-0.5">
                <Badge status={user?.role || 'CLINIC_STAFF'} />
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              icon={<LogOut className="w-4 h-4" />}
              onClick={logout}
              title="Log out"
              className="shrink-0 whitespace-nowrap"
            >
              <span className="hidden sm:inline">Log out</span>
            </Button>

            {/* Mobile / Tablet / Medium-screen Hamburger Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="xl:hidden p-2 rounded-md text-[#172B3A] hover:text-black hover:bg-slate-100 cursor-pointer shrink-0"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile / Tablet Dropdown Menu */}
      {mobileMenuOpen && (
        <div className="xl:hidden border-t border-[#E2E8F0] px-4 pt-2 pb-3 space-y-1 bg-white max-h-[80vh] overflow-y-auto shadow-lg">

          <div className="py-1 text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">
            Navigation Menu
          </div>

          {allNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                onSelectTab(item.id);
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg text-left transition-colors ${
                activeTab === item.id
                  ? 'bg-[#0F4C5C] text-white font-semibold'
                  : 'text-[#172B3A] hover:bg-slate-100'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </header>
  );
};

