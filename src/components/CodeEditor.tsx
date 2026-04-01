import React, { useState, useEffect } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Plus, Trash2, MessageSquare, Info, AlertTriangle, Lightbulb, Code2, Edit3, Clipboard, Bug, Star, Palette, Highlighter } from 'lucide-react';
import { CodeSnippet, Annotation } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

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
  onUpdate: (updated: CodeSnippet) => void;
  onDelete: () => void;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({ snippet, onUpdate, onDelete }) => {
  const [isEditing, setIsEditing] = useState(!snippet.code);
  const [selectionStart, setSelectionStart] = useState<number | null>(null);
  const [isAddingAnnotation, setIsAddingAnnotation] = useState(false);
  const [newAnnotation, setNewAnnotation] = useState({ 
    line: 1, 
    endLine: 1,
    text: '', 
    type: 'logic' as Annotation['type'],
    color: ANNOTATION_COLORS[0].value,
    accentColor: ANNOTATION_COLORS[0].value
  });

  const handlePaste = async () => {
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

  const handleLineClick = (line: number) => {
    if (selectionStart === null) {
      setSelectionStart(line);
    } else {
      const start = Math.min(selectionStart, line);
      const end = Math.max(selectionStart, line);
      setNewAnnotation({
        ...newAnnotation,
        line: start,
        endLine: end
      });
      setSelectionStart(null);
      setIsAddingAnnotation(true);
    }
  };

  const addAnnotation = () => {
    if (!newAnnotation.text) return;
    const annotation: Annotation = {
      id: Math.random().toString(36).substr(2, 9),
      ...newAnnotation
    };
    onUpdate({
      ...snippet,
      annotations: [...snippet.annotations, annotation].sort((a, b) => a.line - b.line)
    });
    setNewAnnotation({ ...newAnnotation, text: '' });
    setIsAddingAnnotation(false);
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

  return (
    <div className="group relative mb-12 bg-[#0c0c0e] rounded-2xl border border-zinc-800/60 overflow-hidden shadow-2xl transition-all hover:border-zinc-700/80">
      {/* Snippet Header */}
      <div className="flex items-center justify-between px-5 py-3 bg-zinc-900/40 border-b border-zinc-800/60">
        <div className="flex items-center gap-4 flex-1">
          <div className="flex gap-1.5 shrink-0">
            <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/30" />
            <div className="w-3 h-3 rounded-full bg-amber-500/20 border border-amber-500/30" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/20 border border-emerald-500/30" />
          </div>
          <div className="w-px h-4 bg-zinc-800 mx-2 shrink-0" />
          <select 
            value={snippet.language}
            onChange={(e) => onUpdate({ ...snippet, language: e.target.value })}
            className="bg-transparent text-[11px] font-mono uppercase tracking-widest text-zinc-500 focus:outline-none cursor-pointer hover:text-zinc-300 transition-colors shrink-0"
          >
            <option value="javascript">JavaScript</option>
            <option value="typescript">TypeScript</option>
            <option value="python">Python</option>
            <option value="css">CSS</option>
            <option value="html">HTML</option>
            <option value="rust">Rust</option>
            <option value="go">Go</option>
          </select>
          <div className="w-px h-4 bg-zinc-800 mx-2 shrink-0" />
          <input 
            type="text"
            placeholder="Snippet Title..."
            value={snippet.title || ''}
            onChange={(e) => onUpdate({ ...snippet, title: e.target.value })}
            className="bg-transparent text-xs font-medium text-zinc-300 focus:outline-none placeholder:text-zinc-600 flex-1 min-w-0 truncate"
          />
        </div>

        <div className="flex items-center gap-1">
          <button 
            onClick={handlePaste}
            className="p-2 hover:bg-zinc-800/60 rounded-md transition-colors text-zinc-500 hover:text-indigo-400"
            title="Paste Snippet"
          >
            <Clipboard className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setIsEditing(!isEditing)}
            className={cn(
              "px-3 py-1.5 rounded-md transition-all text-xs font-medium flex items-center gap-2",
              isEditing ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20" : "text-zinc-500 hover:bg-zinc-800/60"
            )}
          >
            {isEditing ? <MessageSquare className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
            {isEditing ? 'Annotate' : 'Edit Code'}
          </button>
          <div className="w-px h-4 bg-zinc-800 mx-1" />
          <button 
            onClick={onDelete}
            className="p-2 hover:bg-red-500/10 rounded-md transition-colors text-zinc-600 hover:text-red-400"
            title="Delete Snippet"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Editor / Viewer Container */}
      <div className="relative flex">
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <textarea
              autoFocus
              value={snippet.code}
              onChange={(e) => onUpdate({ ...snippet, code: e.target.value })}
              placeholder="Paste your logic here..."
              className="w-full h-[400px] p-6 bg-transparent text-sm font-mono text-zinc-300 focus:outline-none resize-none placeholder:text-zinc-800 leading-relaxed"
              spellCheck={false}
            />
          ) : (
            <div className="relative">
              <SyntaxHighlighter
                language={snippet.language}
                style={vscDarkPlus}
                customStyle={{
                  margin: 0,
                  padding: '1.5rem',
                  background: 'transparent',
                  fontSize: '0.85rem',
                  lineHeight: '1.6',
                }}
                showLineNumbers
                wrapLines={true}
                lineProps={(lineNumber) => {
                  const isSelected = selectionStart === lineNumber;
                  const isInActiveBlock = snippet.annotations.some(a => 
                    lineNumber >= a.line && lineNumber <= (a.endLine || a.line)
                  );
                  const activeAnnotation = snippet.annotations.find(a => 
                    lineNumber >= a.line && lineNumber <= (a.endLine || a.line)
                  );

                  return { 
                    style: { 
                      display: 'block', 
                      cursor: 'pointer',
                      backgroundColor: isSelected 
                        ? 'rgba(99, 102, 241, 0.15)' 
                        : isInActiveBlock 
                          ? ANNOTATION_COLORS.find(c => c.value === activeAnnotation?.color)?.bg || 'rgba(99, 102, 241, 0.05)'
                          : 'transparent',
                      borderLeft: isSelected 
                        ? '3px solid #6366f1' 
                        : isInActiveBlock 
                          ? `3px solid ${activeAnnotation?.color || '#6366f1'}`
                          : '3px solid transparent',
                      transition: 'all 0.2s ease'
                    },
                    onClick: () => handleLineClick(lineNumber),
                    className: isInActiveBlock ? 'group/line relative' : 'relative'
                  };
                }}
              >
                {snippet.code || '// No code provided'}
              </SyntaxHighlighter>

              {/* Floating Annotation Cards (Desktop side) */}
              <div className="absolute top-0 right-4 w-72 h-full pointer-events-none py-6 space-y-4 hidden lg:block">
                <AnimatePresence>
                  {snippet.annotations.map((ann) => (
                    <motion.div
                      key={ann.id}
                      initial={{ opacity: 0, x: 20, scale: 0.95 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      exit={{ opacity: 0, x: 20, scale: 0.95 }}
                      className="pointer-events-auto floating-card bg-[#121214]/95 backdrop-blur-xl p-4 rounded-xl border-l-[3px] shadow-2xl relative group/card"
                      style={{ 
                        borderColor: ann.color || '#6366f1',
                        marginTop: `${Math.max(0, (ann.line - 1) * 1.36)}rem`, // Approximation line height
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">{getIcon(ann.type, ann.color)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 font-mono">
                              Lines {ann.line}{ann.endLine && ann.endLine !== ann.line ? `-${ann.endLine}` : ''}
                            </span>
                            <button 
                              onClick={() => removeAnnotation(ann.id)}
                              className="opacity-0 group-hover/card:opacity-100 p-1 hover:bg-zinc-800 rounded transition-all text-zinc-500 hover:text-red-400"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                          <p className="text-xs text-zinc-300 leading-relaxed font-sans">{ann.text}</p>
                        </div>
                      </div>
                      
                      {/* Connection Dot */}
                      <div 
                        className="absolute -left-[1.3rem] top-4 w-2 h-2 rounded-full hidden lg:block" 
                        style={{ backgroundColor: ann.color || '#6366f1', boxShadow: `0 0 10px ${ann.color || '#6366f1'}` }}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Contextual Annotation Form */}
      <AnimatePresence>
        {isAddingAnnotation && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-zinc-800/60 bg-[#121214]/50 backdrop-blur-md"
          >
            <div className="p-6 space-y-6 max-w-3xl mx-auto">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-4 bg-indigo-500 rounded-full" />
                  <h4 className="text-sm font-bold text-zinc-200">New Logical Note</h4>
                </div>
                <button 
                  onClick={() => setIsAddingAnnotation(false)}
                  className="text-zinc-500 hover:text-zinc-300 text-lg"
                >
                  &times;
                </button>
              </div>

              <div className="grid grid-cols-12 gap-5">
                <div className="col-span-3">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Category</label>
                  <select 
                    value={newAnnotation.type}
                    onChange={(e) => setNewAnnotation({ ...newAnnotation, type: e.target.value as any })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-indigo-500/50 transition-colors"
                  >
                    <option value="logic">Code Logic</option>
                    <option value="tip">Best Practice</option>
                    <option value="important">Warning</option>
                    <option value="debug">Bug Fix</option>
                    <option value="info">General Info</option>
                  </select>
                </div>
                <div className="col-span-9">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Accent Color</label>
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

              <div className="space-y-3">
                <textarea 
                  placeholder="Describe the logic behind this block..."
                  value={newAnnotation.text}
                  onChange={(e) => setNewAnnotation({ ...newAnnotation, text: e.target.value })}
                  className="w-full h-24 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-300 focus:outline-none focus:border-indigo-500/50 resize-none transition-colors"
                />
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-zinc-500 italic">
                    Block: Lignes {newAnnotation.line} à {newAnnotation.endLine}
                  </p>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => setIsAddingAnnotation(false)}
                      className="px-4 py-2 text-xs font-bold text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={addAnnotation}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg text-xs font-bold transition-all shadow-lg shadow-indigo-900/20"
                    >
                      Attach Note
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
        <div className="px-5 py-2 bg-zinc-900/40 border-t border-zinc-800/60 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-mono">
              <span className="w-2 h-2 rounded-full bg-indigo-500/50 animate-pulse" />
              {selectionStart ? `Selecting block (starting at line ${selectionStart})...` : 'Click two lines to define a logical block'}
            </div>
          </div>
          <div className="text-[10px] text-zinc-600 font-mono italic">
            Visual Debug Mode: Active
          </div>
        </div>
      )}
    </div>
  );
};
