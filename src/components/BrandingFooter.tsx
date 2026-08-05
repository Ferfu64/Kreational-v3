import React from 'react';

interface BrandingFooterProps {
  variant?: 'prominent' | 'unobtrusive';
  className?: string;
}

export const BrandingFooter: React.FC<BrandingFooterProps> = ({
  variant = 'unobtrusive',
  className = '',
}) => {
  if (variant === 'prominent') {
    return (
      <div
        id="branding-prominent"
        className={`glass flex items-center justify-center py-3 px-6 text-xs text-purple-300 font-mono font-bold tracking-wider ${className}`}
      >
        Made by Kesavan Raj
      </div>
    );
  }

  return (
    <div
      id="branding-unobtrusive"
      className={`fixed bottom-3 right-3 z-40 px-3.5 py-1.5 rounded-full glass text-[11px] font-mono text-purple-300 font-semibold shadow-xl transition-all hover:border-purple-500/40 opacity-80 hover:opacity-100 ${className}`}
    >
      Made by Kesavan Raj
    </div>
  );
};
