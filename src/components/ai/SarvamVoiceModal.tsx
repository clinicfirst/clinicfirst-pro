import React, { useEffect } from 'react';
import { X, Phone, ShieldCheck } from 'lucide-react';
import { SarvamVoiceWidget } from './SarvamVoiceWidget';

interface SarvamVoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  clinicId: string;
  clinicName?: string;
  onOpenDiagnosticSimulator?: () => void;
}

export const SarvamVoiceModal: React.FC<SarvamVoiceModalProps> = ({
  isOpen,
  onClose,
  clinicId,
  clinicName = 'Clinic',
  onOpenDiagnosticSimulator,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-fade-in">
      <div 
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Dark Blue Header */}
        <div className="bg-[#0052FF] text-white px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-white">
              <Phone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold leading-tight">AI Receptionist Voice Call</h2>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-400/20 text-emerald-100 border border-emerald-400/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live
                </span>
              </div>
              <p className="text-xs text-blue-100 truncate max-w-[280px]">
                {clinicName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body with Sarvam Managed Widget */}
        <div className="p-5 overflow-y-auto max-h-[80vh]">
          <SarvamVoiceWidget
            onOpenDiagnosticSimulator={onOpenDiagnosticSimulator}
            buttonText="Start AI Receptionist Call"
          />

          {/* Real Patient Journey Flow Information */}
          <div className="mt-4 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 mb-1.5">
              <ShieldCheck className="w-4 h-4 text-[#0052FF]" />
              <span>Production Patient Interaction Workflow</span>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-600">
              Patient speaks naturally → Sarvam AI identifies patient & intent → Validates doctors & real schedule slots → Confirms booking details → Authoritative database record updated.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
