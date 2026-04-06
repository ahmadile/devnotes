import React, { useState, useEffect } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, atomDark, prism, tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Plus, Trash2, MessageSquare, Info, AlertTriangle, Lightbulb, Code2, Edit3, Clipboard, Bug, Star, Palette, Highlighter, Eye, EyeOff, ChevronDown, ChevronRight } from 'lucide-react';
import { CodeSnippet, Annotation, AppSettings } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';

const ANNOTATION_COLORS = [
  { name: 'Indigo', value: '#6366f1', bg: 'rgba(99, 102, 241, 0.1)', border: 'rgba(99, 102, 241, 0.4)' },
  { name: 'Blue', value: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)', border: 'rgba(59, 130, 246, 0.4)' },
  { name: 'Amber', value: '#fbbf24', bg: 'rgba(251, 191, 36, 0.1)', border: 'rgba(251, 191, 36, 0.4)' },
  { name: 'Emerald', value: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.4)' },
  { name: 'Rose', value: '#f43f5e', bg: 'rgba(244, 63, 94, 0.1)', border: 'rgba(244, 63, 94, 0.4)' },
  { name: 'Cyan', value: '#06b6d4', bg: 'rgba(6, 182, 212, 0.1)', border: 'rgba(6, 182, 212, 0.4)' },
];

const detectLanguage = (code: string): string => {
  if (!code) return 'javascript';
  const lower = code.toLowerCase();
  if (lower.includes('def ') || lower.includes('import os') || lower.includes('print(')) return 'python';
  if (lower.includes('interface ') || lower.includes('type ') || lower.includes('<react.')) return 'typescript';
  if (lower.includes('const ') || lower.includes('let ') || lower.includes('console.log')) return 'javascript';
  if (lower.includes('<html>') || lower.includes('</div>')) return 'html';
  if (lower.includes('body {') || lower.includes('.class {')) return 'css';
  if (lower.includes('fn main()') || lower.includes('let mut')) return 'rust';
  return 'javascript';
};

interface CodeEditorProps {
  snippet: CodeSnippet;
  settings: AppSettings;
  onUpdate: (updated: CodeSnippet) => void;
  onDelete: () => void;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({ snippet, settings, onUpdate, onDelete }) => {
  const [isEditing, setIsEditing] = useState(!snippet.code);
  const [selectionStart, setSelectionStart] = useState<number | null>(null);
  const [isAddingAnnotation, setIsAddingAnnotation] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [hoveredLine, setHoveredLine] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isMinimizedMode, setIsMinimizedMode] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [dragRange, setDragRange] = useState<{ start: number, end: number } | null>(null);
  const prevCodeRef = React.useRef(snippet.code);

  useEffect(() => {
    prevCodeRef.current = snippet.code;
  }, [snippet.code]);

  const handleCodeChange = (newCode: string) => {
    const oldCode = prevCodeRef.current;
    if (oldCode === newCode) return;

    const oldLines = oldCode.split('\n');
    const newLines = newCode.split('\n');
    const oldLineCount = oldLines.length;
    const newLineCount = newLines.length;
    const lineDelta = newLineCount - oldLineCount;

    if (lineDelta !== 0) {
      // Basic line tracking logic
      // 1. Find divergence from start
      let start = 0;
      while (start < oldLineCount && start < newLineCount && oldLines[start] === newLines[start]) {
        start++;
      }

      // 2. Find divergence from end
      let oldEnd = oldLineCount - 1;
      let newEnd = newLineCount - 1;
      while (oldEnd >= start && newEnd >= start && oldLines[oldEnd] === newLines[newEnd]) {
        oldEnd--;
        newEnd--;
      }

      // Adjustment logic
      const adjustedAnnotations = snippet.annotations.map(ann => {
        let { line, endLine } = ann;
        const annLineIdx = line - 1;
        const annEndLineIdx = (endLine || line) - 1;

        // Case: Annotation is completely after the change point
        if (annLineIdx > oldEnd) {
          line += lineDelta;
          if (endLine) endLine += lineDelta;
        } 
        // Case: Annotation overlaps or is inside the change point
        else if (annEndLineIdx >= start) {
          // If the primary line of the annotation was removed (only if lines were actually deleted)
          if (lineDelta < 0 && annLineIdx >= start && annLineIdx <= oldEnd) {
            return null; // Mark for removal as requested by user
          }
          
          // Adjust endLine if it was after the change point
          if (endLine && annEndLineIdx > oldEnd) {
            endLine += lineDelta;
          }
        }
        
        const updatedAnn = { 
          ...ann, 
          line: Math.max(1, line)
        } as Annotation;
        if (endLine) {
          updatedAnn.endLine = Math.max(1, endLine);
        } else {
          delete updatedAnn.endLine;
        }
        return updatedAnn;
      }).filter((ann): ann is Annotation => ann !== null && (ann as Annotation).line <= newLineCount);

      onUpdate({ ...snippet, code: newCode, annotations: adjustedAnnotations });
    } else {
      onUpdate({ ...snippet, code: newCode });
    }
  };

