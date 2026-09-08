import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { AlertCircle, MicOff, Sparkles, Phone, Terminal, PhoneOff, Mic } from 'lucide-react';
import { apiRequest } from '../../api';
import { SarvamSession } from '../../lib/sarvam/sarvam-session';

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
  compact = false,
}) => {
  const { user } = useAuth();
  
  const [micError, setMicError] = useState<string | null>(null);
  const [config, setConfig] = useState<SarvamConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState(false);

  // Call states
  const [callState, setCallState] = useState<'idle' | 'connecting' | 'listening' | 'speaking' | 'error'>('idle');
  const sessionRef = useRef<any>(null);

  useEffect(() => {
    let mounted = true;
    const fetchConfig = async () => {
      try {
        setConfigLoading(true);
        const data = await apiRequest<SarvamConfig>('/api/clinic/me/ai-widget-config');
        if (mounted) {
          setConfig(data);
          setConfigError(false);
        }
      } catch (err) {
        console.error('Failed to load Sarvam config:', err);
        if (mounted) {
          setConfigError(true);
        }
      } finally {
        if (mounted) {
          setConfigLoading(false);
        }
      }
    };
    fetchConfig();
    return () => {
      mounted = false;
    };
  }, []);

  // Cleanup session on unmount
  useEffect(() => {
    return () => {
      if (sessionRef.current) {
        sessionRef.current.stop().catch(console.error);
        sessionRef.current = null;
      }
    };
  }, []);

  const effectiveAppId = config?.provider_agent_id || config?.appId || '';
  const effectiveEmbedKey = config?.embedKey || (import.meta.env.VITE_SARVAM_EMBED_KEY as string) || '';
  const effectiveOrgId = config?.orgId || (import.meta.env.VITE_SARVAM_ORG_ID as string) || '';
  const effectiveWorkspaceId = config?.workspaceId || (import.meta.env.VITE_SARVAM_WORKSPACE_ID as string) || '';

  const isValidConfig = Boolean(
    effectiveEmbedKey &&
    effectiveOrgId &&
    effectiveWorkspaceId &&
    effectiveAppId &&
    !effectiveEmbedKey.startsWith('demo-') &&
    effectiveEmbedKey !== 'YOUR_SARVAM_EMBED_KEY' &&
    effectiveOrgId !== 'YOUR_SARVAM_ORG_ID' &&
    effectiveWorkspaceId !== 'YOUR_SARVAM_WORKSPACE_ID'
  );

  const handleStartCall = async () => {
    if (!isValidConfig) return;
    
    setMicError(null);
    setCallState('connecting');

    try {
      // Create session using official SDK-backed SarvamSession with minimal config
      const session = new SarvamSession({
        apiKey: effectiveEmbedKey,
        orgId: effectiveOrgId,
        workspaceId: effectiveWorkspaceId,
        appId: effectiveAppId,
        userId: user?.id || 'clinic-staff',
        interactionType: 'call',
      });

      sessionRef.current = session;

      session.on('statechange', ({ state }: { state: string }) => {
        if (state === 'idle') setCallState('idle');
        else if (state === 'connecting') setCallState('connecting');
        else if (state === 'listening') setCallState('listening');
        else if (state === 'speaking') setCallState('speaking');
        else if (state === 'error') setCallState('error');
      });

      session.on('disconnect', () => {
        setCallState('idle');
      });

      session.on('error', (err: any) => {
        console.error('[SarvamVoiceWidget] Session error:', err);
        setMicError(err?.message || 'Voice connection encountered an error.');
        setCallState('error');
      });

      await session.start();
    } catch (err: any) {
      console.error('[SarvamVoiceWidget] Failed to start Sarvam session:', {
        name: err?.name,
        message: err?.message,
        stack: err?.stack,
        error: err,
      });

      const message = err?.message || 'Failed to connect to the voice agent.';
      setMicError(message);
      setCallState('error');
      sessionRef.current = null;
    }
  };

  const handleEndCall = async () => {
    if (sessionRef.current) {
      try {
        await sessionRef.current.stop();
      } catch (e) {
        console.error('Error stopping session:', e);
      }
      sessionRef.current = null;
    }
    setCallState('idle');
  };

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
      <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex flex-col items-center text-center gap-3">
        <AlertCircle className="w-6 h-6 text-red-500" />
        <div>
          <h4 className="text-sm font-bold text-red-800">Configuration Error</h4>
          <p className="text-xs text-red-600 mt-1">Failed to load AI agent configuration from the server.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center ${compact ? 'p-4' : 'p-6'} bg-white border border-gray-200 rounded-2xl relative shadow-xs`}>
      {/* Top Details & Status */}
      <div className="text-center space-y-1 mb-4 w-full">
        <h3 className="text-base font-bold text-[#0A0A0A]">Live AI Voice Receptionist</h3>
        <p className="text-xs text-gray-500 max-w-md mx-auto">
          Talk to the clinic AI receptionist using high-quality browser voice. Real database availability and bookings are enforced server-side.
        </p>
      </div>

      {!isValidConfig ? (
        <div className="w-full mb-4 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-left">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-xs text-amber-900 space-y-1">
              <p className="font-semibold">Browser Voice Configuration Required</p>
              <p className="text-[11px] leading-relaxed text-amber-700">
                To connect browser voice calls, ensure the Agent ID is configured for this clinic and environment keys are set.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full flex flex-col items-center justify-center py-4 min-h-[160px] bg-slate-50 border border-slate-200 rounded-xl mt-2">
          
          {callState === 'idle' && (
            <button
              onClick={handleStartCall}
              className="group relative flex flex-col items-center gap-3 cursor-pointer"
            >
              <div className="w-16 h-16 bg-[#0052FF] text-white rounded-full flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                <Mic className="w-7 h-7" />
              </div>
              <span className="text-sm font-bold text-slate-700 group-hover:text-[#0052FF]">Start AI Call</span>
            </button>
          )}

          {callState === 'connecting' && (
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 bg-blue-100 text-[#0052FF] rounded-full flex items-center justify-center shadow-inner relative">
                <div className="absolute inset-0 rounded-full border-4 border-[#0052FF] border-t-transparent animate-spin"></div>
                <Phone className="w-6 h-6 animate-pulse" />
              </div>
              <span className="text-sm font-bold text-blue-600">Connecting...</span>
            </div>
          )}

          {(callState === 'listening' || callState === 'speaking') && (
            <div className="flex flex-col items-center gap-4 w-full px-6">
              <div className="relative">
                {callState === 'speaking' && (
                  <div className="absolute inset-0 bg-emerald-400 rounded-full animate-ping opacity-30"></div>
                )}
                <div className={`w-20 h-20 rounded-full flex items-center justify-center shadow-lg relative z-10 transition-colors duration-300 ${callState === 'speaking' ? 'bg-emerald-500' : 'bg-emerald-100'}`}>
                  <Sparkles className={`w-8 h-8 ${callState === 'speaking' ? 'text-white' : 'text-emerald-600'}`} />
                </div>
              </div>
              
              <div className="text-center h-8 flex items-center justify-center">
                {callState === 'listening' ? (
                  <span className="text-sm font-bold text-slate-600 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                    Listening...
                  </span>
                ) : (
                  <span className="text-sm font-bold text-emerald-600">Aarohi is speaking...</span>
                )}
              </div>

              <button
                onClick={handleEndCall}
                className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl font-bold transition-colors cursor-pointer"
              >
                <PhoneOff className="w-4 h-4" />
                <span>End Call</span>
              </button>
            </div>
          )}

          {callState === 'error' && (
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 bg-slate-200 text-slate-500 rounded-full flex items-center justify-center">
                <MicOff className="w-7 h-7" />
              </div>
              <span className="text-sm font-bold text-slate-600">Call Ended</span>
              <button
                onClick={() => setCallState('idle')}
                className="mt-2 text-xs text-[#0052FF] font-semibold hover:underline cursor-pointer"
              >
                Try Again
              </button>
            </div>
          )}

        </div>
      )}

      {micError && (
        <div className="w-full p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 mt-3 text-left">
          <MicOff className="w-4 h-4 text-red-600 shrink-0" />
          <span className="text-xs text-red-700">{micError}</span>
        </div>
      )}

      {/* Diagnostic Simulator Switch Link (Explicit developer option) */}
      {onOpenDiagnosticSimulator && (
        <div className="w-full pt-4 mt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
          <span>Need to inspect live database tools or view text transcripts?</span>
          <button
            onClick={onOpenDiagnosticSimulator}
            className="inline-flex items-center gap-1.5 text-[#0052FF] hover:underline font-semibold cursor-pointer shrink-0 ml-2"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Open Diagnostic Simulator (Dev/Internal)</span>
          </button>
        </div>
      )}
      
      {/* Footer Branding */}
      <div className="mt-4 text-[10px] font-semibold tracking-wider text-gray-400 uppercase">
        Voice powered by Sarvam
      </div>
    </div>
  );
};
