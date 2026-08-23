import React, { useState, useEffect } from 'react';
import { Note, Module, CodeSnippet, Annotation, SyntaxDefinition, ProjectBlueprint, ProjectBlueprintComplexPart } from '../types';
import {
  Sparkles,
  MessageSquare,
  Plus,
  Check,
  Folder,
  Tag,
  Code,
  Eye,
  RefreshCw,
  X,
  AlertCircle,
  FileText,
  Send,
  HelpCircle,
  Layers,
  Lightbulb,
  ChevronRight,
  Settings,
  Cpu,
  Globe,
  Server,
  Maximize2,
  Minimize2,
  RotateCcw,
  Eraser,
  Bot,
  Zap,
  Brain,
  History,
  Trash2,
  Clock,
  ChevronDown,
  GraduationCap,
  Briefcase,
  Copy,
  ArrowRight,
  CheckCircle2,
  Target
} from 'lucide-react';
import { Markdown } from './Markdown';
import { RevisionView } from './RevisionView';
import { cn } from '../lib/utils';

export interface AiConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

export interface AiConversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: AiConversationMessage[];
}

interface AiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  modules: Module[];
  notes: Note[];
  activeNote: Note | null;
  syntaxDefinitions?: Record<string, SyntaxDefinition>;
  onSaveNote: (newNote: Partial<Note>, targetModuleId?: string | null, updateExistingId?: string | null) => void;
  initialTab?: 'generator' | 'chat' | 'architect' | 'revision' | 'settings';
  initialTopic?: string;
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

