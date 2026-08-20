import React, { useState, useEffect } from 'react';
import { Shield, Search, RefreshCw } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { apiRequest } from '../../api';
import { AuditLog } from '../../types';

export const PlatformAuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await apiRequest<{ logs: AuditLog[] }>('/api/platform/audit-logs');
      setLogs(res.logs);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filtered = logs.filter(
    (l) =>
      (l.action || '').toLowerCase().includes(search.toLowerCase()) ||
      (l.actor_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (l.target_type && l.target_type.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-[#0A0A0A] tracking-tight">Platform Security & Audit Trail</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Immutable log of all administrative actions, tenant provisioning, user logins, and configuration changes.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
          onClick={fetchLogs}
        >
          Refresh Logs
        </Button>
      </div>

      <div className="w-full sm:w-80">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by action, actor name, target..."
          icon={<Search className="w-4 h-4" />}
        />
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50/75 border-b border-gray-200 text-gray-700 uppercase font-semibold text-[11px] tracking-wider">
              <tr>
                <th className="px-6 py-3.5">Timestamp</th>
                <th className="px-6 py-3.5">Action</th>
                <th className="px-6 py-3.5">Actor</th>
                <th className="px-6 py-3.5">Target</th>
                <th className="px-6 py-3.5">Tenant Boundary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-mono">
              {filtered.map((log) => (
                <tr key={log.id} className="group hover:bg-[#F8FAFC] transition-colors duration-200 transition-colors">
                  <td className="px-6 py-3.5 text-gray-500 text-[11px]">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="px-6 py-3.5 font-semibold text-[#0A2540]">{log.action}</td>
                  <td className="px-6 py-3.5 text-[#0A0A0A] font-sans font-medium">{log.actor_name}</td>
                  <td className="px-6 py-3.5 text-gray-600">
                    {log.target_type ? `${log.target_type}: ${log.target_id}` : '-'}
                  </td>
                  <td className="px-6 py-3.5 text-gray-500 text-[11px]">
                    {log.clinic_id || 'PLATFORM_MASTER'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
