import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Bold, Italic, Heading3, Paintbrush, Highlighter, X } from 'lucide-react';

interface FloatingToolbarProps {
  x: number;
  y: number;
  onFormat: (type: string, param?: string) => void;
  onClose: () => void;
}

const colors = [
  { name: 'Indigo', value: '#818cf8' },
  { name: 'Emerald', value: '#34d399' },
  { name: 'Sky', value: '#38bdf8' },
  { name: 'Amber', value: '#fbbf24' },
  { name: 'Rose', value: '#f87171' },
];

const highlightColors = [
  { name: 'Indigo', value: 'rgba(99, 102, 241, 0.2)' },
  { name: 'Emerald', value: 'rgba(16, 185, 129, 0.2)' },
  { name: 'Sky', value: 'rgba(14, 165, 233, 0.2)' },
  { name: 'Amber', value: 'rgba(245, 158, 11, 0.2)' },
  { name: 'Rose', value: 'rgba(244, 63, 94, 0.2)' },
];

export const FloatingToolbar: React.FC<FloatingToolbarProps> = ({ x, y, onFormat, onClose }) => {
  const [activeSubmenu, setActiveSubmenu] = useState<'color' | 'highlight' | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Close toolbar if clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [onClose]);

  // Adjust toolbar position so it doesn't overflow viewport boundaries
  const adjustedX = Math.max(10, Math.min(x, window.innerWidth - 320));
  const adjustedY = Math.max(10, y);

  return createPortal(
    <div
      ref={toolbarRef}
      style={{
        position: 'fixed',
        left: `${adjustedX}px`,
        top: `${adjustedY}px`,
        transform: 'translate(-50%, -100%)',
        zIndex: 50,
      }}
      className="glass floating-card flex flex-col gap-1.5 p-1.5 rounded-xl shadow-2xl border border-border/40 animate-in fade-in zoom-in-95 duration-100 min-w-[200px]"
    >
      {/* Main Action Buttons */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => {
            onFormat('bold');
            onClose();
          }}
          className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary/60 rounded-lg transition-all cursor-pointer"
          title="Bold"
        >
          <Bold className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => {
            onFormat('italic');
            onClose();
          }}
          className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary/60 rounded-lg transition-all cursor-pointer"
          title="Italic"
        >
          <Italic className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => {
            onFormat('heading');
            onClose();
          }}
          className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary/60 rounded-lg transition-all cursor-pointer"
          title="Heading 3"
        >
          <Heading3 className="w-3.5 h-3.5" />
        </button>

        <div className="w-px h-4 bg-border/60 mx-1" />

        <button
          onClick={() => setActiveSubmenu(activeSubmenu === 'color' ? null : 'color')}
          className={`p-2 rounded-lg transition-all cursor-pointer ${
            activeSubmenu === 'color'
              ? 'text-indigo-400 bg-indigo-500/10'
              : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
          }`}
          title="Text Color"
        >
          <Paintbrush className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => setActiveSubmenu(activeSubmenu === 'highlight' ? null : 'highlight')}
          className={`p-2 rounded-lg transition-all cursor-pointer ${
            activeSubmenu === 'highlight'
              ? 'text-amber-400 bg-amber-500/10'
              : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
          }`}
          title="Highlight Background"
        >
          <Highlighter className="w-3.5 h-3.5" />
        </button>

        <div className="w-px h-4 bg-border/60 mx-1 flex-1" />

        <button
          onClick={onClose}
          className="p-2 text-muted-foreground/55 hover:text-foreground hover:bg-secondary/60 rounded-lg transition-all cursor-pointer"
          title="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Submenu for Color selection */}
      {activeSubmenu === 'color' && (
        <div className="flex items-center gap-1.5 px-1 py-0.5 border-t border-border/20 mt-1 pt-1.5 animate-in slide-in-from-top-1 duration-150">
          <span className="text-[9px] font-semibold text-muted-foreground/60 mr-1 uppercase tracking-wider font-mono">
            Colors:
          </span>
          {colors.map((c) => (
            <button
              key={c.name}
              onClick={() => {
                onFormat('color', c.value);
                onClose();
              }}
              style={{ backgroundColor: c.value }}
              className="w-4.5 h-4.5 rounded-full border border-white/10 hover:scale-110 active:scale-95 transition-transform cursor-pointer"
              title={c.name}
            />
          ))}
          <button
            onClick={() => {
              onFormat('color-reset');
              onClose();
            }}
            className="w-4.5 h-4.5 rounded-full border border-dashed border-muted-foreground/40 hover:border-foreground/60 flex items-center justify-center text-[8px] text-muted-foreground font-semibold hover:scale-110 active:scale-95 transition-all cursor-pointer"
            title="Reset Color"
          >
            /
          </button>
        </div>
      )}

      {/* Submenu for Highlight selection */}
      {activeSubmenu === 'highlight' && (
        <div className="flex items-center gap-1.5 px-1 py-0.5 border-t border-border/20 mt-1 pt-1.5 animate-in slide-in-from-top-1 duration-150">
          <span className="text-[9px] font-semibold text-muted-foreground/60 mr-1 uppercase tracking-wider font-mono">
            Highlights:
          </span>
          {highlightColors.map((h) => (
            <button
              key={h.name}
              onClick={() => {
                onFormat('highlight', h.value);
                onClose();
              }}
              style={{ backgroundColor: h.value }}
              className="w-4.5 h-4.5 rounded-full border border-white/15 hover:scale-110 active:scale-95 transition-transform cursor-pointer"
              title={h.name}
            />
          ))}
          <button
            onClick={() => {
              onFormat('highlight-reset');
              onClose();
            }}
            className="w-4.5 h-4.5 rounded-full border border-dashed border-muted-foreground/40 hover:border-foreground/60 flex items-center justify-center text-[8px] text-muted-foreground font-semibold hover:scale-110 active:scale-95 transition-all cursor-pointer"
            title="Reset Highlight"
          >
            /
          </button>
        </div>
      )}
    </div>,
    document.body
  );
};
