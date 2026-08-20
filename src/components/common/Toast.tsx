import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

export const toastEvent = new EventTarget();

export const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
  const event = new CustomEvent('show-toast', { detail: { message, type } });
  toastEvent.dispatchEvent(event);
};

export const ToastContainer: React.FC = () => {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    
    const handleToast = (e: Event) => {
      const customEvent = e as CustomEvent;
      setToast(customEvent.detail);
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => setToast(null), 3500);
    };
    
    toastEvent.addEventListener('show-toast', handleToast);
    return () => {
      toastEvent.removeEventListener('show-toast', handleToast);
      if (timeout) clearTimeout(timeout);
    };
  }, []);

  if (!toast) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] animate-toast-enter flex items-center gap-2 bg-[#0A2540] text-white px-4 py-3 rounded-md shadow-lg text-sm font-medium">
      {toast.type === 'success' ? (
        <CheckCircle2 className="w-4 h-4 text-green-400" />
      ) : toast.type === 'info' ? (
        <Info className="w-4 h-4 text-sky-400" />
      ) : (
        <AlertCircle className="w-4 h-4 text-red-400" />
      )}
      <span>{toast.message}</span>
    </div>
  );
};

