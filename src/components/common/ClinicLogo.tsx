import React from 'react';

interface ClinicLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSubtitle?: boolean;
  className?: string;
  theme?: 'dark' | 'light' | 'white';
}

export const ClinicLogo: React.FC<ClinicLogoProps> = ({
  size = 'md',
  showSubtitle = true,
  className = '',
  theme = 'dark',
}) => {
  // Size mapping
  const sizeConfig = {
    sm: {
      iconSize: 28,
      titleClass: 'text-base',
      subtitleClass: 'text-[7.5px]',
      gap: 'gap-2',
    },
    md: {
      iconSize: 36,
      titleClass: 'text-lg sm:text-xl',
      subtitleClass: 'text-[8.5px] sm:text-[9.5px]',
      gap: 'gap-2.5',
    },
    lg: {
      iconSize: 46,
      titleClass: 'text-2xl sm:text-3xl',
      subtitleClass: 'text-[10px] sm:text-[11px]',
      gap: 'gap-3',
    },
    xl: {
      iconSize: 58,
      titleClass: 'text-3xl sm:text-4xl',
      subtitleClass: 'text-xs sm:text-sm',
      gap: 'gap-3.5',
    },
  };

  const currentSize = sizeConfig[size];

  const titleColor =
    theme === 'white'
      ? 'text-white'
      : theme === 'dark'
      ? 'text-[#0B2240]'
      : 'text-[#0F172A]';

  const subtitleColor =
    theme === 'white'
      ? 'text-white/80'
      : 'text-[#64748B]';

  return (
    <div className={`flex items-center ${currentSize.gap} select-none shrink-0 ${className}`}>
      {/* Exact Vector Logo Mark: Stylized Cyan "1" stem + Dark Blue Smiling Robot Head with Headphones */}
      <svg
        width={currentSize.iconSize}
        height={currentSize.iconSize}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 drop-shadow-xs"
      >
        {/* Left Stylized Cyan/Teal "1" Stem / Arced Wing */}
        <path
          d="M26 68C22 52 28 34 40 22C43 18 47 21 46 25C37 38 34 52 38 68C39 73 34 76 29 75C27 73 26 71 26 68Z"
          fill="#00C2CB"
        />
        <path
          d="M18 56C18 36 32 18 52 12C55 11 58 14 56 18C44 26 34 40 32 58C31 63 25 65 21 63C19 61 18 59 18 56Z"
          fill="#00B4D8"
        />

        {/* Top Antenna stalk & cyan pulse dot */}
        <rect x="62" y="10" width="4" height="12" rx="2" fill="#0052FF" />
        <circle cx="64" cy="10" r="3.5" fill="#00C2CB" />

        {/* Dark Blue Circular Robot Head / Speech Bubble */}
        <circle cx="64" cy="48" r="30" fill="#0052FF" />
        
        {/* Headphone Ear Cushions */}
        {/* Left Headphone */}
        <rect x="30" y="38" width="7" height="20" rx="3.5" fill="#003EB3" />
        {/* Right Headphone */}
        <rect x="91" y="38" width="7" height="20" rx="3.5" fill="#003EB3" />
        {/* Headband Arc */}
        <path
          d="M34 40C34 22 48 18 64 18C80 18 94 22 94 40"
          stroke="#003EB3"
          strokeWidth="3.5"
          strokeLinecap="round"
        />

        {/* Speech Bubble Little Tail at bottom-left */}
        <path
          d="M44 68L36 78C35 79 38 80 40 78L49 71Z"
          fill="#0052FF"
        />

        {/* Cute Smiling Face (White eyes & smile) */}
        {/* Left Eye */}
        <circle cx="53" cy="45" r="4" fill="white" />
        {/* Right Eye */}
        <circle cx="75" cy="45" r="4" fill="white" />
        {/* Curved Smile */}
        <path
          d="M55 55C59 61 69 61 73 55"
          stroke="white"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
      </svg>

      {/* Brand Typography */}
      <div className="flex flex-col leading-none min-w-0">
        <div className="flex items-baseline">
          <span className={`font-black tracking-tight ${titleColor} ${currentSize.titleClass} font-sans`}>
            Clinic
          </span>
          <span className={`font-black tracking-tight ${titleColor} ${currentSize.titleClass} font-sans`}>
            -1st
          </span>
        </div>
        {showSubtitle && (
          <span
            className={`font-bold tracking-[0.22em] uppercase mt-1 ${subtitleColor} ${currentSize.subtitleClass} truncate`}
          >
            AI RECEPTIONIST FOR CLINICS
          </span>
        )}
      </div>
    </div>
  );
};
