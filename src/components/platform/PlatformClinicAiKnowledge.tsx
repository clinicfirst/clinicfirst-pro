import { showToast } from '../../components/common/Toast';
import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Filter,
  FileText,
  HelpCircle,
  Shield,
  PhoneCall,
  CalendarCheck,
  CreditCard,
  UserCheck,
  Activity,
  Building2,
  Send,
} from 'lucide-react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Input, Select } from '../common/Input';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { ClinicKnowledgeItem, ClinicKnowledgeCategory, Clinic } from '../../types';
import { apiRequest } from '../../api';

const APPROVED_CATEGORIES: Array<{ id: ClinicKnowledgeCategory; label: string; icon: React.ReactNode }> = [
  { id: 'ARRIVAL', label: 'Arrival Protocol', icon: <Clock className="w-3.5 h-3.5" /> },
  { id: 'PAYMENT', label: 'Payment & Billing', icon: <CreditCard className="w-3.5 h-3.5" /> },
  { id: 'CANCELLATION', label: 'Cancellation Policy', icon: <CalendarCheck className="w-3.5 h-3.5" /> },
  { id: 'REGISTRATION', label: 'Patient Registration', icon: <UserCheck className="w-3.5 h-3.5" /> },
  { id: 'WORKFLOW', label: 'Specialty Workflow', icon: <Activity className="w-3.5 h-3.5" /> },
  { id: 'CLINIC_POLICY', label: 'Clinic Policy', icon: <FileText className="w-3.5 h-3.5" /> },
  { id: 'ESCALATION', label: 'Escalation Protocol', icon: <Shield className="w-3.5 h-3.5" /> },
  { id: 'COMMUNICATION', label: 'Communication Rule', icon: <PhoneCall className="w-3.5 h-3.5" /> },
  { id: 'OTHER_APPROVED_CLINIC_RULE', label: 'Other Approved Rule', icon: <HelpCircle className="w-3.5 h-3.5" /> },
];

