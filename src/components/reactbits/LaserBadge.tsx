import React from 'react';

interface LaserBadgeProps {
  label: string;
  variant?: 'violet' | 'cyan' | 'emerald' | 'amber';
  icon?: React.ReactNode;
  pulse?: boolean;
  className?: string;
}

export const LaserBadge: React.FC<LaserBadgeProps> = ({
  label,
  variant = 'violet',
  icon,
  pulse = true,
  className = '',
}) => {
  const styles = {
    violet: {
      bg: 'bg-violet-500/10 dark:bg-violet-500/15',
      text: 'text-violet-700 dark:text-violet-300',
      border: 'border-violet-500/30',
      glow: 'shadow-[0_0_14px_rgba(139,92,246,0.22)]',
      dot: 'bg-violet-400',
    },
    cyan: {
      bg: 'bg-cyan-500/10 dark:bg-cyan-500/15',
      text: 'text-cyan-700 dark:text-cyan-300',
      border: 'border-cyan-500/30',
      glow: 'shadow-[0_0_14px_rgba(6,182,212,0.22)]',
      dot: 'bg-cyan-400',
    },
    emerald: {
      bg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
      text: 'text-emerald-700 dark:text-emerald-300',
      border: 'border-emerald-500/30',
      glow: 'shadow-[0_0_14px_rgba(16,185,129,0.22)]',
      dot: 'bg-emerald-400',
    },
    amber: {
      bg: 'bg-amber-500/10 dark:bg-amber-500/15',
      text: 'text-amber-700 dark:text-amber-300',
      border: 'border-amber-500/30',
      glow: 'shadow-[0_0_14px_rgba(245,158,11,0.22)]',
      dot: 'bg-amber-400',
    },
  }[variant];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border transition-all ${styles.bg} ${styles.text} ${styles.border} ${styles.glow} ${className}`}
    >
      {pulse && (
        <span className="relative flex h-1.5 w-1.5">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${styles.dot} opacity-75`} />
          <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${styles.dot}`} />
        </span>
      )}
      {icon && <span className="shrink-0">{icon}</span>}
      <span className="truncate">{label}</span>
    </span>
  );
};
