import React, { useState, useEffect, useMemo } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, atomDark, prism, tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Plus, Trash2, MessageSquare, Info, AlertTriangle, Lightbulb, Code2, Edit3, Clipboard, Bug, Star, Palette, Highlighter, Eye, EyeOff, ChevronDown, ChevronRight, BookOpen, GripHorizontal, Upload, Columns, Rows, List } from 'lucide-react';
import { CodeSnippet, Annotation, AppSettings, SyntaxDefinition } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence, useDragControls } from 'motion/react';
import { Markdown } from './Markdown';

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

interface DraggableAnnotationFormProps {
  formKey: string;
  topOffset: number;
  editingId: string | null;
  newAnnotation: {
    line: number;
    endLine: number;
    text: string;
    fullContext: string;
    type: Annotation['type'];
    color: string;
    accentColor: string;
  };
  setNewAnnotation: React.Dispatch<React.SetStateAction<DraggableAnnotationFormProps['newAnnotation']>>;
  setIsAddingAnnotation: React.Dispatch<React.SetStateAction<boolean>>;
  setEditingId: React.Dispatch<React.SetStateAction<string | null>>;
  associationKeyword: string;
  setAssociationKeyword: React.Dispatch<React.SetStateAction<string>>;
  syntaxDefinitions: Record<string, SyntaxDefinition>;
  onSaveSyntaxDefinition: (keyword: string, text: string, fullContext?: string, language?: string) => void;
  snippet: CodeSnippet;
  addAnnotation: () => void;
  setToastMessage: React.Dispatch<React.SetStateAction<string | null>>;
}

