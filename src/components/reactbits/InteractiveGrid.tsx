import React from 'react';

interface InteractiveGridProps {
  className?: string;
  gridSize?: number;
}

export const InteractiveGrid: React.FC<InteractiveGridProps> = ({
  className = '',
  gridSize = 36,
}) => {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {/* SVG Grid pattern */}
      <svg
        className="absolute inset-0 h-full w-full stroke-white/[0.04] dark:stroke-white/[0.05] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"
        aria-hidden="true"
      >
        <defs>
          <pattern
            id="reactbits-grid-pattern"
            width={gridSize}
            height={gridSize}
            x="-1"
            y="-1"
            patternUnits="userSpaceOnUse"
          >
            <path d={`M.5 ${gridSize}V.5H${gridSize}`} fill="none" strokeWidth="1" strokeDasharray="0" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" strokeWidth="0" fill="url(#reactbits-grid-pattern)" />
      </svg>
    </div>
  );
};
