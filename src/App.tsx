import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ClinicLogin } from './pages/auth/ClinicLogin';
import { PlatformLogin } from './pages/auth/PlatformLogin';
import { ChangePasswordModal } from './pages/auth/ChangePasswordModal';

// Platform Pages
import { PlatformNavbar } from './components/layout/PlatformNavbar';
import { PlatformDashboard } from './pages/platform/PlatformDashboard';
import { PlatformClinics } from './pages/platform/PlatformClinics';
import { PlatformUsers } from './pages/platform/PlatformUsers';
import { PlatformSettings } from './pages/platform/PlatformSettings';
import { PlatformAuditLogs } from './pages/platform/PlatformAuditLogs';

// Clinic Pages
import { ClinicNavbar } from './components/layout/ClinicNavbar';
import { ClinicDashboard } from './pages/clinic/ClinicDashboard';
import { AppointmentsPage } from './pages/clinic/AppointmentsPage';
import { PatientsPage } from './pages/clinic/PatientsPage';
import { DoctorsPage } from './pages/clinic/DoctorsPage';
import { ServicesPage } from './pages/clinic/ServicesPage';
import { SchedulesPage } from './pages/clinic/SchedulesPage';
import { AiReceptionistPage } from './pages/clinic/AiReceptionistPage';
import { CallsPage } from './pages/clinic/CallsPage';
import { StaffPage } from './pages/clinic/StaffPage';
import { ClinicAuditLogsPage } from './pages/clinic/ClinicAuditLogsPage';

// AI Phone Simulator
import { AiPhoneSimulator } from './components/ai/AiPhoneSimulator';
import { Phone } from 'lucide-react';

import { ToastContainer } from './components/common/Toast';

const MainApp: React.FC = () => {
  const { user, clinic, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [loginMode, setLoginMode] = useState<'clinic' | 'platform'>('clinic');
  const [simulatorOpen, setSimulatorOpen] = useState(false);

  // Reset to dashboard whenever user logs in or switches
  useEffect(() => {
    if (user) {
      setActiveTab('dashboard');
    }
  }, [user?.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F9FC] flex flex-col items-center justify-center font-mono text-xs text-[#64748B]">
        <div className="w-9 h-9 rounded-full border-2 border-[#E2E8F0] border-t-[#0A2540] animate-spin mb-3" />
        <span>Initializing CLINICFIRST Clinical Platform...</span>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    if (loginMode === 'platform') {
      return <PlatformLogin onSwitchToClinic={() => setLoginMode('clinic')} />;
    }
    return <ClinicLogin onSwitchToPlatform={() => setLoginMode('platform')} />;
  }

  // Platform Admin Workflow
  if (user.role === 'PLATFORM_ADMIN') {
    return (
      <div className="min-h-screen bg-[#F7F9FC] flex flex-col text-[#172B3A]">
        {user.must_change_password && <ChangePasswordModal />}

        <PlatformNavbar activeTab={activeTab} onSelectTab={setActiveTab} />

        <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8">
          {activeTab === 'dashboard' && <PlatformDashboard onNavigateToTab={setActiveTab} />}
          {activeTab === 'clinics' && <PlatformClinics />}
          {activeTab === 'users' && <PlatformUsers />}
          {activeTab === 'settings' && <PlatformSettings />}
          {activeTab === 'audit_trail' && <PlatformAuditLogs />}
        </main>
      </div>
    );
  }

  // Clinic Workflow (CLINIC_ADMIN and CLINIC_STAFF)
  return (
    <div className="min-h-screen bg-[#F7F9FC] flex flex-col text-[#172B3A]">
      {user.must_change_password && <ChangePasswordModal />}

      <ClinicNavbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenSimulator={() => setSimulatorOpen(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8">
        {activeTab === 'dashboard' && (
          <ClinicDashboard
            onNavigateToTab={setActiveTab}
            onOpenPhoneSimulator={() => setSimulatorOpen(true)}
          />
        )}
        {activeTab === 'appointments' && <AppointmentsPage />}
        {activeTab === 'patients' && <PatientsPage />}
        {activeTab === 'doctors' && <DoctorsPage />}
        {activeTab === 'services' && <ServicesPage />}
        {activeTab === 'schedules' && <SchedulesPage />}
        {activeTab === 'calls' && <CallsPage />}
        {activeTab === 'ai_receptionist' && (
          <AiReceptionistPage onOpenSimulator={() => setSimulatorOpen(true)} />
        )}
        {activeTab === 'staff' && <StaffPage />}
        {activeTab === 'audit_logs' && <ClinicAuditLogsPage />}
      </main>

      {/* Phone Simulator Modal */}
      {clinic && (
        <AiPhoneSimulator
          isOpen={simulatorOpen}
          onClose={() => setSimulatorOpen(false)}
          clinicId={clinic.id}
          clinicName={clinic.name}
        />
      )}
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
      <ToastContainer />
    </AuthProvider>
  );
}

