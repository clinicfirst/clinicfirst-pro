import React, { useState, useRef, useEffect } from 'react';
import {
  Shield,
  Building2,
  LayoutDashboard,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Check,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ConfirmModal } from '../common/ConfirmModal';
import { ClinicLogo } from '../common/ClinicLogo';

export type PlatformTab = 'dashboard' | 'clinics' | 'users' | 'settings' | 'audit_trail';

interface PlatformNavbarProps {
  activeTab?: string;
  onSelectTab?: (tab: string) => void;
  currentTab?: PlatformTab;
  onTabChange?: (tab: PlatformTab) => void;
}

export const PlatformNavbar: React.FC<PlatformNavbarProps> = ({
  activeTab,
  onSelectTab,
  currentTab,
  onTabChange,
}) => {
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [settingsDropdownOpen, setSettingsDropdownOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);

  const navContainerRef = useRef<HTMLDivElement | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (navContainerRef.current && !navContainerRef.current.contains(event.target as Node)) {
        setSettingsDropdownOpen(false);
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selected = (activeTab || currentTab || 'dashboard') as PlatformTab;
  const handleSelect = (tab: PlatformTab) => {
    if (onSelectTab) onSelectTab(tab);
    if (onTabChange) onTabChange(tab);
    setSettingsDropdownOpen(false);
    setUserMenuOpen(false);
    setMobileMenuOpen(false);
  };

  const isSettingsGroupActive = selected === 'settings' || selected === 'audit_trail';

  const settingsSubItems = [
    {
      id: 'settings' as const,
      label: 'Platform Settings',
      description: 'System configurations & API defaults',
      icon: <Settings className="w-4 h-4 text-[#0052FF]" />,
    },
    {
      id: 'audit_trail' as const,
      label: 'Global Audit Trail',
      description: 'Security logs, logins & system events',
      icon: <Shield className="w-4 h-4 text-emerald-600" />,
    },
  ];

  return (
    <>
      <header className="bg-white border-b border-[#E2E8F0] sticky top-0 z-30 w-full shadow-xs">
        <div className="w-full px-4 sm:px-6 lg:px-8" ref={navContainerRef}>
          <div className="flex justify-between items-center h-16 gap-3 sm:gap-6 w-full">
            {/* Brand */}
            <div className="flex items-center gap-3 shrink-0">
              <div
                className="cursor-pointer select-none shrink-0"
                onClick={() => handleSelect('dashboard')}
                title="CLINICFIRST Platform Master Console"
              >
                <ClinicLogo size="md" />
              </div>

              <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900 text-white text-[10px] font-bold uppercase tracking-wider shrink-0">
                <Shield className="w-3 h-3 text-[#00C2CB]" />
                <span>Super Admin</span>
              </div>
            </div>

            {/* Nav Tabs */}
            <nav className="hidden lg:flex items-center space-x-1.5 shrink-0">
              <button
                onClick={() => handleSelect('dashboard')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all duration-150 cursor-pointer shrink-0 select-none ${
                  selected === 'dashboard'
                    ? 'bg-blue-50 text-[#0052FF] border border-blue-200/80 shadow-2xs'
                    : 'text-[#64748B] hover:text-[#0F172A] hover:bg-slate-50 border border-transparent'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Dashboard</span>
              </button>

              <button
                onClick={() => handleSelect('clinics')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all duration-150 cursor-pointer shrink-0 select-none ${
                  selected === 'clinics'
                    ? 'bg-blue-50 text-[#0052FF] border border-blue-200/80 shadow-2xs'
                    : 'text-[#64748B] hover:text-[#0F172A] hover:bg-slate-50 border border-transparent'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Clinics</span>
              </button>

              <button
                onClick={() => handleSelect('users')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all duration-150 cursor-pointer shrink-0 select-none ${
                  selected === 'users'
                    ? 'bg-blue-50 text-[#0052FF] border border-blue-200/80 shadow-2xs'
                    : 'text-[#64748B] hover:text-[#0F172A] hover:bg-slate-50 border border-transparent'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Users</span>
              </button>

              {/* Grouped Settings Dropdown */}
              <div className="relative shrink-0">
                <button
                  onClick={() => {
                    setSettingsDropdownOpen(!settingsDropdownOpen);
                    setUserMenuOpen(false);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all duration-150 cursor-pointer shrink-0 select-none ${
                    isSettingsGroupActive || settingsDropdownOpen
                      ? 'bg-blue-50 text-[#0052FF] border border-blue-200/80 shadow-2xs'
                      : 'text-[#64748B] hover:text-[#0F172A] hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>{selected === 'audit_trail' ? 'Audit Trail' : 'Settings'}</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${
                      settingsDropdownOpen ? 'rotate-180 text-[#0052FF]' : 'text-[#94A3B8]'
                    }`}
                  />
                </button>

                {/* Dropdown Menu */}
                {settingsDropdownOpen && (
                  <div className="absolute right-0 xl:left-0 mt-2 w-72 bg-white border border-[#E2E8F0] rounded-2xl shadow-xl p-2 z-50 animate-fade-enter">
                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                      Platform Governance
                    </div>
                    <div className="space-y-1">
                      {settingsSubItems.map((item) => {
                        const isItemActive = selected === item.id;
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
            </nav>

            {/* User Info & Actions */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {/* User Dropdown */}
              <div className="relative shrink-0">
                <button
                  onClick={() => {
                    setUserMenuOpen(!userMenuOpen);
                    setSettingsDropdownOpen(false);
                  }}
                  className="flex items-center gap-2 p-1 sm:px-2 sm:py-1 rounded-xl hover:bg-slate-100 transition-all border border-transparent hover:border-[#E2E8F0] cursor-pointer shrink-0"
                  title="Platform Master Profile"
                >
                  <div className="w-8 h-8 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center text-xs ring-2 ring-slate-900/20 shrink-0">
                    {user?.name?.charAt(0) || 'P'}
                  </div>
                  <div className="hidden xl:flex flex-col text-left">
                    <span className="text-xs font-bold text-[#0F172A] tracking-tight truncate max-w-[120px]">
                      {user?.name}
                    </span>
                    <span className="text-[10px] text-[#0052FF] font-bold uppercase tracking-wider">
                      Platform Master
                    </span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-[#64748B] hidden sm:block" />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white border border-[#E2E8F0] rounded-2xl shadow-xl py-2 z-50 animate-fade-enter">
                    <div className="px-4 py-3 border-b border-[#F1F5F9] bg-slate-50/50 rounded-t-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center text-sm ring-2 ring-slate-900/20">
                          {user?.name?.charAt(0) || 'P'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-[#0F172A] truncate">{user?.name}</p>
                          <p className="text-[11px] text-[#64748B] truncate">{user?.email || 'master@clinicfirst.ai'}</p>
                          <span className="inline-block mt-1 px-2 py-0.5 text-[9px] font-bold rounded-full bg-slate-900 text-white">
                            PLATFORM_ADMIN
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="py-1">
                      <button
                        onClick={() => handleSelect('settings')}
                        className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-[#0F172A] hover:bg-slate-50 transition-colors"
                      >
                        <Settings className="w-4 h-4 text-[#64748B]" />
                        <span>Platform Settings</span>
                      </button>

                      <button
                        onClick={() => handleSelect('audit_trail')}
                        className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-[#0F172A] hover:bg-slate-50 transition-colors"
                      >
                        <Shield className="w-4 h-4 text-[#64748B]" />
                        <span>Global Security Audit Trail</span>
                      </button>
                    </div>

                    <div className="pt-1 border-t border-[#F1F5F9] px-2">
                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          setConfirmLogoutOpen(true);
                        }}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                      >
                        <LogOut className="w-4 h-4 text-rose-600" />
                        <span>Log Out of Platform</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Direct Visible Logout Icon Button */}
              <button
                onClick={() => setConfirmLogoutOpen(true)}
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-[#64748B] hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors border border-transparent hover:border-rose-100 cursor-pointer shrink-0"
                title="Log out of console"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden xl:inline">Logout</span>
              </button>

              {/* Mobile Hamburger */}
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

        {/* Mobile nav drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-[#E2E8F0] px-4 pt-3 pb-5 space-y-3 bg-white shadow-xl max-h-[85vh] overflow-y-auto">
            <div className="p-3 bg-slate-50 border border-[#E2E8F0] rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center text-xs shrink-0">
                  {user?.name?.charAt(0) || 'P'}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#0F172A] truncate">{user?.name}</p>
                  <p className="text-[10px] text-[#64748B] truncate">Platform Master Console</p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-900 text-white shrink-0">
                Super Admin
              </span>
            </div>

            <div className="py-1 text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
              Platform Navigation
            </div>

            <div className="space-y-1">
              <button
                onClick={() => handleSelect('dashboard')}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-medium rounded-xl text-left transition-colors cursor-pointer ${
                  selected === 'dashboard'
                    ? 'bg-blue-50 text-[#0052FF] font-bold'
                    : 'text-[#0F172A] hover:bg-slate-50'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Dashboard</span>
              </button>

              <button
                onClick={() => handleSelect('clinics')}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-medium rounded-xl text-left transition-colors cursor-pointer ${
                  selected === 'clinics'
                    ? 'bg-blue-50 text-[#0052FF] font-bold'
                    : 'text-[#0F172A] hover:bg-slate-50'
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span>Clinics</span>
              </button>

              <button
                onClick={() => handleSelect('users')}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-medium rounded-xl text-left transition-colors cursor-pointer ${
                  selected === 'users'
                    ? 'bg-blue-50 text-[#0052FF] font-bold'
                    : 'text-[#0F172A] hover:bg-slate-50'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Users</span>
              </button>

              <button
                onClick={() => handleSelect('settings')}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-medium rounded-xl text-left transition-colors cursor-pointer ${
                  selected === 'settings'
                    ? 'bg-blue-50 text-[#0052FF] font-bold'
                    : 'text-[#0F172A] hover:bg-slate-50'
                }`}
              >
                <Settings className="w-4 h-4" />
                <span>Platform Settings</span>
              </button>

              <button
                onClick={() => handleSelect('audit_trail')}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-medium rounded-xl text-left transition-colors cursor-pointer ${
                  selected === 'audit_trail'
                    ? 'bg-blue-50 text-[#0052FF] font-bold'
                    : 'text-[#0F172A] hover:bg-slate-50'
                }`}
              >
                <Shield className="w-4 h-4" />
                <span>Global Audit Trail</span>
              </button>
            </div>

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

      <ConfirmModal
        isOpen={confirmLogoutOpen}
        onClose={() => setConfirmLogoutOpen(false)}
        onConfirm={() => {
          setConfirmLogoutOpen(false);
          logout();
        }}
        title="Confirm Logout"
        message="Are you sure you want to log out of the Platform Admin Console?"
        confirmText="Yes, Log Out"
        destructive={true}
      />
    </>
  );
};