// Custom DevNotes AI Emblem
export const DevNotesAiEmblem = ({ isThinking = false, size = "md" }: { isThinking?: boolean; size?: "sm" | "md" | "lg" }) => {
  const containerSize = {
    sm: "w-5 h-5 rounded-md",
    md: "w-8 h-8 rounded-lg",
    lg: "w-10 h-10 rounded-xl",
  }[size];

  const iconSize = {
    sm: "w-3 h-3",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  }[size];

  return (
    <div className="relative inline-flex items-center justify-center shrink-0">
      <div className={cn(
        "flex items-center justify-center transition-all duration-300",
        "bg-indigo-500/10 dark:bg-indigo-500/20 border border-indigo-500/20 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400 group-hover:border-indigo-500/40",
        containerSize,
        isThinking && "animate-pulse shadow-sm shadow-indigo-500/30 border-indigo-500/50"
      )}>
        <Brain className={cn(iconSize, "transition-transform", isThinking && "animate-spin text-indigo-500")} />
      </div>
      {isThinking && (
        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full border border-background animate-ping" />
      )}
    </div>
  );
};

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
  initialTab = 'generator',
  initialTopic,
}) => {
  const [activeTab, setActiveTab] = useState<'generator' | 'chat' | 'architect' | 'revision' | 'settings'>(initialTab);

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);
  const [inputContent, setInputContent] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiResult, setAiResult] = useState<ProcessedAiResult | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);

  // Architect Pro State
  const [blueprintPrompt, setBlueprintPrompt] = useState('');
  const [isArchitectProcessing, setIsArchitectProcessing] = useState(false);
  const [blueprintResult, setBlueprintResult] = useState<ProjectBlueprint | null>(null);
  const [blueprintScope, setBlueprintScope] = useState<'all' | string>('all');
  const [blueprintSavedSuccess, setBlueprintSavedSuccess] = useState(false);
  const [blueprintCopied, setBlueprintCopied] = useState(false);

  // AI Provider & Key Settings
  const [aiProvider, setAiProvider] = useState<'openrouter' | 'gemini' | 'ollama' | 'openai'>(
    () => (localStorage.getItem('devnotes_ai_provider') as any) || 'openrouter'
  );
  const [openRouterKey, setOpenRouterKey] = useState(() => localStorage.getItem('devnotes_openrouter_key') || '');
  const [geminiApiKey, setGeminiApiKey] = useState(() => localStorage.getItem('devnotes_gemini_key') || '');
  const [aiModel, setAiModel] = useState(() => localStorage.getItem('devnotes_ai_model') || 'google/gemini-2.5-flash');
  const [ollamaUrl, setOllamaUrl] = useState(() => localStorage.getItem('devnotes_ollama_url') || 'http://localhost:11434');

  const [savedSuccess, setSavedSuccess] = useState(false);

  // Persistent Chat History state
  const [conversations, setConversations] = useState<AiConversation[]>(() => {
    try {
      const saved = localStorage.getItem('devnotes_ai_conversations');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Failed to parse AI conversations from storage', e);
    }
    return [{
      id: 'conv_default',
      title: 'Accueil & Assistant DevNotes',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [
        {
          role: 'assistant',
          content: "Bonjour ! Je suis l'assistant IA DevNotes (OpenRouter & Multi-modèles). Posez-moi des questions sur vos notes, votre code, ou demandez-moi d'expliquer un snippet !",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ],
    }];
  });

  const [activeConvId, setActiveConvId] = useState<string>(() => {
    const savedLast = localStorage.getItem('devnotes_ai_last_conv_id');
    if (savedLast) return savedLast;
    return conversations[0]?.id || 'conv_default';
  });

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [isChatSending, setIsChatSending] = useState(false);

  // Active conversation & messages
  const activeConv = conversations.find(c => c.id === activeConvId) || conversations[0] || {
    id: 'conv_default',
    title: 'Accueil & Assistant DevNotes',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [],
  };
  const messages = activeConv.messages || [];

  const saveConversations = (updatedConvs: AiConversation[]) => {
    setConversations(updatedConvs);
    try {
      localStorage.setItem('devnotes_ai_conversations', JSON.stringify(updatedConvs));
    } catch (e) {
      console.error('Failed to save conversations to localStorage', e);
    }
  };

  const handleNewConversation = () => {
    const newConv: AiConversation = {
      id: `conv_${Date.now()}`,
      title: `Discussion #${conversations.length + 1}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [
        {
          role: 'assistant',
          content: "Nouvelle discussion démarrée ! Posez votre question ou collez votre extrait de code.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ],
    };
    const updated = [newConv, ...conversations];
    saveConversations(updated);
    setActiveConvId(newConv.id);
    localStorage.setItem('devnotes_ai_last_conv_id', newConv.id);
    setIsHistoryOpen(false);
  };

  const handleDeleteConversation = (convId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const filtered = conversations.filter(c => c.id !== convId);
    const fallbackConv: AiConversation = {
      id: `conv_${Date.now()}`,
      title: 'Nouvelle discussion',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [
        {
          role: 'assistant',
          content: "Bonjour ! Comment puis-je vous aider ?",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ],
    };
    const nextList = filtered.length > 0 ? filtered : [fallbackConv];
    saveConversations(nextList);
    if (activeConvId === convId) {
      setActiveConvId(nextList[0].id);
      localStorage.setItem('devnotes_ai_last_conv_id', nextList[0].id);
    }
  };

  if (!isOpen) return null;

  const activeApiKey = aiProvider === 'openrouter' ? openRouterKey : geminiApiKey;

  const handleClearInput = () => {
    setInputContent('');
    setAiResult(null);
  };

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

  const handleLoadActiveNote = () => {
    if (!activeNote) return;

    let formatted = `🔵 Titre\n${activeNote.title}\n\n`;
    if (activeNote.tags && activeNote.tags.length > 0) {
      formatted += `🟡 Tags\n${activeNote.tags.join(', ')}\n\n`;
    }
    if (activeNote.content) {
      formatted += `🟢 Résumé\n${activeNote.content}\n\n`;
    }
    if (activeNote.snippets && activeNote.snippets.length > 0) {
      const s = activeNote.snippets[0];
      formatted += `🔴 Bloc logique du code\n⚪ Titre : ${s.title || 'Bloc de code'}\n\`\`\`${s.language || 'python'}\n${s.code || ''}\n\`\`\`\n\n`;
      if (s.annotations && s.annotations.length > 0) {
        formatted += s.annotations
          .map(a => `⚫ Ligne ${a.line} : ${a.text}${a.fullContext && a.fullContext !== a.text ? ` — ${a.fullContext}` : ''}`)
          .join('\n');
      }
    }

    setInputContent(formatted.trim());
    if (activeNote.moduleId) {
      setSelectedModuleId(activeNote.moduleId);
    }
  };

  const handleCreateNoteFromAi = (isUpdate: boolean = false) => {
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

    if (isUpdate && activeNote) {
      onSaveNote(
        {
          title: aiResult.title,
          tags: aiResult.tags,
          content: aiResult.content,
          snippets: formattedSnippets,
        },
        selectedModuleId || activeNote.moduleId,
        activeNote.id
      );
    } else {
      onSaveNote(
        {
          title: aiResult.title,
          tags: aiResult.tags,
          content: aiResult.content,
          snippets: formattedSnippets,
        },
        selectedModuleId
      );
    }

    onClose();
  };

  const handleSendChat = async () => {
    if (!chatInput.trim() || isChatSending) return;

    const userMessageText = chatInput.trim();
    setChatInput('');
    const userMsg: AiConversationMessage = {
      role: 'user',
      content: userMessageText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const updatedMessages = [...messages, userMsg];
    
    let newTitle = activeConv.title;
    if (activeConv.title.startsWith('Discussion #') || activeConv.title.startsWith('Accueil &') || activeConv.title === 'Nouvelle discussion') {
      newTitle = userMessageText.length > 32 ? userMessageText.slice(0, 32) + '...' : userMessageText;
    }

    const updatedConv: AiConversation = {
      ...activeConv,
      title: newTitle,
      updatedAt: new Date().toISOString(),
      messages: updatedMessages,
    };

    const updatedConvs = conversations.map(c => c.id === activeConv.id ? updatedConv : c);
    saveConversations(updatedConvs);
    setIsChatSending(true);

    try {
      const notesSummary = notes
        .map(n => `- Note: "${n.title}" [Tags: ${n.tags.join(', ')}]\n  Extrait: ${n.content.slice(0, 150)}...`)
        .join('\n');

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
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
        const assistantMsg: AiConversationMessage = {
          role: 'assistant',
          content: data.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        const finalMessages = [...updatedMessages, assistantMsg];
        const finalConv: AiConversation = {
          ...updatedConv,
          updatedAt: new Date().toISOString(),
          messages: finalMessages,
        };
        saveConversations(conversations.map(c => c.id === activeConv.id ? finalConv : c));
      }
    } catch (err: any) {
      const errorMsg: AiConversationMessage = {
        role: 'assistant',
        content: `Désolé, une erreur est survenue: ${err.message || 'Erreur réseau'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      const finalMessages = [...updatedMessages, errorMsg];
      const finalConv: AiConversation = {
        ...updatedConv,
        updatedAt: new Date().toISOString(),
        messages: finalMessages,
      };
      saveConversations(conversations.map(c => c.id === activeConv.id ? finalConv : c));
    } finally {
      setIsChatSending(false);
    }
  };

  const handleGenerateBlueprint = async (customPrompt?: string) => {
    const promptToUse = (customPrompt || blueprintPrompt).trim();
    if (!promptToUse || isArchitectProcessing) return;

    setIsArchitectProcessing(true);
    setBlueprintResult(null);
    setBlueprintSavedSuccess(false);

    try {
      const scopedNotes = blueprintScope === 'all'
        ? notes
        : notes.filter(n => n.moduleId === blueprintScope);

      const notesContext = scopedNotes.map(n => ({
        id: n.id,
        title: n.title,
        tags: n.tags,
        content: n.content,
        snippets: n.snippets.map(s => ({
          title: s.title,
          language: s.language,
          code: s.code,
          annotations: s.annotations.map(a => ({ line: a.line, text: a.text, type: a.type }))
        }))
      }));

      const targetModule = modules.find(m => m.id === blueprintScope);

      const res = await fetch('/api/ai/architect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectIdea: promptToUse,
          notesContext,
          syntaxDefinitions,
          targetModuleName: targetModule?.name,
          provider: aiProvider,
          apiKey: (aiProvider === 'openrouter' ? openRouterKey : geminiApiKey).trim() || undefined,
          model: aiModel.trim() || undefined,
          ollamaUrl: ollamaUrl.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data.ok && data.blueprint) {
        setBlueprintResult(data.blueprint);
      } else {
        throw new Error(data.error || "Impossible de générer le dossier d'architecture");
      }
    } catch (err: any) {
      console.error('[Architect] Generation error:', err);
      alert(err.message || 'Une erreur est survenue lors de la conception.');
    } finally {
      setIsArchitectProcessing(false);
    }
  };

  const handleSaveBlueprintAsNote = () => {
    if (!blueprintResult) return;

    let fullMarkdown = `# ${blueprintResult.projectTitle}\n\n`;
    fullMarkdown += `> [!NOTE]\n> **Résumé Exécutif** : ${blueprintResult.summary}\n\n`;

    if (blueprintResult.targetStack && blueprintResult.targetStack.length > 0) {
      fullMarkdown += `### 🛠️ Stack Technique Ciblée\n`;
      fullMarkdown += blueprintResult.targetStack.map(s => `- \`${s}\``).join('\n') + '\n\n';
    }

    if (blueprintResult.reusableNotesSummary && blueprintResult.reusableNotesSummary.length > 0) {
      fullMarkdown += `### 💡 Connaissances & Notes Réutilisées\n`;
      fullMarkdown += blueprintResult.reusableNotesSummary.map(s => `- ${s}`).join('\n') + '\n\n';
    }

    fullMarkdown += `${blueprintResult.architectureOverview}\n\n`;

    if (blueprintResult.complexParts && blueprintResult.complexParts.length > 0) {
      fullMarkdown += `### 🧩 Résolution des Défis Complexes\n\n`;
      blueprintResult.complexParts.forEach((cp, idx) => {
        fullMarkdown += `#### ${idx + 1}. ${cp.title}\n`;
        fullMarkdown += `- **Problème / Enjeu** : ${cp.problemDescription}\n`;
        fullMarkdown += `- **Stratégie & Solution** : ${cp.solutionStrategy}\n`;
        if (cp.reusableConceptsFromNotes && cp.reusableConceptsFromNotes.length > 0) {
          fullMarkdown += `- **Concepts mobilisés** : ${cp.reusableConceptsFromNotes.map(c => `\`#${c}\``).join(', ')}\n`;
        }
        fullMarkdown += '\n';
      });
    }

    if (blueprintResult.roadmapSteps && blueprintResult.roadmapSteps.length > 0) {
      fullMarkdown += `### 🗺️ Roadmap d'Implémentation\n\n`;
      blueprintResult.roadmapSteps.forEach(st => {
        fullMarkdown += `#### ${st.phase}\n${st.description}\n`;
        if (st.keyDeliverables && st.keyDeliverables.length > 0) {
          fullMarkdown += `*Livrables clés :* ${st.keyDeliverables.join(', ')}\n`;
        }
        fullMarkdown += '\n';
      });
    }

    const mappedSnippets: CodeSnippet[] = (blueprintResult.snippets || []).map(s => ({
      id: Math.random().toString(36).substr(2, 9),
      title: s.title,
      language: s.language || 'python',
      code: s.code,
      annotations: (s.annotations || []).map(a => ({
        id: Math.random().toString(36).substr(2, 9),
        line: a.line,
        endLine: a.endLine,
        text: a.text,
        fullContext: a.fullContext,
        type: a.type || 'logic',
        color: a.color || '#6366f1'
      })),
      highlightedLines: s.annotations ? s.annotations.map(a => a.line) : []
    }));

    let targetModId = blueprintScope !== 'all' ? blueprintScope : null;
    if (!targetModId && blueprintResult.suggestedModuleName) {
      const existingMod = modules.find(m => m.name.toLowerCase() === blueprintResult.suggestedModuleName?.toLowerCase());
      if (existingMod) targetModId = existingMod.id;
    }

    onSaveNote({
      title: blueprintResult.projectTitle,
      content: fullMarkdown,
      tags: blueprintResult.suggestedTags || ['architecture', 'project-blueprint'],
      snippets: mappedSnippets
    }, targetModId);

    setBlueprintSavedSuccess(true);
    setTimeout(() => setBlueprintSavedSuccess(false), 4000);
  };

  const handleCopyBlueprintMarkdown = () => {
    if (!blueprintResult) return;

    let fullMarkdown = `# ${blueprintResult.projectTitle}\n\n`;
    fullMarkdown += `> [!NOTE]\n> **Résumé Exécutif** : ${blueprintResult.summary}\n\n`;

    if (blueprintResult.targetStack && blueprintResult.targetStack.length > 0) {
      fullMarkdown += `### 🛠️ Stack Technique Ciblée\n`;
      fullMarkdown += blueprintResult.targetStack.map(s => `- \`${s}\``).join('\n') + '\n\n';
    }

    if (blueprintResult.reusableNotesSummary && blueprintResult.reusableNotesSummary.length > 0) {
      fullMarkdown += `### 💡 Connaissances & Notes Réutilisées\n`;
      fullMarkdown += blueprintResult.reusableNotesSummary.map(s => `- ${s}`).join('\n') + '\n\n';
    }

    fullMarkdown += `${blueprintResult.architectureOverview}\n\n`;

    if (blueprintResult.complexParts && blueprintResult.complexParts.length > 0) {
      fullMarkdown += `### 🧩 Résolution des Défis Complexes\n\n`;
      blueprintResult.complexParts.forEach((cp, idx) => {
        fullMarkdown += `#### ${idx + 1}. ${cp.title}\n`;
        fullMarkdown += `- **Problème / Enjeu** : ${cp.problemDescription}\n`;
        fullMarkdown += `- **Stratégie & Solution** : ${cp.solutionStrategy}\n`;
        if (cp.reusableConceptsFromNotes && cp.reusableConceptsFromNotes.length > 0) {
          fullMarkdown += `- **Concepts mobilisés** : ${cp.reusableConceptsFromNotes.map(c => `\`#${c}\``).join(', ')}\n`;
        }
        fullMarkdown += '\n';
      });
    }

    if (blueprintResult.snippets && blueprintResult.snippets.length > 0) {
      fullMarkdown += `### 💻 Snippets Clés d'Architecture\n\n`;
      blueprintResult.snippets.forEach(s => {
        fullMarkdown += `#### ${s.title}\n\`\`\`${s.language}\n${s.code}\n\`\`\`\n\n`;
      });
    }

    if (blueprintResult.roadmapSteps && blueprintResult.roadmapSteps.length > 0) {
      fullMarkdown += `### 🗺️ Roadmap d'Implémentation\n\n`;
      blueprintResult.roadmapSteps.forEach(st => {
        fullMarkdown += `#### ${st.phase}\n${st.description}\n`;
        if (st.keyDeliverables && st.keyDeliverables.length > 0) {
          fullMarkdown += `*Livrables clés :* ${st.keyDeliverables.join(', ')}\n`;
        }
        fullMarkdown += '\n';
      });
    }

    navigator.clipboard.writeText(fullMarkdown);
    setBlueprintCopied(true);
    setTimeout(() => setBlueprintCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-hidden transition-all duration-300">
      <div
        className={cn(
          "bg-card border border-indigo-500/30 shadow-2xl flex flex-col overflow-hidden font-sans transition-all duration-300",
          isMaximized
            ? "w-full h-full rounded-none max-w-none"
            : "w-full max-w-6xl h-[90vh] rounded-2xl"
        )}
      >
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/80 bg-muted/30">
          <div className="flex items-center gap-3">
            <DevNotesAiEmblem isThinking={isProcessing || isChatSending} />
            <div>
              <h2 className="text-base font-extrabold text-foreground flex items-center gap-2">
                DevNotes AI Engine
                <span className="text-[10px] bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 px-2 py-0.5 rounded-full font-mono uppercase tracking-wider font-semibold">
                  {aiProvider === 'openrouter' ? 'OpenRouter' : aiProvider === 'ollama' ? 'Ollama Local' : 'Gemini 2.5'}
                </span>
              </h2>
              <p className="text-xs text-muted-foreground">
                Génération automatique de notes, sous-notes de code et réutilisation de syntaxes
              </p>
            </div>
          </div>

          {/* Navigation Tabs & Window Controls */}
          <div className="flex items-center gap-3">
            <div className="flex bg-secondary/80 p-1 rounded-xl border border-border/60">
              <button
                onClick={() => setActiveTab('generator')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer',
                  activeTab === 'generator'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Zap className="w-3.5 h-3.5" />
                Générateur de Note
              </button>
              <button
                onClick={() => setActiveTab('chat')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer',
                  activeTab === 'chat'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Assistant Chat
              </button>
              <button
                onClick={() => setActiveTab('architect')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer',
                  activeTab === 'architect'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Briefcase className="w-3.5 h-3.5" />
                Architecte Pro
              </button>
              <button
                onClick={() => setActiveTab('revision')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer',
                  activeTab === 'revision'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                Révision & Pratique
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer',
                  activeTab === 'settings'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Settings className="w-3.5 h-3.5" />
                Clé API / Modèle
              </button>
            </div>

            {/* Window Resizing & Close controls */}
            <div className="flex items-center gap-1 pl-2 border-l border-border/60">
              <button
                onClick={() => setIsMaximized(!isMaximized)}
                title={isMaximized ? "Réduire la fenêtre" : "Agrandir en plein écran"}
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors cursor-pointer"
              >
                {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button
                onClick={onClose}
                className="p-2 text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {activeTab === 'generator' && (
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border/60 overflow-hidden">
              
              {/* Left Column: Input Prompt & Controls */}
              <div className="p-6 flex flex-col h-full bg-secondary/10 space-y-4 overflow-y-auto">
                {/* Active Note Banner if available */}
                {activeNote && (
                  <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold text-indigo-400 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">Note active : {activeNote.title}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {activeNote.snippets?.length ? `${activeNote.snippets[0].annotations?.length || 0} sous-notes de code` : 'Aucun code'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleLoadActiveNote}
                      className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 flex-shrink-0 transition-colors shadow-sm cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      📥 Charger la note active
                    </button>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-indigo-400" />
                    Texte Brut / Format de la Note
                  </label>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setInputContent(DEFAULT_EXAMPLE_INPUT)}
                      className="text-xs text-indigo-400 hover:text-indigo-300 font-medium hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" />
                      Exemple
                    </button>
                    {inputContent && (
                      <button
                        type="button"
                        onClick={handleClearInput}
                        className="text-xs text-rose-400 hover:text-rose-300 font-medium hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Eraser className="w-3 h-3" />
                        Réinitialiser
                      </button>
                    )}
                  </div>
                </div>

                <textarea
                  placeholder="Collez votre contenu de note, le format 🔵 Titre 🟡 Tags 🟢 Résumé 🔴 Code ⚫ Ligne ..., ou chargez la note active pour la restructurer..."
                  value={inputContent}
                  onChange={(e) => setInputContent(e.target.value)}
                  className="flex-1 w-full min-h-[240px] bg-secondary/35 border border-border/80 rounded-xl p-4 text-xs font-mono text-foreground focus:outline-none focus:border-indigo-500 transition-colors resize-none leading-relaxed"
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
                      <Zap className="w-4 h-4" />
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
                    <div className="flex items-center gap-2">
                      {activeNote && (
                        <button
                          onClick={() => handleCreateNoteFromAi(true)}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                          title="Met à jour la note actuellement ouverte"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          Mettre à jour la note active
                        </button>
                      )}
                      <button
                        onClick={() => handleCreateNoteFromAi(false)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                        title="Créer une nouvelle note distincte"
                      >
                        <Check className="w-3.5 h-3.5" />
                        {activeNote ? 'Créer comme nouvelle' : 'Enregistrer dans DevNotes'}
                      </button>
                    </div>
                  )}
                </div>

                {/* AI Processing / Thinking Animation */}
                {isProcessing ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-4">
                    <div className="relative">
                      <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center animate-pulse">
                        <Brain className="w-8 h-8 text-indigo-400 animate-spin" />
                      </div>
                      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-indigo-500 to-sky-400 blur-xl opacity-30 animate-pulse" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-foreground flex items-center justify-center gap-2">
                        L'IA analyse et réfléchit à votre note...
                        <span className="inline-flex gap-1">
                          <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" />
                          <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                          <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                        </span>
                      </h4>
                      <p className="text-xs text-muted-foreground max-w-sm">
                        Séparation du code pur, création des sous-notes de ligne et croisement des syntaxes en cours.
                      </p>
                    </div>
                  </div>
                ) : !aiResult ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-muted-foreground space-y-3">
                    <div className="p-4 bg-secondary/50 rounded-full border border-border">
                      <Brain className="w-8 h-8 text-indigo-400 opacity-60" />
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
                            <div className="bg-black/40 p-3 rounded-lg font-mono text-[11px] text-foreground/90 overflow-x-auto max-h-56 leading-relaxed">
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
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-card relative">
              {/* Chat Sub-Header / History Bar */}
              <div className="px-5 py-3 border-b border-border/80 bg-secondary/30 flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={() => setIsHistoryOpen(!isHistoryOpen)}
                    className="flex items-center gap-2 text-xs font-bold text-indigo-300 hover:text-indigo-200 bg-indigo-500/15 border border-indigo-500/30 px-3 py-1.5 rounded-xl transition-all cursor-pointer hover:bg-indigo-500/25"
                    title="Afficher vos conversations précédentes"
                  >
                    <History className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Dernières conversations</span>
                    <span className="bg-indigo-500/40 text-indigo-200 text-[10px] font-mono px-1.5 py-0.5 rounded-full">
                      {conversations.length}
                    </span>
                    <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-200", isHistoryOpen && "rotate-180")} />
                  </button>

                  <div className="h-4 w-px bg-border hidden sm:block" />

                  <span className="text-xs font-semibold text-foreground truncate max-w-[200px] sm:max-w-[300px] hidden sm:inline-block">
                    {activeConv.title}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleNewConversation}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
                    title="Démarrer une nouvelle discussion"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Nouvelle conversation</span>
                  </button>

                  {conversations.length > 1 && (
                    <button
                      onClick={(e) => handleDeleteConversation(activeConv.id, e)}
                      className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors cursor-pointer"
                      title="Supprimer la conversation actuelle"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* History Drawer Dropdown */}
              {isHistoryOpen && (
                <div className="absolute top-12 left-4 z-30 w-80 max-h-96 bg-card border border-border shadow-2xl rounded-2xl overflow-y-auto p-2 space-y-1 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between border-b border-border">
                    <span>Dernières conversations ({conversations.length})</span>
                    <button
                      onClick={() => setIsHistoryOpen(false)}
                      className="text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {conversations.map((c) => {
                    const isActive = c.id === activeConv.id;
                    const dateStr = new Date(c.updatedAt).toLocaleDateString([], {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    });
                    return (
                      <div
                        key={c.id}
                        onClick={() => {
                          setActiveConvId(c.id);
                          localStorage.setItem('devnotes_ai_last_conv_id', c.id);
                          setIsHistoryOpen(false);
                        }}
                        className={cn(
                          "p-3 rounded-xl cursor-pointer transition-all flex items-start justify-between gap-2 group",
                          isActive
                            ? "bg-indigo-500/15 border border-indigo-500/40 text-indigo-700 dark:text-indigo-300"
                            : "hover:bg-secondary/70 text-foreground border border-transparent"
                        )}
                      >
                        <div className="space-y-1 overflow-hidden">
                          <div className="text-xs font-bold truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                            {c.title}
                          </div>
                          <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                            <span className="flex items-center gap-1 font-mono">
                              <Clock className="w-3 h-3 opacity-70" />
                              {dateStr}
                            </span>
                            <span>•</span>
                            <span>{c.messages.length} msg</span>
                          </div>
                        </div>

                        {conversations.length > 1 && (
                          <button
                            onClick={(e) => handleDeleteConversation(c.id, e)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-opacity cursor-pointer"
                            title="Supprimer cette discussion"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Chat Messages */}
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
                        'w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold shadow-md',
                        m.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-indigo-600 text-white'
                      )}
                    >
                      {m.role === 'user' ? 'Vous' : <Brain className="w-4 h-4" />}
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
                      {m.timestamp && (
                        <div className={cn(
                          "text-[9px] font-mono mt-1 opacity-60 text-right",
                          m.role === 'user' ? "text-primary-foreground/70" : "text-muted-foreground"
                        )}>
                          {m.timestamp}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* AI Chat Thinking Indicator */}
                {isChatSending && (
                  <div className="flex gap-3 mr-auto items-center animate-pulse">
                    <div className="w-8 h-8 rounded-full bg-indigo-600/30 border border-indigo-500/50 flex items-center justify-center text-indigo-300">
                      <Brain className="w-4 h-4 animate-spin" />
                    </div>
                    <div className="bg-secondary/40 border border-border/80 px-4 py-3 rounded-2xl rounded-tl-none text-xs text-muted-foreground flex items-center gap-2 font-mono">
                      <span>L'IA réfléchit</span>
                      <span className="inline-flex gap-1">
                        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" />
                        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                      </span>
                    </div>
                  </div>
                )}
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
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
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
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md"
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

          {/* Architect Pro Tab */}
          {activeTab === 'architect' && (
            <div className="flex-1 flex flex-col p-4 sm:p-6 overflow-y-auto bg-background/50">
              {!blueprintResult ? (
                /* Input & Configuration Screen */
                <div className="max-w-4xl w-full mx-auto space-y-6 my-auto">
                  {/* Banner */}
                  <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-background border border-indigo-500/20 shadow-sm space-y-2">
                    <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm">
                      <Briefcase className="w-4 h-4" />
                      <span>Architecte Logiciel & Tech Lead Solution</span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Soumettez une idée de projet logiciel ou un défi d'ingénierie. L'agent parcourt l'ensemble de votre base de connaissances (cours, notes, syntaxes, snippets) pour concevoir le dossier d'architecture technique, résoudre les points complexes et générer des modèles de code annotés prêts à l'emploi.
                    </p>
                  </div>

                  {/* Scope Selector */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-secondary/40 border border-border">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-primary shrink-0" />
                      <span className="text-xs font-semibold text-foreground">Connaissances ciblées :</span>
                    </div>
                    <div className="flex items-center gap-2 flex-1 sm:justify-end">
                      <select
                        value={blueprintScope}
                        onChange={(e) => setBlueprintScope(e.target.value)}
                        className="bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-indigo-500 cursor-pointer min-w-[220px]"
                      >
                        <option value="all">🌐 Tout l'espace de travail ({notes.length} notes, {Object.keys(syntaxDefinitions).length} syntaxes)</option>
                        {modules.map(m => (
                          <option key={m.id} value={m.id}>📁 Dossier : {m.name} ({notes.filter(n => n.moduleId === m.id).length} notes)</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Quick inspirations */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-indigo-400" />
                      Exemples d'idées de projets :
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {[
                        "🤖 Système d'Agents IA pour Supermarché (Stocks, Alertes, Catalogue)",
                        "⚡ Pipeline ETL & Streaming Temps Réel pour Transactions",
                        "🔐 Plateforme Microservices avec Auth Sécurisée & Cache Redis",
                        "📊 Moteur d'Analytics et Détection d'Anomalies avec Pandas"
                      ].map((idea, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setBlueprintPrompt(idea)}
                          className="px-2.5 py-1.5 rounded-lg bg-secondary/50 hover:bg-secondary border border-border hover:border-indigo-500/40 text-[11px] text-muted-foreground hover:text-foreground transition-all text-left cursor-pointer"
                        >
                          {idea}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Prompt Textarea */}
                  <div className="space-y-3">
                    <label className="block text-xs font-bold uppercase tracking-wider text-foreground flex items-center justify-between">
                      <span>Cahier des charges ou Problème à concevoir</span>
                      <span className="text-[10px] text-muted-foreground font-normal lowercase">Markdown et détails bienvenus</span>
                    </label>
                    <textarea
                      rows={5}
                      value={blueprintPrompt}
                      onChange={(e) => setBlueprintPrompt(e.target.value)}
                      placeholder="Ex: Je souhaite concevoir un système complet d'agents IA pour un supermarché. Les agents doivent gérer la prédiction des ruptures de stock, surveiller les dates de péremption, et alerter les managers via WebSocket..."
                      className="w-full bg-background border border-border rounded-xl p-4 text-xs font-sans text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-none shadow-inner"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                          handleGenerateBlueprint();
                        }
                      }}
                    />
                  </div>

                  {/* Submit Button */}
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-[11px] text-muted-foreground/70 italic">
                      Astuce : Appuyez sur Ctrl + Entrée pour lancer la conception.
                    </span>
                    <button
                      onClick={() => handleGenerateBlueprint()}
                      disabled={isArchitectProcessing || !blueprintPrompt.trim()}
                      className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-lg shadow-indigo-500/20"
                    >
                      {isArchitectProcessing ? (
                        <>
                          <Brain className="w-4 h-4 animate-spin text-white" />
                          <span>Conception architecturale en cours...</span>
                        </>
                      ) : (
                        <>
                          <Briefcase className="w-4 h-4" />
                          <span>Concevoir l'Architecture du Projet</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                /* Generated Blueprint View */
                <div className="max-w-5xl w-full mx-auto space-y-6 pb-12">
                  {/* Top Action Bar */}
                  <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 p-3.5 bg-card/95 backdrop-blur-md border border-border rounded-2xl shadow-lg">
                    <button
                      onClick={() => setBlueprintResult(null)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Modifier le prompt</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleCopyBlueprintMarkdown}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary/80 hover:bg-secondary border border-border text-foreground text-xs font-semibold transition-colors cursor-pointer"
                        title="Copier tout le dossier technique en Markdown"
                      >
                        {blueprintCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{blueprintCopied ? 'Copié !' : 'Copier Markdown'}</span>
                      </button>

                      <button
                        onClick={handleSaveBlueprintAsNote}
                        className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all shadow-md cursor-pointer"
                      >
                        {blueprintSavedSuccess ? <CheckCircle2 className="w-3.5 h-3.5 text-white" /> : <Plus className="w-3.5 h-3.5" />}
                        <span>{blueprintSavedSuccess ? 'Projet Enregistré !' : 'Créer la Note Projet'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Overview Header Card */}
                  <div className="p-6 rounded-2xl bg-card border border-indigo-500/30 shadow-md space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-bold uppercase tracking-wider text-indigo-500 font-mono">
                        Dossier d'Architecture
                      </span>
                      {(blueprintResult.suggestedTags || []).map(t => (
                        <span key={t} className="px-2 py-0.5 rounded-md bg-secondary text-[10px] font-mono text-muted-foreground">
                          #{t}
                        </span>
                      ))}
                    </div>

                    <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                      {blueprintResult.projectTitle}
                    </h2>

                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed bg-secondary/30 p-4 rounded-xl border border-border/50">
                      {blueprintResult.summary}
                    </p>

                    {/* Stack & Capitalized Notes */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                      <div className="space-y-2 p-3.5 rounded-xl bg-secondary/20 border border-border/50">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                          Stack Technique Recommandée :
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {(blueprintResult.targetStack || []).map((tech, i) => (
                            <span key={i} className="px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 text-[10px] font-mono font-semibold">
                              {tech}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2 p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-500 flex items-center gap-1.5">
                          <Lightbulb className="w-3.5 h-3.5 text-emerald-400" />
                          Connaissances & Cours Mobilisés :
                        </span>
                        <ul className="space-y-1 text-xs text-muted-foreground">
                          {(blueprintResult.reusableNotesSummary || []).map((item, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <span className="text-emerald-500 font-bold">•</span>
                              <span className="text-[11px]">{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Architecture Breakdown */}
                  <div className="p-6 rounded-2xl bg-card border border-border shadow-sm space-y-4">
                    <h3 className="text-base font-bold text-foreground flex items-center gap-2 border-b border-border pb-3">
                      <Globe className="w-4 h-4 text-indigo-400" />
                      <span>Spécifications & Architecture Système</span>
                    </h3>
                    <div className="prose dark:prose-invert prose-xs max-w-none">
                      <Markdown content={blueprintResult.architectureOverview} />
                    </div>
                  </div>

                  {/* Complex Parts Resolution */}
                  {blueprintResult.complexParts && blueprintResult.complexParts.length > 0 && (
                    <div className="p-6 rounded-2xl bg-card border border-border shadow-sm space-y-4">
                      <h3 className="text-base font-bold text-foreground flex items-center gap-2 border-b border-border pb-3">
                        <Target className="w-4 h-4 text-rose-400" />
                        <span>Résolution des Défis Techniques Complexes</span>
                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {blueprintResult.complexParts.map((cp, idx) => (
                          <div key={idx} className="p-4 rounded-xl bg-secondary/30 border border-border/80 space-y-3 flex flex-col justify-between">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20 text-[10px] font-bold flex items-center justify-center shrink-0">
                                  {idx + 1}
                                </span>
                                <h4 className="text-xs font-bold text-foreground">{cp.title}</h4>
                              </div>

                              <div className="space-y-1 text-xs">
                                <p className="text-rose-400/90 text-[11px] font-semibold">⚠️ Le Défi :</p>
                                <p className="text-muted-foreground text-[11px] leading-relaxed">{cp.problemDescription}</p>
                              </div>

                              <div className="space-y-1 text-xs pt-1">
                                <p className="text-emerald-400 font-semibold text-[11px]">💡 Stratégie & Solution :</p>
                                <p className="text-foreground/90 text-[11px] leading-relaxed">{cp.solutionStrategy}</p>
                              </div>
                            </div>

                            {cp.reusableConceptsFromNotes && cp.reusableConceptsFromNotes.length > 0 && (
                              <div className="pt-2 border-t border-border/40 flex items-center gap-1.5 flex-wrap">
                                <span className="text-[9px] uppercase font-bold text-muted-foreground/60">Concepts réutilisés :</span>
                                {cp.reusableConceptsFromNotes.map((c, i) => (
                                  <span key={i} className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-[9px] text-emerald-500 font-mono">
                                    #{c}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Key Code Snippets */}
                  {blueprintResult.snippets && blueprintResult.snippets.length > 0 && (
                    <div className="p-6 rounded-2xl bg-card border border-border shadow-sm space-y-4">
                      <h3 className="text-base font-bold text-foreground flex items-center gap-2 border-b border-border pb-3">
                        <Code className="w-4 h-4 text-indigo-400" />
                        <span>Modèles de Code Clés & Annotations</span>
                      </h3>

                      <div className="space-y-4">
                        {blueprintResult.snippets.map((snip, idx) => (
                          <div key={idx} className="rounded-xl border border-border overflow-hidden bg-secondary/20 space-y-2">
                            <div className="flex items-center justify-between px-4 py-2 bg-secondary/50 border-b border-border">
                              <span className="text-xs font-bold text-foreground">{snip.title}</span>
                              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                                {snip.language}
                              </span>
                            </div>
                            <pre className="p-4 text-xs font-mono text-foreground overflow-x-auto bg-black/30 rounded-b-xl leading-relaxed">
                              <code>{snip.code}</code>
                            </pre>
                            {snip.annotations && snip.annotations.length > 0 && (
                              <div className="p-3 bg-secondary/30 border-t border-border space-y-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                                  Annotations d'Architecture :
                                </span>
                                <div className="space-y-1.5">
                                  {snip.annotations.map((ann, aIdx) => (
                                    <div key={aIdx} className="flex items-start gap-2 text-xs p-2 rounded-lg bg-background/60 border border-border/40">
                                      <span className="text-[10px] font-mono font-bold text-indigo-400 shrink-0">
                                        Ligne {ann.line}{ann.endLine && ann.endLine !== ann.line ? `-${ann.endLine}` : ''}
                                      </span>
                                      <span className="text-[11px] text-muted-foreground">{ann.text}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Implementation Roadmap */}
                  {blueprintResult.roadmapSteps && blueprintResult.roadmapSteps.length > 0 && (
                    <div className="p-6 rounded-2xl bg-card border border-border shadow-sm space-y-4">
                      <h3 className="text-base font-bold text-foreground flex items-center gap-2 border-b border-border pb-3">
                        <ArrowRight className="w-4 h-4 text-emerald-400" />
                        <span>Roadmap d'Implémentation par Étapes</span>
                      </h3>

                      <div className="space-y-3">
                        {blueprintResult.roadmapSteps.map((step, idx) => (
                          <div key={idx} className="p-3.5 rounded-xl bg-secondary/25 border border-border/60 flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                              {idx + 1}
                            </div>
                            <div className="flex-1 min-w-0 space-y-1">
                              <h4 className="text-xs font-bold text-foreground">{step.phase}</h4>
                              <p className="text-xs text-muted-foreground">{step.description}</p>
                              {step.keyDeliverables && step.keyDeliverables.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                  {step.keyDeliverables.map((del, dIdx) => (
                                    <span key={dIdx} className="px-2 py-0.5 rounded-md bg-secondary text-[10px] text-foreground/80 border border-border/50">
                                      ✓ {del}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'revision' && (
            <RevisionView
              notes={notes}
              modules={modules}
              activeNote={activeNote}
              syntaxDefinitions={syntaxDefinitions}
              aiProvider={aiProvider}
              apiKey={aiProvider === 'openrouter' ? openRouterKey : geminiApiKey}
              aiModel={aiModel}
              ollamaUrl={ollamaUrl}
              onSaveNote={onSaveNote}
              initialTopic={initialTopic}
            />
          )}
        </div>
      </div>
    </div>
  );
};
