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
      
      // Convert to Float32Array (-1.0 to 1.0)
      const float32Array = new Float32Array(buffer.length);
      for (let i = 0; i < buffer.length; i++) {
        float32Array[i] = buffer[i] / 32768.0;
      }

      const audioBuffer = audioCtx.createBuffer(1, float32Array.length, 24000);
      audioBuffer.copyToChannel(float32Array, 0);

      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);
      source.start(0);
    } catch (e) {
      console.error("Audio playback error", e);
    }
  };

  const startCall = async () => {
    try {
      setCallState('dialing');
      setTranscript([]);
      setToolLogs([]);
      setDurationSeconds(0);
      setCallOutcome(null);

      const res = await apiRequest<{
        sessionId: string;
        callId: string;
        greeting: string;
        agentName: string;
        patient?: { id: string; name: string };
        audioBase64?: string;
      }>('/api/ai/call/start', {
        method: 'POST',
        body: JSON.stringify({
          clinicId,
          callerPhone: callerPhone.trim(),
        }),
      });

      setSessionId(res.sessionId);
      setCallId(res.callId);
      setAgentName(res.agentName);
      setCallState('connected');

      setTranscript([
        {
          speaker: 'ai',
          text: res.greeting,
          timestamp: '00:00',
        },
      ]);
      
      if (res.audioBase64) {
        playAudio(res.audioBase64);
      }
    } catch (err: any) {
      console.error('Call initiation error:', err);
      setCallState('idle');
      showToast(err.message || 'Failed to start call', 'error');
    }
  };

  const sendTurn = async (text: string) => {
    if (!text.trim() || !sessionId || !callId || loading) return;

    const patientText = text.trim();
    setInputMessage('');
    setLoading(true);

    const currentTimeStr = `${Math.floor(durationSeconds / 60)
      .toString()
      .padStart(2, '0')}:${(durationSeconds % 60).toString().padStart(2, '0')}`;

    const newHistory = [
      ...transcript,
      { speaker: 'patient' as const, text: patientText, timestamp: currentTimeStr },
    ];
    setTranscript(newHistory);

    try {
      const res = await apiRequest<{
        replyText: string;
        toolCallsExecuted: Array<{ name: string; args: any; result: any }>;
        audioBase64?: string;
      }>('/api/ai/call/message', {
        method: 'POST',
        body: JSON.stringify({
          clinicId,
          sessionId,
          callId,
          message: patientText,
          history: newHistory,
          durationSeconds,
        }),
      });

      if (res.toolCallsExecuted && res.toolCallsExecuted.length > 0) {
        setToolLogs((prev) => [...prev, ...res.toolCallsExecuted]);
        // Check for specific outcomes
        for (const tc of res.toolCallsExecuted) {
          if (tc.name === 'createAppointment' && tc.result?.appointment_id) {
            setCallOutcome('APPOINTMENT_BOOKED');
          } else if (tc.name === 'rescheduleAppointment') {
            setCallOutcome('APPOINTMENT_RESCHEDULED');
          } else if (tc.name === 'cancelAppointment') {
            setCallOutcome('APPOINTMENT_CANCELLED');
          } else if (tc.name === 'escalateToStaff') {
            setCallOutcome('ESCALATED');
          }
        }
      }

      if (res.audioBase64) {
        playAudio(res.audioBase64);
      }

      const replyTimeStr = `${Math.floor((durationSeconds + 2) / 60)
        .toString()
        .padStart(2, '0')}:${((durationSeconds + 2) % 60).toString().padStart(2, '0')}`;

      setTranscript((prev) => [
        ...prev,
        {
          speaker: 'ai',
          text: res.replyText,
          timestamp: replyTimeStr,
        },
      ]);
    } catch (err: any) {
      console.error('Turn execution failed:', err);
      setTranscript((prev) => [
        ...prev,
        {
          speaker: 'ai',
          text: 'I apologize, but I encountered a momentary connection glitch. Could you please repeat that?',
          timestamp: currentTimeStr,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Keep ref up to date
  sendTurnRef.current = sendTurn;

  const endCall = async () => {
    if (callState === 'connected' && callId) {
      try {
        await apiRequest('/api/ai/call/end', {
          method: 'POST',
          body: JSON.stringify({
            clinicId,
            callId,
            durationSeconds,
          }),
        });
      } catch (err) {
        console.warn('Error ending call:', err);
      }
    }
    setCallState('ended');
    if (onCallCompleted) {
      onCallCompleted();
    }
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Keyboard ESC for modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript, toolLogs]);

  // Duration timer
  useEffect(() => {
    if (callState === 'connected') {
      timerRef.current = setInterval(() => {
        setDurationSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callState]);

  // Speech Recognition setup if supported
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        const text = event.results?.[0]?.[0]?.transcript;
        setIsListening(false);
        if (text) {
          sendTurnRef.current(text);
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

  const content = (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 bg-white w-full">
      {/* Left Column: Phone & Live Interaction Canvas */}
      <div className="w-full lg:col-span-7 min-w-0 flex flex-col border border-[#E2E8F0] rounded-xl p-3.5 sm:p-5 bg-white">
        {/* Phone Header Bar */}
        <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-[#F1F5F9] mb-3 sm:mb-4">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-[#0F4C5C] flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-xs">
              <Bot className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h4 className="text-xs sm:text-sm font-bold text-[#172B3A] truncate">{agentName}</h4>
                <span className="text-[10px] sm:text-xs text-[#0F4C5C] font-semibold bg-[#0F4C5C]/10 px-1.5 py-0.5 rounded shrink-0">AI Receptionist</span>
              </div>
              <p className="text-[11px] sm:text-xs text-[#64748B] truncate">{clinicName}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {callState === 'connected' && (
              <div className="flex items-center gap-1 sm:gap-1.5 px-2.5 py-1 bg-[#F8FAFC] border border-[#E2E8F0] rounded-md text-[11px] sm:text-xs font-mono font-bold text-[#0F4C5C]">
                <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#0F4C5C]" />
                <span>{formatTimer(durationSeconds)}</span>
              </div>
            )}
            {callOutcome && <Badge status={callOutcome} />}
          </div>
        </div>

        {/* State: Idle / Setup */}
        {callState === 'idle' && (
          <div className="space-y-4 py-2 sm:py-4">
            <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl">
              <h5 className="text-xs font-bold uppercase tracking-wider text-[#172B3A] mb-1.5 sm:mb-2">
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
                  className="w-full px-3 py-2 text-xs sm:text-sm border border-[#E2E8F0] rounded-lg focus:border-[#0F4C5C] focus:ring-2 focus:ring-[#0F4C5C]/15 font-mono text-[#172B3A] bg-white outline-none"
                />
              </div>

              {/* Quick Scenario Buttons */}
              <div className="space-y-1.5 pt-1 sm:pt-2">
                <p className="text-[10px] sm:text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
                  Quick Test Profiles:
                </p>
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  <button
                    onClick={() => {
                      setCallerPhone('+1-555-019-2834');
                      setCallerName('Jonathan Miller');
                    }}
                    className="px-2.5 py-1 text-[11px] sm:text-xs bg-white border border-[#E2E8F0] hover:border-[#0F4C5C] rounded-md font-medium text-[#172B3A] transition-colors cursor-pointer hover:bg-[#0F4C5C]/5"
                  >
                    Jonathan Miller (Returning)
                  </button>
                  <button
                    onClick={() => {
                      setCallerPhone('+1-555-014-9982');
                      setCallerName('Maria Rodriguez');
                    }}
                    className="px-2.5 py-1 text-[11px] sm:text-xs bg-white border border-[#E2E8F0] hover:border-[#0F4C5C] rounded-md font-medium text-[#172B3A] transition-colors cursor-pointer hover:bg-[#0F4C5C]/5"
                  >
                    Maria Rodriguez (General)
                  </button>
                  <button
                    onClick={() => {
                      const randPhone = `+1-555-${Math.floor(100 + Math.random() * 900)}-${Math.floor(1000 + Math.random() * 9000)}`;
                      setCallerPhone(randPhone);
                      setCallerName('New Caller');
                    }}
                    className="px-2.5 py-1 text-[11px] sm:text-xs bg-white border border-[#E2E8F0] hover:border-[#0F4C5C] rounded-md font-medium text-[#172B3A] transition-colors cursor-pointer hover:bg-[#0F4C5C]/5"
                  >
                    + New Patient Caller
                  </button>
                </div>
              </div>
            </div>

            <Button
              variant="primary"
              size="lg"
              className="w-full"
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
            <div className="w-12 h-12 mx-auto rounded-full bg-[#0F4C5C] flex items-center justify-center text-white animate-pulse">
              <Phone className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-[#172B3A]">Connecting to {agentName}...</p>
            <p className="text-xs text-[#64748B] font-mono">Routing call from {callerPhone}</p>
          </div>
        )}

        {/* State: Connected */}
        {callState === 'connected' && (
          <div className="flex-1 flex flex-col min-h-[300px] sm:min-h-[360px]">
            {/* Live Transcript Stream */}
            <div className="flex-1 max-h-[260px] sm:max-h-[320px] overflow-y-auto space-y-2.5 sm:space-y-3 p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl mb-3 sm:mb-4">
              {transcript.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-2 sm:gap-2.5 ${
                    msg.speaker === 'patient' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {msg.speaker === 'ai' && (
                    <div className="w-7 h-7 rounded-lg bg-[#0F4C5C] flex items-center justify-center text-white shrink-0 mt-0.5 shadow-xs">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] sm:max-w-[82%] px-3.5 py-2.5 rounded-xl text-xs leading-relaxed break-words shadow-xs ${
                      msg.speaker === 'patient'
                        ? 'bg-[#083B4A] text-white'
                        : 'bg-white border border-[#E2E8F0] text-[#172B3A]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 mb-1 text-[10px] opacity-75 font-mono">
                      <span>{msg.speaker === 'patient' ? 'Caller' : agentName}</span>
                      <span>{msg.timestamp}</span>
                    </div>
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  </div>

                  {msg.speaker === 'patient' && (
                    <div className="w-7 h-7 rounded-lg bg-[#E2E8F0] flex items-center justify-center text-[#172B3A] shrink-0 mt-0.5">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex items-center gap-2 text-xs text-[#64748B] italic p-2">
                  <span className="inline-block animate-spin h-3.5 w-3.5 border-2 border-[#0F4C5C] border-t-transparent rounded-full" />
                  <span>{agentName} is checking real-time clinic tools...</span>
                </div>
              )}
              <div ref={transcriptEndRef} />
            </div>

            {/* Quick Interactive Prompt Suggestions */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              <span className="text-[10px] sm:text-[11px] text-[#64748B] font-semibold self-center mr-1">Say:</span>
              <button
                onClick={() => sendTurn('Hi, I need to book a cardiac checkup appointment today.')}
                className="px-2.5 py-1 text-[10px] sm:text-[11px] bg-white border border-[#E2E8F0] hover:border-[#0F4C5C] rounded-md text-[#172B3A] cursor-pointer hover:bg-[#0F4C5C]/5 transition-colors"
              >
                "Book cardiac checkup"
              </button>
              <button
                onClick={() => sendTurn('What are your clinic operating hours?')}
                className="px-2.5 py-1 text-[10px] sm:text-[11px] bg-white border border-[#E2E8F0] hover:border-[#0F4C5C] rounded-md text-[#172B3A] cursor-pointer hover:bg-[#0F4C5C]/5 transition-colors"
              >
                "Ask clinic hours"
              </button>
              <button
                onClick={() => sendTurn('Can you reschedule my appointment to tomorrow at 2:00 PM?')}
                className="px-2.5 py-1 text-[10px] sm:text-[11px] bg-white border border-[#E2E8F0] hover:border-[#0F4C5C] rounded-md text-[#172B3A] cursor-pointer hover:bg-[#0F4C5C]/5 transition-colors"
              >
                "Reschedule visit"
              </button>
              <button
                onClick={() => sendTurn('I am having sudden acute chest pain and shortness of breath.')}
                className="px-2.5 py-1 text-[10px] sm:text-[11px] bg-rose-50 border border-rose-300 hover:border-rose-500 font-semibold rounded-md text-rose-700 cursor-pointer transition-colors"
              >
                "Emergency Escalation Test"
              </button>
            </div>

            {/* Input Bar */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={toggleMic}
                className={`p-2 sm:p-2.5 rounded-lg border transition-colors cursor-pointer shrink-0 ${
                  isListening
                    ? 'bg-[#0F4C5C] text-white border-[#0F4C5C] shadow-xs'
                    : 'bg-white text-[#64748B] border-[#E2E8F0] hover:bg-[#F8FAFC]'
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
                className="min-w-0 flex-1 px-3.5 py-2 text-xs border border-[#E2E8F0] rounded-lg focus:border-[#0F4C5C] focus:ring-2 focus:ring-[#0F4C5C]/15 text-[#172B3A] bg-white outline-none"
                disabled={loading}
              />

              <Button
                variant="primary"
                size="sm"
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
            <div className="w-10 h-10 mx-auto rounded-full bg-[#F1F5F9] border border-[#E2E8F0] flex items-center justify-center text-[#64748B]">
              <PhoneOff className="w-5 h-5" />
            </div>
            <h4 className="text-sm font-bold text-[#172B3A]">Call Completed</h4>
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
      <div className="w-full lg:col-span-5 min-w-0 flex flex-col border border-[#E2E8F0] rounded-xl p-3.5 sm:p-5 bg-[#F8FAFC]">
        <div className="flex items-center justify-between pb-2.5 sm:pb-3 border-b border-[#E2E8F0] mb-2.5 sm:mb-3">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Wrench className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#0F4C5C]" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#172B3A]">
              Live Tool Inspector
            </h4>
          </div>
          <span className="text-[10px] sm:text-[11px] font-mono text-[#64748B]">
            {toolLogs.length} tool executions
          </span>
        </div>

        <p className="text-[10px] sm:text-[11px] text-[#64748B] mb-2.5 sm:mb-3">
          Inspect authoritative database tools triggered by the AI Receptionist during the phone call.
        </p>

        <div className="flex-1 max-h-[260px] sm:max-h-[420px] overflow-y-auto space-y-2.5 pr-1">
          {toolLogs.length === 0 ? (
            <div className="text-center py-8 sm:py-12 text-[#94A3B8] text-xs">
              Tools invoked during the conversation (e.g. slot calculations, patient search, appointment bookings) will appear here in real time.
            </div>
          ) : (
            toolLogs.map((tl, i) => (
              <div key={i} className="p-3 bg-white border border-[#E2E8F0] rounded-lg text-xs space-y-1.5 overflow-hidden shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-[#0F4C5C] truncate">{tl.name}()</span>
                  <span className="text-[10px] px-2 py-0.5 bg-[#F1F5F9] rounded text-[#64748B] font-mono shrink-0">
                    Step #{i + 1}
                  </span>
                </div>

                {/* Arguments */}
                {Object.keys(tl.args || {}).length > 0 && (
                  <div className="overflow-hidden">
                    <span className="text-[10px] uppercase font-bold text-[#64748B]">Inputs:</span>
                    <pre className="mt-0.5 p-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded text-[10px] sm:text-[11px] font-mono text-[#172B3A] overflow-x-auto whitespace-pre-wrap break-all max-h-24">
                      {JSON.stringify(tl.args, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Output */}
                <div className="overflow-hidden">
                  <span className="text-[10px] uppercase font-bold text-[#64748B]">Tool Return:</span>
                  <pre className="mt-0.5 p-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded text-[10px] sm:text-[11px] font-mono text-[#172B3A] overflow-x-auto whitespace-pre-wrap break-all max-h-24">
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
          className="fixed inset-0 bg-[#083B4A]/50 backdrop-blur-xs transition-opacity"
          onClick={onClose}
        />
        <div className="flex min-h-full items-center justify-center p-3 sm:p-4 text-center">
          <div className="relative transform overflow-hidden rounded-2xl bg-white text-left shadow-2xl transition-all my-4 sm:my-8 w-full max-w-5xl max-h-[92vh] flex flex-col border border-[#E2E8F0]">
            <div className="px-5 sm:px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between shrink-0 bg-white">
              <div className="min-w-0 pr-3">
                <h3 className="text-sm sm:text-base font-bold text-[#172B3A] truncate">
                  AI Receptionist Phone Call Simulator
                </h3>
                <p className="text-xs text-[#64748B] mt-0.5 truncate">
                  Live voice and tool orchestration testing for {clinicName}
                </p>
              </div>
              {onClose && (
                <button
                  onClick={onClose}
                  className="text-[#64748B] hover:text-[#172B3A] rounded-lg p-1.5 hover:bg-[#F1F5F9] transition-colors cursor-pointer shrink-0"
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

