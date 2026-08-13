import React, { useState } from 'react';
import { Note, Module, CodeSnippet, Annotation, SyntaxDefinition } from '../types';
import { Sparkles, MessageSquare, Plus, Check, Folder, Tag, Code, Eye, RefreshCw, X, AlertCircle, FileText, Send, HelpCircle, Layers, Lightbulb, ChevronRight, Settings, Cpu, Globe, Server } from 'lucide-react';
import { Markdown } from './Markdown';
import { cn } from '../lib/utils';

interface AiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  modules: Module[];
  notes: Note[];
  activeNote: Note | null;
  syntaxDefinitions?: Record<string, SyntaxDefinition>;
  onSaveNote: (newNote: Partial<Note>, targetModuleId?: string | null) => void;
}

interface ProcessedAiResult {
  title: string;
  tags: string[];
  moduleName?: string;
  moduleId?: string | null;
  content: string;
  snippets: {
    title?: string;
    language: string;
    code: string;
    annotations: {
      line: number;
      endLine?: number;
      text: string;
      fullContext?: string;
      type: 'info' | 'warning' | 'tip' | 'logic' | 'debug' | 'important';
      color?: string;
    }[];
  }[];
}

const DEFAULT_EXAMPLE_INPUT = `🔵 Titre
Les fonctions en tant qu'objets (les bases avant les décorateurs)

🟡 Tags
fonction objet, fonction variable, fonction argument, fonction imbriquée, fonction valeur de retour

🟢 Résumé

L'idée centrale, en une phrase

En Python, une fonction n'est pas un "truc à part" avec des règles spéciales. Une fonction, c'est un objet — exactement comme un nombre (5), une chaîne de texte ("bonjour"), ou une liste ([1, 2, 3]). Et comme tout objet en Python, on peut la stocker, la déplacer, la donner à quelqu'un d'autre, ou la recevoir en retour.

Cette idée est la base indispensable pour comprendre les décorateurs plus tard.

1. Une fonction peut être rangée dans une variable
2. Une fonction peut être rangée dans une liste ou un dictionnaire
3. Un détail crucial : avec ou sans parenthèses ()
4. On peut donner une fonction en argument à une autre fonction
5. On peut définir une fonction à l'intérieur d'une autre fonction
6. Une fonction peut renvoyer... une autre fonction

🔴 Bloc logique du code
⚪ Titre : Manipuler des fonctions comme n'importe quel autre objet

python
# --- 1) Assigner une fonction à une variable ---
def my_function():
    print("Bonjour !")

x = my_function          # PAS de parenthèses : on copie juste "l'étiquette"
x()                        # → "Bonjour !"   (appeler x() = appeler my_function())

# --- 2) Ranger des fonctions dans une liste ou un dictionnaire ---
list_of_functions = [my_function, open, print]
list_of_functions[2]("J'appelle print() via la liste")

dict_of_functions = {
    'func1': my_function,
    'func2': open,
    'func3': print
}
dict_of_functions['func3']("J'appelle print() via le dictionnaire")

# --- 3) La différence entre "my_function" et "my_function()" ---
print(my_function)       # → affiche l'OBJET fonction lui-même
print(my_function())     # → EXÉCUTE la fonction

# --- 4) Passer une fonction en argument à une autre fonction ---
def has_docstring(func):
    return func.__doc__ is not None

def no():
    return 42

def yes():
    """Moi, j'ai une docstring !"""
    return 42

print(has_docstring(no))
print(has_docstring(yes))

# --- 5) Définir une fonction À L'INTÉRIEUR d'une autre fonction ---
def foo(x, y):
    def in_range(v):
        return 0 < v < 10
    if in_range(x) and in_range(y):
        print(x * y)

# --- 6) Une fonction qui RENVOIE une autre fonction ---
def get_function():
    def print_me(s):
        print(s)
    return print_me

new_func = get_function()
new_func("Ceci fonctionne !")

⚫ Ligne x = my_function : il n'y a pas de parenthèses. Si on écrivait x = my_function(), on exécuterait la fonction tout de suite, et x contiendrait le résultat.
⚫ list_of_functions[2]("...") : d'abord list_of_functions[2] va chercher la fonction print, puis les parenthèses l'exécutent.
⚫ has_docstring(func) : func est un nom de variable qui pointe vers la fonction passée en argument.
⚫ def in_range(v): à l'intérieur de foo() : cette fonction imbriquée n'existe que pendant l'exécution de foo().
⚫ return print_me (sans parenthèses) : on renvoie la fonction elle-même, pas son résultat.`;

