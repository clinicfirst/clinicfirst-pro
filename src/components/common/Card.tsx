import React from 'react';

interface CardProps {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  headerClassName?: string;
  interactive?: boolean;
}

export const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  action,
  children,
  className = '',
  headerClassName = '',
  interactive = false,
}) => {
  const hoverStyles = interactive
    ? 'transition-all duration-200 ease-out hover:shadow-md hover:border-[#CBD5E1] motion-safe:hover:-translate-y-0.5'
    : 'shadow-xs';

  return (
    <div className={`bg-white border border-[#E2E8F0] rounded-xl overflow-hidden ${hoverStyles} ${className}`}>
      {(title || subtitle || action) && (
        <div
          className={`px-5 sm:px-6 py-4 border-b border-[#F1F5F9] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 ${headerClassName}`}
        >
          <div>
            {title && <h3 className="text-sm sm:text-base font-semibold text-[#172B3A] tracking-tight">{title}</h3>}
            {subtitle && <p className="text-xs text-[#64748B] mt-0.5">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className="p-4 sm:p-6">{children}</div>
    </div>
  );
};

