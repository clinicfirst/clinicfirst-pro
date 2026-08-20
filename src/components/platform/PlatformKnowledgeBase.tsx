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
} from 'lucide-react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { PlatformKnowledgeItem, KnowledgeCategory } from '../../types';
import { apiRequest } from '../../api';

export const PlatformKnowledgeBase: React.FC = () => {
  const [items, setItems] = useState<PlatformKnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PlatformKnowledgeItem | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<KnowledgeCategory>('APPOINTMENT_POLICIES');
  const [content, setContent] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [existingFileName, setExistingFileName] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const categories: Array<{ id: string; label: string; icon: React.ReactNode }> = [
    { id: 'ALL', label: 'All Knowledge', icon: <BookOpen className="w-3.5 h-3.5" /> },
    { id: 'APPOINTMENT_POLICIES', label: 'Appointment Policies', icon: <CalendarCheck className="w-3.5 h-3.5" /> },
    { id: 'RECEPTION_GUIDANCE', label: 'Reception Guidance', icon: <PhoneCall className="w-3.5 h-3.5" /> },
    { id: 'ESCALATION_PROTOCOLS', label: 'Escalation Protocols', icon: <Shield className="w-3.5 h-3.5" /> },
    { id: 'COMMUNICATION_RULES', label: 'Communication Rules', icon: <FileText className="w-3.5 h-3.5" /> },
    { id: 'GENERAL_FAQS', label: 'General FAQs', icon: <HelpCircle className="w-3.5 h-3.5" /> },
  ];

  const fetchItems = async () => {
    try {
      setLoading(true);
      const res = await apiRequest<{ items: PlatformKnowledgeItem[] }>('/api/platform/knowledge-base');
      setItems(res.items || []);
    } catch (err: any) {
      console.error('Failed to load knowledge base:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const openCreateModal = () => {
    setEditingItem(null);
    setTitle('');
    setCategory('APPOINTMENT_POLICIES');
    setContent('');
    setIsActive(true);
    setFile(null);
    setExistingFileName(null);
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const openEditModal = (item: PlatformKnowledgeItem) => {
    setEditingItem(item);
    setTitle(item.title);
    setCategory(item.category);
    setContent(item.content);
    setIsActive(item.is_active);
    setFile(null);
    setExistingFileName(item.file_name || null);
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const convertFileToBase64 = (f: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
      reader.readAsDataURL(f);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || (!content.trim() && !file && !existingFileName)) {
      setErrorMessage('Title and either content or a file attachment are required.');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      let fileDataStr: string | undefined;
      let fileName: string | undefined;
      let fileType: string | undefined;
      let fileSize: number | undefined;

      if (file) {
        fileDataStr = await convertFileToBase64(file);
        fileName = file.name;
        fileType = file.type;
        fileSize = file.size;
      }

      const payload: any = {
        title: title.trim(),
        category,
        content: content.trim(),
        is_active: isActive,
      };

      if (file) {
        payload.file_name = fileName;
        payload.file_type = fileType;
        payload.file_data = fileDataStr;
        payload.file_size = fileSize;
      }

      if (editingItem) {
        // Update
        const res = await apiRequest<{ item: PlatformKnowledgeItem }>(
          `/api/platform/knowledge-base/${editingItem.id}`,
          {
            method: 'PUT',
            body: JSON.stringify(payload),
          }
        );
        setItems(items.map((it) => (it.id === editingItem.id ? res.item : it)));
        setSuccessMessage('Knowledge item successfully updated.');
      } else {
        // Create
        const res = await apiRequest<{ item: PlatformKnowledgeItem }>('/api/platform/knowledge-base', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setItems([res.item, ...items]);
        setSuccessMessage('New knowledge item added.');
      }

      setIsModalOpen(false);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save knowledge item.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, itemTitle: string) => {
    if (!confirm(`Are you sure you want to delete "${itemTitle}" from the platform knowledge base?`)) {
      return;
    }

    try {
      await apiRequest(`/api/platform/knowledge-base/${id}`, { method: 'DELETE' });
      setItems(items.filter((it) => it.id !== id));
      setSuccessMessage('Knowledge item removed.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      showToast(err.message || 'Failed to delete knowledge item.', 'error');
    }
  };

  const handleToggleActive = async (item: PlatformKnowledgeItem) => {
    try {
      const res = await apiRequest<{ item: PlatformKnowledgeItem }>(
        `/api/platform/knowledge-base/${item.id}`,
        {
          method: 'PUT',
          body: JSON.stringify({ is_active: !item.is_active }),
        }
      );
      setItems(items.map((it) => (it.id === item.id ? res.item : it)));
    } catch (err: any) {
      showToast(err.message || 'Failed to update item status.', 'error');
    }
  };

  // Filtered List
  const filtered = items.filter((it) => {
    const matchesCat = selectedCategory === 'ALL' || it.category === selectedCategory;
    const matchesSearch =
      !searchQuery.trim() ||
      (it.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (it.content || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-[#0A0A0A]">Platform Knowledge Base</h2>
            <span className="bg-[#0A2540] text-white text-[10px] font-mono px-2 py-0.5 rounded font-semibold uppercase">
              Global Knowledge
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1 max-w-2xl">
            Standard operating policies, communication guidelines, and non-medical FAQs injected into all clinic AI
            receptionists. Clinic-specific database data (doctors, services, schedules) is automatically loaded in
            addition to this knowledge.
          </p>
        </div>

        <Button
          onClick={openCreateModal}
          className="text-xs bg-[#0A2540] text-white hover:bg-[#071b30] flex items-center gap-1.5 shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Knowledge Item
        </Button>
      </div>

      {successMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-md text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Category Pills & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap transition-colors cursor-pointer border ${
                selectedCategory === cat.id
                  ? 'bg-[#0A2540] text-white border-[#0A2540]'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {cat.icon}
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search knowledge..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-gray-200 rounded text-[#0A0A0A] focus:outline-none focus:border-[#0A2540]"
          />
        </div>
      </div>

      {/* Articles Grid / List */}
      {loading ? (
        <div className="py-12 flex justify-center text-gray-400 text-xs font-mono">
          Loading platform knowledge base...
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center text-gray-500 text-xs">
          <BookOpen className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="font-semibold text-gray-700">No knowledge items found.</p>
          <p className="text-[11px] text-gray-400 mt-1">
            {searchQuery || selectedCategory !== 'ALL'
              ? 'Try adjusting your search or category filter.'
              : 'Add your first standard clinic communication or scheduling guideline.'}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((item) => (
            <Card key={item.id} className="p-4 flex flex-col justify-between hover:border-gray-300 transition-colors">
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <span
                      className={`inline-block text-[10px] font-mono font-semibold px-2 py-0.5 rounded border uppercase mb-1.5 ${
                        item.category === 'APPOINTMENT_POLICIES'
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : item.category === 'ESCALATION_PROTOCOLS'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : item.category === 'RECEPTION_GUIDANCE'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-gray-100 text-gray-700 border-gray-200'
                      }`}
                    >
                      {item.category.replace(/_/g, ' ')}
                    </span>
                    <h3 className="text-xs font-bold text-[#0A0A0A] leading-snug">{item.title}</h3>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(item)}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold border cursor-pointer ${
                        item.is_active
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-gray-100 text-gray-500 border-gray-200'
                      }`}
                      title="Toggle active status"
                    >
                      {item.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </div>
                </div>

                <p className="text-xs text-gray-600 leading-relaxed line-clamp-4 mt-2 font-normal">
                  {item.content || <span className="text-gray-400 italic">No text content</span>}
                </p>

                {item.file_name && (
                  <div className="mt-3 flex items-center gap-1.5 p-2 bg-gray-50 border border-gray-100 rounded text-xs text-gray-700">
                    <FileText className="w-3.5 h-3.5 text-[#0A2540]" />
                    <span className="font-semibold truncate" title={item.file_name}>{item.file_name}</span>
                    {item.file_size && <span className="text-[10px] text-gray-400 ml-auto shrink-0">{(item.file_size / 1024).toFixed(0)} KB</span>}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 mt-4 border-t border-gray-100 text-[11px] text-gray-400">
                <span className="flex items-center gap-1 font-mono text-[10px]">
                  <Clock className="w-3 h-3 text-gray-300" />
                  {new Date(item.updated_at).toLocaleDateString()}
                </span>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEditModal(item)}
                    className="p-1 text-gray-500 hover:text-[#0A2540] transition-colors"
                    title="Edit item"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id, item.title)}
                    className="p-1 text-gray-400 hover:text-rose-600 transition-colors"
                    title="Delete item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg border border-gray-200 max-w-xl w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-sm font-bold text-[#0A0A0A]">
                {editingItem ? 'Edit Knowledge Item' : 'Add New Knowledge Item'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-700 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Title</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Standard 2-Hour Cancellation Policy"
                  className="text-xs"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as KnowledgeCategory)}
                  className="w-full text-xs rounded border border-gray-300 bg-white px-3 py-2 text-[#0A0A0A] focus:outline-none focus:border-[#0A2540]"
                >
                  <option value="APPOINTMENT_POLICIES">Appointment Policies</option>
                  <option value="RECEPTION_GUIDANCE">Reception Guidance</option>
                  <option value="ESCALATION_PROTOCOLS">Escalation Protocols</option>
                  <option value="COMMUNICATION_RULES">Communication Rules</option>
                  <option value="GENERAL_FAQS">General FAQs</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Content / Instruction Body</label>
                <textarea
                  rows={6}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="State the exact policy, guidance, or non-medical facts that the AI should follow..."
                  className="w-full text-xs rounded border border-gray-300 p-3 text-[#0A0A0A] focus:outline-none focus:border-[#0A2540] leading-relaxed font-sans"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Upload File (Optional)</label>
                <div className="flex flex-col gap-2">
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="text-xs text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-[#0A2540] file:text-white hover:file:bg-[#071b30] cursor-pointer border border-gray-300 rounded p-1 w-full"
                  />
                  {existingFileName && !file && (
                    <p className="text-xs text-gray-500">
                      Currently attached: <span className="font-semibold text-[#0A2540]">{existingFileName}</span>
                    </p>
                  )}
                  {file && (
                    <p className="text-[11px] text-gray-500">
                      Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
                    </p>
                  )}
                </div>
                <p className="text-[10px] text-gray-400 mt-1">Supports PDF, Word, Excel, TXT, CSV.</p>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isActiveToggle"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded border-gray-300 text-[#0A2540] focus:ring-[#0A2540]"
                />
                <label htmlFor="isActiveToggle" className="text-xs text-gray-700 font-medium">
                  Active (Immediately injected into all clinic AI sessions)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  loading={submitting}
                  className="text-xs bg-[#0A2540] text-white hover:bg-[#071b30]"
                >
                  {editingItem ? 'Save Changes' : 'Create Item'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