const DraggableAnnotationForm: React.FC<DraggableAnnotationFormProps> = ({
  formKey, topOffset, editingId, newAnnotation, setNewAnnotation,
  setIsAddingAnnotation, setEditingId, associationKeyword, setAssociationKeyword,
  syntaxDefinitions, onSaveSyntaxDefinition, snippet, addAnnotation, setToastMessage
}) => {
  const dragControls = useDragControls();

  return (
    <motion.div
      key={formKey}
      drag
      dragControls={dragControls}
      dragListener={false}
      dragMomentum={false}
      initial={{ scale: 0.95, opacity: 0, y: 10 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.95, opacity: 0, y: 10 }}
      className="absolute left-6 z-50 w-full max-w-lg bg-card/98 border border-primary/30 shadow-2xl rounded-2xl p-5 space-y-4 font-sans select-none"
      style={{ top: `${topOffset}px` }}
    >
      {/* Popover Header / Drag Handle */}
      <div
        onPointerDown={(e) => dragControls.start(e)}
        className="flex items-center justify-between pb-2 border-b border-border/60 cursor-grab active:cursor-grabbing hover:bg-secondary/20 p-1.5 rounded-lg transition-colors"
      >
        <div className="flex items-center gap-2">
          <GripHorizontal className="w-4 h-4 text-muted-foreground/60 shrink-0" />
          <span className="w-1.5 h-3 bg-primary rounded-full shrink-0" />
          <h4 className="text-xs font-bold text-foreground">
            {editingId ? 'Update Logical Note' : 'New Logical Note'}
          </h4>
        </div>
        <button 
          onClick={() => {
            setIsAddingAnnotation(false);
            setEditingId(null);
          }}
          className="text-muted-foreground hover:text-foreground text-sm leading-none transition-colors p-1 hover:bg-secondary rounded cursor-pointer"
        >
          &times;
        </button>
      </div>

      {/* Category & Accent Color */}
      <div className="grid grid-cols-2 gap-4 bg-secondary/35 p-3 rounded-xl border border-border/40">
        <div>
          <label className="block text-[9px] font-extrabold uppercase tracking-widest text-muted-foreground/80 mb-1.5">Category</label>
          <select 
            value={newAnnotation.type}
            onChange={(e) => setNewAnnotation({ ...newAnnotation, type: e.target.value as any })}
            className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs text-foreground focus:outline-none focus:border-primary/50 transition-colors"
          >
            <option value="logic">Code Logic</option>
            <option value="tip">Best Practice</option>
            <option value="warning">Warning</option>
            <option value="debug">Bug Fix</option>
            <option value="important">Warning / Imp</option>
          </select>
        </div>
        <div>
          <label className="block text-[9px] font-extrabold uppercase tracking-widest text-muted-foreground/80 mb-1.5">Accent Color</label>
          <div className="flex items-center gap-2 mt-0.5">
            {ANNOTATION_COLORS.map(c => (
              <button
                key={c.value}
                type="button"
                onClick={() => setNewAnnotation({ ...newAnnotation, color: c.value, accentColor: c.value })}
                className={cn(
                  "w-4 h-4 rounded-full border transition-all p-0.5 cursor-pointer",
                  newAnnotation.color === c.value ? "border-white scale-110" : "border-transparent opacity-60 hover:opacity-100"
                )}
              >
                <div className="w-full h-full rounded-full" style={{ backgroundColor: c.value }} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Short Logic Input */}
      <div>
        <label className="block text-[9px] font-extrabold uppercase tracking-widest text-muted-foreground/80 mb-1.5">Short Logic (Visible directly)</label>
        <textarea 
          placeholder="Describe the logic behind this block..."
          value={newAnnotation.text}
          onChange={(e) => setNewAnnotation({ ...newAnnotation, text: e.target.value })}
          className="w-full h-14 bg-secondary/40 border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary/50 resize-none transition-colors"
        />
      </div>

      {/* Detailed Context Input */}
      <div>
        <label className="block text-[9px] font-extrabold uppercase tracking-widest text-muted-foreground/80 mb-1.5">Detailed Context (Optional, Markdown Supported)</label>
        <textarea 
          placeholder="Add in-depth details, code snippets, or external links..."
          value={newAnnotation.fullContext}
          onChange={(e) => setNewAnnotation({ ...newAnnotation, fullContext: e.target.value })}
          className="w-full h-24 bg-secondary/40 border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary/50 resize-none transition-colors font-mono"
        />
      </div>

      {/* Optional Syntax Library Link & Save */}
      <div className="bg-secondary/20 border border-border/40 rounded-xl p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-extrabold uppercase tracking-widest text-muted-foreground/75 font-mono">
            Syntax Library Link
          </span>
          {Object.keys(syntaxDefinitions || {}).length > 0 && (
            <select
              onChange={(e) => {
                const kw = e.target.value;
                if (kw && syntaxDefinitions[kw]) {
                  setNewAnnotation(prev => ({
                    ...prev,
                    text: syntaxDefinitions[kw].text,
                    fullContext: syntaxDefinitions[kw].fullContext || ''
                  }));
                  setAssociationKeyword(kw);
                }
              }}
              className="bg-transparent text-[9px] font-bold text-primary focus:outline-none cursor-pointer hover:text-primary/80 transition-colors"
              defaultValue=""
            >
              <option value="" disabled>-- Load Saved Syntax --</option>
              {Object.keys(syntaxDefinitions).map(kw => (
                <option key={kw} value={kw} className="bg-popover text-foreground text-xs">{kw}</option>
              ))}
            </select>
          )}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Keyword Name (e.g. sorted, append)"
            value={associationKeyword}
            onChange={(e) => setAssociationKeyword(e.target.value)}
            className="flex-1 bg-card border border-border rounded-lg px-2.5 py-1 text-xs text-foreground focus:outline-none focus:border-primary/50 transition-colors"
          />
          <button
            type="button"
            onClick={() => {
              if (associationKeyword.trim() && newAnnotation.text.trim()) {
                onSaveSyntaxDefinition(
                  associationKeyword.trim(),
                  newAnnotation.text.trim(),
                  newAnnotation.fullContext || '',
                  snippet.language || 'python'
                );
                setToastMessage(`Syntax definition for "${associationKeyword.trim()}" successfully saved!`);
                setTimeout(() => setToastMessage(null), 3000);
                addAnnotation();
              }
            }}
            disabled={!associationKeyword.trim() || !newAnnotation.text.trim()}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-3 py-1 rounded-lg text-xs font-bold transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
          >
            Save Syntax
          </button>
        </div>
      </div>

      {/* Action Buttons & Info */}
      <div className="flex items-center justify-between pt-1">
        <p className="text-[9px] text-muted-foreground italic font-mono">
          Block: Lines {newAnnotation.line} to {newAnnotation.endLine}
        </p>
        <div className="flex gap-2">
          <button 
            onClick={() => {
              setIsAddingAnnotation(false);
              setEditingId(null);
            }}
            className="px-3 py-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button 
            onClick={addAnnotation}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-1.5 rounded-lg text-xs font-bold transition-all shadow-md cursor-pointer"
          >
            {editingId ? 'Update Note' : 'Attach Note'}
          </button>
        </div>
      </div>
    </motion.div>
  );
};

interface CodeEditorProps {
  snippet: CodeSnippet;
  settings: AppSettings;
  onUpdate: (updated: CodeSnippet) => void;
  onDelete: () => void;
  syntaxDefinitions: Record<string, SyntaxDefinition>;
  onSaveSyntaxDefinition: (keyword: string, text: string, fullContext?: string, language?: string) => void;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({ 
  snippet, 
  settings, 
  onUpdate, 
  onDelete, 
  syntaxDefinitions, 
  onSaveSyntaxDefinition 
}) => {
  const [isEditing, setIsEditing] = useState(!snippet.code);
  const [selectionStart, setSelectionStart] = useState<number | null>(null);
  const [isAddingAnnotation, setIsAddingAnnotation] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [hoveredLine, setHoveredLine] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isMinimizedMode, setIsMinimizedMode] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [viewLayout, setViewLayout] = useState<'lateral' | 'inline'>('lateral');
  const [dragRange, setDragRange] = useState<{ start: number, end: number } | null>(null);
  const [associationKeyword, setAssociationKeyword] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const prevCodeRef = React.useRef(snippet.code);

  useEffect(() => {
    prevCodeRef.current = snippet.code;
  }, [snippet.code]);

  useEffect(() => {
    if (isAddingAnnotation && !editingId && dragRange && snippet.code) {
      const lineText = snippet.code.split('\n')[dragRange.start - 1] || '';
      const matchedKw = Object.keys(syntaxDefinitions || {}).find(kw => {
        const regex = new RegExp(`\\b${kw}\\b`, 'i');
        return regex.test(lineText);
      });
      if (matchedKw && syntaxDefinitions[matchedKw]) {
        setNewAnnotation(prev => ({
          ...prev,
          text: syntaxDefinitions[matchedKw].text,
          fullContext: syntaxDefinitions[matchedKw].fullContext || ''
        }));
        setAssociationKeyword(matchedKw);
      } else {
        setAssociationKeyword('');
      }
    }
  }, [isAddingAnnotation, editingId, dragRange, snippet.code, syntaxDefinitions]);

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

      onUpdate({
        ...snippet,
        code: newCode,
        annotations: adjustedAnnotations
      });
    } else {
      onUpdate({
        ...snippet,
        code: newCode
      });
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
    if (!snippet.code) return;
    try {
      await navigator.clipboard.writeText(snippet.code);
      // Optional: add a "Copied!" state if wanted, but for now just function
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  /** Estimate the rendered height of an annotation card (in px). */
  const estimateCardHeight = (ann: Annotation, isExpanded: boolean, isActive: boolean): number => {
    // In compact pill state: sleek 32px height to avoid vertical drift on consecutive lines
    if (!isExpanded && !isActive) {
      return 32;
    }
    // Expanded or active: compute full height
    const textLines = Math.max(1, Math.ceil((ann.text?.length || 20) / 36));
    let h = 58 + textLines * 20;
    if (ann.fullContext) h += 28; // "Read Full Context" button
    if (isExpanded && ann.fullContext) {
      const contextLines = Math.max(2, Math.ceil((ann.fullContext.length || 40) / 36));
      h += 36 + contextLines * 18; // border-t + padding + content
      h = Math.min(h, 450); // max-h on the card
    }
    return h;
  };

  /** Compute collision-resolved card positions so cards don't overlap. */
  const cardPositions = useMemo(() => {
    const GAP = 6; // compact 6px gap between cards
    const sorted = [...snippet.annotations].sort((a, b) => a.line - b.line);
    const positions: Record<string, number> = {};
    let prevBottom = 0;
    let maxBottom = 0;

    for (const ann of sorted) {
      const idealTop = 24 + (ann.line - 1) * 24;
      const resolvedTop = Math.max(idealTop, prevBottom + GAP);
      positions[ann.id] = resolvedTop;

      const isAnnActive = hoveredLine !== null && hoveredLine >= ann.line && hoveredLine <= (ann.endLine || ann.line);
      const height = estimateCardHeight(ann, expandedId === ann.id, isAnnActive);
      prevBottom = resolvedTop + height;
      maxBottom = Math.max(maxBottom, prevBottom);
    }

    return { positions, maxBottom };
  }, [snippet.annotations, expandedId, hoveredLine]);

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
    setAssociationKeyword('');
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
    const matchedKw = Object.keys(syntaxDefinitions || {}).find(
      kw => syntaxDefinitions[kw].text === ann.text
    ) || '';
    setAssociationKeyword(matchedKw);
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
          {/* View Layout Switcher (Lateral Cards vs Inline CodeLens) */}
          <button 
            onClick={() => setViewLayout(viewLayout === 'lateral' ? 'inline' : 'lateral')}
            className={cn(
              "px-2.5 py-1.5 rounded-md transition-all text-xs font-bold flex items-center gap-1.5 cursor-pointer",
              viewLayout === 'inline' 
                ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30" 
                : "text-muted-foreground hover:bg-secondary"
            )}
            title={viewLayout === 'lateral' ? "Basculer en Vue Intégrée (Notes insérées sous chaque ligne)" : "Basculer en Vue Latérale (Cartes & Connecteurs)"}
          >
            {viewLayout === 'lateral' ? <Rows className="w-3.5 h-3.5" /> : <Columns className="w-3.5 h-3.5" />}
            <span className="hidden md:inline">{viewLayout === 'lateral' ? 'Vue Cartes' : 'Vue Intégrée'}</span>
          </button>
          <div className="w-px h-4 bg-border mx-1" />
          <button 
            onClick={handleCopy}
            className="p-2 hover:bg-secondary rounded-md transition-colors text-muted-foreground hover:text-primary cursor-pointer"
            title="Copy Code"
          >
            <Clipboard className="w-4 h-4" />
          </button>
          <button 
            onClick={handlePaste}
            className="p-2 hover:bg-secondary rounded-md transition-colors text-muted-foreground hover:text-primary cursor-pointer"
            title="Import/Replace Code from Clipboard"
          >
            <Upload className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setIsMinimizedMode(!isMinimizedMode)}
            className={cn(
              "p-2 rounded-md transition-all cursor-pointer",
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
              "px-3 py-1.5 rounded-md transition-all text-xs font-bold flex items-center gap-2 cursor-pointer",
              isEditing ? "bg-primary/10 text-primary border border-primary/20 shadow-sm" : "text-muted-foreground hover:bg-secondary"
            )}
          >
            {isEditing ? <MessageSquare className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
            {isEditing ? 'Annotate' : 'Edit Code'}
          </button>
          <div className="w-px h-4 bg-border mx-1" />
          <button 
            onClick={onDelete}
            className="p-2 hover:bg-destructive/10 rounded-md transition-colors text-muted-foreground hover:text-destructive cursor-pointer"
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
              ) : viewLayout === 'inline' ? (
                /* INLINE CODELENS VIEW: Each note sits directly under its line of code */
                <div className="p-5 font-mono text-[13.6px] leading-[24px] space-y-1 overflow-x-auto">
                  {snippet.code.split('\n').map((lineText, idx) => {
                    const lineNum = idx + 1;
                    const lineAnns = snippet.annotations.filter(a => lineNum >= a.line && lineNum <= (a.endLine || a.line));
                    const hasAnns = lineAnns.length > 0;
                    const isHovered = hoveredLine === lineNum;

                    return (
                      <div key={lineNum} className="group/inlineline">
                        {/* Code Line */}
                        <div 
                          className={cn(
                            "flex items-center gap-3 px-3 py-0.5 rounded-lg transition-colors cursor-pointer select-none",
                            hasAnns ? "bg-secondary/25 hover:bg-secondary/45" : "hover:bg-secondary/15",
                            isHovered && "bg-primary/15"
                          )}
                          onMouseEnter={() => setHoveredLine(lineNum)}
                          onMouseLeave={() => setHoveredLine(null)}
                          onMouseDown={() => handleMouseDown(lineNum)}
                        >
                          <span className="w-8 text-right text-xs text-muted-foreground/60 select-none font-mono shrink-0">
                            {lineNum}
                          </span>
                          <span className="text-foreground flex-1 font-mono whitespace-pre overflow-x-auto">
                            {lineText || ' '}
                          </span>
                          {hasAnns && (
                            <span 
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 shadow-sm"
                              style={{ 
                                backgroundColor: `${lineAnns[0]?.color || '#6366f1'}25`, 
                                color: lineAnns[0]?.color || '#6366f1' 
                              }}
                            >
                              {lineAnns.length} sous-note{lineAnns.length > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>

                        {/* Inline Annotations Accordion directly beneath the line */}
                        {hasAnns && (
                          <div className="ml-11 mr-4 my-2 space-y-2">
                            {lineAnns.map((ann) => (
                              <div 
                                key={ann.id}
                                className="rounded-xl border-l-[4px] p-3.5 bg-secondary/35 backdrop-blur-md shadow-md transition-all hover:bg-secondary/50"
                                style={{ borderColor: ann.color || 'var(--primary)' }}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex items-center gap-2">
                                    {getIcon(ann.type, ann.color)}
                                    <span className="text-xs font-bold text-foreground font-sans">{ann.text}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button 
                                      onClick={() => handleEdit(ann)}
                                      className="p-1 hover:bg-secondary rounded text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                                      title="Modifier la note"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                    <button 
                                      onClick={() => removeAnnotation(ann.id)}
                                      className="p-1 hover:bg-secondary rounded text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                                      title="Supprimer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                                {ann.fullContext && (
                                  <div className="mt-2 text-xs text-muted-foreground/90 font-sans border-t border-border/40 pt-2 leading-relaxed">
                                    <Markdown content={ann.fullContext} />
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* LATERAL VIEW: Code on left + Compact Ribbon Pills & SVG Connectors on right */
                <div className="relative">
                  <SyntaxHighlighter
                    language={snippet.language}
                    style={getSyntaxStyle()}
                    customStyle={{
                      margin: 0,
                      padding: `24px ${snippet.annotations.length > 0 ? 'min(360px, 45%)' : '24px'} ${snippet.annotations.length > 0 ? Math.max(64, (cardPositions.maxBottom || 0) - (snippet.code.split('\n').length * 24) + 120) : 24}px 24px`,
                      background: 'transparent',
                      fontSize: '13.6px', // 0.85rem
                      lineHeight: '24px', // STRICT 24px height for alignment
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
                          height: '24px',
                          lineHeight: '24px',
                          boxSizing: 'border-box',
                          backgroundColor: isBeingSelected 
                            ? 'rgba(99, 102, 241, 0.2)' 
                            : isInActiveBlock 
                              ? isHovered 
                                ? (ANNOTATION_COLORS.find(c => c.value === activeAnnotation?.color)?.bg.replace('0.1', '0.2') || 'rgba(99, 102, 241, 0.2)')
                                : (ANNOTATION_COLORS.find(c => c.value === activeAnnotation?.color)?.bg || 'rgba(99, 102, 241, 0.05)')
                              : 'transparent',
                          borderLeft: isBeingSelected 
                            ? '3px solid #6366f1' 
                            : isInActiveBlock 
                              ? `3px solid ${activeAnnotation?.color || '#6366f1'}`
                              : '3px solid transparent',
                          paddingLeft: '8px',
                          transition: 'background-color 0.15s ease, border-color 0.15s ease',
                        },
                        onMouseDown: () => handleMouseDown(lineNumber),
                        onMouseEnter: () => setHoveredLine(lineNumber),
                        onMouseLeave: () => setHoveredLine(null),
                      };
                    }}
                  >
                    {snippet.code || '// No code provided'}
                  </SyntaxHighlighter>

                  {/* Mobile / Small Screen Inline Fallback when in lateral mode (< lg) */}
                  {snippet.annotations.length > 0 && (
                    <div className="lg:hidden p-4 border-t border-border bg-secondary/15 space-y-2">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center justify-between">
                        <span>Sous-notes ({snippet.annotations.length})</span>
                        <span className="text-[10px] text-primary">Vue responsive</span>
                      </div>
                      {snippet.annotations.map(ann => (
                        <div 
                          key={`mobile-ann-${ann.id}`}
                          className="p-3 rounded-xl border border-border/70 bg-card/80 shadow-sm"
                          style={{ borderLeftColor: ann.color || '#6366f1', borderLeftWidth: '3px' }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span 
                              className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md"
                              style={{ backgroundColor: `${ann.color || '#6366f1'}20`, color: ann.color || '#6366f1' }}
                            >
                              L{ann.line}{ann.endLine && ann.endLine !== ann.line ? `-${ann.endLine}` : ''}
                            </span>
                            <span className="text-xs font-semibold text-foreground flex-1 truncate">{ann.text}</span>
                          </div>
                          {ann.fullContext && (
                            <div className="mt-2 text-xs text-muted-foreground border-t border-border/40 pt-2">
                              <Markdown content={ann.fullContext} />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* SVG Laser Beam Connectors for Active/Hovered Annotation */}
                  <svg className="absolute inset-0 pointer-events-none w-full h-full z-20 overflow-visible hidden lg:block">
                    {snippet.annotations.map(ann => {
                      const isActive = hoveredLine !== null && hoveredLine >= ann.line && hoveredLine <= (ann.endLine || ann.line);
                      if (!isActive) return null;

                      const lineY = 24 + (ann.line - 1) * 24 + 12;
                      const cardTop = cardPositions.positions[ann.id] ?? (24 + (ann.line - 1) * 24);
                      const cardY = cardTop + 16;

                      return (
                        <g key={`svg-conn-${ann.id}`}>
                          <path
                            d={`M 120 ${lineY} C 280 ${lineY}, calc(100% - 360px) ${cardY}, calc(100% - 330px) ${cardY}`}
                            fill="none"
                            stroke={ann.color || '#6366f1'}
                            strokeWidth="2"
                            strokeDasharray="4 2"
                            className="animate-pulse"
                            style={{ filter: `drop-shadow(0 0 6px ${ann.color || '#6366f1'})` }}
                          />
                        </g>
                      );
                    })}
                  </svg>

                  {/* Floating Annotation Cards (Desktop side) */}
                  <div className="absolute top-0 right-4 w-80 h-full pointer-events-none py-6 hidden lg:block">
                    <AnimatePresence>
                      {snippet.annotations.map((ann, index) => {
                        const isExpanded = expandedId === ann.id;
                        const isActive = hoveredLine !== null && hoveredLine >= ann.line && hoveredLine <= (ann.endLine || ann.line);
                        // Use collision-resolved position instead of raw line offset
                        const topOffset = cardPositions.positions[ann.id] ?? (24 + (ann.line - 1) * 24);
                        const isVisible = !isMinimizedMode || isActive;
                        const isCardCompact = !isActive && !isExpanded;

                        return (
                          <motion.div
                            key={ann.id}
                            initial={{ opacity: 0, x: 20, scale: 0.95 }}
                            animate={{ 
                              opacity: isVisible ? (hoveredLine === null || isActive ? 1 : 0.4) : 0, 
                              x: isActive ? -6 : 0,
                              scale: isActive ? 1.02 : 0.98,
                              pointerEvents: isVisible ? 'auto' : 'none'
                            }}
                            exit={{ opacity: 0, x: 20, scale: 0.95 }}
                            className={cn(
                              "absolute right-0 w-full floating-card rounded-xl border-l-[3px] shadow-xl group/card overflow-hidden transition-all duration-200",
                              isCardCompact ? "h-8 py-0.5 px-3 flex items-center justify-between" : "p-3.5",
                              isActive 
                                ? "ring-2 ring-primary/80 ring-offset-2 ring-offset-background shadow-2xl scale-[1.03] z-30" 
                                : "hover:border-primary/50 opacity-90 hover:opacity-100 z-10"
                            )}
                            style={{
                              top: `${topOffset}px`,
                              borderLeftColor: ann.color || '#6366f1',
                              backgroundColor: 'var(--card)',
                              backdropFilter: 'blur(16px)',
                            }}
                            onMouseEnter={() => setHoveredLine(ann.line)}
                            onMouseLeave={() => setHoveredLine(null)}
                          >
                            {isCardCompact ? (
                              /* COMPACT PILL MODE: Minimal ribbon pill to prevent visual clutter */
                              <div className="flex items-center justify-between w-full gap-2 text-xs select-none">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <span 
                                    className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 shadow-sm"
                                    style={{ 
                                      backgroundColor: `${ann.color || '#6366f1'}25`, 
                                      color: ann.color || '#6366f1' 
                                    }}
                                  >
                                    L{ann.line}{ann.endLine && ann.endLine !== ann.line ? `-${ann.endLine}` : ''}
                                  </span>
                                  <span className="font-semibold text-foreground/90 truncate text-[11px]">
                                    {ann.text}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 shrink-0 opacity-40 group-hover/card:opacity-100 transition-opacity">
                                  {ann.fullContext && (
                                    <button
                                      onClick={() => setExpandedId(ann.id)}
                                      className="p-1 hover:bg-secondary rounded text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                      title="Développer la note"
                                    >
                                      <ChevronDown className="w-3 h-3" />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleEdit(ann)}
                                    className="p-1 hover:bg-secondary rounded text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                    title="Éditer"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => removeAnnotation(ann.id)}
                                    className="p-1 hover:bg-secondary rounded text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                                    title="Supprimer"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              /* EXPANDED RICH CARD: Shows full context, syntax save, markdown */
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
                                            onClick={() => {
                                              const lineText = snippet.code.split('\n')[ann.line - 1] || '';
                                              const words: string[] = lineText.match(/\b[a-zA-Z_]\w*\b/g) || [];
                                              const common = ['import', 'as', 'from', 'for', 'in', 'def', 'return', 'if', 'else', 'print', 'const', 'let', 'var', 'function'];
                                              const candidates = words.filter(w => w.length > 2 && !common.includes(w));
                                              const defaultKw = candidates[0] || '';
                                              const kw = prompt(`Save this annotation to the Syntax Library under keyword/tag:`, defaultKw);
                                              if (kw && kw.trim()) {
                                                onSaveSyntaxDefinition(
                                                  kw.trim(),
                                                  ann.text,
                                                  ann.fullContext || '',
                                                  snippet.language
                                                );
                                                setToastMessage(`Syntax definition for "${kw.trim()}" successfully saved!`);
                                                setTimeout(() => setToastMessage(null), 3000);
                                              }
                                            }}
                                            className="p-1 hover:bg-secondary rounded text-muted-foreground hover:text-emerald-500 transition-colors cursor-pointer"
                                            title="Save to Syntax Library"
                                          >
                                            <BookOpen className="w-3 h-3" />
                                          </button>
                                          <button 
                                            onClick={() => handleEdit(ann)}
                                            className="p-1 hover:bg-secondary rounded text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                                            title="Edit Note"
                                          >
                                            <Edit3 className="w-3 h-3" />
                                          </button>
                                          <button 
                                            onClick={() => removeAnnotation(ann.id)}
                                            className="p-1 hover:bg-secondary rounded text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
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
                                          className="text-[10px] font-bold text-primary hover:text-primary/80 flex items-center gap-1 transition-colors cursor-pointer"
                                        >
                                          {isExpanded ? 'Show Less' : 'Read Full Context'}
                                        </button>
                                      )}
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
                                      <div className="p-4 text-xs text-muted-foreground max-h-[300px] overflow-y-auto custom-scrollbar">
                                        <Markdown content={ann.fullContext || ''} />
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            )}
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {/* Contextual Annotation Form (Absolute Floating / Draggable) */}
              <AnimatePresence>
                {isAddingAnnotation && (
                  <DraggableAnnotationForm
                    formKey={`${newAnnotation.line}-${newAnnotation.endLine}-${editingId || 'new'}`}
                    topOffset={24 + (newAnnotation.endLine || newAnnotation.line) * 24}
                    editingId={editingId}
                    newAnnotation={newAnnotation}
                    setNewAnnotation={setNewAnnotation}
                    setIsAddingAnnotation={setIsAddingAnnotation}
                    setEditingId={setEditingId}
                    associationKeyword={associationKeyword}
                    setAssociationKeyword={setAssociationKeyword}
                    syntaxDefinitions={syntaxDefinitions}
                    onSaveSyntaxDefinition={onSaveSyntaxDefinition}
                    snippet={snippet}
                    addAnnotation={addAnnotation}
                    setToastMessage={setToastMessage}
                  />
                )}
              </AnimatePresence>
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
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-emerald-500 text-white font-sans text-xs font-bold px-4 py-3 rounded-xl shadow-xl border border-emerald-400/20"
          >
            <BookOpen className="w-4 h-4" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
