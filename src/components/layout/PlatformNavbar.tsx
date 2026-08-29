import React, { useState } from 'react';
import {
  Shield,
  Building2,
  LayoutDashboard,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { ConfirmModal } from '../common/ConfirmModal';

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
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);

  const selected = (activeTab || currentTab || 'dashboard') as PlatformTab;
  const handleSelect = (tab: PlatformTab) => {
    if (onSelectTab) onSelectTab(tab);
    if (onTabChange) onTabChange(tab);
    setMobileMenuOpen(false);
  };

  const navItems = [
    { id: 'dashboard' as const, label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'clinics' as const, label: 'Clinics', icon: <Building2 className="w-4 h-4" /> },
    { id: 'users' as const, label: 'Users', icon: <Users className="w-4 h-4" /> },
    { id: 'settings' as const, label: 'Settings', icon: <Settings className="w-4 h-4" /> },
    { id: 'audit_trail' as const, label: 'Audit Trail', icon: <Shield className="w-4 h-4" /> },
  ];

  return (
    <>
      <header className="bg-white/95 backdrop-blur-md border-b border-[#E2E8F0] sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Brand */}
          <div className="flex items-center gap-6">
            <div 
              className="flex items-center gap-2.5 cursor-pointer group"
              onClick={() => handleSelect('dashboard')}
            >
              <div className="w-8 h-8 rounded-lg bg-[#06182C] flex items-center justify-center text-white font-bold text-xs shadow-xs group-hover:bg-[#0A2540] transition-colors">
                CF
              </div>
              <div>
                <span className="font-extrabold text-[#06182C] tracking-tight text-sm uppercase group-hover:text-[#0A2540] transition-colors">
                  CLINICFIRST
                </span>
                <span className="block text-[10px] text-[#64748B] font-mono">
                  Platform Admin Portal
                </span>
              </div>
            </div>

            {/* Nav Tabs */}
            <nav className="hidden md:flex items-center space-x-1">
              {navItems.map((item) => {
                const isActive = selected === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 ease-out cursor-pointer active:scale-[0.98] ${
                      isActive
                        ? 'bg-[#06182C] text-white shadow-xs'
                        : 'text-[#172B3A] hover:text-[#06182C] hover:bg-[#06182C]/8'
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* User info & Logout */}
          <div className="flex items-center gap-4 sm:gap-6 shrink-0">
            <div className="hidden sm:flex flex-col items-end shrink-0">
              <span className="text-sm font-bold text-[#172B3A] tracking-tight">{user?.name}</span>
              <div className="mt-1">
                <Badge status="PLATFORM_ADMIN" className="!rounded-lg !px-2.5 !py-1 text-[11px]" />
              </div>
            </div>

            <button
              onClick={() => setConfirmLogoutOpen(true)}
              className="hidden sm:flex items-center gap-2.5 text-[15px] font-semibold text-[#172B3A] hover:text-black transition-colors"
            >
              <LogOut className="w-[18px] h-[18px] stroke-[2.5]" />
              Log out
            </button>

            {/* Mobile Log out (Icon only) */}
            <button
              onClick={() => setConfirmLogoutOpen(true)}
              className="sm:hidden p-2 text-[#172B3A] hover:text-black hover:bg-slate-100 rounded-md"
            >
              <LogOut className="w-5 h-5" />
            </button>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-md text-[#172B3A] hover:text-black hover:bg-slate-100 cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile nav */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[#E2E8F0] px-4 pt-2 pb-3 space-y-1 bg-white shadow-lg">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleSelect(item.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg text-left ${
                selected === item.id
                  ? 'bg-[#06182C] text-white font-semibold'
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
      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmLogoutOpen}
        onClose={() => setConfirmLogoutOpen(false)}
        onConfirm={() => {
          setConfirmLogoutOpen(false);
          logout();
        }}
        title="Confirm Logout"
        message="Are you sure you want to log out?"
        confirmText="Yes, Log out"
        destructive={true}
      />
    </>
  );
};

