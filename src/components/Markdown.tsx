import React, { useState, useEffect, useId, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import mermaid from 'mermaid';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { 
  Clipboard, Check, Info, Lightbulb, AlertTriangle, Star, HelpCircle, 
  ArrowDown, Image as ImageIcon, Trash2, Layers,
  ZoomIn, ZoomOut, Download, Maximize2, Minimize2, Code, Eye, X
} from 'lucide-react';
import { cn } from '../lib/utils';

interface MarkdownProps {
  content: string;
  className?: string;
  onDeleteImage?: (src: string, alt?: string) => void;
}

// Pattern matching functions (e.g. foo(x)), decorators (@decorator), snake_case variables (in_range, run_n_times), and args/kwargs
const CODE_TOKEN_REGEX = /(@[a-zA-Z_][\w.]*|\b[a-zA-Z_]\w*\([^)]*\)|\b[a-zA-Z_]\w*_[a-zA-Z0-9_]+\b|\b(?:\*args|\*\*kwargs|defaultdict|Counter|DataFrame|Series)\b)/g;

export const renderTextWithCodeHighlights = (node: React.ReactNode): React.ReactNode => {
  if (typeof node === 'string') {
    if (!node.trim()) return node;
    const parts = node.split(CODE_TOKEN_REGEX);
    if (parts.length <= 1) return node;

    return parts.map((part, index) => {
      if (!part) return null;
      if (index % 2 === 1) {
        return (
          <code 
            key={index}
            className="font-mono text-xs bg-blue-50/80 dark:bg-[#18181c] text-blue-700 dark:text-[#60a5fa] border border-blue-200/70 dark:border-white/[0.08] px-1.5 py-0.5 rounded font-medium inline-block mx-0.5 my-0.5"
          >
            {part}
          </code>
        );
      }
      return part;
    });
  }

  if (Array.isArray(node)) {
    return React.Children.map(node, child => renderTextWithCodeHighlights(child));
  }

  if (React.isValidElement(node)) {
    // Never rewrite inside existing code tags or links
    if (node.type === 'code' || node.type === 'a') {
      return node;
    }
    const props = node.props as { children?: React.ReactNode };
    if (props && props.children) {
      return React.cloneElement(node, {}, renderTextWithCodeHighlights(props.children));
    }
  }

  return node;
};

// Auto-format naked code blocks and format raw markdown cleanly
export const autoFormatMarkdown = (text: string): string => {
  if (!text) return '';
  
  const lines = text.split('\n');
  const processed: string[] = [];
  let inFenced = false;
  let inNaked = false;
  let nakedLang = 'python';
  let nakedLines: string[] = [];

  const isLangHeader = (l: string) => /^(python|javascript|typescript|sql|bash|sh|css|html|json)$/i.test(l.trim());

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      if (inNaked) {
        processed.push('```' + nakedLang);
        processed.push(...nakedLines);
        processed.push('```\n');
        inNaked = false;
        nakedLines = [];
      }
      inFenced = !inFenced;
      processed.push(line);
      continue;
    }

    if (inFenced) {
      processed.push(line);
      continue;
    }

    if (!inNaked && isLangHeader(trimmed)) {
      inNaked = true;
      nakedLang = trimmed.toLowerCase();
      nakedLines = [];
      continue;
    }

    if (inNaked) {
      if (trimmed.startsWith('###') || /^\d+[.)]/.test(trimmed) || trimmed.startsWith('Schéma') || trimmed.startsWith('🔴') || trimmed.startsWith('⚫') || trimmed.startsWith('Analogie') || trimmed.startsWith('>')) {
        processed.push('```' + nakedLang);
        processed.push(...nakedLines);
        processed.push('```\n');
        inNaked = false;
        nakedLines = [];
        processed.push(line);
      } else {
        nakedLines.push(line);
      }
      continue;
    }

    processed.push(line);
  }

  if (inNaked) {
    processed.push('```' + nakedLang);
    processed.push(...nakedLines);
    processed.push('```\n');
  }

  return processed.join('\n');
};