  const [newAnnotation, setNewAnnotation] = useState({ 
    line: 1, 
    endLine: 1,
    text: '', 
    fullContext: '',
    type: 'logic' as Annotation['type'],
    color: ANNOTATION_COLORS[0].value,
    accentColor: ANNOTATION_COLORS[0].value
  });

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(snippet.code);
      // Optional: add a "Copied!" state if wanted, but for now just function
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const handlePaste = async () => {
    if (snippet.code && snippet.code.trim().length > 0) {
      const confirmPaste = window.confirm("This will replace your current code and may affect your existing notes. Continue?");
      if (!confirmPaste) return;
    }

    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        const language = detectLanguage(text);
        onUpdate({ ...snippet, code: text, language });
      }
    } catch (err) {
      console.error('Failed to read clipboard', err);
    }
  };

  const handleMouseDown = (line: number) => {
    if (isEditing) return;
    setIsDragging(true);
    setSelectionStart(line);
    setDragRange({ start: line, end: line });
  };

  const handleMouseEnterLine = (line: number) => {
    setHoveredLine(line);
    if (isDragging && selectionStart !== null) {
      setDragRange({ 
        start: Math.min(selectionStart, line), 
        end: Math.max(selectionStart, line) 
      });
    }
  };

  const handleMouseUp = () => {
    if (isDragging && dragRange) {
      setNewAnnotation({
        ...newAnnotation,
        line: dragRange.start,
        endLine: dragRange.end
      });
      setIsAddingAnnotation(true);
    }
    setIsDragging(false);
    setSelectionStart(null);
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging) handleMouseUp();
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [isDragging, dragRange]);

  const addAnnotation = () => {
    if (!newAnnotation.text) return;
    
    if (editingId) {
      onUpdate({
        ...snippet,
        annotations: snippet.annotations.map(a => 
          a.id === editingId ? { ...a, ...newAnnotation } : a
        )
      });
      setEditingId(null);
    } else {
      const annotation: Annotation = {
        id: Math.random().toString(36).substr(2, 9),
        ...newAnnotation
      };
      onUpdate({
        ...snippet,
        annotations: [...snippet.annotations, annotation].sort((a, b) => a.line - b.line)
      });
    }
    
    setNewAnnotation({ 
      line: 1, 
      endLine: 1, 
      text: '', 
      fullContext: '', 
      type: 'logic', 
      color: ANNOTATION_COLORS[0].value, 
      accentColor: ANNOTATION_COLORS[0].value 
    });
    setIsAddingAnnotation(false);
  };

  const handleEdit = (ann: Annotation) => {
    setNewAnnotation({
      line: ann.line,
      endLine: ann.endLine || ann.line,
      text: ann.text,
      fullContext: ann.fullContext || '',
      type: ann.type,
      color: ann.color || ANNOTATION_COLORS[0].value,
      accentColor: ann.color || ANNOTATION_COLORS[0].value
    });
    setEditingId(ann.id);
    setIsAddingAnnotation(true);
  };

  const removeAnnotation = (id: string) => {
    onUpdate({
      ...snippet,
      annotations: snippet.annotations.filter(a => a.id !== id)
    });
  };

  const getIcon = (type: Annotation['type'], color?: string) => {
    const className = "w-3.5 h-3.5";
    const style = { color: color || 'currentColor' };
    switch (type) {
      case 'warning': return <AlertTriangle className={className} style={style} />;
      case 'tip': return <Lightbulb className={className} style={style} />;
      case 'logic': return <Code2 className={className} style={style} />;
      case 'debug': return <Bug className={className} style={style} />;
      case 'important': return <Star className={className} style={style} />;
      default: return <Info className={className} style={style} />;
    }
  };

  const getSyntaxStyle = () => {
    if (settings.theme === 'light') return prism;
    switch (settings.syntaxTheme) {
      case 'atomDark': return atomDark;
      case 'tomorrow': return tomorrow;
      case 'prism': return prism;
      default: return vscDarkPlus;
    }
  };

  const getFontFamily = () => {
    switch (settings.fontFamily) {
      case 'JetBrains Mono': return "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
      case 'Fira Code': return "'Fira Code', monospace";
      case 'Inter': return "'Inter', sans-serif";
      default: return "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
    }
  };

  return (
    <div className="group relative mb-12 bg-card rounded-2xl border border-border overflow-hidden shadow-2xl transition-all hover:border-primary/30">
      {/* Snippet Header */}
      <div className="flex items-center justify-between px-5 py-3 bg-secondary/50 border-b border-border">
        <div className="flex items-center gap-4 flex-1">
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 hover:bg-secondary rounded-md transition-colors text-muted-foreground hover:text-foreground"
            title={isCollapsed ? "Expand Snippet" : "Collapse Snippet"}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <div className="flex gap-1.5 shrink-0">
            <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/30" />
            <div className="w-3 h-3 rounded-full bg-amber-500/20 border border-amber-500/30" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/20 border border-emerald-500/30" />
          </div>
          <div className="w-px h-4 bg-border mx-2 shrink-0" />
          <select 
            value={snippet.language}
            onChange={(e) => onUpdate({ ...snippet, language: e.target.value })}
            className="bg-transparent text-[11px] font-mono font-bold uppercase tracking-widest text-muted-foreground focus:outline-none cursor-pointer hover:text-primary transition-colors shrink-0"
          >
            <option value="javascript">JavaScript</option>
            <option value="typescript">TypeScript</option>
            <option value="python">Python</option>
            <option value="css">CSS</option>
            <option value="html">HTML</option>
            <option value="rust">Rust</option>
            <option value="go">Go</option>
          </select>
          <div className="w-px h-4 bg-border mx-2 shrink-0" />
          <input 
            type="text"
            placeholder="Snippet Title..."
            value={snippet.title || ''}
            onChange={(e) => onUpdate({ ...snippet, title: e.target.value })}
            className="bg-transparent text-xs font-semibold text-foreground focus:outline-none placeholder:text-muted-foreground/30 flex-1 min-w-0 truncate"
          />
        </div>

        <div className="flex items-center gap-1">
          <button 
            onClick={handleCopy}
            className="p-2 hover:bg-secondary rounded-md transition-colors text-muted-foreground hover:text-primary"
            title="Copy Code"
          >
            <Clipboard className="w-4 h-4" />
          </button>
          <button 
            onClick={handlePaste}
            className="p-2 hover:bg-secondary rounded-md transition-colors text-muted-foreground hover:text-primary"
            title="Import/Replace Code from Clipboard"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setIsMinimizedMode(!isMinimizedMode)}
            className={cn(
              "p-2 rounded-md transition-all",
              isMinimizedMode ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground hover:bg-secondary"
            )}
            title={isMinimizedMode ? "Show All Notes" : "Minimize to Pulse Dots"}
          >
            {isMinimizedMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          <div className="w-px h-4 bg-border mx-1" />
          <button 
            onClick={() => setIsEditing(!isEditing)}
            className={cn(
              "px-3 py-1.5 rounded-md transition-all text-xs font-bold flex items-center gap-2",
              isEditing ? "bg-primary/10 text-primary border border-primary/20 shadow-sm" : "text-muted-foreground hover:bg-secondary"
            )}
          >
            {isEditing ? <MessageSquare className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
            {isEditing ? 'Annotate' : 'Edit Code'}
          </button>
          <div className="w-px h-4 bg-border mx-1" />
          <button 
            onClick={onDelete}
            className="p-2 hover:bg-destructive/10 rounded-md transition-colors text-muted-foreground hover:text-destructive"
            title="Delete Snippet"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Editor / Viewer Container */}
      <AnimatePresence>
        {!isCollapsed && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="relative flex overflow-hidden"
          >
            <div className="flex-1 min-w-0">
              {isEditing ? (
                <textarea
                  autoFocus
                  value={snippet.code}
                  onChange={(e) => handleCodeChange(e.target.value)}
                  placeholder="Paste your logic here..."
                  className="w-full h-[400px] p-6 bg-transparent text-sm text-foreground focus:outline-none resize-none placeholder:text-muted-foreground/30 leading-relaxed transition-colors"
                  style={{ fontFamily: getFontFamily() }}
                  spellCheck={false}
                />
              ) : (
            <div className="relative">
              <SyntaxHighlighter
                language={snippet.language}
                style={getSyntaxStyle()}
                customStyle={{
                  margin: 0,
                  padding: '1.5rem 1.5rem 12rem 1.5rem',
                  background: 'transparent',
                  fontSize: '0.85rem',
                  lineHeight: '1.6',
                  fontFamily: getFontFamily(),
                }}
                showLineNumbers
                wrapLines={true}
                lineProps={(lineNumber) => {
                  const isBeingSelected = isDragging && dragRange && lineNumber >= dragRange.start && lineNumber <= dragRange.end;
                  const activeAnnotation = snippet.annotations.find(a => 
                    lineNumber >= a.line && lineNumber <= (a.endLine || a.line)
                  );
                  const isInActiveBlock = !!activeAnnotation;
                  const isHovered = hoveredLine === lineNumber || (activeAnnotation && snippet.annotations.find(a => hoveredLine ? (hoveredLine >= a.line && hoveredLine <= (a.endLine || a.line)) : false)?.id === activeAnnotation.id);

                  return { 
                    style: { 
                      display: 'block', 
                      cursor: 'text',
                      backgroundColor: isBeingSelected 
                        ? 'rgba(99, 102, 241, 0.2)' 
                        : isInActiveBlock 
                          ? isHovered 
                            ? (ANNOTATION_COLORS.find(c => c.value === activeAnnotation?.color)?.bg.replace('0.1', '0.2') || 'rgba(99, 102, 241, 0.1)')
                            : (ANNOTATION_COLORS.find(c => c.value === activeAnnotation?.color)?.bg || 'rgba(99, 102, 241, 0.05)')
                          : 'transparent',
                      borderLeft: isBeingSelected 
                        ? '3px solid #6366f1' 
                        : isInActiveBlock 
                          ? `3px solid ${activeAnnotation?.color || '#6366f1'}`
                          : '3px solid transparent',
                      transition: 'all 0.15s ease',
                      opacity: isDragging && !isBeingSelected ? 0.6 : 1
                    },
                    onMouseDown: () => handleMouseDown(lineNumber),
                    onMouseEnter: () => handleMouseEnterLine(lineNumber),
                    onMouseLeave: () => setHoveredLine(null),
                    className: cn(
                      'relative select-none',
                      isInActiveBlock && 'group/line'
                    )
                  };
                }}
              >
                {snippet.code || '// No code provided'}
              </SyntaxHighlighter>

              {/* Floating Annotation Cards (Desktop side) */}
              <div className="absolute top-0 right-4 w-80 h-full pointer-events-none py-6 hidden lg:block">
                <AnimatePresence>
                  {snippet.annotations.map((ann, index) => {
                    const isExpanded = expandedId === ann.id;
                    const isActive = hoveredLine !== null && hoveredLine >= ann.line && hoveredLine <= (ann.endLine || ann.line);
                    // Match SyntaxHighlighter padding: 1.5rem, lineHeight: 1.6, fontSize: 0.85rem
                    // math: 1.5 + (line-1) * (0.85 * 1.6)
                    const topOffset = 1.35 + (ann.line - 1) * 1.36; 
                    const isVisible = !isMinimizedMode || isActive;

                    return (
                      <motion.div
                        key={ann.id}
                        initial={{ opacity: 0, x: 20, scale: 0.95 }}
                        animate={{ 
                          opacity: isVisible ? (hoveredLine === null || isActive ? 1 : 0.2) : 0, 
                          x: isActive ? -5 : 0,
                          scale: isActive ? 1 : 0.98,
                          pointerEvents: isVisible ? 'auto' : 'none'
                        }}
                        exit={{ opacity: 0, x: 20, scale: 0.95 }}
                        className={cn(
                          "absolute right-0 w-full floating-card rounded-xl border-l-[3px] shadow-2xl group/card overflow-hidden transition-all duration-300",
                          isActive ? "shadow-primary/20 ring-1 ring-primary/20" : "grayscale-[0.5] opacity-90"
                        )}
                        style={{ 
                          borderColor: ann.color || 'var(--primary)',
                          top: `${topOffset}rem`,
                          zIndex: isActive ? 100 : (isExpanded ? 50 : 10 + index)
                        }}
                        onMouseEnter={() => setHoveredLine(ann.line)}
                        onMouseLeave={() => setHoveredLine(null)}
                      >
                        <div className="flex flex-col max-h-[400px]">
                          <div className="p-4 overflow-y-auto custom-scrollbar">
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5 shrink-0">{getIcon(ann.type, ann.color)}</div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground/60 font-mono">
                                    Lines {ann.line}{ann.endLine && ann.endLine !== ann.line ? `-${ann.endLine}` : ''}
                                  </span>
                                  <div className="flex items-center gap-1 opacity-0 group-hover/card:opacity-100 transition-all">
                                    <button 
                                      onClick={() => handleEdit(ann)}
                                      className="p-1 hover:bg-secondary rounded text-muted-foreground hover:text-primary transition-colors"
                                      title="Edit Note"
                                    >
                                      <Edit3 className="w-3 h-3" />
                                    </button>
                                    <button 
                                      onClick={() => removeAnnotation(ann.id)}
                                      className="p-1 hover:bg-secondary rounded text-muted-foreground hover:text-destructive transition-colors"
                                      title="Delete Note"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                                <p className="text-xs text-foreground leading-relaxed font-semibold mb-2">{ann.text}</p>
                                
                                {ann.fullContext && (
                                  <button 
                                    onClick={() => setExpandedId(isExpanded ? null : ann.id)}
                                    className="text-[10px] font-bold text-primary hover:text-primary/80 flex items-center gap-1 transition-colors"
                                  >
                                    {isExpanded ? 'Show Less' : 'Read Full Context'}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        <AnimatePresence>
                          {isExpanded && ann.fullContext && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="border-t border-border bg-secondary/30 overflow-hidden"
                            >
                              <div className="p-4 text-[11px] text-muted-foreground prose prose-invert prose-xs max-w-none prose-p:leading-relaxed prose-code:text-primary max-h-[300px] overflow-y-auto custom-scrollbar">
                                <ReactMarkdown>{ann.fullContext}</ReactMarkdown>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                        
                        {/* Connection Dot Trigger */}
                        <div 
                          className={cn(
                            "absolute -left-[1.3rem] top-4 w-2.5 h-2.5 rounded-full cursor-pointer transition-all duration-300",
                            isActive ? "scale-125 shadow-lg" : "opacity-60 hover:opacity-100"
                          )}
                          style={{ 
                            backgroundColor: ann.color || 'var(--primary)', 
                            boxShadow: `0 0 10px ${ann.color || 'var(--primary)'}` 
                          }}
                          onMouseEnter={() => setHoveredLine(ann.line)}
                        />
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    )}
  </AnimatePresence>

      {/* Contextual Annotation Form */}
      <AnimatePresence>
        {isAddingAnnotation && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-border bg-secondary/50 backdrop-blur-md"
          >
            <div className="p-6 space-y-6 max-w-3xl mx-auto">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-4 bg-primary rounded-full" />
                  <h4 className="text-sm font-bold text-foreground">
                    {editingId ? 'Update Logical Note' : 'New Logical Note'}
                  </h4>
                </div>
                <button 
                  onClick={() => {
                    setIsAddingAnnotation(false);
                    setEditingId(null);
                  }}
                  className="text-muted-foreground hover:text-foreground text-lg transition-colors"
                >
                  &times;
                </button>
              </div>

              <div className="grid grid-cols-12 gap-5">
                <div className="col-span-3">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Category</label>
                  <select 
                    value={newAnnotation.type}
                    onChange={(e) => setNewAnnotation({ ...newAnnotation, type: e.target.value as any })}
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary/50 transition-colors"
                  >
                    <option value="logic">Code Logic</option>
                    <option value="tip">Best Practice</option>
                    <option value="important">Warning</option>
                    <option value="debug">Bug Fix</option>
                    <option value="info">General Info</option>
                  </select>
                </div>
                <div className="col-span-9">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-2">Accent Color</label>
                  <div className="flex items-center gap-3">
                    {ANNOTATION_COLORS.map(c => (
                      <button
                        key={c.value}
                        onClick={() => setNewAnnotation({ ...newAnnotation, color: c.value, accentColor: c.value })}
                        className={cn(
                          "w-6 h-6 rounded-full border-2 transition-all p-0.5",
                          newAnnotation.color === c.value ? "border-white" : "border-transparent opacity-40 hover:opacity-100"
                        )}
                      >
                        <div className="w-full h-full rounded-full" style={{ backgroundColor: c.value }} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Short Logic (Visible directly)</label>
                  <textarea 
                    placeholder="Describe the logic behind this block..."
                    value={newAnnotation.text}
                    onChange={(e) => setNewAnnotation({ ...newAnnotation, text: e.target.value })}
                    className="w-full h-20 bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary/50 resize-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Detailed Context (Optional, Markdown Supported)</label>
                  <textarea 
                    placeholder="Add in-depth details about libraries (Pandas, OS), functions, or external links..."
                    value={newAnnotation.fullContext}
                    onChange={(e) => setNewAnnotation({ ...newAnnotation, fullContext: e.target.value })}
                    className="w-full h-32 bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary/50 resize-none transition-colors"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-muted-foreground italic">
                    Block: Lines {newAnnotation.line} to {newAnnotation.endLine}
                  </p>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => {
                        setIsAddingAnnotation(false);
                        setEditingId(null);
                      }}
                      className="px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={addAnnotation}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground px-5 py-2 rounded-lg text-xs font-bold transition-all shadow-lg"
                    >
                      {editingId ? 'Update Note' : 'Attach Note'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer Info */}
      {!isEditing && (
        <div className="px-5 py-2 bg-secondary/30 border-t border-border flex items-center justify-between transition-colors">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-mono">
              <span className="w-2 h-2 rounded-full bg-primary/50 animate-pulse" />
              {selectionStart ? `Selecting block (starting at line ${selectionStart})...` : 'Click two lines to define a logical block'}
            </div>
          </div>
          <div className="text-[10px] text-muted-foreground/60 font-mono italic">
            Visual Debug Mode: Active
          </div>
        </div>
      )}
    </div>
  );
};
