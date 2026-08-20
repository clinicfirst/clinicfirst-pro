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
    <header className="bg-white/95 backdrop-blur-md border-b border-[#E2E8F0] sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Brand */}
          <div className="flex items-center gap-6">
            <div 
              className="flex items-center gap-2.5 cursor-pointer group"
              onClick={() => handleSelect('dashboard')}
            >
              <div className="w-8 h-8 rounded-lg bg-[#083B4A] flex items-center justify-center text-white font-bold text-xs shadow-xs group-hover:bg-[#0F4C5C] transition-colors">
                CF
              </div>
              <div>
                <span className="font-extrabold text-[#083B4A] tracking-tight text-sm uppercase group-hover:text-[#0F4C5C] transition-colors">
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
                        ? 'bg-[#083B4A] text-white shadow-xs'
                        : 'text-[#172B3A] hover:text-[#083B4A] hover:bg-[#083B4A]/8'
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
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end border-l border-[#E2E8F0] pl-3">
              <span className="text-xs font-semibold text-[#172B3A]">{user?.name}</span>
              <div className="flex items-center gap-1 mt-0.5">
                <Badge status="PLATFORM_ADMIN" />
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              icon={<LogOut className="w-4 h-4" />}
              onClick={logout}
              title="Log out"
            >
              <span className="hidden sm:inline">Log out</span>
            </Button>

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
                  ? 'bg-[#083B4A] text-white font-semibold'
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

