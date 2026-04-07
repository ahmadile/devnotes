import React, { useState, useEffect, useMemo, useRef } from 'react';
import { SignedIn, SignedOut, useAuth } from '@clerk/clerk-react';
import { Sidebar } from './components/Sidebar';
import { CodeEditor } from './components/CodeEditor';
import { Login } from './components/Login';
import { Note, CodeSnippet, AppSettings } from './types';
import { Plus, Save, Trash2, Tag, Layout, CloudUpload, CloudDownload, Download, Upload, Settings as SettingsIcon, Sun, Moon, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';

const STORAGE_KEY = 'devnotes_data';

async function fetchRemoteNotes(token: string | null, signal?: AbortSignal): Promise<Note[] | null> {
  if (!token) return null;
  try {
    const res = await fetch('/api/notes', {
      headers: { 'Authorization': `Bearer ${token}` },
      signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { notes?: unknown };
    if (!data || !Array.isArray(data.notes)) return null;
    return data.notes as Note[];
  } catch {
    return null;
  }
}

async function putRemoteNotes(notes: Note[], token: string | null, signal?: AbortSignal): Promise<{ok: boolean, msg?: string}> {
  if (!token) return { ok: false, msg: 'No authentication token available' };
  try {
    const res = await fetch('/api/notes', {
      method: 'PUT',
      headers: { 
        'content-type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ notes }),
      signal,
    });
    if (!res.ok) {
      let errText = `HTTP ${res.status}`;
      try {
        const body = await res.json();
        if (body.error) errText = body.error;
      } catch (e) {}
      return { ok: false, msg: errText };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, msg: err.message || 'Network fetch failed' };
  }
}

export default function App() {
  const { getToken, isLoaded: isAuthLoaded } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [lastCloudSyncAt, setLastCloudSyncAt] = useState<number | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => 
    (localStorage.getItem('theme') as 'dark' | 'light') || 'dark'
  );
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('devnotes_settings');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse settings', e);
      }
    }
    return {
      theme: 'dark',
      fontSize: 14,
      fontFamily: 'JetBrains Mono',
      syntaxTheme: 'vscDarkPlus'
    };
  });

  const [showScrollTop, setShowScrollTop] = useState(false);
  const mainContentRef = useRef<HTMLDivElement>(null);
  const didHydrate = useRef(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setShowScrollTop(e.currentTarget.scrollTop > 400);
  };

  const scrollToTop = () => {
    mainContentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Theme support
  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.documentElement.classList.toggle('light', theme === 'light');
    setSettings(prev => ({ ...prev, theme }));
  }, [theme]);

  // Settings persistence
  useEffect(() => {
    localStorage.setItem('devnotes_settings', JSON.stringify(settings));
  }, [settings]);

  const updateSettings = (updates: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
    if (updates.theme) setTheme(updates.theme);
  };

  // Load data
  useEffect(() => {
    const loadFromLocal = (): Note[] | null => {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return null;
      try {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? (parsed as Note[]) : null;
      } catch (e) {
        console.error('Failed to parse saved notes', e);
        return null;
      }
    };

    const welcomeNote: Note = {
      id: 'welcome',
      title: 'Welcome to DevNotes 🚀',
      content: 'This is your futuristic developer workspace. Paste code, add logic annotations, and organize your thoughts.',
      snippets: [
        {
          id: 'sample-1',
          title: 'Physics Logic Example',
          language: 'javascript',
          code: `function calculateVelocity(distance, time) {\n  // Basic physics calculation\n  if (time === 0) return 0;\n  \n  const velocity = distance / time;\n  return velocity;\n}`,
          annotations: [
            { id: 'a1', line: 3, text: 'Critical check to avoid division by zero.', type: 'logic' },
            { id: 'a2', line: 5, text: 'Standard formula: v = d/t', type: 'tip' }
          ],
          highlightedLines: [3],
          backgroundColor: 'rgba(15, 23, 42, 0.8)'
        }
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tags: ['tutorial', 'welcome']
    };

    const local = loadFromLocal();
    const nextNotes = (local && local.length > 0) ? local : [welcomeNote];
    setNotes(nextNotes);
    setActiveNoteId(nextNotes.length > 0 ? nextNotes[0].id : null);
    didHydrate.current = true;
  }, []);

  const persistNotes = (data: Note[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
      console.error('Failed to persist notes to localStorage', err);
    }
    setLastSaved(Date.now());
  };

  // Save data (debounced)
  useEffect(() => {
    if (!didHydrate.current) return;

    setIsSaving(true);
    const timeout = window.setTimeout(() => {
      persistNotes(notes);
      setIsSaving(false);
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [notes]);

  const manualSave = () => {
    if (!didHydrate.current) return;
    setIsSaving(true);
    persistNotes(notes);
    window.setTimeout(() => setIsSaving(false), 800);
  };

  const syncToCloud = async () => {
    setIsSyncing(true);
    setSyncMessage(null);
    const token = await getToken();
    const result = await putRemoteNotes(notes, token);
    setIsSyncing(false);
    if (result.ok) {
      setLastCloudSyncAt(Date.now());
      setSyncMessage('Cloud sync completed.');
    } else {
      setSyncMessage(`Sync failed: ${result.msg}`);
    }
  };

  const loadFromCloud = async () => {
    setIsSyncing(true);
    setSyncMessage(null);
    const token = await getToken();
    const remote = await fetchRemoteNotes(token);
    if (!remote) {
      setIsSyncing(false);
      setSyncMessage('Could not load from cloud.');
      return;
    }

    if (!confirm('Replace local notes with cloud notes?')) {
      setIsSyncing(false);
      return;
    }

    setNotes(remote);
    setActiveNoteId(remote.length > 0 ? remote[0].id : null);
    persistNotes(remote);
    setLastCloudSyncAt(Date.now());
    setIsSyncing(false);
    setSyncMessage('Cloud notes loaded.');
  };

  const exportAsJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      notes,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `devnotes-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setSyncMessage('Backup JSON exported.');
  };

  const importFromJson = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as { notes?: unknown };
      if (!parsed || !Array.isArray(parsed.notes)) {
        setSyncMessage('Invalid backup file format.');
        return;
      }

      if (!confirm('Replace local notes with imported backup?')) return;

      const importedNotes = parsed.notes as Note[];
      setNotes(importedNotes);
      setActiveNoteId(importedNotes.length > 0 ? importedNotes[0].id : null);
      persistNotes(importedNotes);
      setSyncMessage('Backup imported successfully.');
    } catch {
      setSyncMessage('Could not import backup file.');
    } finally {
      event.target.value = '';
    }
  };

  const activeNote = useMemo(() => 
    notes.find(n => n.id === activeNoteId) || null
  , [notes, activeNoteId]);

  useEffect(() => {
    if (notes.length > 0 && !activeNoteId) {
      setActiveNoteId(notes[0].id);
    }
  }, [notes, activeNoteId]);

  const createNote = () => {
    const newNote: Note = {
      id: Math.random().toString(36).substr(2, 9),
      title: '',
      content: '',
      snippets: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tags: []
    };
    setNotes((prev) => [newNote, ...prev]);
    setActiveNoteId(newNote.id);
  };

  const updateNote = (updated: Note) => {
    setNotes((prev) => prev.map((n) => (n.id === updated.id ? { ...updated, updatedAt: Date.now() } : n)));
  };

  const deleteNote = (id: string) => {
    if (!confirm('Are you sure you want to delete this note?')) return;
    const newNotes = notes.filter(n => n.id !== id);
    setNotes(newNotes);
    if (activeNoteId === id) {
      setActiveNoteId(newNotes.length > 0 ? newNotes[0].id : null);
    }
  };

  const addSnippet = () => {
    if (!activeNote) return;
    const newSnippet: CodeSnippet = {
      id: Math.random().toString(36).substr(2, 9),
      code: '',
      title: '',
      language: 'javascript',
      annotations: [],
      highlightedLines: []
    };
    updateNote({
      ...activeNote,
      snippets: [...activeNote.snippets, newSnippet]
    });
  };

  const updateSnippet = (snippetId: string, updatedSnippet: CodeSnippet) => {
    if (!activeNote) return;
    updateNote({
      ...activeNote,
      snippets: activeNote.snippets.map(s => s.id === snippetId ? updatedSnippet : s)
    });
  };

  const deleteSnippet = (snippetId: string) => {
    if (!activeNote) return;
    updateNote({
      ...activeNote,
      snippets: activeNote.snippets.filter(s => s.id !== snippetId)
    });
  };

  const addTag = (tag: string) => {
    const cleanTag = tag.trim();
    if (!activeNote || !cleanTag || activeNote.tags.includes(cleanTag)) return;
    updateNote({
      ...activeNote,
      tags: [...activeNote.tags, cleanTag]
    });
  };

  const removeTag = (tag: string) => {
    if (!activeNote) return;
    updateNote({
      ...activeNote,
      tags: activeNote.tags.filter(t => t !== tag)
    });
  };

  if (!isAuthLoaded) return null;

  return (
    <>
      <SignedOut>
        <Login />
      </SignedOut>
      <SignedIn>
        <div className="flex h-screen w-full bg-background text-foreground overflow-hidden font-sans selection:bg-indigo-500/30 antialiased transition-colors duration-300">
          {/* Sidebar */}
          <AnimatePresence mode="wait">
            {isSidebarOpen && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 288, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="h-full"
              >
                <Sidebar 
                  notes={notes}
                  activeNoteId={activeNoteId}
                  onSelectNote={setActiveNoteId}
                  onNewNote={createNote}
                  onOpenSettings={() => setIsSettingsOpen(true)}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main Content */}
          <main className="flex-1 flex flex-col h-full bg-background relative min-w-0 transition-colors duration-300">
            {/* Header */}
            <header className="h-16 flex items-center justify-between px-6 border-b border-border sticky top-0 bg-background/80 backdrop-blur-sm z-20 transition-colors">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  className="text-muted-foreground hover:text-foreground p-1.5 hover:bg-secondary rounded-md transition-all"
                >
                  <Layout className="w-5 h-5" strokeWidth="1.5" />
                </button>
                <div className="flex items-center gap-3">
                  <div className="w-px h-4 bg-border mx-1 hidden md:block" />
                  <h1 className="text-xl font-semibold tracking-tight text-foreground flex items-center gap-3">
                    {activeNote?.title || 'Untitled Note'}
                  </h1>
                </div>
              </div>
              
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 mr-4">
                  {isSaving ? (
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-primary animate-pulse">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      Saving...
                    </div>
                  ) : lastSaved ? (
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground hidden lg:block">
                      Last local save: {new Date(lastSaved).toLocaleTimeString()}
                    </div>
                  ) : null}
                </div>

                <div className="flex items-center gap-3 text-muted-foreground border-l border-border pl-6">
                  <button 
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    className="hover:text-primary transition-colors p-1.5 hover:bg-secondary rounded-md"
                    title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                  >
                    {theme === 'dark' ? <Sun className="w-4 h-4" strokeWidth="1.5" /> : <Moon className="w-4 h-4" strokeWidth="1.5" />}
                  </button>
                  <div className="w-px h-4 bg-border mx-1" />
                  <button 
                    onClick={manualSave}
                    className="hover:text-foreground transition-colors p-1.5 hover:bg-secondary rounded-md"
                    title="Save locally"
                  >
                    <Save className="w-4 h-4" strokeWidth="1.5" />
                  </button>
                  <button
                    onClick={syncToCloud}
                    disabled={isSyncing}
                    className="hover:text-foreground transition-colors p-1.5 hover:bg-secondary rounded-md disabled:opacity-30"
                    title="Sync to cloud"
                  >
                    <CloudUpload className="w-4 h-4" strokeWidth="1.5" />
                  </button>
                  <button
                    onClick={loadFromCloud}
                    disabled={isSyncing}
                    className="hover:text-foreground transition-colors p-1.5 hover:bg-secondary rounded-md disabled:opacity-30"
                    title="Pull from cloud"
                  >
                    <CloudDownload className="w-4 h-4" strokeWidth="1.5" />
                  </button>
                  <div className="w-px h-4 bg-border mx-1" />
                  <button
                    onClick={exportAsJson}
                    className="hover:text-foreground transition-colors p-1.5 hover:bg-secondary rounded-md"
                    title="Export backup"
                  >
                    <Download className="w-4 h-4" strokeWidth="1.5" />
                  </button>
                  <button
                    onClick={() => importInputRef.current?.click()}
                    className="hover:text-foreground transition-colors p-1.5 hover:bg-secondary rounded-md"
                    title="Import backup"
                  >
                    <Upload className="w-4 h-4" strokeWidth="1.5" />
                  </button>
                  <button 
                    onClick={() => activeNote && deleteNote(activeNote.id)}
                    className="hover:text-destructive transition-colors p-1.5 hover:bg-destructive/10 rounded-md ml-2"
                    title="Delete Note"
                  >
                    <Trash2 className="w-4 h-4" strokeWidth="1.5" />
                  </button>
                </div>

                <input
                  ref={importInputRef}
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={importFromJson}
                />
              </div>
            </header>

            {syncMessage && (
              <div className="px-8 py-2 text-xs text-primary/80 border-b border-border bg-primary/5 backdrop-blur-sm animate-in fade-in slide-in-from-top-1 duration-300">
                {syncMessage}
                {lastCloudSyncAt ? ` • Last cloud sync: ${new Date(lastCloudSyncAt).toLocaleTimeString()}` : ''}
              </div>
            )}

            {/* Editor Area */}
            <div 
              ref={mainContentRef}
              onScroll={(e) => setShowScrollTop(e.currentTarget.scrollTop > 400)}
              className="flex-1 overflow-y-auto p-6 md:p-8 lg:p-12 scroll-smooth"
            >
              <div className="max-w-5xl mx-auto flex flex-col gap-8">
                {activeNote ? (
                  <>
                    {/* Header Title & Tags */}
                    <div className="space-y-6">
                      <input 
                        type="text"
                        placeholder="Untitled Note"
                        value={activeNote.title}
                        onChange={(e) => updateNote({ ...activeNote, title: e.target.value })}
                        className="w-full bg-transparent text-4xl font-bold tracking-tight focus:outline-none placeholder:text-muted-foreground/30 border-none p-0 text-foreground"
                      />

                      <div className="flex flex-wrap items-center gap-3">
                        <Tag className="w-4 h-4 text-muted-foreground/50" strokeWidth="2" />
                        {activeNote.tags.map(tag => (
                          <span 
                            key={tag} 
                            className="group flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium border border-primary/20 shadow-sm"
                          >
                            #{tag}
                            <button 
                              onClick={() => removeTag(tag)} 
                              className="hover:text-foreground opacity-50 hover:opacity-100 transition-opacity"
                            >
                              &times;
                            </button>
                          </span>
                        ))}
                        <div className="flex items-center gap-1 border-b border-dashed border-border pb-0.5 focus-within:border-primary/40 transition-colors">
                          <input
                            type="text"
                            placeholder="Add tag..."
                            value={tagInput}
                            className="bg-transparent text-xs text-foreground focus:outline-none w-24 h-6 px-1 placeholder:text-muted-foreground/40"
                            onChange={(e) => setTagInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                addTag(tagInput);
                                setTagInput('');
                              }
                            }}
                          />
                          <button
                            onClick={() => {
                              addTag(tagInput);
                              setTagInput('');
                            }}
                            className="p-0.5 text-muted-foreground hover:text-primary transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Content Section */}
                    <div className="relative group">
                      <div className="absolute -left-4 inset-y-0 w-1 bg-primary/20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                      <textarea 
                        placeholder="Start writing your thoughts or paste code snippets below..."
                        value={activeNote.content}
                        onChange={(e) => updateNote({ ...activeNote, content: e.target.value })}
                        className="w-full min-h-[48px] bg-transparent text-lg text-foreground/80 leading-relaxed focus:outline-none resize-none placeholder:text-muted-foreground/30"
                      />
                    </div>

                    {/* Snippets Region */}
                    <div className="flex flex-col gap-10">
                      {activeNote.snippets.map((snippet) => (
                        <CodeEditor 
                          key={snippet.id}
                          snippet={snippet}
                          settings={settings}
                          onUpdate={(updated) => updateSnippet(snippet.id, updated)}
                          onDelete={() => deleteSnippet(snippet.id)}
                        />
                      ))}

                      <button 
                        onClick={addSnippet}
                        className="w-full py-12 border border-dashed border-border hover:border-primary/40 bg-secondary/20 hover:bg-secondary/50 rounded-2xl flex flex-col items-center justify-center gap-4 transition-all group"
                      >
                        <div className="w-12 h-12 rounded-full bg-background flex items-center justify-center text-muted-foreground group-hover:text-primary group-hover:bg-primary/10 transition-all border border-border group-hover:border-primary/20 shadow-sm">
                          <Plus className="w-6 h-6" strokeWidth="1.5" />
                        </div>
                        <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground">Add Code Snippet</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="h-full flex flex-col space-y-12 pt-12 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <h2 className="text-3xl font-bold tracking-tight text-foreground">Your Note Vault</h2>
                        <p className="text-muted-foreground">Access all your developer insights and logic snippets.</p>
                      </div>
                      <button 
                        onClick={createNote}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-3 rounded-xl font-semibold transition-all shadow-lg shadow-indigo-900/20 flex items-center gap-2"
                      >
                        <Plus className="w-5 h-5" strokeWidth="2" />
                        New Note
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {notes.map(note => (
                        <motion.div
                          key={note.id}
                          whileHover={{ scale: 1.02, translateY: -4 }}
                          onClick={() => setActiveNoteId(note.id)}
                          className="bg-secondary/30 p-6 rounded-2xl border border-border hover:border-primary/40 transition-all cursor-pointer group relative overflow-hidden shadow-sm"
                        >
                          <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Tag className="w-4 h-4 text-primary" />
                          </div>
                          
                          <h3 className="text-lg font-bold mb-2 group-hover:text-primary transition-colors truncate text-foreground">
                            {note.title || 'Untitled Note'}
                          </h3>
                          <p className="text-sm text-muted-foreground line-clamp-3 mb-4 h-15">
                            {note.content || 'No description provided.'}
                          </p>
                          
                          <div className="flex items-center justify-between mt-auto pt-4 border-t border-border/50">
                            <div className="flex gap-1.5 focus-within:ring-0">
                              {note.tags.slice(0, 2).map(tag => (
                                <span key={tag} className="text-[10px] px-2 py-0.5 rounded-md bg-background text-muted-foreground border border-border transition-colors group-hover:border-primary/20 group-hover:text-primary/70">
                                  #{tag}
                                </span>
                              ))}
                            </div>
                            <span className="text-[10px] text-muted-foreground/60 font-mono">
                              {new Date(note.updatedAt).toLocaleDateString()}
                            </span>
                          </div>
                        </motion.div>
                      ))}

                      {notes.length === 0 && (
                        <div className="col-span-full h-64 flex flex-col items-center justify-center text-center space-y-4 border border-dashed border-border rounded-3xl bg-secondary/10">
                          <div className="w-16 h-16 rounded-2xl bg-background flex items-center justify-center border border-border">
                            <Plus className="w-8 h-8 text-muted-foreground/30" />
                          </div>
                          <p className="text-muted-foreground">No notes found. Create your first one!</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Scroll to Top Button */}
            <AnimatePresence>
              {showScrollTop && (
                <motion.button
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  onClick={scrollToTop}
                  className="fixed bottom-8 right-8 p-3 bg-primary text-white rounded-full shadow-lg hover:scale-110 transition-all z-50 neon-glow"
                >
                  <ChevronUp className="w-6 h-6" />
                </motion.button>
              )}
            </AnimatePresence>
          </main>

          {/* Settings Modal */}
          <AnimatePresence>
            {isSettingsOpen && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
              >
                <motion.div 
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  className="w-full max-w-md bg-popover border border-border rounded-3xl p-8 space-y-8 shadow-2xl relative overflow-hidden"
                >
                  <div className="absolute top-0 inset-x-0 h-1.5 bg-primary" />
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <SettingsIcon className="w-5 h-5 text-primary" />
                      <h3 className="text-xl font-bold text-foreground">Developer Settings</h3>
                    </div>
                    <button 
                      onClick={() => setIsSettingsOpen(false)} 
                      className="text-muted-foreground hover:text-foreground transition-colors p-1"
                    >
                      &times;
                    </button>
                  </div>
                  
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Syntax Theme</label>
                      <select 
                        value={settings.syntaxTheme}
                        onChange={(e) => updateSettings({ syntaxTheme: e.target.value as any })}
                        className="w-full bg-secondary border border-border rounded-xl p-3 text-sm text-foreground focus:outline-none focus:border-primary/50 transition-colors cursor-pointer"
                      >
                        <option value="vscDarkPlus">VS Code Dark Plus</option>
                        <option value="atomDark">Atom Dark</option>
                        <option value="prism">Classic Prism</option>
                        <option value="tomorrow">Tomorrow Night</option>
                      </select>
                    </div>
                    <div className="space-y-3">
                      <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Font Family</label>
                      <select 
                        value={settings.fontFamily}
                        onChange={(e) => updateSettings({ fontFamily: e.target.value as any })}
                        className="w-full bg-secondary border border-border rounded-xl p-3 text-sm text-foreground focus:outline-none focus:border-primary/50 transition-colors font-mono cursor-pointer"
                      >
                        <option value="JetBrains Mono">JetBrains Mono</option>
                        <option value="Fira Code">Fira Code</option>
                        <option value="Inter">Inter (Sans)</option>
                        <option value="System">System Mono</option>
                      </select>
                    </div>
                    <div className="space-y-3">
                      <label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">App Appearance</label>
                      <div className="grid grid-cols-2 gap-3">
                        <button 
                          onClick={() => updateSettings({ theme: 'dark' })}
                          className={cn(
                            "flex items-center justify-center gap-2 py-3 rounded-xl border transition-all",
                            theme === 'dark' ? "bg-primary/10 border-primary text-primary" : "bg-secondary/50 border-border text-muted-foreground hover:border-border/80"
                          )}
                        >
                          <Moon className="w-4 h-4" />
                          <span className="text-xs font-semibold">Dark</span>
                        </button>
                        <button 
                          onClick={() => updateSettings({ theme: 'light' })}
                          className={cn(
                            "flex items-center justify-center gap-2 py-3 rounded-xl border transition-all",
                            theme === 'light' ? "bg-primary/10 border-primary text-primary" : "bg-secondary/50 border-border text-muted-foreground hover:border-border/80"
                          )}
                        >
                          <Sun className="w-4 h-4" />
                          <span className="text-xs font-semibold">Light</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={() => setIsSettingsOpen(false)}
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-4 rounded-xl font-bold transition-all shadow-lg shadow-primary/20"
                  >
                    Close Settings
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </SignedIn>
    </>
  );
}
