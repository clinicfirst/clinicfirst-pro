import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Search,
  Shield,
  Clock,
  Filter,
  FileText,
  HelpCircle,
  PhoneCall,
  CalendarCheck,
  CreditCard,
  UserCheck,
  Activity,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { Input } from '../common/Input';
import { ClinicKnowledgeItem, ClinicKnowledgeCategory } from '../../types';
import { apiRequest } from '../../api';

export const ClinicAiKnowledgeView: React.FC = () => {
  const [items, setItems] = useState<ClinicKnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const categories: Array<{ id: string; label: string; icon: React.ReactNode }> = [
    { id: 'ALL', label: 'All Rules', icon: <BookOpen className="w-3.5 h-3.5" /> },
    { id: 'ARRIVAL', label: 'Arrival Protocol', icon: <Clock className="w-3.5 h-3.5" /> },
    { id: 'PAYMENT', label: 'Payment & Fees', icon: <CreditCard className="w-3.5 h-3.5" /> },
    { id: 'CANCELLATION', label: 'Cancellation', icon: <CalendarCheck className="w-3.5 h-3.5" /> },
    { id: 'REGISTRATION', label: 'Registration', icon: <UserCheck className="w-3.5 h-3.5" /> },
    { id: 'WORKFLOW', label: 'Clinical Workflow', icon: <Activity className="w-3.5 h-3.5" /> },
    { id: 'CLINIC_POLICY', label: 'Clinic Policy', icon: <FileText className="w-3.5 h-3.5" /> },
    { id: 'ESCALATION', label: 'Escalation', icon: <Shield className="w-3.5 h-3.5" /> },
    { id: 'COMMUNICATION', label: 'Communication', icon: <PhoneCall className="w-3.5 h-3.5" /> },
  ];

  const fetchItems = async () => {
    try {
      setLoading(true);
      const res = await apiRequest<{ items: ClinicKnowledgeItem[] }>('/api/clinic/ai-knowledge');
      setItems(res.items || []);
    } catch (err: any) {
      console.error('Failed to load clinic AI knowledge:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const filteredItems = items.filter((item) => {
    const matchesCategory = selectedCategory === 'ALL' || item.category === selectedCategory;
    const matchesSearch =
      !searchQuery ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const getCategoryLabel = (cat: string) => {
    const found = categories.find((c) => c.id === cat);
    return found ? found.label : cat.replace(/_/g, ' ');
  };

  return (
    <Card
      title="Clinic AI Rules & Specific Knowledge"
      subtitle="Approved clinic operational rules and policies active in your AI Receptionist"
      action={
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded border border-gray-200">
            Read-Only (Platform Governed)
          </span>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Platform Governance Notice */}
        <div className="p-3.5 bg-blue-50/60 border border-blue-200/80 rounded-lg flex items-start gap-3">
          <Shield className="w-4 h-4 text-[#0A2540] shrink-0 mt-0.5" />
          <div className="text-xs text-gray-700">
            <div className="font-semibold text-[#0A2540]">Platform-Governed Knowledge</div>
            <p className="mt-0.5 text-gray-600 leading-relaxed">
              These clinic-specific rules are published by your Platform Administrator and automatically combined with live tools and platform safety policies.
              To add or update rules, please contact your Platform Administrator.
            </p>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
          <div className="w-full sm:w-64">
            <Input
              placeholder="Search clinic rules..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              icon={<Search className="w-3.5 h-3.5 text-gray-400" />}
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            {categories.slice(0, 5).map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap transition-colors border ${
                  selectedCategory === cat.id
                    ? 'bg-[#0A2540] text-white border-[#0A2540]'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {cat.icon}
                <span>{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Knowledge Items Grid */}
        {loading ? (
          <div className="py-8 text-center text-xs text-gray-500">Loading clinic rules...</div>
        ) : filteredItems.length === 0 ? (
          <div className="py-8 text-center border border-dashed border-gray-200 rounded-lg p-6">
            <BookOpen className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <div className="text-xs font-semibold text-gray-700">No Clinic Rules Found</div>
            <p className="text-[11px] text-gray-500 mt-1 max-w-sm mx-auto">
              {searchQuery
                ? 'No rules match your search criteria.'
                : 'No clinic-specific rules are currently configured. Standard platform policies apply.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="p-3.5 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-700 border border-gray-200">
                      {getCategoryLabel(item.category as string)}
                    </span>
                    <Badge
                      status={item.status === 'PUBLISHED' ? 'ACTIVE' : 'INACTIVE'}
                      label={item.status || 'PUBLISHED'}
                    />
                  </div>
                  <h4 className="text-xs font-bold text-[#0A0A0A] leading-snug">{item.title}</h4>
                  <p className="text-[11px] text-gray-600 mt-1.5 leading-relaxed font-sans line-clamp-3">
                    {item.content}
                  </p>
                </div>

                <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between text-[10px] text-gray-400">
                  <span>Version {item.version || 1}</span>
                  {item.published_at && (
                    <span>Published: {new Date(item.published_at).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
};