export const AiAssistantModal: React.FC<AiAssistantModalProps> = ({
  isOpen,
  onClose,
  modules,
  notes,
  activeNote,
  syntaxDefinitions = {},
  onSaveNote,
}) => {
  const [activeTab, setActiveTab] = useState<'generator' | 'chat' | 'settings'>('generator');
  const [inputContent, setInputContent] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiResult, setAiResult] = useState<ProcessedAiResult | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);

  // AI Provider & Key Settings
  const [aiProvider, setAiProvider] = useState<'openrouter' | 'gemini' | 'ollama' | 'openai'>(
    () => (localStorage.getItem('devnotes_ai_provider') as any) || 'openrouter'
  );
  const [openRouterKey, setOpenRouterKey] = useState(() => localStorage.getItem('devnotes_openrouter_key') || '');
  const [geminiApiKey, setGeminiApiKey] = useState(() => localStorage.getItem('devnotes_gemini_key') || '');
  const [aiModel, setAiModel] = useState(() => localStorage.getItem('devnotes_ai_model') || 'google/gemini-2.5-flash');
  const [ollamaUrl, setOllamaUrl] = useState(() => localStorage.getItem('devnotes_ollama_url') || 'http://localhost:11434');

  const [savedSuccess, setSavedSuccess] = useState(false);

  // Chat state
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
    {
      role: 'assistant',
      content: 'Bonjour ! Je suis l\'assistant IA DevNotes (OpenRouter & Multi-modèles). Posez-moi des questions sur vos notes, votre code, ou demandez-moi d\'expliquer un snippet !',
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatSending, setIsChatSending] = useState(false);

  if (!isOpen) return null;

  const activeApiKey = aiProvider === 'openrouter' ? openRouterKey : geminiApiKey;

  const handleSaveSettings = () => {
    localStorage.setItem('devnotes_ai_provider', aiProvider);
    localStorage.setItem('devnotes_openrouter_key', openRouterKey.trim());
    localStorage.setItem('devnotes_gemini_key', geminiApiKey.trim());
    localStorage.setItem('devnotes_ai_model', aiModel.trim());
    localStorage.setItem('devnotes_ollama_url', ollamaUrl.trim());
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleProcessNote = async () => {
    if (!inputContent.trim()) return;
    setIsProcessing(true);
    setAiResult(null);

    try {
      const res = await fetch('/api/ai/process-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: inputContent,
          modules,
          syntaxDefinitions,
          provider: aiProvider,
          apiKey: activeApiKey.trim() || undefined,
          model: aiModel.trim() || undefined,
          ollamaUrl: ollamaUrl.trim() || undefined,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.ok && data.note) {
        setAiResult(data.note);
      }
    } catch (err) {
      console.error('Failed to process note:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateNoteFromAi = () => {
    if (!aiResult) return;

    const formattedSnippets: CodeSnippet[] = (aiResult.snippets || []).map((s, index) => ({
      id: `snippet_${Date.now()}_${index}`,
      title: s.title || 'Bloc de code',
      language: s.language || 'python',
      code: s.code || '',
      highlightedLines: [],
      annotations: (s.annotations || []).map((a, aIdx) => ({
        id: `ann_${Date.now()}_${aIdx}`,
        line: a.line || 1,
        endLine: a.endLine || a.line || 1,
        text: a.text,
        fullContext: a.fullContext,
        type: a.type || 'logic',
        color: a.color || '#6366f1',
        accentColor: a.color || '#6366f1',
      })),
    }));

    onSaveNote(
      {
        title: aiResult.title,
        tags: aiResult.tags,
        content: aiResult.content,
        snippets: formattedSnippets,
      },
      selectedModuleId
    );

    onClose();
  };

  const handleSendChat = async () => {
    if (!chatInput.trim() || isChatSending) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    const updatedMessages = [...messages, { role: 'user' as const, content: userMessage }];
    setMessages(updatedMessages);
    setIsChatSending(true);

    try {
      const notesSummary = notes
        .map(n => `- Note: "${n.title}" [Tags: ${n.tags.join(', ')}]\n  Extrait: ${n.content.slice(0, 150)}...`)
        .join('\n');

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages,
          notesContext: notesSummary,
          provider: aiProvider,
          apiKey: activeApiKey.trim() || undefined,
          model: aiModel.trim() || undefined,
          ollamaUrl: ollamaUrl.trim() || undefined,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.ok && data.reply) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
      }
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: `Désolé, une erreur est survenue: ${err.message}` },
      ]);
    } finally {
      setIsChatSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-hidden">
      <div className="bg-card border border-primary/30 w-full max-w-5xl h-[88vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden font-sans">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/80 bg-secondary/30">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/15 rounded-xl border border-indigo-500/30">
              <Sparkles className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-foreground flex items-center gap-2">
                DevNotes AI Assistant
                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full font-mono uppercase">
                  {aiProvider === 'openrouter' ? 'OpenRouter API' : aiProvider === 'ollama' ? 'Ollama IA' : 'Gemini 2.5'}
                </span>
              </h2>
              <p className="text-xs text-muted-foreground">
                Génération automatique de notes, sous-notes de code et réutilisation de syntaxes
              </p>
            </div>
          </div>

          {/* Navigation Tabs & Close */}
          <div className="flex items-center gap-3">
            <div className="flex bg-secondary p-1 rounded-xl border border-border/60">
              <button
                onClick={() => setActiveTab('generator')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer',
                  activeTab === 'generator'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Générateur de Note
              </button>
              <button
                onClick={() => setActiveTab('chat')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer',
                  activeTab === 'chat'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Assistant Chat
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer',
                  activeTab === 'settings'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Settings className="w-3.5 h-3.5" />
                Clé API / Modèle
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {activeTab === 'generator' && (
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border/60 overflow-hidden">
              
              {/* Left Column: Input Prompt & Controls */}
              <div className="p-6 flex flex-col h-full bg-secondary/10 space-y-4 overflow-y-auto">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-indigo-400" />
                    Format / Texte de la Note
                  </label>

                  <button
                    type="button"
                    onClick={() => setInputContent(DEFAULT_EXAMPLE_INPUT)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-medium hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    Charger l'exemple de note structurée
                  </button>
                </div>

                <textarea
                  placeholder="Collez votre contenu de note, le format 🔵 Titre 🟡 Tags 🟢 Résumé 🔴 Code ⚫ Ligne ..., ou du texte brut..."
                  value={inputContent}
                  onChange={(e) => setInputContent(e.target.value)}
                  className="flex-1 w-full min-h-[220px] bg-secondary/35 border border-border/80 rounded-xl p-4 text-xs font-mono text-foreground focus:outline-none focus:border-indigo-500 transition-colors resize-none leading-relaxed"
                />

                {/* Destination Folder Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                    <Folder className="w-3.5 h-3.5 text-sky-400" />
                    Dossier de destination (Module)
                  </label>
                  <select
                    value={selectedModuleId || ''}
                    onChange={(e) => setSelectedModuleId(e.target.value || null)}
                    className="w-full bg-secondary/40 border border-border/80 rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="">-- Racine (Aucun dossier spécifique) --</option>
                    {modules.map((m) => (
                      <option key={m.id} value={m.id}>
                        📂 {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Generate Action Button */}
                <button
                  onClick={handleProcessNote}
                  disabled={!inputContent.trim() || isProcessing}
                  className="w-full py-3 bg-gradient-to-r from-indigo-600 via-indigo-500 to-sky-500 hover:from-indigo-500 hover:to-sky-400 text-white rounded-xl text-xs font-bold transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Analyse et structuration par l'IA...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Générer et Structurer la Note avec l'IA
                    </>
                  )}
                </button>
              </div>

              {/* Right Column: Live Interactive Preview */}
              <div className="p-6 flex flex-col h-full bg-card overflow-y-auto space-y-5">
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Eye className="w-4 h-4 text-emerald-400" />
                    Aperçu Interactif de la Note Générée
                  </span>

                  {aiResult && (
                    <button
                      onClick={handleCreateNoteFromAi}
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      Enregistrer dans DevNotes
                    </button>
                  )}
                </div>

                {!aiResult ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-muted-foreground space-y-3">
                    <div className="p-4 bg-secondary/50 rounded-full border border-border">
                      <Sparkles className="w-8 h-8 text-indigo-400 opacity-60" />
                    </div>
                    <p className="text-xs max-w-sm">
                      Cliquez sur <strong>"Générer et Structurer la Note"</strong> pour prévisualiser le titre, les tags, le résumé visuel et les sous-notes de code.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-5 animate-fadeIn">
                    {/* Note Header Card */}
                    <div className="bg-secondary/25 border border-border/80 p-4 rounded-xl space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-indigo-500" />
                        <h3 className="text-base font-extrabold text-foreground">{aiResult.title}</h3>
                      </div>

                      {/* Tags & Syntax References matching */}
                      <div className="flex flex-wrap gap-1.5">
                        {aiResult.tags.map((t, idx) => {
                          const hasSyntax = !!syntaxDefinitions[t.toLowerCase().trim()];
                          return (
                            <span
                              key={idx}
                              className={cn(
                                "px-2 py-0.5 rounded-md text-[10px] font-semibold flex items-center gap-1 border transition-all",
                                hasSyntax
                                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                                  : "bg-indigo-500/15 text-indigo-300 border-indigo-500/30"
                              )}
                            >
                              <Tag className="w-2.5 h-2.5" />
                              #{t}
                              {hasSyntax && <span className="text-[9px] bg-emerald-500/20 px-1 rounded">Syntax Match</span>}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    {/* Note Markdown Content Preview */}
                    <div className="space-y-1.5">
                      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        Contenu & Résumé Structuré
                      </h4>
                      <div className="bg-secondary/15 border border-border/60 rounded-xl p-4 text-xs leading-relaxed">
                        <Markdown content={aiResult.content} />
                      </div>
                    </div>

                    {/* Code Snippets & Line Annotations Preview */}
                    {aiResult.snippets && aiResult.snippets.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                          <Code className="w-3.5 h-3.5 text-emerald-400" />
                          Snippet de Code & Sous-notes de Ligne ({aiResult.snippets[0].annotations.length} sous-notes)
                        </h4>

                        {aiResult.snippets.map((snip, sIdx) => (
                          <div key={sIdx} className="bg-secondary/30 border border-border/80 rounded-xl overflow-hidden space-y-3 p-4">
                            <div className="flex items-center justify-between text-xs font-mono font-bold text-indigo-300 border-b border-border/40 pb-2">
                              <span>{snip.title || 'Bloc de code'}</span>
                              <span className="text-[10px] bg-secondary px-2 py-0.5 rounded border border-border uppercase">
                                {snip.language}
                              </span>
                            </div>

                            {/* Code lines preview */}
                            <div className="bg-black/40 p-3 rounded-lg font-mono text-[11px] text-foreground/90 overflow-x-auto max-h-48 leading-relaxed">
                              {snip.code.split('\n').map((lineText, lIdx) => {
                                const lineNum = lIdx + 1;
                                const matchingAnn = snip.annotations.find(a => a.line === lineNum);
                                return (
                                  <div
                                    key={lIdx}
                                    className={cn(
                                      'flex gap-3 py-0.5 px-1 rounded transition-colors',
                                      matchingAnn ? 'bg-indigo-500/15 border-l-2 border-indigo-400' : 'hover:bg-white/5'
                                    )}
                                  >
                                    <span className="text-muted-foreground/50 w-6 text-right select-none">{lineNum}</span>
                                    <span className="flex-1">{lineText}</span>
                                    {matchingAnn && (
                                      <span
                                        className="text-[9px] px-1.5 py-0.5 rounded font-sans font-bold shrink-0 shadow-sm"
                                        style={{ backgroundColor: matchingAnn.color + '30', color: matchingAnn.color, border: `1px solid ${matchingAnn.color}60` }}
                                      >
                                        ⚫ {matchingAnn.text.slice(0, 30)}...
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>

                            {/* Annotations List */}
                            <div className="space-y-2 pt-2 border-t border-border/40">
                              <h5 className="text-[11px] font-bold text-foreground/80 flex items-center gap-1">
                                <Layers className="w-3 h-3 text-indigo-400" />
                                Sous-notes rattachées au code :
                              </h5>
                              <div className="grid grid-cols-1 gap-2">
                                {snip.annotations.map((ann, aIdx) => (
                                  <div
                                    key={aIdx}
                                    className="bg-secondary/40 border border-border/60 rounded-lg p-2.5 text-xs font-sans space-y-1"
                                  >
                                    <div className="flex items-center justify-between font-bold">
                                      <span className="text-indigo-300 font-mono text-[10px]">
                                        Ligne {ann.line}{ann.endLine && ann.endLine !== ann.line ? `-${ann.endLine}` : ''}
                                      </span>
                                      <span
                                        className="text-[9px] uppercase px-1.5 py-0.2 rounded font-extrabold"
                                        style={{ backgroundColor: (ann.color || '#6366f1') + '25', color: ann.color || '#6366f1' }}
                                      >
                                        {ann.type}
                                      </span>
                                    </div>
                                    <p className="font-semibold text-foreground/90">{ann.text}</p>
                                    {ann.fullContext && (
                                      <p className="text-[11px] text-muted-foreground leading-normal bg-background/50 p-2 rounded border border-border/40 mt-1">
                                        {ann.fullContext}
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Chat Tab */}
          {activeTab === 'chat' && (
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-card">
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.map((m, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      'flex gap-3 max-w-3xl',
                      m.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'
                    )}
                  >
                    <div
                      className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold',
                        m.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/40'
                      )}
                    >
                      {m.role === 'user' ? 'Vous' : 'IA'}
                    </div>

                    <div
                      className={cn(
                        'p-4 rounded-2xl text-xs leading-relaxed max-w-xl font-sans',
                        m.role === 'user'
                          ? 'bg-primary text-primary-foreground rounded-tr-none'
                          : 'bg-secondary/40 border border-border/80 text-foreground rounded-tl-none'
                      )}
                    >
                      <Markdown content={m.content} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Chat Input Bar */}
              <div className="p-4 border-t border-border/80 bg-secondary/20 flex gap-2">
                <input
                  type="text"
                  placeholder="Posez une question sur vos notes ou demandez des explications de code..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                  className="flex-1 bg-secondary/50 border border-border/80 rounded-xl px-4 py-2.5 text-xs text-foreground focus:outline-none focus:border-indigo-500 transition-colors"
                />
                <button
                  onClick={handleSendChat}
                  disabled={!chatInput.trim() || isChatSending}
                  className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  Envoyer
                </button>
              </div>
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="flex-1 p-8 max-w-2xl mx-auto space-y-6 overflow-y-auto">
              <div className="space-y-2">
                <h3 className="text-base font-extrabold text-foreground flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-indigo-400" />
                  Configuration de l'IA (OpenRouter, Gemini, Ollama)
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Choisissez votre fournisseur d'IA préféré. Avec **OpenRouter**, accédez à des dizaines de modèles (Gemini, Claude 3.5, Llama 3, DeepSeek) avec une seule clé API !
                </p>
              </div>

              {/* Provider Choice */}
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setAiProvider('openrouter')}
                  className={cn(
                    "p-4 rounded-xl border text-left flex flex-col gap-2 transition-all cursor-pointer",
                    aiProvider === 'openrouter'
                      ? "bg-indigo-500/15 border-indigo-500/50 text-indigo-300"
                      : "bg-secondary/20 border-border/60 text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Globe className="w-5 h-5 text-indigo-400" />
                  <div>
                    <div className="text-xs font-bold">OpenRouter</div>
                    <div className="text-[10px] opacity-75">Tous les modèles (Claude, Llama, Gemini)</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setAiProvider('gemini')}
                  className={cn(
                    "p-4 rounded-xl border text-left flex flex-col gap-2 transition-all cursor-pointer",
                    aiProvider === 'gemini'
                      ? "bg-indigo-500/15 border-indigo-500/50 text-indigo-300"
                      : "bg-secondary/20 border-border/60 text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Sparkles className="w-5 h-5 text-sky-400" />
                  <div>
                    <div className="text-xs font-bold">Google Gemini</div>
                    <div className="text-[10px] opacity-75">Direct Gemini 2.5 Flash API</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setAiProvider('ollama')}
                  className={cn(
                    "p-4 rounded-xl border text-left flex flex-col gap-2 transition-all cursor-pointer",
                    aiProvider === 'ollama'
                      ? "bg-indigo-500/15 border-indigo-500/50 text-indigo-300"
                      : "bg-secondary/20 border-border/60 text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Server className="w-5 h-5 text-emerald-400" />
                  <div>
                    <div className="text-xs font-bold">Ollama (Local)</div>
                    <div className="text-[10px] opacity-75">IA locale privée & gratuite</div>
                  </div>
                </button>
              </div>

              {/* Form Inputs */}
              <div className="bg-secondary/30 border border-border/80 p-5 rounded-2xl space-y-4">
                {aiProvider === 'openrouter' && (
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Clé API OpenRouter (sk-or-v1-...)
                    </label>
                    <input
                      type="password"
                      placeholder="sk-or-v1-..."
                      value={openRouterKey}
                      onChange={(e) => setOpenRouterKey(e.target.value)}
                      className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-xs font-mono text-foreground focus:outline-none focus:border-indigo-500"
                    />
                    <a
                      href="https://openrouter.ai/keys"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-indigo-400 hover:underline inline-block font-semibold"
                    >
                      Obtenir une clé API OpenRouter &rarr;
                    </a>
                  </div>
                )}

                {aiProvider === 'gemini' && (
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Clé API Google Gemini
                    </label>
                    <input
                      type="password"
                      placeholder="AIzaSy..."
                      value={geminiApiKey}
                      onChange={(e) => setGeminiApiKey(e.target.value)}
                      className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-xs font-mono text-foreground focus:outline-none focus:border-indigo-500"
                    />
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-indigo-400 hover:underline inline-block font-semibold"
                    >
                      Obtenir une clé API Gemini gratuite &rarr;
                    </a>
                  </div>
                )}

                {aiProvider === 'ollama' && (
                  <div className="space-y-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      URL Serveur Ollama Local
                    </label>
                    <input
                      type="text"
                      placeholder="http://localhost:11434"
                      value={ollamaUrl}
                      onChange={(e) => setOllamaUrl(e.target.value)}
                      className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-xs font-mono text-foreground focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                )}

                <div className="space-y-2 pt-2 border-t border-border/40">
                  <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Modèle d'IA cible
                  </label>
                  <input
                    type="text"
                    placeholder="google/gemini-2.5-flash ou anthropic/claude-3.5-sonnet ou meta-llama/llama-3.3-70b-instruct"
                    value={aiModel}
                    onChange={(e) => setAiModel(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-xs font-mono text-foreground focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex items-center justify-end pt-3">
                  <button
                    onClick={handleSaveSettings}
                    className="px-5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md"
                  >
                    Enregistrer les Paramètres
                  </button>
                </div>

                {savedSuccess && (
                  <p className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                    <Check className="w-4 h-4" /> Paramètres d'IA enregistrés avec succès !
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
