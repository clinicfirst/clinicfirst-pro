import React, { useState, useEffect } from 'react';
import { BookOpen, RefreshCw, Download, CheckCircle, AlertTriangle, Eye, ShieldAlert, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../api';
import { ClinicKnowledgeRelease } from '../../types';

export const KnowledgeCompilerPanel: React.FC = () => {
  const { user } = useAuth();
  const [releases, setReleases] = useState<ClinicKnowledgeRelease[]>([]);
  const [targetAgent, setTargetAgent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [compiling, setCompiling] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [publishConfirm, setPublishConfirm] = useState(false);

  useEffect(() => {
    fetchReleases();
  }, [user]);

  const fetchReleases = async () => {
    if (!user?.clinic_id) return;
    try {
      const res = await apiRequest<{ releases: ClinicKnowledgeRelease[], target_agent: any }>(`/api/compiler/${user.clinic_id}/releases`);
      setReleases(res.releases || []);
      setTargetAgent(res.target_agent || null);
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
    if (!publishConfirm) {
      alert('You must explicitly confirm that this exact release was uploaded.');
      return;
    }
    try {
      await apiRequest(`/api/compiler/${user.clinic_id}/releases/${releaseId}/publish`, {
        method: 'POST'
      });
      setPublishConfirm(false);
      await fetchReleases();
      alert('Release successfully marked as PUBLISHED.');
    } catch (err: any) {
      alert(err.message || 'Failed to mark as published');
    }
  };

  const downloadSnapshot = (release: ClinicKnowledgeRelease) => {
    const content = release.compiled_content;
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clinicfirst-kb-v${release.version}-${release.document_hash.substring(0,8)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copySnapshot = (release: ClinicKnowledgeRelease) => {
    navigator.clipboard.writeText(release.compiled_content).then(() => {
      alert('Markdown copied to clipboard!');
    }).catch(err => {
      alert('Failed to copy: ' + err);
    });
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
            {latestRelease && <div className="text-xs text-gray-400 mt-1">Hash: {latestRelease.document_hash.substring(0,8)}...</div>}
          </div>
          
          <div className="p-4 rounded-lg bg-gray-50 border border-gray-100">
            <div className="text-sm text-gray-500 mb-1">Last Published to Sarvam</div>
            <div className="text-2xl font-bold text-[#0A0A0A]">
              {publishedRelease ? `Version ${publishedRelease.version}` : 'None'}
            </div>
            {publishedRelease && <div className="text-xs text-gray-400 mt-1">Hash: {publishedRelease.document_hash.substring(0,8)}...</div>}
            {publishedRelease?.published_by && <div className="text-xs text-gray-400">By: {publishedRelease.published_by}</div>}
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
        </div>

        {previewContent && (
          <div className="mb-8 p-4 bg-gray-50 border border-gray-200 rounded-lg max-h-96 overflow-y-auto font-mono text-xs whitespace-pre-wrap">
            {previewContent}
          </div>
        )}

        {latestRelease && hasMismatch && (
          <div className="border-t border-gray-100 pt-6">
            <h3 className="text-sm font-bold text-[#0A0A0A] mb-2">Publish to Sarvam Knowledge Base</h3>
            
            <div className="mb-4 text-xs">
               <strong>Target Agent:</strong> {targetAgent?.name || 'N/A'}<br/>
               <strong>Provider:</strong> {targetAgent?.provider || 'Sarvam'}<br/>
               <strong>Status:</strong> <span className="text-red-600 font-semibold">Manual upload required</span>
            </div>

            <p className="text-xs text-gray-600 mb-4 bg-gray-50 p-3 rounded border border-gray-100">
              1. Download or copy the compiled Markdown.<br/>
              2. Open the configured Sarvam Voice Agent Dashboard.<br/>
              3. Open that Agent's Knowledge Base.<br/>
              4. Upload/paste the compiled Markdown.<br/>
              5. Verify that the upload succeeded in Sarvam.<br/>
              6. Verify that the correct Agent is being edited.<br/>
              7. Return to Clinic-1st.<br/>
              8. Confirm that this exact release was published below.<br/><br/>
              <em>Clinic-1st will record this release as PUBLISHED only after you confirm the upload in Sarvam.</em>
            </p>
            
            <div className="flex gap-2 mb-4">
              <button 
                onClick={() => downloadSnapshot(latestRelease)}
                className="px-4 py-2 bg-blue-50 text-blue-700 text-sm font-medium rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download Markdown
              </button>
              <button 
                onClick={() => copySnapshot(latestRelease)}
                className="px-4 py-2 bg-blue-50 text-blue-700 text-sm font-medium rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-2"
              >
                <BookOpen className="w-4 h-4" />
                Copy Markdown
              </button>
            </div>

            <div className="p-4 bg-white border border-gray-200 rounded-lg">
               <h4 className="font-semibold text-sm mb-2 text-[#0A0A0A]">Confirm Sarvam KB publication</h4>
               <div className="text-xs text-gray-500 mb-3 space-y-1">
                  <div><strong>Release:</strong> Version {latestRelease.version}</div>
                  <div><strong>Hash:</strong> {latestRelease.document_hash}</div>
                  <div><strong>Clinic:</strong> {user.clinic_id}</div>
               </div>
               
               <label className="flex items-start gap-2 mb-4 cursor-pointer">
                 <input 
                   type="checkbox" 
                   checked={publishConfirm}
                   onChange={e => setPublishConfirm(e.target.checked)}
                   className="mt-0.5 rounded border-gray-300 text-[#0A0A0A] focus:ring-[#0A0A0A]"
                 />
                 <span className="text-xs font-semibold text-gray-700">
                   I verified that this exact release was uploaded to the correct Sarvam Agent Knowledge Base.
                 </span>
               </label>
               
               <div className="flex gap-2">
                 <button 
                   onClick={() => markAsPublished(latestRelease.id)}
                   disabled={!publishConfirm}
                   className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                   <CheckCircle className="w-4 h-4" />
                   Confirm Published
                 </button>
                 <button 
                   onClick={() => setPublishConfirm(false)}
                   className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
                 >
                   Cancel
                 </button>
               </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
