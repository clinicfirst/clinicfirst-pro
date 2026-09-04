import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { AlertCircle, MicOff, ShieldAlert, Sparkles, Phone, Terminal } from 'lucide-react';
import { apiRequest } from '../../api';

export interface SarvamConfig {
  enabled: boolean;
  clinic_id?: string;
  provider_agent_id?: string;
  appId: string;
  orgId: string;
  workspaceId: string;
  embedKey: string;
}

interface SarvamVoiceWidgetProps {
  onOpenDiagnosticSimulator?: () => void;
  buttonText?: string;
  compact?: boolean;
}

export const SarvamVoiceWidget: React.FC<SarvamVoiceWidgetProps> = ({
  onOpenDiagnosticSimulator,
  buttonText = 'Call AI Receptionist',
  compact = false,
}) => {
  const { user } = useAuth();
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [scriptError, setScriptError] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [config, setConfig] = useState<SarvamConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchConfig = async () => {
      try {
        setConfigLoading(true);
        setConfigError(null);
        const data = await apiRequest<SarvamConfig>('/api/clinic/me/ai-widget-config');
        if (isMounted) {
          setConfig(data);
        }
      } catch (err: any) {
        if (isMounted) {
          setConfigError(err.message || 'Failed to load AI agent configuration.');
        }
      } finally {
        if (isMounted) {
          setConfigLoading(false);
        }
      }
    };
    fetchConfig();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (configLoading || configError || !config) return;

    // Check if customElements already defines sarvam-widget
    if (typeof window !== 'undefined' && window.customElements && window.customElements.get('sarvam-widget')) {
      setScriptLoaded(true);
      return;
    }

    const existingScript = document.querySelector('script[src="https://unpkg.com/sarvam-convai-embed"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => setScriptLoaded(true));
      existingScript.addEventListener('error', () => setScriptError(true));
      setScriptLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/sarvam-convai-embed';
    script.async = true;
    script.onload = () => setScriptLoaded(true);
    script.onerror = () => setScriptError(true);
    document.body.appendChild(script);
  }, [configLoading, configError, config]);

  useEffect(() => {
    const handleRejection = (event: PromiseRejectionEvent) => {
      if (
        event.reason?.name === 'NotAllowedError' ||
        event.reason?.name === 'NotFoundError' ||
        event.reason?.message?.toLowerCase().includes('microphone')
      ) {
        setMicError('Microphone access was denied or is unavailable. Please check your browser microphone permissions.');
      }
    };
    window.addEventListener('unhandledrejection', handleRejection);
    return () => window.removeEventListener('unhandledrejection', handleRejection);
  }, []);

  if (configLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-white border border-gray-200 rounded-xl">
        <div className="animate-spin w-6 h-6 border-2 border-[#0052FF] border-t-transparent rounded-full mb-3" />
        <div className="text-xs text-gray-600 font-medium">Resolving clinic AI agent configuration...</div>
      </div>
    );
  }

  if (configError) {
    return (
      <div className="flex flex-col items-center justify-center space-y-3 p-6 bg-gray-50 border border-gray-200 rounded-xl text-center">
        <ShieldAlert className="w-8 h-8 text-amber-600" />
        <div>
          <h3 className="text-sm font-bold text-[#0A0A0A]">AI Receptionist Unavailable</h3>
          <p className="text-xs text-gray-500 mt-1 max-w-sm">{configError}</p>
        </div>
        {onOpenDiagnosticSimulator && (
          <button
            onClick={onOpenDiagnosticSimulator}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer mt-2"
          >
            <Terminal className="w-3.5 h-3.5 text-gray-500" />
            <span>Open Diagnostic Simulator (Dev/Offline)</span>
          </button>
        )}
      </div>
    );
  }

  if (scriptError) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
        <div className="space-y-2">
          <div>
            <h4 className="text-sm font-bold text-red-800">Sarvam Managed Widget Failed to Load</h4>
            <p className="text-xs text-red-600 mt-0.5">
              Could not load the Sarvam managed voice script from unpkg. Please check your network connection.
            </p>
          </div>
          {onOpenDiagnosticSimulator && (
            <button
              onClick={onOpenDiagnosticSimulator}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-red-200 rounded-lg text-xs font-semibold text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Use Diagnostic Simulator Fallback</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  const effectiveAppId = config?.provider_agent_id || config?.appId || '';
  const effectiveEmbedKey = config?.embedKey || (import.meta.env.VITE_SARVAM_EMBED_KEY as string) || '';
  const effectiveOrgId = config?.orgId || (import.meta.env.VITE_SARVAM_ORG_ID as string) || '';
  const effectiveWorkspaceId = config?.workspaceId || (import.meta.env.VITE_SARVAM_WORKSPACE_ID as string) || '';

  // Valid production configuration requires all three browser-safe keys to be non-empty and non-demo/placeholder
  const isValidConfig = Boolean(
    effectiveEmbedKey &&
    effectiveOrgId &&
    effectiveWorkspaceId &&
    !effectiveEmbedKey.startsWith('demo-') &&
    effectiveEmbedKey !== 'YOUR_SARVAM_EMBED_KEY' &&
    effectiveOrgId !== 'YOUR_SARVAM_ORG_ID' &&
    effectiveWorkspaceId !== 'YOUR_SARVAM_WORKSPACE_ID'
  );

  return (
    <div className={`flex flex-col items-center justify-center ${compact ? 'p-4' : 'p-6'} bg-white border border-gray-200 rounded-2xl relative shadow-xs`}>
      {/* Top Details & Status */}
      <div className="text-center space-y-1 mb-4 w-full">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-[#0052FF] text-[11px] font-semibold mb-1">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Production Sarvam AI Managed Widget</span>
        </div>
        <h3 className="text-base font-bold text-[#0A0A0A]">Live AI Voice Receptionist</h3>
        <p className="text-xs text-gray-500 max-w-md mx-auto">
          Talk to the clinic AI receptionist using high-quality browser voice. Real database availability and bookings are enforced server-side.
        </p>
        <div className="flex items-center justify-center gap-2 pt-1 text-[11px] text-gray-500">
          <span>Agent ID: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-700 font-mono text-[10px]">{effectiveAppId || 'Unassigned'}</code></span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${isValidConfig ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            {isValidConfig ? 'Active' : 'Configuration Pending'}
          </span>
        </div>
      </div>

      {/* Status or Configuration Notice */}
      {isValidConfig ? (
        <div className="w-full mb-3 py-1.5 px-3 bg-emerald-50/70 border border-emerald-100 rounded-lg flex items-center justify-center gap-1.5 text-[11px] text-emerald-800 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
          <span>Ready for browser voice testing.</span>
        </div>
      ) : (
        <div className="w-full mb-4 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-left">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-xs text-amber-900 space-y-1">
              <p className="font-semibold">Browser Voice Configuration Required</p>
              <p className="text-[11px] leading-relaxed text-amber-700">
                To connect browser voice calls with Sarvam AI, set <code className="font-mono bg-amber-100 px-1 py-0.5 rounded">VITE_SARVAM_EMBED_KEY</code>, <code className="font-mono bg-amber-100 px-1 py-0.5 rounded">VITE_SARVAM_ORG_ID</code>, and <code className="font-mono bg-amber-100 px-1 py-0.5 rounded">VITE_SARVAM_WORKSPACE_ID</code> in deployment environment settings.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Sarvam Web Component Render Area */}
      <div className="w-full flex flex-col items-center justify-center py-2 min-h-[80px]">
        {!effectiveAppId ? (
          <div className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl text-center">
            <p className="text-xs font-semibold text-gray-800">No Sarvam Agent ID Configured</p>
            <p className="text-[11px] text-gray-500 mt-1">
              This clinic does not have an assigned Sarvam voice agent ID. Update the Agent ID in the AI Receptionist settings tab.
            </p>
          </div>
        ) : !isValidConfig ? (
          <div className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl text-center space-y-2">
            <p className="text-xs text-gray-600">
              Sarvam managed voice widget will activate as soon as production environment credentials are provided.
            </p>
            {onOpenDiagnosticSimulator && (
              <button
                onClick={onOpenDiagnosticSimulator}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <Terminal className="w-3.5 h-3.5 text-gray-500" />
                <span>Open Diagnostic Simulator (Dev/Offline)</span>
              </button>
            )}
          </div>
        ) : !scriptLoaded ? (
          <div className="flex items-center gap-2 text-xs text-gray-500 font-medium py-3">
            <div className="w-3.5 h-3.5 border-2 border-[#0052FF] border-t-transparent rounded-full animate-spin" />
            <span>Initializing Sarvam voice engine...</span>
          </div>
        ) : (
          <div className="sarvam-widget-wrapper w-full flex justify-center py-2">
            <sarvam-widget
              api-key={effectiveEmbedKey}
              app-id={effectiveAppId}
              org-id={effectiveOrgId}
              workspace-id={effectiveWorkspaceId}
              user-id={user?.id || 'clinic-staff'}
              button-text={buttonText}
              interaction-type="voice"
            ></sarvam-widget>
          </div>
        )}
      </div>

      {micError && (
        <div className="w-full p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 mt-3 text-left">
          <MicOff className="w-4 h-4 text-red-600 shrink-0" />
          <span className="text-xs text-red-700">{micError}</span>
        </div>
      )}

      {/* Diagnostic Simulator Switch Link (Explicit developer option) */}
      {onOpenDiagnosticSimulator && (
        <div className="w-full pt-4 mt-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
          <span>Need to inspect live database tools or view text transcripts?</span>
          <button
            onClick={onOpenDiagnosticSimulator}
            className="inline-flex items-center gap-1.5 text-[#0052FF] hover:underline font-semibold cursor-pointer shrink-0 ml-2"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Open Diagnostic Simulator</span>
          </button>
        </div>
      )}

      {/* Footer Branding */}
      <div className="mt-4 text-[10px] font-semibold tracking-wider text-gray-400 uppercase">
        Powered by Sarvam AI Conversational Engine
      </div>
    </div>
  );
};

