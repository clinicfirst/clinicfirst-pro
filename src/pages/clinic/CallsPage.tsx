import React, { useState, useEffect } from 'react';
import {
  PhoneCall,
  Search,
  Clock,
  User,
  CheckCircle2,
  AlertCircle,
  FileText,
  Bot,
  RefreshCw,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { Input, Select } from '../../components/common/Input';
import { apiRequest } from '../../api';
import { Call } from '../../types';

export const CallsPage: React.FC = () => {
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [outcomeFilter, setOutcomeFilter] = useState('all');
  const [search, setSearch] = useState('');

  // Transcript Inspector
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);

  const fetchCalls = async () => {
    try {
      setLoading(true);
      const res = await apiRequest<{ calls: Call[] }>(
        `/api/clinic/calls${outcomeFilter !== 'all' ? `?outcome=${outcomeFilter}` : ''}`
      );
      setCalls(res.calls);
    } catch (err) {
      console.error('Failed to load calls:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalls();
  }, [outcomeFilter]);

  const filteredCalls = calls.filter((c) =>
    (c.caller_phone || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.summary && c.summary.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-[#0A0A0A] tracking-tight">AI Receptionist Call Logs</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Real-time transcripts, outcome analysis, and tool executions from all inbound phone calls.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          icon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
          onClick={fetchCalls}
        >
          Refresh Logs
        </Button>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-3 border border-gray-200 rounded-lg">
        <div className="w-full sm:w-72">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by caller phone, summary..."
            icon={<Search className="w-4 h-4" />}
          />
        </div>

        <div className="w-52">
          <select
            value={outcomeFilter}
            onChange={(e) => setOutcomeFilter(e.target.value)}
            className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded focus:border-[#0A2540]"
          >
            <option value="all">All Outcomes</option>
            <option value="BOOKED">Booked</option>
            <option value="RESCHEDULED">Rescheduled</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="INQUIRY_RESOLVED">Inquiry Resolved</option>
            <option value="ESCALATED">Escalated</option>
            <option value="DROPPED">Dropped</option>
          </select>
        </div>
      </div>

      {/* Calls Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {filteredCalls.length === 0 ? (
          <div className="py-16 text-center text-xs text-gray-400">
            <PhoneCall className="w-8 h-8 mx-auto text-gray-300 mb-2" />
            No recorded phone calls found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/75 border-b border-gray-200 text-gray-700 uppercase font-semibold text-[11px] tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Timestamp</th>
                  <th className="px-6 py-3.5">Caller Number</th>
                  <th className="px-6 py-3.5">Duration</th>
                  <th className="px-6 py-3.5">Outcome</th>
                  <th className="px-6 py-3.5">Summary / Actions</th>
                  <th className="px-6 py-3.5 text-right">Inspection</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-normal">
                {filteredCalls.map((c) => (
                  <tr key={c.id} className="group hover:bg-[#F8FAFC] transition-colors duration-200 transition-colors">
                    <td className="px-6 py-4 font-mono text-[11px] text-gray-500 whitespace-nowrap">
                      {new Date(c.start_time).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>

                    <td className="px-6 py-4 font-mono font-semibold text-[#0A0A0A]">
                      {c.caller_phone}
                    </td>

                    <td className="px-6 py-4 font-mono text-gray-700">
                      {c.duration_seconds} sec
                    </td>

                    <td className="px-6 py-4">
                      <Badge status={c.outcome} />
                    </td>

                    <td className="px-6 py-4 max-w-xs text-gray-700 truncate">
                      {c.summary || 'Call completed successfully'}
                    </td>

                    <td className="px-6 py-4 text-right opacity-80 group-hover:opacity-100 transition-opacity duration-200">
                      <Button
                        variant="outline"
                        size="sm"
                        icon={<FileText className="w-3.5 h-3.5" />}
                        onClick={() => setSelectedCall(c)}
                      >
                        Transcript ({c.transcript?.length || 0})
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* TRANSCRIPT INSPECTOR MODAL */}
      {selectedCall && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedCall(null)}
          title={`Call Transcript: ${selectedCall.caller_phone}`}
          subtitle={`Duration: ${selectedCall.duration_seconds}s • Outcome: ${selectedCall.outcome}`}
          maxWidth="lg"
        >
          <div className="space-y-4 text-xs">
            {/* Outcome & Summary Banner */}
            <div className="p-3 bg-gray-50 border border-gray-200 rounded space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-700 uppercase tracking-wider text-[10px]">
                  Call Summary & Result
                </span>
                <Badge status={selectedCall.outcome} />
              </div>
              <p className="text-gray-900 font-medium">
                {selectedCall.summary || 'Inquiry resolved by AI Receptionist'}
              </p>
            </div>

            {/* Turn by turn dialogue */}
            <div className="space-y-3 max-h-96 overflow-y-auto p-3 border border-gray-200 rounded bg-white font-sans">
              {(!selectedCall.transcript || selectedCall.transcript.length === 0) ? (
                <div className="py-6 text-center text-gray-400">No transcript lines recorded.</div>
              ) : (
                selectedCall.transcript.map((turn, i) => {
                  const isAgent = turn.speaker === 'ai' || (turn as any).role === 'agent';
                  return (
                    <div
                      key={i}
                      className={`flex flex-col ${isAgent ? 'items-start' : 'items-end'}`}
                    >
                      <div className="flex items-center gap-1.5 mb-0.5 text-[10px] text-gray-400 uppercase font-mono">
                        {isAgent ? (
                          <>
                            <Bot className="w-3 h-3 text-[#0A2540]" />
                            <span className="font-semibold text-[#0A2540]">AI Receptionist</span>
                          </>
                        ) : (
                          <>
                            <User className="w-3 h-3 text-gray-600" />
                            <span>Caller</span>
                          </>
                        )}
                        <span>• {turn.timestamp}</span>
                      </div>
                      <div
                        className={`p-2.5 rounded-lg max-w-[85%] text-xs leading-relaxed ${
                          isAgent
                            ? 'bg-gray-100 text-[#0A0A0A] border border-gray-200'
                            : 'bg-[#0A2540] text-white'
                        }`}
                      >
                        {turn.text}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <Button variant="secondary" size="md" onClick={() => setSelectedCall(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
