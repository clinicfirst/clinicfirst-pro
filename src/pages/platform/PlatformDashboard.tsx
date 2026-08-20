import React, { useState, useEffect } from 'react';
import {
  Building2,
  Stethoscope,
  Calendar,
  PhoneCall,
  Plus,
  ArrowRight,
  Shield,
  CheckCircle2,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { apiRequest } from '../../api';
import { Clinic, AuditLog } from '../../types';

interface PlatformDashboardProps {
  onNavigateToTab?: (tab: string) => void;
  onNavigateToClinics?: () => void;
  onOpenCreateClinic?: () => void;
}

export const PlatformDashboard: React.FC<PlatformDashboardProps> = ({
  onNavigateToTab,
  onNavigateToClinics,
  onOpenCreateClinic,
}) => {
  const handleGoToClinics = onNavigateToClinics || (() => onNavigateToTab?.('clinics'));
  const handleCreateClinic = onOpenCreateClinic || (() => onNavigateToTab?.('clinics'));

  const [metrics, setMetrics] = useState<{
    totalClinics: number;
    activeClinics: number;
    totalDoctors: number;
    todayAppointments: number;
    todayAiCalls: number;
  }>({
    totalClinics: 0,
    activeClinics: 0,
    totalDoctors: 0,
    todayAppointments: 0,
    todayAiCalls: 0,
  });

  const [recentClinics, setRecentClinics] = useState<Clinic[]>([]);
  const [recentActivity, setRecentActivity] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const data = await apiRequest<{
        metrics: any;
        recentClinics: Clinic[];
        recentActivity: AuditLog[];
      }>('/api/platform/dashboard');
      setMetrics(data.metrics);
      setRecentClinics(data.recentClinics);
      setRecentActivity(data.recentActivity);
    } catch (err) {
      console.error('Failed to load platform metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-[#0A0A0A] tracking-tight">Platform Overview</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Multi-tenant clinic infrastructure, doctor capacity, and AI Receptionist operational metrics.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            size="md"
            icon={<Plus className="w-4 h-4" />}
            onClick={handleCreateClinic}
          >
            Create New Clinic
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
        <div className="p-3.5 sm:p-4 bg-white border border-gray-200 rounded-lg min-w-0">
          <div className="flex items-center justify-between text-gray-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider truncate">Total Clinics</span>
            <Building2 className="w-4 h-4 text-[#0A2540] shrink-0" />
          </div>
          <div className="text-2xl font-bold text-[#0A0A0A] font-mono">{metrics.totalClinics}</div>
          <div className="text-[11px] text-gray-500 mt-1 truncate">{metrics.activeClinics} Active Tenants</div>
        </div>

        <div className="p-3.5 sm:p-4 bg-white border border-gray-200 rounded-lg min-w-0">
          <div className="flex items-center justify-between text-gray-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider truncate">Doctors Registered</span>
            <Stethoscope className="w-4 h-4 text-[#0A2540] shrink-0" />
          </div>
          <div className="text-2xl font-bold text-[#0A0A0A] font-mono">{metrics.totalDoctors}</div>
          <div className="text-[11px] text-gray-500 mt-1 truncate">Across all clinics</div>
        </div>

        <div className="p-3.5 sm:p-4 bg-white border border-gray-200 rounded-lg min-w-0">
          <div className="flex items-center justify-between text-gray-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider truncate">Today's Appointments</span>
            <Calendar className="w-4 h-4 text-[#0A2540] shrink-0" />
          </div>
          <div className="text-2xl font-bold text-[#0A0A0A] font-mono">{metrics.todayAppointments}</div>
          <div className="text-[11px] text-gray-500 mt-1 truncate">Live booking load</div>
        </div>

        <div className="p-3.5 sm:p-4 bg-white border border-gray-200 rounded-lg min-w-0">
          <div className="flex items-center justify-between text-gray-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider truncate">Today's AI Calls</span>
            <PhoneCall className="w-4 h-4 text-[#0A2540] shrink-0" />
          </div>
          <div className="text-2xl font-bold text-[#0A0A0A] font-mono">{metrics.todayAiCalls}</div>
          <div className="text-[11px] text-gray-500 mt-1 truncate">Inbound AI turns handled</div>
        </div>

        <div className="p-3.5 sm:p-4 bg-white border border-gray-200 rounded-lg min-w-0">
          <div className="flex items-center justify-between text-gray-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider truncate">Tenant Isolation</span>
            <Shield className="w-4 h-4 text-[#0A2540] shrink-0" />
          </div>
          <div className="text-sm font-bold text-[#0A2540] font-mono flex items-center gap-1 mt-1">
            <CheckCircle2 className="w-4 h-4 shrink-0" /> ENFORCED
          </div>
          <div className="text-[11px] text-gray-500 mt-1 truncate">clinic_id RLS boundary</div>
        </div>
      </div>

      {/* Grid: Recent Clinics + Platform Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        {/* Recent Clinics */}
        <div className="w-full lg:col-span-7 min-w-0">
          <Card
            title="Clinics Directory"
            subtitle="Recently provisioned clinic tenants"
            action={
              <Button variant="ghost" size="sm" onClick={handleGoToClinics} icon={<ArrowRight className="w-3.5 h-3.5" />}>
                View All
              </Button>
            }
          >
            <div className="divide-y divide-gray-100">
              {recentClinics.map((c) => (
                <div key={c.id} className="py-3.5 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-[#0A0A0A]">{c.name}</h4>
                      <Badge status={c.status} />
                    </div>
                    <p className="text-xs text-gray-500">
                      {c.city} • {c.phone} • {c.email}
                    </p>
                  </div>
                  <span className="text-xs font-mono text-gray-400">
                    {new Date(c.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Platform Audit Trail */}
        <div className="lg:col-span-5">
          <Card title="Platform Activity Stream" subtitle="Authoritative administrative & security log">
            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
              {recentActivity.length === 0 ? (
                <p className="text-xs text-gray-400 py-4 text-center">No platform activity logged yet.</p>
              ) : (
                recentActivity.map((log) => (
                  <div key={log.id} className="p-3 bg-gray-50/50 border border-gray-100 rounded text-xs">
                    <div className="flex items-center justify-between font-mono text-[11px] mb-1">
                      <span className="font-semibold text-[#0A2540]">{log.action}</span>
                      <span className="text-gray-400">
                        {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-gray-700">
                      By: <span className="font-medium text-[#0A0A0A]">{log.actor_name}</span>
                      {log.target_type && (
                        <span className="text-gray-500"> ({log.target_type}: {log.target_id})</span>
                      )}
                    </p>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
