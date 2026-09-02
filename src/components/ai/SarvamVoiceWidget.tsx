import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { AlertCircle, MicOff, Settings, ShieldAlert } from 'lucide-react';
import { apiRequest } from '../../api';

interface SarvamConfig {
  enabled: boolean;
  appId: string;
  orgId: string;
  workspaceId: string;
  embedKey: string;
}

export const SarvamVoiceWidget: React.FC = () => {
  const { user } = useAuth();
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [scriptError, setScriptError] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [config, setConfig] = useState<SarvamConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        setConfigLoading(true);
        setConfigError(null);
        const data = await apiRequest<SarvamConfig>('/api/clinic/me/ai-widget-config');
        setConfig(data);
      } catch (err: any) {
        setConfigError(err.message || 'Failed to load AI agent configuration.');
      } finally {
        setConfigLoading(false);
      }
    };
    fetchConfig();
  }, []);

  useEffect(() => {
    if (configLoading || configError || !config) return;

    const existingScript = document.querySelector('script[src="https://unpkg.com/sarvam-convai-embed"]');
    if (existingScript) {
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
    // Attempt to catch unhandled mic errors if the widget throws them
    const handleRejection = (event: PromiseRejectionEvent) => {
      if (
        event.reason?.name === 'NotAllowedError' ||
        event.reason?.name === 'NotFoundError' ||
        event.reason?.message?.toLowerCase().includes('microphone')
      ) {
        setMicError('Microphone access is unavailable. Please check your browser microphone permissions.');
      }
    };
    window.addEventListener('unhandledrejection', handleRejection);
    return () => window.removeEventListener('unhandledrejection', handleRejection);
  }, []);

  if (configLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-gray-50 border border-gray-200 rounded-xl">
        <div className="text-xs text-gray-500 font-medium">Resolving clinic agent configuration...</div>
      </div>
    );
  }

  if (configError) {
    return (
      <div className="flex flex-col items-center justify-center space-y-2 p-6 bg-gray-50 border border-gray-200 rounded-xl relative overflow-hidden">
        <ShieldAlert className="w-6 h-6 text-yellow-600 mb-1" />
        <h3 className="text-sm font-bold text-[#0A0A0A]">AI Receptionist Unavailable</h3>
        <p className="text-xs text-gray-500 text-center max-w-sm">{configError}</p>
      </div>
    );
  }

  if (scriptError) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
        <div>
          <h4 className="text-sm font-bold text-red-800">Widget Failed to Load</h4>
          <p className="text-xs text-red-600 mt-1">
            Could not load the Sarvam AI voice widget. Please check your network connection.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center space-y-4 p-6 bg-gray-50 border border-gray-200 rounded-xl relative overflow-hidden">
      <div className="text-center space-y-1">
        <h3 className="text-sm font-bold text-[#0A0A0A]">Sarvam AI Test Agent</h3>
        <p className="text-xs text-gray-500">
          Click the button below to start a live voice conversation using your browser microphone.
        </p>
      </div>

      {!scriptLoaded ? (
        <div className="text-xs text-gray-500 font-medium py-4">Initializing voice widget...</div>
      ) : (!config?.embedKey || !config?.appId || !config?.orgId || !config?.workspaceId || config.embedKey === 'demo-embed-key') ? (
        <div className="text-xs text-red-500 font-medium py-4">
          Widget configuration is incomplete. Please set Sarvam credentials in the environment.
        </div>
      ) : (
        <div className="sarvam-widget-wrapper">
          {/* @ts-ignore */}
          <sarvam-widget
            api-key={config.embedKey}
            app-id={config.appId}
            org-id={config.orgId}
            workspace-id={config.workspaceId}
            user-id={user?.id || 'anonymous-tester'}
            button-text="Call Sarvam Test Agent"
            interaction-type="voice"
          ></sarvam-widget>
        </div>
      )}

      {micError && (
        <div className="w-full p-3 bg-red-50 border border-red-100 rounded flex items-center gap-2 mt-4">
          <MicOff className="w-4 h-4 text-red-600 shrink-0" />
          <span className="text-xs text-red-700">{micError}</span>
        </div>
      )}

      <div className="absolute bottom-2 right-3">
        <span className="text-[10px] font-semibold tracking-wider text-gray-400 uppercase">
          Powered by Sarvam AI
        </span>
      </div>
    </div>
  );
};
