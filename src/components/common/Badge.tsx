import React from 'react';
import {
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  RefreshCw,
  MinusCircle,
  UserCheck,
  PhoneCall,
  Bot,
  User,
  Shield,
} from 'lucide-react';

export type BadgeStatus =
  | 'CONFIRMED'
  | 'REQUESTED'
  | 'RESCHEDULED'
  | 'CANCELLED'
  | 'COMPLETED'
  | 'NO_SHOW'
  | 'ACTIVE'
  | 'INACTIVE'
  | 'ESCALATED'
  | 'IN_PROGRESS'
  | 'STAFF'
  | 'AI_RECEPTIONIST'
  | 'PLATFORM_ADMIN'
  | 'CLINIC_ADMIN'
  | 'CLINIC_STAFF';

interface BadgeProps {
  status: BadgeStatus | string;
  label?: string;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ status, label, className = '' }) => {
  const normalized = (status || '').toUpperCase();

  const getStatusConfig = () => {
    switch (normalized) {
      case 'CONFIRMED':
        return {
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-[#0A2540]" />,
          border: 'border-[#0A2540]/30 bg-[#0A2540]/10 text-[#0A2540] font-semibold',
          text: label || 'Confirmed',
        };
      case 'COMPLETED':
        return {
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-slate-700" />,
          border: 'border-slate-300 bg-slate-100 text-slate-800 font-medium',
          text: label || 'Completed',
        };
      case 'ACTIVE':
        return {
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-[#0A2540]" />,
          border: 'border-[#0A2540]/30 bg-[#0A2540]/10 text-[#0A2540] font-semibold',
          text: label || 'Active',
        };
      case 'REQUESTED':
      case 'PENDING':
        return {
          icon: <Clock className="w-3.5 h-3.5 text-amber-700" />,
          border: 'border-amber-200 bg-amber-50 text-amber-800 font-medium',
          text: label || 'Requested',
        };
      case 'RESCHEDULED':
        return {
          icon: <RefreshCw className="w-3.5 h-3.5 text-slate-700" />,
          border: 'border-slate-300 bg-slate-100 text-slate-800 font-medium',
          text: label || 'Rescheduled',
        };
      case 'CANCELLED':
      case 'INACTIVE':
        return {
          icon: <XCircle className="w-3.5 h-3.5 text-slate-400" />,
          border: 'border-slate-200 bg-slate-50 text-slate-500 font-normal',
          text: label || (normalized === 'CANCELLED' ? 'Cancelled' : 'Inactive'),
        };
      case 'NO_SHOW':
        return {
          icon: <MinusCircle className="w-3.5 h-3.5 text-rose-600" />,
          border: 'border-rose-200 bg-rose-50 text-rose-700 font-medium',
          text: label || 'No Show',
        };
      case 'ESCALATED':
        return {
          icon: <AlertCircle className="w-3.5 h-3.5 text-rose-600" />,
          border: 'border-rose-200 bg-rose-50 text-rose-700 font-semibold',
          text: label || 'Escalated',
        };
      case 'IN_PROGRESS':
        return {
          icon: <PhoneCall className="w-3.5 h-3.5 text-[#0A2540] animate-pulse" />,
          border: 'border-[#0A2540]/30 bg-[#0A2540]/10 text-[#0A2540] font-medium',
          text: label || 'In Progress',
        };
      case 'AI_RECEPTIONIST':
        return {
          icon: <Bot className="w-3.5 h-3.5 text-white" />,
          border: 'bg-[#0A2540] text-white border border-[#0A2540] font-medium shadow-xs',
          text: label || 'AI Receptionist',
        };
      case 'STAFF':
        return {
          icon: <User className="w-3.5 h-3.5 text-slate-600" />,
          border: 'border-slate-200 bg-slate-50 text-slate-700 font-medium',
          text: label || 'Clinic Staff',
        };
      case 'PLATFORM_ADMIN':
        return {
          icon: <Shield className="w-3.5 h-3.5 text-white" />,
          border: 'bg-[#06182C] text-white border border-[#06182C] font-semibold shadow-xs',
          text: label || 'Platform Admin',
        };
      case 'CLINIC_ADMIN':
        return {
          icon: <UserCheck className="w-3.5 h-3.5 text-white" />,
          border: 'bg-[#0A2540] text-white border border-[#0A2540] font-semibold shadow-xs',
          text: label || 'Clinic Admin',
        };
      case 'CLINIC_STAFF':
        return {
          icon: <User className="w-3.5 h-3.5 text-slate-600" />,
          border: 'border-slate-200 bg-slate-100 text-slate-700 font-medium',
          text: label || 'Staff',
        };
      default:
        return {
          icon: null,
          border: 'border-slate-200 bg-slate-50 text-slate-700 font-normal',
          text: label || status,
        };
    }
  };

  const config = getStatusConfig();

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs rounded-md border tracking-tight select-none whitespace-nowrap transition-opacity duration-200 hover:opacity-95 ${config.border} ${className}`}
    >
      {config.icon}
      <span>{config.text}</span>
    </span>
  );
};

