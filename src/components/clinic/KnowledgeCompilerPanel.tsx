import React, { useState, useEffect } from 'react';
import { BookOpen, RefreshCw, Download, CheckCircle, AlertTriangle, Eye, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../api';
import { ClinicKnowledgeRelease } from '../../types';

export const KnowledgeCompilerPanel: React.FC = () => {
  const { user } = useAuth();
  const [releases, setReleases] = useState<ClinicKnowledgeRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [compiling, setCompiling] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);

  useEffect(() => {
    fetchReleases();
  }, [user]);

  const fetchReleases = async () => {
    if (!user?.clinic_id) return;
    try {
      const res = await apiRequest<{ releases: ClinicKnowledgeRelease[] }>(`/api/compiler/${user.clinic_id}/releases`);
      setReleases(res.releases || []);
    } catch (err) {
      console.error('Failed to fetch releases', err);
    } finally {
      setLoading(false);
    }
  };

  const generateSnapshot = async () => {
    if (!user?.clinic_id) return;
    setCompiling(true);
    try {
      const res = await apiRequest<{ success: boolean; release: ClinicKnowledgeRelease; message?: string }>(`/api/compiler/${user.clinic_id}/compile`, {
        method: 'POST'
      });
      if (res.message) {
        alert(res.message);
      }
      await fetchReleases();
    } catch (err: any) {
      alert(err.message || 'Failed to compile snapshot');
    } finally {
      setCompiling(false);
    }
  };

  const markAsPublished = async (releaseId: string) => {
    if (!user?.clinic_id) return;
    try {
      await apiRequest(`/api/compiler/${user.clinic_id}/releases/${releaseId}/publish`, {
        method: 'POST'
      });
      await fetchReleases();
    } catch (err: any) {
      alert(err.message || 'Failed to mark as published');
    }
  };

  const downloadSnapshot = (release: ClinicKnowledgeRelease) => {
    // 14. Security requirements scan (basic client-side check)
    const content = release.compiled_content;
    if (content.includes('SARVAM_API_KEY') || content.includes('SUPABASE_SERVICE_ROLE_KEY')) {
      alert('SECURITY ALERT: Sensitive keys detected in snapshot! Download blocked.');
      return;
    }

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Clinic_AI_Knowledge_${user?.clinic_id}_v${release.version}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="p-6 text-sm text-gray-500">Loading knowledge compiler...</div>;

  const latestRelease = releases[0];
  const publishedRelease = releases.find(r => r.status === 'PUBLISHED');
  const hasMismatch = latestRelease && latestRelease.version !== publishedRelease?.version;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-[#0A0A0A] rounded-lg">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <h2 className="text-lg font-bold text-[#0A0A0A]">AI Receptionist Knowledge Base</h2>
        </div>
        <p className="text-sm text-gray-500">
          Compile static clinic knowledge into a voice-optimized snapshot for the Sarvam AI Agent.
        </p>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="p-4 rounded-lg bg-gray-50 border border-gray-100">
            <div className="text-sm text-gray-500 mb-1">Current Compiled Version</div>
            <div className="text-2xl font-bold text-[#0A0A0A]">
              {latestRelease ? `Version ${latestRelease.version}` : 'None'}
            </div>
          </div>
          
          <div className="p-4 rounded-lg bg-gray-50 border border-gray-100">
            <div className="text-sm text-gray-500 mb-1">Last Published to Sarvam</div>
            <div className="text-2xl font-bold text-[#0A0A0A]">
              {publishedRelease ? `Version ${publishedRelease.version}` : 'None'}
            </div>
          </div>
        </div>

        {hasMismatch && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
            <div>
              <h4 className="font-semibold text-amber-800">New knowledge is ready</h4>
              <p className="text-sm text-amber-700 mt-1">
                Version {latestRelease.version} has been compiled but not yet published. The AI is still operating on Version {publishedRelease?.version || 'None'}.
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-3 mb-8">
          {latestRelease && (
            <button 
              onClick={() => setPreviewContent(previewContent ? null : latestRelease.compiled_content)}
              className="px-4 py-2 bg-white border border-gray-200 text-[#0A0A0A] text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <Eye className="w-4 h-4" />
              {previewContent ? 'Hide Preview' : 'Preview Knowledge'}
            </button>
          )}
          
          <button 
            onClick={generateSnapshot}
            disabled={compiling}
            className="px-4 py-2 bg-[#0A0A0A] text-white text-sm font-medium rounded-lg hover:bg-black transition-colors flex items-center gap-2 disabled:opacity-70"
          >
            <RefreshCw className={`w-4 h-4 ${compiling ? 'animate-spin' : ''}`} />
            Generate Snapshot
          </button>
          
          {latestRelease && user?.role === 'PLATFORM_ADMIN' && (
            <button 
              onClick={() => downloadSnapshot(latestRelease)}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download for Sarvam
            </button>
          )}
        </div>

        {previewContent && (
          <div className="mb-8 p-4 bg-gray-50 border border-gray-200 rounded-lg max-h-96 overflow-y-auto font-mono text-xs whitespace-pre-wrap">
            {previewContent}
          </div>
        )}

        {latestRelease && user?.role === 'PLATFORM_ADMIN' && hasMismatch && (
          <div className="border-t border-gray-100 pt-6">
            <h3 className="text-sm font-bold text-[#0A0A0A] mb-2">Platform Admin Manual Publication Step</h3>
            <p className="text-xs text-gray-500 mb-4">
              1. Download the snapshot.<br/>
              2. Upload it to the Sarvam Console for agent: <strong>{user.clinic_id}</strong>.<br/>
              3. Publish the agent in Sarvam.<br/>
              4. Mark as published below.
            </p>
            <button 
              onClick={() => markAsPublished(latestRelease.id)}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              Mark as Published
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