const MarkdownImage: React.FC<{ src?: string; alt?: string; onDelete?: (src: string, alt?: string) => void; [key: string]: any }> = ({ src, alt, onDelete, ...props }) => {
  const [currentSrc, setCurrentSrc] = useState<string | undefined>(src);
  const [hasError, setHasError] = useState(false);
  const [retriedDirect, setRetriedDirect] = useState(false);

  useEffect(() => {
    setCurrentSrc(src);
    setHasError(false);
    setRetriedDirect(false);
  }, [src]);

  const handleError = () => {
    // 1. If relative /uploads/ failed, retry direct via backend port 3001
    if (!retriedDirect && currentSrc && currentSrc.startsWith('/uploads/')) {
      setRetriedDirect(true);
      setCurrentSrc(`http://127.0.0.1:3001${currentSrc}`);
      return;
    }
    // 2. If user copied raw markdown with bare filename e.g. "deepseek_mermaid_...png"
    if (!retriedDirect && currentSrc && !currentSrc.startsWith('http') && !currentSrc.startsWith('data:') && !currentSrc.startsWith('/')) {
      setRetriedDirect(true);
      setCurrentSrc(`/uploads/${currentSrc}`);
      return;
    }
    setHasError(true);
  };

  if (hasError) {
    return (
      <div className="my-6 p-4 rounded-xl border border-dashed border-amber-500/30 bg-amber-500/5 dark:bg-amber-950/20 text-center flex flex-col items-center gap-2 max-w-lg mx-auto">
        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-semibold text-xs">
          <ImageIcon className="w-4 h-4" />
          <span>Image non disponible : {alt || src}</span>
        </div>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-sm">
          Le fichier n'est pas accessible en local ou n'a pas été importé.
        </p>
        {onDelete && (
          <button
            type="button"
            onClick={() => onDelete(src || '', alt)}
            className="mt-1 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-500 hover:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-all cursor-pointer shadow-xs"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Supprimer cette image de la note</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <figure className="my-6 flex flex-col items-center group/img w-full">
      <div className="relative overflow-hidden rounded-2xl border border-zinc-200 dark:border-white/[0.08] bg-zinc-100/50 dark:bg-zinc-900/40 p-2 shadow-md transition-all hover:border-blue-500/40 hover:shadow-lg max-w-full flex justify-center">
        <img 
          src={currentSrc} 
          alt={alt || 'Image de note'} 
          className="max-h-[460px] w-auto max-w-full rounded-xl object-contain cursor-zoom-in transition-transform duration-200 group-hover/img:scale-[1.005]" 
          loading="lazy"
          onError={handleError}
          onClick={() => {
            if (currentSrc) window.open(currentSrc, '_blank');
          }}
          {...props} 
        />
        <div className="absolute top-3 right-3 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center gap-1.5">
          <button 
            type="button"
            onClick={() => {
              if (currentSrc) window.open(currentSrc, '_blank');
            }}
            className="bg-zinc-900/80 hover:bg-zinc-800 backdrop-blur-sm text-zinc-200 text-xs px-2.5 py-1 rounded-md border border-white/10 flex items-center gap-1.5 cursor-pointer"
          >
            <span>Agrandir</span>
          </button>
          {onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm("Supprimer cette image de la note ?")) {
                  onDelete(src || '', alt);
                }
              }}
              className="bg-zinc-900/80 hover:bg-rose-900/80 backdrop-blur-sm text-zinc-300 hover:text-rose-200 text-xs p-1.5 rounded-md border border-white/10 transition-colors cursor-pointer"
              title="Supprimer cette image de la note"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      {alt && alt !== 'Image' && alt !== 'Image de note' && (
        <figcaption className="mt-2 text-xs text-zinc-500 dark:text-zinc-400 font-sans text-center max-w-md">
          {alt}
        </figcaption>
      )}
    </figure>
  );
};

/**
 * Applies the DeepSeek + Claude hybrid semantic palette to Mermaid flowcharts.
 * - Start / Input / Task: Soft Sky / Cyan
 * - Logic / Process / Execution: Deep Emerald / Teal
 * - Model / Response / Object: Royal Indigo / Purple
 * - Decision / Arbitration: Amber / Gold
 * - Output / Terminal / Cost: Warm Terracotta / Peach
 * - Intermediate cards: Sleek Charcoal / Slate
 */
export function enhanceMermaidChart(rawChart: string): string {
  let chart = rawChart.trim();

  // If already styled or sequenceDiagram, preserve untouched
  if (chart.startsWith('sequenceDiagram') || chart.startsWith('classDiagram') || chart.includes('classDef')) {
    return chart;
  }

  // Ensure diagram type
  if (!chart.startsWith('flowchart') && !chart.startsWith('graph')) {
    chart = `flowchart TD\n${chart}`;
  }

  // Claude + DeepSeek hybrid palette (high contrast, enterprise dark theme)
  const classDefs = [
    'classDef startNode fill:#082f49,stroke:#38bdf8,stroke-width:1.8px,color:#f0f9ff;',
    'classDef actionNode fill:#064e3b,stroke:#34d399,stroke-width:1.8px,color:#ecfdf5;',
    'classDef modelNode fill:#312e81,stroke:#a78bfa,stroke-width:1.8px,color:#f5f3ff;',
    'classDef decisionNode fill:#78350f,stroke:#fbbf24,stroke-width:1.8px,color:#fef3c7;',
    'classDef outputNode fill:#7c2d12,stroke:#fb923c,stroke-width:1.8px,color:#fff7ed;',
    'classDef slateNode fill:#1e293b,stroke:#475569,stroke-width:1.8px,color:#f8fafc;',
  ].join('\n    ');

  // Extract node IDs defined like A[...], B(...), C{...}
  const nodeMatches = [...chart.matchAll(/\b([A-Za-z0-9_]+)\s*(?:\[|\(|\{)/g)];
  const uniqueIds = Array.from(new Set(nodeMatches.map(m => m[1]))).filter(id => 
    !['subgraph', 'end', 'flowchart', 'graph', 'classDef', 'class', 'style', 'click'].includes(id.toLowerCase())
  );

  if (uniqueIds.length === 0) return chart;

  const decisionNodes = [...chart.matchAll(/\b([A-Za-z0-9_]+)\s*\{/g)].map(m => m[1]);

  const assignments: string[] = [];
  uniqueIds.forEach((id, idx) => {
    if (decisionNodes.includes(id)) {
      assignments.push(`class ${id} decisionNode;`);
    } else if (idx === 0) {
      assignments.push(`class ${id} startNode;`);
    } else if (idx === uniqueIds.length - 1) {
      assignments.push(`class ${id} outputNode;`);
    } else {
      const step = idx % 3;
      if (step === 1) assignments.push(`class ${id} actionNode;`);
      else if (step === 2) assignments.push(`class ${id} modelNode;`);
      else assignments.push(`class ${id} slateNode;`);
    }
  });

  return `${chart}\n    ${classDefs}\n    ${assignments.join('\n    ')}`;
}

const MermaidDiagram: React.FC<{ chart: string }> = ({ chart }) => {
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'diagram' | 'code'>('diagram');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const rawId = useId();
  const cleanId = rawId.replace(/[^a-zA-Z0-9]/g, '_');

  const enhancedChart = enhanceMermaidChart(chart);

  useEffect(() => {
    let isMounted = true;
    const renderChart = async () => {
      try {
        setError(null);
        mermaid.initialize({
          startOnLoad: false,
          theme: 'base',
          securityLevel: 'loose',
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
          flowchart: {
            htmlLabels: true,
            curve: 'basis',
            nodeSpacing: 40,
            rankSpacing: 40,
            padding: 15,
          },
          themeVariables: {
            darkMode: true,
            background: 'transparent',
            mainBkg: '#161922',
            nodeBorder: '#334155',
            nodeTextColor: '#f8fafc',
            lineColor: '#64748b',
            clusterBkg: '#0d1017',
            clusterBorder: '#1e293b',
            titleColor: '#38bdf8',
            edgeLabelBackground: '#18181b',
            fontSize: '12.5px',
          },
        });
        const uniqueId = `mermaid_${cleanId}_${Math.random().toString(36).slice(2, 7)}`;
        const { svg: renderedSvg } = await mermaid.render(uniqueId, enhancedChart.trim());
        if (isMounted) {
          setSvg(renderedSvg);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err?.message || 'Erreur de syntaxe Mermaid');
        }
      }
    };

    renderChart();
    return () => { isMounted = false; };
  }, [enhancedChart, cleanId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(chart);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleZoomIn = () => setZoom(prev => Math.min(Number((prev + 0.2).toFixed(2)), 3));
  const handleZoomOut = () => setZoom(prev => Math.max(Number((prev - 0.2).toFixed(2)), 0.4));
  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleDownload = () => {
    if (!svg) return;
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `schema_devnotes_${Date.now()}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (activeTab !== 'diagram') return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPan({
      x: dragStartRef.current.panX + dx,
      y: dragStartRef.current.panY + dy,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const cleanSvgHtml = (rawSvg: string) => {
    return rawSvg.replace(/<svg\b([^>]*)>/i, (_, attrs) => {
      const clean = attrs
        .replace(/\bstyle="[^"]*"/gi, '')
        .replace(/\bwidth="[^"]*"/gi, '')
        .replace(/\bheight="[^"]*"/gi, '');
      return `<svg ${clean} width="100%" height="100%" style="max-width:100%; max-height:100%; display:block; margin:auto;" preserveAspectRatio="xMidYMid meet">`;
    });
  };

  // Render the sleek DeepSeek-inspired toolbar
  const renderToolbar = (inFullscreen: boolean = false) => (
    <div className="flex items-center justify-between px-3 py-2 bg-[#121319] border-b border-white/[0.08] text-xs font-sans select-none">
      {/* Left: View Tabs (Diagram / Code) */}
      <div className="flex items-center gap-1 bg-zinc-900/90 p-0.5 rounded-lg border border-white/[0.06]">
        <button
          type="button"
          onClick={() => setActiveTab('diagram')}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer",
            activeTab === 'diagram'
              ? "bg-zinc-800 text-white shadow-xs font-semibold"
              : "text-zinc-400 hover:text-zinc-200"
          )}
        >
          <Eye className="w-3.5 h-3.5" />
          <span>Diagram</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('code')}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer",
            activeTab === 'code'
              ? "bg-zinc-800 text-white shadow-xs font-semibold"
              : "text-zinc-400 hover:text-zinc-200"
          )}
        >
          <Code className="w-3.5 h-3.5" />
          <span>Code</span>
        </button>
      </div>

      {/* Right: Controls (Zoom, Download, Fullscreen, Copy) */}
      <div className="flex items-center gap-1.5 text-zinc-400">
        {activeTab === 'diagram' && (
          <>
            <button
              type="button"
              onClick={handleZoomOut}
              className="p-1 hover:bg-white/10 rounded-md hover:text-white transition-colors cursor-pointer"
              title="Zoom arrière (-)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleResetZoom}
              className="px-1.5 py-0.5 text-[11px] font-mono hover:bg-white/10 rounded-md hover:text-white transition-colors cursor-pointer"
              title="Réinitialiser le zoom (100%)"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={handleZoomIn}
              className="p-1 hover:bg-white/10 rounded-md hover:text-white transition-colors cursor-pointer"
              title="Zoom avant (+)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>

            <div className="w-px h-3.5 bg-white/10 mx-1" />

            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-1 px-2 py-1 hover:bg-white/10 rounded-md hover:text-white transition-colors text-xs cursor-pointer"
              title="Télécharger le schéma en SVG"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Download</span>
            </button>
          </>
        )}

        <button
          type="button"
          onClick={handleCopyCode}
          className="flex items-center gap-1 px-2 py-1 hover:bg-white/10 rounded-md hover:text-white transition-colors text-xs cursor-pointer"
          title="Copier le code Mermaid"
        >
          {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Clipboard className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">{isCopied ? 'Copié' : 'Copier'}</span>
        </button>

        <button
          type="button"
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="flex items-center gap-1 px-2 py-1 hover:bg-white/10 rounded-md hover:text-white transition-colors text-xs cursor-pointer"
          title={inFullscreen ? "Quitter le plein écran (Échap)" : "Plein écran"}
        >
          {inFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">{inFullscreen ? 'Réduire' : 'Fullscreen'}</span>
        </button>
      </div>
    </div>
  );

  // Render diagram viewport
  const renderViewport = (inFullscreen: boolean = false) => {
    if (activeTab === 'code') {
      return (
        <div className={cn(
          "w-full p-4 bg-[#0a0b10] overflow-x-auto text-xs font-mono text-zinc-300 select-text leading-relaxed",
          inFullscreen ? "h-full" : "max-h-[440px]"
        )}>
          <pre className="select-text whitespace-pre overflow-x-auto">{chart}</pre>
        </div>
      );
    }

    return (
      <div 
        className={cn(
          "w-full relative overflow-hidden bg-[#090b10] flex items-center justify-center p-3 select-none",
          inFullscreen ? "h-full" : "h-[360px] md:h-[420px]"
        )}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div 
          className={cn(
            "w-full h-full flex items-center justify-center transition-transform duration-75",
            isDragging ? "cursor-grabbing" : "cursor-grab",
            // Rounded corners on node rects and clean edge strokes
            "[&_.node_rect]:rx-2 [&_.node_rect]:ry-2 [&_.node_polygon]:stroke-[1.5px]"
          )}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
          }}
          dangerouslySetInnerHTML={{ __html: cleanSvgHtml(svg) }}
        />
      </div>
    );
  };

  if (error) {
    return (
      <div className="my-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-xs font-mono">
        <div className="flex items-center justify-between text-amber-500 font-bold mb-2">
          <span>Diagramme Mermaid (Code)</span>
          <button onClick={handleCopyCode} className="text-[10px] text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer">
            {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Clipboard className="w-3 h-3" />}
            <span>{isCopied ? 'Copié' : 'Copier'}</span>
          </button>
        </div>
        <pre className="overflow-x-auto text-zinc-300">{chart}</pre>
      </div>
    );
  }

  return (
    <>
      <div className="my-6 rounded-2xl border border-white/[0.08] bg-[#0c0e14] overflow-hidden shadow-xl group/mermaid relative">
        {renderToolbar(false)}
        {renderViewport(false)}
      </div>

      {/* Fullscreen Overlay Modal */}
      {isFullscreen && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col p-4 md:p-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between rounded-t-2xl overflow-hidden border border-white/[0.08] border-b-0">
            <div className="flex-1">
              {renderToolbar(true)}
            </div>
            <button 
              type="button"
              onClick={() => setIsFullscreen(false)}
              className="p-2.5 bg-[#121319] hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer border-l border-white/[0.08]"
              title="Fermer le plein écran (Échap)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 relative overflow-hidden rounded-b-2xl border border-white/[0.08] bg-[#090b10]">
            {renderViewport(true)}
          </div>
        </div>
      )}
    </>
  );
};

export const Markdown: React.FC<MarkdownProps> = ({ content, className, onDeleteImage }) => {
  const formattedContent = autoFormatMarkdown(content);

  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          img: (props) => <MarkdownImage {...props} onDelete={onDeleteImage} />,
          code({ className: codeClassName, children, ...props }) {
            const match = /language-(\w+)/.exec(codeClassName || '');
            const isInline = !match;
            const codeString = String(children).replace(/\n$/, '');

            if (match && match[1].toLowerCase() === 'mermaid') {
              return <MermaidDiagram chart={codeString} />;
            }

            if (isInline) {
              return (
                <code 
                  className="font-mono text-xs bg-blue-50/80 dark:bg-[#18181c] text-blue-700 dark:text-[#60a5fa] border border-blue-200/70 dark:border-white/[0.08] px-1.5 py-0.5 rounded font-medium"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            return <CodeBlock language={match[1]} value={codeString} />;
          },
          blockquote({ children }) {
            return <Callout>{renderTextWithCodeHighlights(children)}</Callout>;
          },
          h1: ({ children }) => (
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight border-b border-zinc-200 dark:border-white/[0.08] pb-2.5 mt-7 mb-4 font-sans">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight mt-7 mb-3 font-sans border-l-2 border-blue-600 dark:border-blue-500 pl-3 flex items-center gap-2">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-200 tracking-tight mt-6 mb-2 font-sans border-l-2 border-zinc-400 dark:border-zinc-700 pl-2.5">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="leading-relaxed text-zinc-800 dark:text-zinc-300 my-3 text-sm font-sans whitespace-pre-line">
              {renderTextWithCodeHighlights(children)}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-inside space-y-1.5 my-3 pl-2 text-zinc-800 dark:text-zinc-300 text-sm font-sans">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside space-y-1.5 my-3 pl-2 text-zinc-800 dark:text-zinc-300 text-sm font-sans">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed text-zinc-800 dark:text-zinc-300 font-sans marker:text-zinc-400 dark:marker:text-zinc-500">
              {renderTextWithCodeHighlights(children)}
            </li>
          ),
          a: ({ href, children }) => (
            <a 
              href={href} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline underline-offset-4 font-medium transition-colors"
            >
              {children}
            </a>
          ),
          strong: ({ children }) => (
            <strong className="font-bold text-zinc-950 dark:text-white">
              {renderTextWithCodeHighlights(children)}
            </strong>
          ),
          pre: ({ children }) => (
            <div className="my-4 overflow-hidden rounded-xl border border-border/70 bg-secondary/40 shadow-md">
              {children}
            </div>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-5 rounded-xl border border-border/80 bg-secondary/20 shadow-md backdrop-blur-sm">
              <table className="min-w-full divide-y divide-border/60 text-xs font-sans">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-secondary/60 border-b border-white/[0.08] text-zinc-200 font-semibold">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="px-4 py-3 text-left font-semibold text-zinc-300 uppercase tracking-wider text-[11px]">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-3 border-t border-border/30 text-foreground/90 align-middle">
              {renderTextWithCodeHighlights(children)}
            </td>
          ),
          tr: ({ children }) => (
            <tr className="even:bg-secondary/15 hover:bg-white/[0.03] transition-colors">
              {children}
            </tr>
          ),
        }}
      >
        {formattedContent}
      </ReactMarkdown>
    </div>
  );
};

// Visual Flow Cards representation matching DevNotes carbon palette
interface FlowStep {
  title: string;
  subtitle?: string;
  color: 'slate' | 'emerald' | 'indigo' | 'terracotta' | 'purple';
}

const DEFAULT_FLOW_COLORS: ('slate' | 'emerald' | 'indigo' | 'terracotta')[] = [
  'slate',
  'emerald',
  'indigo',
  'terracotta',
];

const FLOW_COLOR_STYLES: Record<string, { card: string; title: string; subtitle: string }> = {
  slate: {
    card: "bg-zinc-100 dark:bg-zinc-800/90 border-zinc-300 dark:border-zinc-700/80 shadow-sm",
    title: "text-zinc-900 dark:text-zinc-100 font-bold",
    subtitle: "text-zinc-600 dark:text-zinc-400 font-mono text-xs",
  },
  emerald: {
    card: "bg-emerald-50 dark:bg-[#064e3b]/90 border-emerald-300 dark:border-[#059669]/60 shadow-sm",
    title: "text-emerald-950 dark:text-emerald-100 font-bold",
    subtitle: "text-emerald-800 dark:text-emerald-300/90 font-mono text-xs",
  },
  indigo: {
    card: "bg-blue-50 dark:bg-[#312e81]/90 border-blue-300 dark:border-[#4f46e5]/60 shadow-sm",
    title: "text-blue-950 dark:text-indigo-100 font-bold",
    subtitle: "text-blue-800 dark:text-indigo-300/90 font-mono text-xs",
  },
  terracotta: {
    card: "bg-orange-50 dark:bg-[#7c2d12]/90 border-orange-300 dark:border-[#ea580c]/50 shadow-sm",
    title: "text-orange-950 dark:text-amber-100 font-bold",
    subtitle: "text-orange-800 dark:text-amber-200/90 font-mono text-xs",
  },
  purple: {
    card: "bg-purple-50 dark:bg-[#581c87]/90 border-purple-300 dark:border-[#9333ea]/50 shadow-sm",
    title: "text-purple-950 dark:text-purple-100 font-bold",
    subtitle: "text-purple-800 dark:text-purple-300/90 font-mono text-xs",
  },
};

function parseFlowContent(text: string): FlowStep[] {
  const lines = text.split('\n');
  const steps: FlowStep[] = [];
  let colorIdx = 0;

  for (const rawLine of lines) {
    let line = rawLine.trim();
    if (!line) continue;
    if (/^[↓▼|│─\->\s]+$/.test(line)) continue;

    if (line.startsWith('[') && line.endsWith(']')) {
      line = line.slice(1, -1).trim();
    }
    line = line.replace(/^\d+[\.\)]\s*/, '');

    const parts = line.split('|').map(p => p.trim());
    const title = parts[0] || '';
    if (!title) continue;

    const subtitle = parts[1] || undefined;
    const explicitColor = parts[2]?.toLowerCase();

    let color: FlowStep['color'] = DEFAULT_FLOW_COLORS[colorIdx % DEFAULT_FLOW_COLORS.length];
    if (explicitColor) {
      if (explicitColor.includes('green') || explicitColor.includes('emerald')) color = 'emerald';
      else if (explicitColor.includes('blue') || explicitColor.includes('indigo')) color = 'indigo';
      else if (explicitColor.includes('orange') || explicitColor.includes('amber') || explicitColor.includes('terracotta') || explicitColor.includes('red')) color = 'terracotta';
      else if (explicitColor.includes('purple') || explicitColor.includes('violet')) color = 'purple';
      else if (explicitColor.includes('slate') || explicitColor.includes('zinc') || explicitColor.includes('gray')) color = 'slate';
    }

    steps.push({ title, subtitle, color });
    colorIdx++;
  }

  return steps;
}

const VisualFlowChart: React.FC<{ value: string }> = ({ value }) => {
  const steps = parseFlowContent(value);

  if (steps.length === 0) {
    return (
      <pre className="p-4 sm:p-5 m-0 overflow-x-auto text-xs font-mono text-zinc-200 bg-transparent whitespace-pre">
        <code>{value}</code>
      </pre>
    );
  }

  return (
    <div className="p-6 sm:p-8 flex flex-col items-center justify-center gap-0 w-full max-w-xl mx-auto my-2">
      {steps.map((step, idx) => {
        const theme = FLOW_COLOR_STYLES[step.color] || FLOW_COLOR_STYLES.slate;
        return (
          <React.Fragment key={idx}>
            <div className={cn(
              "w-full px-6 py-4 rounded-2xl border text-center transition-all duration-200 hover:scale-[1.01] hover:shadow-lg",
              theme.card
            )}>
              <div className={cn("text-sm sm:text-base leading-snug", theme.title)}>
                {step.title}
              </div>
              {step.subtitle && (
                <div className={cn("mt-1 opacity-90 leading-relaxed", theme.subtitle)}>
                  {step.subtitle}
                </div>
              )}
            </div>

            {idx < steps.length - 1 && (
              <div className="flex flex-col items-center my-2 text-zinc-400 dark:text-zinc-500">
                <div className="w-0.5 h-3 bg-current opacity-40" />
                <ArrowDown className="w-4 h-4 text-current -my-0.5" strokeWidth={2} />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

// Code block with copy functionality
const CodeBlock: React.FC<{ language: string; value: string }> = ({ language, value }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  const isFlow = language === 'flow' || language === 'flowchart' || (language === 'diagram' && (value.includes('↓') || value.includes('-->') || value.includes('->')) && value.includes('|'));

  const isSchemaOrDiagram = 
    isFlow ||
    language === 'schema' || 
    language === 'ascii' || 
    language === 'diagram' || 
    (language === 'text' && /[│┌─┐▼▲┼├└═║]/.test(value)) ||
    /[│┌─┐▼▲┼├└═║]/.test(value);

  return (
    <div className={cn(
      "my-4 overflow-hidden rounded-xl border shadow-lg group/code",
      isFlow
        ? "bg-[#0c0c0f] dark:bg-[#0c0c0f] border-border/80"
        : isSchemaOrDiagram 
          ? "bg-[#0b0b0e] border-white/[0.08]" 
          : "bg-secondary/35 border-border/60"
    )}>
      <div className="flex items-center justify-between px-4 py-1.5 bg-white/[0.02] border-b border-white/[0.06] text-[10px] font-mono tracking-widest text-zinc-400 uppercase">
        <span className="flex items-center gap-1.5">
          {isFlow ? (
            <>
              <span className="text-blue-400">⚡</span>
              <span>Schéma Visuel de Flux</span>
            </>
          ) : isSchemaOrDiagram ? (
            <>
              <span className="text-blue-400">📐</span>
              <span>Schéma Conceptuel</span>
            </>
          ) : (
            <span>{language || 'code'}</span>
          )}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-zinc-400 hover:text-white transition-colors p-1 rounded hover:bg-white/[0.06] cursor-pointer"
          title="Copier"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400">Copié</span>
            </>
          ) : (
            <>
              <Clipboard className="w-3 h-3" />
              <span>Copier</span>
            </>
          )}
        </button>
      </div>
      {isFlow ? (
        <VisualFlowChart value={value} />
      ) : isSchemaOrDiagram ? (
        <pre className="p-4 sm:p-5 m-0 overflow-x-auto text-xs font-mono leading-[1.28] text-zinc-200 bg-transparent selection:bg-white/20 whitespace-pre">
          <code>{value}</code>
        </pre>
      ) : (
        <SyntaxHighlighter
          language={language || 'text'}
          style={vscDarkPlus}
          customStyle={{
            margin: 0,
            padding: '16px',
            background: 'transparent',
            fontSize: '12px',
            lineHeight: '1.6',
          }}
        >
          {value}
        </SyntaxHighlighter>
      )}
    </div>
  );
};

// Callout / blockquote with GitHub-style alert parsing
const Callout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  let type: 'note' | 'tip' | 'warning' | 'important' | 'info' = 'info';
  let cleanChildren = children;

  // Walk through blockquote children to detect [!NOTE], [!TIP], etc.
  const childArray = React.Children.toArray(children);
  for (let i = 0; i < childArray.length; i++) {
    const child = childArray[i];
    if (React.isValidElement(child)) {
      const element = child as React.ReactElement<any>;
      if (element.props && element.props.children) {
        const innerList = React.Children.toArray(element.props.children);
        if (innerList.length > 0 && typeof innerList[0] === 'string') {
          const text = innerList[0].trim();
          const alertPatterns: Array<{ prefix: string; alertType: 'note' | 'tip' | 'warning' | 'important' | 'info' }> = [
            { prefix: '[!NOTE]', alertType: 'note' },
            { prefix: '[!TIP]', alertType: 'tip' },
            { prefix: '[!WARNING]', alertType: 'warning' },
            { prefix: '[!IMPORTANT]', alertType: 'important' },
          ];
          for (const { prefix, alertType } of alertPatterns) {
            if (text.startsWith(prefix)) {
              type = alertType;
              const cleaned = text.replace(prefix, '').trim();
              const newChild = React.cloneElement(element, {}, [cleaned, ...innerList.slice(1)]);
              const newArray = [...childArray];
              newArray[i] = newChild;
              cleanChildren = newArray;
              break;
            }
          }
          break; // Only check the first text-bearing element
        }
      }
    }
  }

  const styleMap = {
    note: {
      border: 'border-l-2 border-sky-500 bg-sky-50/50 dark:bg-[#151a24] border border-sky-200/60 dark:border-white/[0.08]',
      icon: <Info className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" strokeWidth={1.5} />,
      title: 'Note',
      badgeClass: 'text-sky-700 dark:text-sky-300 font-mono text-[11px] uppercase tracking-wider'
    },
    tip: {
      border: 'border-l-2 border-emerald-500 bg-emerald-50/50 dark:bg-[#131e18] border border-emerald-200/60 dark:border-white/[0.08]',
      icon: <Lightbulb className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" strokeWidth={1.5} />,
      title: 'Astuce',
      badgeClass: 'text-emerald-700 dark:text-emerald-300 font-mono text-[11px] uppercase tracking-wider'
    },
    warning: {
      border: 'border-l-2 border-amber-500 bg-amber-50/50 dark:bg-[#221c13] border border-amber-200/60 dark:border-white/[0.08]',
      icon: <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" strokeWidth={1.5} />,
      title: 'Attention',
      badgeClass: 'text-amber-700 dark:text-amber-300 font-mono text-[11px] uppercase tracking-wider'
    },
    important: {
      border: 'border-l-2 border-rose-500 bg-rose-50/50 dark:bg-[#241618] border border-rose-200/60 dark:border-white/[0.08]',
      icon: <Star className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" strokeWidth={1.5} />,
      title: 'Important',
      badgeClass: 'text-rose-700 dark:text-rose-300 font-mono text-[11px] uppercase tracking-wider'
    },
    info: {
      border: 'border-l-2 border-zinc-400 dark:border-zinc-600 bg-zinc-50 dark:bg-[#18181c] border border-zinc-200 dark:border-white/[0.08]',
      icon: <HelpCircle className="w-4 h-4 text-zinc-600 dark:text-zinc-400 shrink-0 mt-0.5" strokeWidth={1.5} />,
      title: 'Info',
      badgeClass: 'text-zinc-700 dark:text-zinc-300 font-mono text-[11px] uppercase tracking-wider'
    }
  };

  const styles = styleMap[type];

  return (
    <div className={`p-4 rounded-xl my-4 text-sm font-sans flex gap-3 ${styles.border}`}>
      {styles.icon}
      <div className="flex-1 min-w-0 space-y-1">
        {styles.title && (
          <div className="flex items-center gap-2 mb-1">
            <span className={cn(
              "text-[10px] font-semibold uppercase tracking-wider",
              styles.badgeClass
            )}>
              {styles.title}
            </span>
          </div>
        )}
        <div className="text-zinc-800 dark:text-zinc-200 leading-relaxed text-sm">{cleanChildren}</div>
      </div>
    </div>
  );
};
