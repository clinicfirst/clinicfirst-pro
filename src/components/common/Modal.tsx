import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
  position?: 'center' | 'top';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'md',
  position = 'center',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
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

  if (!isOpen) return null;

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-3xl',
    '3xl': 'max-w-4xl',
    '4xl': 'max-w-5xl',
  };

  const positionClasses = position === 'top' ? 'items-start pt-16 sm:pt-20' : 'items-center';
  const marginClasses = position === 'top' ? 'mb-8 sm:mb-10' : 'my-4 sm:my-8';
  const maxHeightClasses = position === 'top' ? 'max-h-[calc(100vh-8rem)]' : 'max-h-[90vh]';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#083B4A]/50 backdrop-blur-xs transition-opacity animate-fade-enter"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className={`relative z-10 flex min-h-full justify-center p-3 sm:p-4 text-center pointer-events-none ${positionClasses}`}>
        <div
          className={`relative transform overflow-hidden rounded-2xl bg-white text-left shadow-2xl ${marginClasses} w-full ${maxWidthClasses[maxWidth]} ${maxHeightClasses} flex flex-col border border-[#E2E8F0] animate-modal-enter pointer-events-auto`}
        >
          {/* Header */}
          <div className="px-5 sm:px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between shrink-0 bg-white">
            <div className="min-w-0 pr-3">
              <h3 className="text-sm sm:text-base font-bold text-[#172B3A] truncate">{title}</h3>
              {subtitle && <p className="text-xs text-[#64748B] mt-0.5 line-clamp-2">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              className="text-[#64748B] hover:text-[#172B3A] rounded-lg p-1.5 hover:bg-[#F1F5F9] transition-colors cursor-pointer shrink-0"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="px-5 sm:px-6 py-5 overflow-y-auto flex-1">{children}</div>
        </div>
      </div>
    </div>
  );
};
