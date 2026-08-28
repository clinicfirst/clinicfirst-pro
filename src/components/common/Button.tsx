import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'teal' | 'danger-outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-medium transition-all duration-200 ease-out cursor-pointer select-none rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0A2540]/30 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none disabled:active:scale-100 whitespace-nowrap active:scale-[0.98]';

  const sizeStyles = {
    sm: 'text-xs px-3 py-1.5 gap-1.5',
    md: 'text-xs sm:text-sm px-4 py-2 gap-2',
    lg: 'text-sm sm:text-base px-5 py-2.5 gap-2.5',
  };

  const variantStyles = {
    primary:
      'bg-[#0A2540] text-white hover:bg-[#06182C] border border-[#0A2540] hover:border-[#06182C] motion-safe:hover:-translate-y-[1px] hover:shadow-sm shadow-xs',
    secondary:
      'bg-white text-[#172B3A] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] border border-[#E2E8F0] shadow-xs motion-safe:hover:-translate-y-[1px]',
    outline:
      'bg-transparent text-[#0A2540] hover:bg-[#0A2540]/5 border border-[#0A2540] motion-safe:hover:-translate-y-[1px]',
    ghost:
      'bg-transparent text-[#172B3A] hover:bg-slate-100/80 border border-transparent hover:text-[#0A2540]',
    teal:
      'bg-[#0A2540] text-white hover:bg-[#06182C] border border-[#0A2540] hover:border-[#06182C] motion-safe:hover:-translate-y-[1px] hover:shadow-sm shadow-xs',
    'danger-outline':
      'bg-white text-rose-700 hover:bg-rose-50 border border-rose-200 font-semibold motion-safe:hover:-translate-y-[1px]',
  };

  return (
    <button
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="inline-block animate-spin h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full" />
      ) : (
        icon && <span className="shrink-0">{icon}</span>
      )}
      <span>{children}</span>
    </button>
  );
};

