import React, { useState } from 'react';
import {
  Calendar,
  Users,
  UserCheck,
  Stethoscope,
  Clock,
  PhoneCall,
  Bot,
  Shield,
  LogOut,
  Menu,
  X,
  Phone,
  Settings,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { can } from '../../lib/permissions';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { AiPhoneSimulator } from '../ai/AiPhoneSimulator';

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

interface NavbarProps {
  currentTab: ClinicTab;
  onTabChange: (tab: ClinicTab) => void;
  onRefreshData?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onTabChange,
  onRefreshData,
}) => {
  const { user, clinic, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [phoneSimulatorOpen, setPhoneSimulatorOpen] = useState(false);

  const navItems: Array<{ id: ClinicTab; label: string; icon: React.ReactNode; show: boolean }> = [
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
      show: can(user, 'manage_appointments'),
    },
    {
      id: 'patients',
      label: 'Patients',
      icon: <Users className="w-4 h-4" />,
      show: can(user, 'manage_patients'),
    },
    {
      id: 'doctors',
      label: 'Doctors',
      icon: <Stethoscope className="w-4 h-4" />,
      show: can(user, 'view_doctors'),
    },
    {
      id: 'services',
      label: 'Services',
      icon: <Settings className="w-4 h-4" />,
      show: can(user, 'view_services'),
    },
    {
      id: 'schedules',
      label: 'Schedules',
      icon: <Clock className="w-4 h-4" />,
      show: can(user, 'view_schedules'),
    },
    {
      id: 'calls',
      label: 'Calls',
      icon: <PhoneCall className="w-4 h-4" />,
      show: can(user, 'view_calls'),
    },
    {
      id: 'ai_receptionist',
      label: 'AI Receptionist',
      icon: <Bot className="w-4 h-4" />,
      show: can(user, 'configure_ai_receptionist') || can(user, 'view_calls'),
    },
    {
      id: 'staff',
      label: 'Staff',
      icon: <UserCheck className="w-4 h-4" />,
      show: can(user, 'manage_staff'),
    },
    {
      id: 'audit_logs',
      label: 'Audit Trail',
      icon: <Shield className="w-4 h-4" />,
      show: can(user, 'view_audit_logs'),
    },
  ];

  return (
    <>
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            {/* Left: Brand + Clinic Title */}
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded bg-[#0A2540] flex items-center justify-center text-white font-bold tracking-wider text-xs">
                  CF
                </div>
                <div>
                  <span className="font-extrabold text-[#0A2540] tracking-tight text-sm uppercase">
                    CLINICFIRST
                  </span>
                  {clinic && (
                    <span className="block text-[11px] text-gray-500 font-medium truncate max-w-[160px] sm:max-w-xs">
                      {clinic.name}
                    </span>
                  )}
                </div>
              </div>

              {/* Desktop Nav Items */}
              <nav className="hidden lg:flex items-center space-x-1">
                {navItems
                  .filter((item) => item.show)
                  .map((item) => {
                    const isActive = currentTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => onTabChange(item.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                          isActive
                            ? 'bg-[#0A2540] text-white'
                            : 'text-gray-700 hover:text-[#0A0A0A] hover:bg-gray-100'
                        }`}
                      >
                        {item.icon}
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
              </nav>
            </div>

            {/* Right: AI Call Simulator Button + User Info + Logout */}
            <div className="flex items-center gap-3">
              {clinic && (
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Phone className="w-3.5 h-3.5" />}
                  onClick={() => setPhoneSimulatorOpen(true)}
                  className="hidden sm:inline-flex"
                >
                  Simulate Inbound Call
                </Button>
              )}

              <div className="hidden md:flex flex-col items-end border-l border-gray-200 pl-3">
                <span className="text-xs font-semibold text-[#0A0A0A]">{user?.name}</span>
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
              >
                <span className="hidden md:inline">Log out</span>
              </Button>

              {/* Mobile menu trigger */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded-md text-gray-600 hover:text-black hover:bg-gray-100 cursor-pointer"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Dropdown */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-gray-200 px-4 pt-2 pb-3 space-y-1 bg-white">
            {clinic && (
              <div className="pb-2">
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full justify-start"
                  icon={<Phone className="w-3.5 h-3.5" />}
                  onClick={() => {
                    setPhoneSimulatorOpen(true);
                    setMobileMenuOpen(false);
                  }}
                >
                  Simulate Inbound Call
                </Button>
              </div>
            )}
            {navItems
              .filter((item) => item.show)
              .map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    onTabChange(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-md text-left ${
                    currentTab === item.id
                      ? 'bg-[#0A2540] text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
          </div>
        )}
      </header>

      {/* AI Receptionist Phone Call Simulator Modal */}
      {clinic && (
        <Modal
          isOpen={phoneSimulatorOpen}
          onClose={() => setPhoneSimulatorOpen(false)}
          title={`AI Receptionist Live Call Simulator`}
          subtitle={`Interactive voice & clinical tool tester for ${clinic.name}`}
          maxWidth="2xl"
        >
          <AiPhoneSimulator
            clinicId={clinic.id}
            clinicName={clinic.name}
            onCallCompleted={() => {
              if (onRefreshData) onRefreshData();
            }}
          />
        </Modal>
      )}
    </>
  );
};
