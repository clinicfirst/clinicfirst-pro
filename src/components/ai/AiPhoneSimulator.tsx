import { showToast } from '../../components/common/Toast';
import React, { useState, useEffect, useRef } from 'react';
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Send,
  Bot,
  User,
  Wrench,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Clock,
  Volume2,
  X,
} from 'lucide-react';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { apiRequest } from '../../api';

interface AiPhoneSimulatorProps {
  isOpen?: boolean;
  onClose?: () => void;
  clinicId: string;
  clinicName?: string;
  onCallCompleted?: () => void;
}

export const AiPhoneSimulator: React.FC<AiPhoneSimulatorProps> = ({
  isOpen,
  onClose,
  clinicId,
  clinicName = 'Clinic',
  onCallCompleted,
}) => {
  const [callerPhone, setCallerPhone] = useState('+1-555-019-2834');
  const [callerName, setCallerName] = useState('Jonathan Miller');
  const [callState, setCallState] = useState<'idle' | 'dialing' | 'connected' | 'ended'>('idle');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [callId, setCallId] = useState<string | null>(null);
  const [agentName, setAgentName] = useState('Ava');
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [transcript, setTranscript] = useState<
    Array<{ speaker: 'ai' | 'patient'; text: string; timestamp: string }>
  >([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [toolLogs, setToolLogs] = useState<Array<{ name: string; args: any; result: any }>>([]);
  const [callOutcome, setCallOutcome] = useState<string | null>(null);

  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionRef = useRef<any>(null);
  const sendTurnRef = useRef<(text: string) => Promise<void>>(async () => {});

  const toggleMic = () => {
    if (!recognitionRef.current) {
      showToast('Speech recognition is not supported in this browser. Please type your message below.', 'success');
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        setIsListening(false);
      }
    }
  };

  const audioCtxRef = useRef<AudioContext | null>(null);

  const getAudioContext = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  const playAudio = async (base64String: string) => {
    try {
      const audioCtx = getAudioContext();
      const binaryString = window.atob(base64String);
      const len = binaryString.length;
      
      // Since it's 16-bit PCM (little-endian), 2 bytes per sample.
      const buffer = new Int16Array(len / 2);
      const dataView = new DataView(buffer.buffer);
      for (let i = 0; i < len; i++) {
        dataView.setUint8(i, binaryString.charCodeAt(i));
      }
      
      const audioBuffer = audioCtx.createBuffer(1, buffer.length, 24000);
      const channelData = audioBuffer.getChannelData(0);
      for (let i = 0; i < buffer.length; i++) {
        channelData[i] = buffer[i] / 32768.0;
      }
      
      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);
      source.start();
    } catch (err) {
      console.warn('Audio playback not supported or failed:', err);
    }
  };

  // Setup Web Speech API for voice input if supported
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        const transcriptText = event.results[0][0].transcript;
        if (transcriptText) {
          setInputMessage(transcriptText);
          sendTurnRef.current(transcriptText);
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  // Timer effect when connected
  useEffect(() => {
    if (callState === 'connected') {
      timerRef.current = setInterval(() => {
        setDurationSeconds((d) => d + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callState]);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript, loading]);

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60)
      .toString()
      .padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const startCall = async () => {
    try {
      setCallState('dialing');
      setTranscript([]);
      setToolLogs([]);
      setDurationSeconds(0);
      setCallOutcome(null);

      // Call backend to start AI Phone Call Session
      const res = await apiRequest<{
        sessionId: string;
        callId: string;
        agentName: string;
        greeting: string;
        audioBase64?: string;
      }>('/api/ai/phone-call/start', {
        method: 'POST',
        body: JSON.stringify({
          clinicId,
          callerPhone,
          callerName,
        }),
      });

      setSessionId(res.sessionId);
      setCallId(res.callId);
      setAgentName(res.agentName || 'Ava');
      setCallState('connected');

      // Add AI initial greeting to transcript
      if (res.greeting) {
        setTranscript([
          {
            speaker: 'ai',
            text: res.greeting,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        if (res.audioBase64) {
          playAudio(res.audioBase64);
        }
      }
    } catch (err: any) {
      console.error('Failed to start AI call:', err);
      showToast(err.message || 'Failed to connect to AI Receptionist', 'error');
      setCallState('idle');
    }
  };

  const sendTurn = async (messageText: string) => {
    if (!messageText.trim() || !sessionId || loading) return;

    const userMsg = messageText.trim();
    setInputMessage('');
    setTranscript((prev) => [
      ...prev,
      {
        speaker: 'patient',
        text: userMsg,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);

    try {
      setLoading(true);
      const res = await apiRequest<{
        reply: string;
        outcome?: string;
        toolCalls?: Array<{ name: string; args: any; result: any }>;
        audioBase64?: string;
      }>('/api/ai/phone-call/turn', {
        method: 'POST',
        body: JSON.stringify({
          sessionId,
          message: userMsg,
        }),
      });

      if (res.toolCalls && res.toolCalls.length > 0) {
        setToolLogs((prev) => [...prev, ...res.toolCalls!]);
      }

      if (res.reply) {
        setTranscript((prev) => [
          ...prev,
          {
            speaker: 'ai',
            text: res.reply,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        if (res.audioBase64) {
          playAudio(res.audioBase64);
        }
      }

      if (res.outcome) {
        setCallOutcome(res.outcome);
      }
    } catch (err: any) {
      console.error('Turn execution error:', err);
      setTranscript((prev) => [
        ...prev,
        {
          speaker: 'ai',
          text: 'I am experiencing a momentary connection blip. Could you please repeat that?',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Keep ref up to date
  sendTurnRef.current = sendTurn;

  const endCall = async () => {
    try {
      if (sessionId) {
        await apiRequest('/api/ai/phone-call/end', {
          method: 'POST',
          body: JSON.stringify({
            sessionId,
            callId,
            durationSeconds,
            outcome: callOutcome || 'COMPLETED',
          }),
        });
      }
    } catch (err) {
      console.warn('Error closing call session:', err);
    } finally {
      setCallState('ended');
      if (onCallCompleted) {
        onCallCompleted();
      }
    }
  };

  const content = (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 bg-white w-full">
      {/* Left Column: Phone & Live Interaction Canvas */}
      <div className="w-full lg:col-span-7 min-w-0 flex flex-col border border-[#E2E8F0] rounded-2xl p-4 sm:p-5 bg-white shadow-xs">
        {/* Phone Header Bar */}
        <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-[#F1F5F9] mb-3 sm:mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0052FF] flex items-center justify-center font-bold text-sm shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-[#0F172A] truncate">{agentName}</h4>
                <span className="text-xs text-[#0052FF] font-semibold bg-blue-50 px-2 py-0.5 rounded-full shrink-0">
                  AI Receptionist
                </span>
              </div>
              <p className="text-xs text-[#64748B] truncate">{clinicName}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {callState === 'connected' && (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-100 rounded-full text-xs font-mono font-bold text-[#0052FF]">
                <Clock className="w-3.5 h-3.5" />
                <span>{formatTimer(durationSeconds)}</span>
              </div>
            )}
            {callOutcome && <Badge status={callOutcome} />}
          </div>
        </div>

        {/* State: Idle / Setup */}
        {callState === 'idle' && (
          <div className="space-y-4 py-2 sm:py-4">
            <div className="p-4 bg-slate-50 border border-[#E2E8F0] rounded-2xl">
              <h5 className="text-xs font-bold uppercase tracking-wider text-[#0F172A] mb-1.5 sm:mb-2">
                Simulate Inbound Patient Call
              </h5>
              <p className="text-xs text-[#64748B] mb-3">
                Dial the clinic AI receptionist to test appointment booking, reschedule, cancellation, doctor queries, or emergency escalation.
              </p>

              <div className="space-y-1.5 mb-3">
                <label className="block text-xs font-semibold text-[#475569]">Caller Phone Number</label>
                <input
                  type="text"
                  value={callerPhone}
                  onChange={(e) => setCallerPhone(e.target.value)}
                  placeholder="+1-555-019-2834"
                  className="w-full px-3.5 py-2 text-xs sm:text-sm border border-[#E2E8F0] rounded-xl focus:border-[#0052FF] focus:ring-2 focus:ring-blue-500/10 font-mono text-[#0F172A] bg-white outline-none"
                />
              </div>

              {/* Quick Scenario Buttons */}
              <div className="space-y-1.5 pt-1 sm:pt-2">
                <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
                  Quick Test Profiles:
                </p>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  <button
                    onClick={() => {
                      setCallerPhone('+1-555-019-2834');
                      setCallerName('Jonathan Miller');
                    }}
                    className="px-3 py-1.5 text-xs bg-white border border-[#E2E8F0] hover:border-[#0052FF] rounded-xl font-medium text-[#0F172A] transition-colors cursor-pointer hover:bg-blue-50"
                  >
                    Jonathan Miller (Returning)
                  </button>
                  <button
                    onClick={() => {
                      setCallerPhone('+1-555-014-9982');
                      setCallerName('Maria Rodriguez');
                    }}
                    className="px-3 py-1.5 text-xs bg-white border border-[#E2E8F0] hover:border-[#0052FF] rounded-xl font-medium text-[#0F172A] transition-colors cursor-pointer hover:bg-blue-50"
                  >
                    Maria Rodriguez (General)
                  </button>
                  <button
                    onClick={() => {
                      const randPhone = `+1-555-${Math.floor(100 + Math.random() * 900)}-${Math.floor(1000 + Math.random() * 9000)}`;
                      setCallerPhone(randPhone);
                      setCallerName('New Caller');
                    }}
                    className="px-3 py-1.5 text-xs bg-white border border-[#E2E8F0] hover:border-[#0052FF] rounded-xl font-medium text-[#0F172A] transition-colors cursor-pointer hover:bg-blue-50"
                  >
                    + New Patient Caller
                  </button>
                </div>
              </div>
            </div>

            <Button
              variant="primary"
              size="lg"
              className="w-full !bg-[#0052FF] hover:!bg-blue-700"
              icon={<Phone className="w-4 h-4" />}
              onClick={startCall}
            >
              Start Inbound Call
            </Button>
          </div>
        )}

        {/* State: Dialing */}
        {callState === 'dialing' && (
          <div className="py-12 sm:py-16 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-[#0052FF] flex items-center justify-center text-white animate-pulse">
              <Phone className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-[#0F172A]">Connecting to {agentName}...</p>
            <p className="text-xs text-[#64748B] font-mono">Routing call from {callerPhone}</p>
          </div>
        )}

        {/* State: Connected */}
        {callState === 'connected' && (
          <div className="flex-1 flex flex-col min-h-[300px] sm:min-h-[360px]">
            {/* Live Transcript Stream */}
            <div className="flex-1 max-h-[260px] sm:max-h-[320px] overflow-y-auto space-y-2.5 sm:space-y-3 p-3 bg-slate-50 border border-[#E2E8F0] rounded-2xl mb-3 sm:mb-4">
              {transcript.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-2 sm:gap-2.5 ${
                    msg.speaker === 'patient' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {msg.speaker === 'ai' && (
                    <div className="w-7 h-7 rounded-lg bg-[#0052FF] flex items-center justify-center text-white shrink-0 mt-0.5 shadow-xs">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] sm:max-w-[82%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed break-words shadow-xs ${
                      msg.speaker === 'patient'
                        ? 'bg-slate-900 text-white'
                        : 'bg-white border border-[#E2E8F0] text-[#0F172A]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 mb-1 text-[10px] opacity-75 font-mono">
                      <span>{msg.speaker === 'patient' ? 'Caller' : agentName}</span>
                      <span>{msg.timestamp}</span>
                    </div>
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  </div>

                  {msg.speaker === 'patient' && (
                    <div className="w-7 h-7 rounded-lg bg-slate-200 flex items-center justify-center text-slate-800 shrink-0 mt-0.5">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex items-center gap-2 text-xs text-[#64748B] italic p-2">
                  <span className="inline-block animate-spin h-3.5 w-3.5 border-2 border-[#0052FF] border-t-transparent rounded-full" />
                  <span>{agentName} is querying clinical calendar & rules...</span>
                </div>
              )}
              <div ref={transcriptEndRef} />
            </div>

            {/* Quick Interactive Prompt Suggestions */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              <span className="text-[11px] text-[#64748B] font-semibold self-center mr-1">Say:</span>
              <button
                onClick={() => sendTurn('Hi, I need to book a cardiac checkup appointment today.')}
                className="px-2.5 py-1 text-xs bg-white border border-[#E2E8F0] hover:border-[#0052FF] rounded-lg text-[#0F172A] cursor-pointer hover:bg-blue-50 transition-colors"
              >
                "Book cardiac checkup"
              </button>
              <button
                onClick={() => sendTurn('What are your clinic operating hours?')}
                className="px-2.5 py-1 text-xs bg-white border border-[#E2E8F0] hover:border-[#0052FF] rounded-lg text-[#0F172A] cursor-pointer hover:bg-blue-50 transition-colors"
              >
                "Ask clinic hours"
              </button>
              <button
                onClick={() => sendTurn('Can you reschedule my appointment to tomorrow at 2:00 PM?')}
                className="px-2.5 py-1 text-xs bg-white border border-[#E2E8F0] hover:border-[#0052FF] rounded-lg text-[#0F172A] cursor-pointer hover:bg-blue-50 transition-colors"
              >
                "Reschedule visit"
              </button>
              <button
                onClick={() => sendTurn('I am having sudden acute chest pain and shortness of breath.')}
                className="px-2.5 py-1 text-xs bg-rose-50 border border-rose-200 hover:border-rose-400 font-semibold rounded-lg text-rose-700 cursor-pointer transition-colors"
              >
                "Emergency Escalation Test"
              </button>
            </div>

            {/* Input Bar */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={toggleMic}
                className={`p-2.5 rounded-xl border transition-colors cursor-pointer shrink-0 ${
                  isListening
                    ? 'bg-[#0052FF] text-white border-[#0052FF] shadow-xs'
                    : 'bg-white text-[#64748B] border-[#E2E8F0] hover:bg-slate-50'
                }`}
                title={isListening ? 'Listening... click to stop' : 'Click to speak via Microphone'}
              >
                {isListening ? <Mic className="w-4 h-4 text-white" /> : <MicOff className="w-4 h-4" />}
              </button>

              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') sendTurn(inputMessage);
                }}
                placeholder="Speak or type caller response..."
                className="min-w-0 flex-1 px-3.5 py-2.5 text-xs sm:text-sm border border-[#E2E8F0] rounded-xl focus:border-[#0052FF] focus:ring-2 focus:ring-blue-500/10 text-[#0F172A] bg-white outline-none"
                disabled={loading}
              />

              <Button
                variant="primary"
                size="sm"
                className="!bg-[#0052FF] hover:!bg-blue-700"
                icon={<Send className="w-3.5 h-3.5" />}
                onClick={() => sendTurn(inputMessage)}
                disabled={loading || !inputMessage.trim()}
              >
                Send
              </Button>

              <Button
                variant="secondary"
                size="sm"
                className="border-[#E2E8F0] text-[#64748B] hover:text-rose-600"
                icon={<PhoneOff className="w-3.5 h-3.5" />}
                onClick={endCall}
              >
                End
              </Button>
            </div>
          </div>
        )}

        {/* State: Ended */}
        {callState === 'ended' && (
          <div className="py-6 sm:py-8 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-100 flex items-center justify-center text-slate-600">
              <PhoneOff className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-[#0F172A]">Call Completed</h4>
            <p className="text-xs text-[#64748B] font-mono">
              Total Duration: {formatTimer(durationSeconds)} | Messages: {transcript.length}
            </p>
            {callOutcome && (
              <div className="pt-1">
                <Badge status={callOutcome} />
              </div>
            )}
            <div className="pt-3">
              <Button variant="outline" size="sm" onClick={() => setCallState('idle')}>
                Make Another Call
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Right Column: Real-Time Backend Tool Execution Inspector */}
      <div className="w-full lg:col-span-5 min-w-0 flex flex-col border border-[#E2E8F0] rounded-2xl p-4 sm:p-5 bg-slate-50">
        <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0] mb-3">
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-[#0052FF]" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#0F172A]">
              Live Tool Inspector
            </h4>
          </div>
          <span className="text-xs font-mono text-[#0052FF] font-semibold bg-blue-50 px-2 py-0.5 rounded-md">
            {toolLogs.length} Executions
          </span>
        </div>

        <p className="text-xs text-[#64748B] mb-3">
          Inspect authoritative database tools triggered by the AI Receptionist during the phone call.
        </p>

        <div className="flex-1 max-h-[260px] sm:max-h-[420px] overflow-y-auto space-y-2.5 pr-1">
          {toolLogs.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs">
              Tools invoked during the conversation (e.g. slot calculations, patient search, appointment bookings) will appear here in real time.
            </div>
          ) : (
            toolLogs.map((tl, i) => (
              <div key={i} className="p-3 bg-white border border-[#E2E8F0] rounded-xl text-xs space-y-1.5 overflow-hidden shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-[#0052FF] truncate">{tl.name}()</span>
                  <span className="text-[10px] px-2 py-0.5 bg-slate-100 rounded text-[#64748B] font-mono shrink-0">
                    Step #{i + 1}
                  </span>
                </div>

                {/* Arguments */}
                {Object.keys(tl.args || {}).length > 0 && (
                  <div className="overflow-hidden">
                    <span className="text-[10px] uppercase font-bold text-[#64748B]">Inputs:</span>
                    <pre className="mt-0.5 p-2 bg-slate-50 border border-[#E2E8F0] rounded-lg text-[11px] font-mono text-[#0F172A] overflow-x-auto whitespace-pre-wrap break-all max-h-24">
                      {JSON.stringify(tl.args, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Output */}
                <div className="overflow-hidden">
                  <span className="text-[10px] uppercase font-bold text-[#64748B]">Tool Return:</span>
                  <pre className="mt-0.5 p-2 bg-slate-50 border border-[#E2E8F0] rounded-lg text-[11px] font-mono text-[#0F172A] overflow-x-auto whitespace-pre-wrap break-all max-h-24">
                    {JSON.stringify(tl.result, null, 2)}
                  </pre>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  // If in modal mode and closed, do not render
  if (isOpen === false) {
    return null;
  }

  // If in modal mode and open, wrap in modal dialog
  if (isOpen === true) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
          onClick={onClose}
        />
        <div className="flex min-h-full items-center justify-center p-3 sm:p-4 text-center">
          <div className="relative transform overflow-hidden rounded-3xl bg-white text-left shadow-2xl transition-all my-4 sm:my-8 w-full max-w-5xl max-h-[92vh] flex flex-col border border-[#E2E8F0]">
            <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between shrink-0 bg-white">
              <div className="min-w-0 pr-3">
                <h3 className="text-base font-bold text-[#0F172A] truncate">
                  AI Receptionist Phone Call Simulator
                </h3>
                <p className="text-xs text-[#64748B] mt-0.5 truncate">
                  Live voice and tool orchestration testing for {clinicName}
                </p>
              </div>
              {onClose && (
                <button
                  onClick={onClose}
                  className="text-[#64748B] hover:text-[#0F172A] rounded-xl p-1.5 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
                  aria-label="Close dialog"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
            <div className="p-4 sm:p-6 overflow-y-auto flex-1">{content}</div>
          </div>
        </div>
      </div>
    );
  }

  // Embed mode (isOpen is undefined)
  return content;
};