export const PlatformClinicAiKnowledge: React.FC = () => {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [selectedClinicId, setSelectedClinicId] = useState<string>('');
  const [items, setItems] = useState<ClinicKnowledgeItem[]>([]);
  const [loadingClinics, setLoadingClinics] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ClinicKnowledgeItem | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ClinicKnowledgeCategory>('ARRIVAL');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState<string>('PUBLISHED');
  const [submitting, setSubmitting] = useState(false);
  const [publishingAll, setPublishingAll] = useState(false);

  // Fetch clinics list
  const fetchClinics = async () => {
    try {
      setLoadingClinics(true);
      const res = await apiRequest<{ clinics: Clinic[] }>('/api/platform/clinics');
      const list = res.clinics || [];
      setClinics(list);
      if (list.length > 0 && !selectedClinicId) {
        setSelectedClinicId(list[0].id);
      }
    } catch (err) {
      console.error('Failed to load clinics:', err);
      showToast('Failed to load clinics list', 'error');
    } finally {
      setLoadingClinics(false);
    }
  };

  // Fetch items for the selected clinic
  const fetchItems = async (clinicId: string) => {
    if (!clinicId) return;
    try {
      setLoadingItems(true);
      const res = await apiRequest<{ items: ClinicKnowledgeItem[] }>(
        `/api/platform/clinics/${clinicId}/ai-knowledge`
      );
      setItems(res.items || []);
    } catch (err) {
      console.error('Failed to load clinic AI knowledge:', err);
      showToast('Failed to load clinic knowledge items', 'error');
    } finally {
      setLoadingItems(false);
    }
  };

  useEffect(() => {
    fetchClinics();
  }, []);

  useEffect(() => {
    if (selectedClinicId) {
      fetchItems(selectedClinicId);
    }
  }, [selectedClinicId]);

  const openCreateModal = () => {
    setEditingItem(null);
    setTitle('');
    setCategory('ARRIVAL');
    setContent('');
    setStatus('PUBLISHED');
    setIsModalOpen(true);
  };

  const openEditModal = (item: ClinicKnowledgeItem) => {
    setEditingItem(item);
    setTitle(item.title);
    setCategory((item.category as ClinicKnowledgeCategory) || 'ARRIVAL');
    setContent(item.content);
    setStatus(item.status || 'PUBLISHED');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim() || !selectedClinicId) {
      showToast('Title and content are required.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      if (editingItem) {
        await apiRequest(`/api/platform/clinics/${selectedClinicId}/ai-knowledge/${editingItem.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            title: title.trim(),
            category,
            content: content.trim(),
            status,
          }),
        });
        showToast('Clinic rule updated successfully.', 'success');
      } else {
        await apiRequest(`/api/platform/clinics/${selectedClinicId}/ai-knowledge`, {
          method: 'POST',
          body: JSON.stringify({
            title: title.trim(),
            category,
            content: content.trim(),
            status,
          }),
        });
        showToast('Clinic rule created successfully.', 'success');
      }
      setIsModalOpen(false);
      fetchItems(selectedClinicId);
    } catch (err: any) {
      showToast(err.message || 'Failed to save clinic rule', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (item: ClinicKnowledgeItem) => {
    if (!window.confirm(`Are you sure you want to delete the rule "${item.title}"?`)) {
      return;
    }

    try {
      await apiRequest(`/api/platform/clinics/${selectedClinicId}/ai-knowledge/${item.id}`, {
        method: 'DELETE',
      });
      showToast('Clinic rule deleted.', 'success');
      fetchItems(selectedClinicId);
    } catch (err: any) {
      showToast(err.message || 'Failed to delete rule', 'error');
    }
  };

  const handlePublishAll = async () => {
    if (!selectedClinicId) return;
    try {
      setPublishingAll(true);
      const res = await apiRequest<{ items: ClinicKnowledgeItem[]; message: string }>(
        `/api/platform/clinics/${selectedClinicId}/ai-knowledge/publish`,
        { method: 'POST' }
      );
      showToast(res.message || 'Published knowledge items.', 'success');
      fetchItems(selectedClinicId);
    } catch (err: any) {
      showToast(err.message || 'Failed to publish knowledge items', 'error');
    } finally {
      setPublishingAll(false);
    }
  };

  const filteredItems = items.filter((item) => {
    const matchesCategory = selectedCategory === 'ALL' || item.category === selectedCategory;
    const matchesSearch =
      !searchQuery ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const selectedClinic = clinics.find((c) => c.id === selectedClinicId);

  return (
    <div className="space-y-6">
      {/* Header & Clinic Selector */}
      <Card
        title="Clinic-Specific AI Knowledge Governance"
        subtitle="Configure and enforce tenant-scoped operational rules, arrival protocols, and policies"
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePublishAll}
              loading={publishingAll}
              icon={<Send className="w-3.5 h-3.5" />}
            >
              Publish All Rules
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={openCreateModal}
              disabled={!selectedClinicId}
              icon={<Plus className="w-3.5 h-3.5" />}
            >
              Add Clinic Rule
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Clinic Selector Dropdown */}
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Building2 className="w-5 h-5 text-[#0A2540]" />
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                  Target Clinic Tenant
                </label>
                <p className="text-[11px] text-gray-500">
                  Select which clinic tenant's isolated AI rules you want to manage.
                </p>
              </div>
            </div>

            <div className="w-full sm:w-80">
              <select
                value={selectedClinicId}
                onChange={(e) => setSelectedClinicId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs bg-white font-medium text-[#0A0A0A] focus:outline-none focus:border-[#0A2540]"
                disabled={loadingClinics}
              >
                {clinics.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.id})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Search & Category Filter */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <div className="w-full sm:w-72">
              <Input
                placeholder="Search rules in selected clinic..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                icon={<Search className="w-3.5 h-3.5 text-gray-400" />}
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
              <button
                type="button"
                onClick={() => setSelectedCategory('ALL')}
                className={`px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap transition-colors border ${
                  selectedCategory === 'ALL'
                    ? 'bg-[#0A2540] text-white border-[#0A2540]'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                All Categories
              </button>
              {APPROVED_CATEGORIES.map((cat) => (
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

          {/* Items List */}
          {loadingItems ? (
            <div className="py-12 text-center text-xs text-gray-500">Loading clinic rules...</div>
          ) : filteredItems.length === 0 ? (
            <div className="py-12 text-center border border-dashed border-gray-200 rounded-lg p-8">
              <BookOpen className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <div className="text-xs font-semibold text-gray-700">No Rules Found</div>
              <p className="text-[11px] text-gray-500 mt-1 max-w-sm mx-auto">
                {searchQuery
                  ? 'No rules match your search filter.'
                  : `No rules found for ${selectedClinic?.name || 'this clinic'}. Click "Add Clinic Rule" to create one.`}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="p-4 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors flex flex-col sm:flex-row sm:items-start justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-700 border border-gray-200">
                        {item.category?.replace(/_/g, ' ')}
                      </span>
                      <Badge
                        status={item.status === 'PUBLISHED' ? 'ACTIVE' : item.status === 'DRAFT' ? 'PENDING' : 'INACTIVE'}
                        label={item.status || 'DRAFT'}
                      />
                      <span className="text-[10px] text-gray-400 font-mono">v{item.version || 1}</span>
                    </div>

                    <h4 className="text-sm font-bold text-[#0A0A0A]">{item.title}</h4>
                    <p className="text-xs text-gray-600 leading-relaxed font-sans">{item.content}</p>

                    <div className="flex items-center gap-4 text-[10px] text-gray-400 pt-1">
                      <span>Updated: {item.updated_at ? new Date(item.updated_at).toLocaleString() : 'N/A'}</span>
                      {item.published_at && (
                        <span>Published: {new Date(item.published_at).toLocaleString()}</span>
                      )}
                      <span className="font-mono">ID: {item.id}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 pt-1 sm:pt-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditModal(item)}
                      icon={<Edit2 className="w-3.5 h-3.5" />}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(item)}
                      icon={<Trash2 className="w-3.5 h-3.5 text-red-500" />}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? 'Edit Clinic AI Rule' : `Add Rule to ${selectedClinic?.name || 'Clinic'}`}
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <Input
            label="Rule Title *"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Patient Arrival & Check-In Protocol"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Rule Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ClinicKnowledgeCategory)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs bg-white focus:outline-none focus:border-[#0A2540]"
              >
                {APPROVED_CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label} ({cat.id})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Publish Status *
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs bg-white focus:outline-none focus:border-[#0A2540]"
              >
                <option value="PUBLISHED">Published (Active at Runtime)</option>
                <option value="VALIDATED">Validated (Ready to Publish)</option>
                <option value="DRAFT">Draft (Not Active)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Instruction / Content *
            </label>
            <textarea
              rows={4}
              required
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="e.g. Patients must arrive 15 minutes before their scheduled appointment with a valid government ID..."
              className="w-full p-3 border border-gray-300 rounded-md text-xs focus:outline-none focus:border-[#0A2540] leading-relaxed"
            />
            <p className="text-[11px] text-gray-500 mt-1">
              This rule will be securely scoped to {selectedClinic?.name} and included in its runtime AI Receptionist snapshot.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-200">
            <Button variant="outline" size="sm" type="button" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={submitting}>
              {editingItem ? 'Update Rule' : 'Create Rule'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
