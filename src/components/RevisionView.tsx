import React, { useState } from 'react';
import { 
  Note, 
  Module, 
  SyntaxDefinition, 
  RevisionSession, 
  RevisionCodingExercise 
} from '../types';
import { 
  GraduationCap, 
  Brain, 
  Sparkles, 
  CheckCircle2, 
  XCircle, 
  HelpCircle, 
  Code2, 
  Layers, 
  BookOpen, 
  RotateCcw, 
  Lightbulb, 
  Plus, 
  Check, 
  FileText, 
  Search, 
  Flame, 
  Award, 
  Eye
} from 'lucide-react';
import { Markdown } from './Markdown';
import { cn } from '../lib/utils';

interface RevisionViewProps {
  notes: Note[];
  modules: Module[];
  activeNote: Note | null;
  syntaxDefinitions?: Record<string, SyntaxDefinition>;
  aiProvider: 'openrouter' | 'gemini' | 'ollama' | 'openai';
  apiKey?: string;
  aiModel?: string;
  ollamaUrl?: string;
  onSaveNote: (newNote: Partial<Note>, targetModuleId?: string | null, updateExistingId?: string | null) => void;
  initialTopic?: string;
}

export const RevisionView: React.FC<RevisionViewProps> = ({
  notes,
  activeNote,
  syntaxDefinitions = {},
  aiProvider,
  apiKey,
  aiModel,
  ollamaUrl,
  onSaveNote,
  initialTopic,
}) => {
  const [topicInput, setTopicInput] = useState(initialTopic || (activeNote ? activeNote.title : ''));
  const [isLoading, setIsLoading] = useState(false);
  const [session, setSession] = useState<RevisionSession | null>(null);
  const [activeSessionTab, setActiveSessionTab] = useState<'memo' | 'flashcards' | 'quiz' | 'code'>('memo');
  
  // Flashcards state
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isCardFlipped, setIsCardFlipped] = useState(false);
  const [masteredCards, setMasteredCards] = useState<Record<string, boolean>>({});

  // Quiz state
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState<Record<string, boolean>>({});

  // Code Exercise state
  const [activeExerciseIndex, setActiveExerciseIndex] = useState(0);
  const [userCodes, setUserCodes] = useState<Record<string, string>>({});
  const [isEvaluatingCode, setIsEvaluatingCode] = useState(false);
  const [evaluations, setEvaluations] = useState<Record<string, { score: number; isCorrect: boolean; feedback: string; suggestion?: string }>>({});
  const [showSolution, setShowSolution] = useState<Record<string, boolean>>({});
  const [showHints, setShowHints] = useState<Record<string, boolean>>({});

  // Save to notes feedback
  const [isSavedToNotes, setIsSavedToNotes] = useState(false);

  // Suggestions list
  const suggestedTopics = [
    ...(activeNote ? [activeNote.title] : []),
    "Les décorateurs en Python",
    "Les fonctions imbriquées & Closures",
    "Gestion des dates (datetime)",
    "Listes & Dictionnaires compréhensions",
    "Manipulation des arguments (*args, **kwargs)",
    "Gestion des exceptions (try / except / finally)"
  ];

  const startRevision = async (targetTopic?: string) => {
    const topicToUse = (targetTopic || topicInput).trim();
    if (!topicToUse) return;

    setIsLoading(true);
    setSession(null);
    setIsSavedToNotes(false);
    setQuizAnswers({});
    setQuizSubmitted({});
    setMasteredCards({});
    setEvaluations({});
    setShowSolution({});
    setShowHints({});
    setCurrentCardIndex(0);
    setIsCardFlipped(false);
    setActiveSessionTab('memo');

    try {
      const response = await fetch('/api/ai/revision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topicToUse,
          existingNotes: notes,
          syntaxDefinitions,
          activeNoteId: activeNote?.id,
          provider: aiProvider,
          apiKey,
          model: aiModel,
          ollamaUrl,
        }),
      });

      if (!response.ok) throw new Error('Erreur de révision');
      const data = await response.json();
      if (data.session) {
        setSession(data.session);
        // Initialize starter code for exercises
        const initialCodes: Record<string, string> = {};
        (data.session.exercises || []).forEach((ex: RevisionCodingExercise) => {
          initialCodes[ex.id] = ex.starterCode;
        });
        setUserCodes(initialCodes);
      }
    } catch (err) {
      console.error('Revision error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Evaluate user's code attempt with AI
  const evaluateCodeAttempt = async (exercise: RevisionCodingExercise) => {
    const code = userCodes[exercise.id] || '';
    if (!code.trim()) return;

    setIsEvaluatingCode(true);
    try {
      const response = await fetch('/api/ai/revision/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exerciseTitle: exercise.title,
          exerciseInstructions: exercise.instructions,
          userCode: code,
          solutionCode: exercise.solutionCode,
          provider: aiProvider,
          apiKey,
          model: aiModel,
          ollamaUrl,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.evaluation) {
          setEvaluations(prev => ({ ...prev, [exercise.id]: data.evaluation }));
        }
      }
    } catch (err) {
      console.error('Code evaluation error:', err);
    } finally {
      setIsEvaluatingCode(false);
    }
  };

  const handleSaveToNotes = () => {
    if (!session?.suggestedNote) return;
    const noteData = session.suggestedNote;
    onSaveNote({
      title: noteData.title,
      tags: noteData.tags,
      content: noteData.content,
      snippets: (noteData.snippets || []).map((s, idx) => ({
        id: `snip_rev_${Date.now()}_${idx}`,
        title: s.title || `Code d'entraînement : ${session.topic}`,
        language: s.language || 'python',
        code: s.code,
        annotations: (s.annotations || []).map((a, aIdx) => ({
          id: `ann_rev_${Date.now()}_${aIdx}`,
          line: a.line || 1,
          text: a.text,
          type: a.type || 'logic',
          color: '#6366f1'
        })),
        highlightedLines: [],
      }))
    });
    setIsSavedToNotes(true);
  };

  // Score calculations
  const totalQuiz = session?.quiz?.length || 0;
  const answeredQuiz = Object.keys(quizSubmitted).length;
  const correctQuizCount = session?.quiz?.filter(q => quizSubmitted[q.id] && quizAnswers[q.id] === q.correctIndex).length || 0;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background text-foreground">
      {/* Top Bar / Search Topic */}
      <div className="p-4 border-b border-border/80 bg-muted/20 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && startRevision()}
              placeholder="Ex: Les décorateurs en Python, Fonctions imbriquées, Gestion des dates..."
              className="w-full bg-secondary/70 border border-border/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20 transition-all"
            />
          </div>
          <button
            onClick={() => startRevision()}
            disabled={isLoading || !topicInput.trim()}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-sm shadow-md shadow-indigo-500/20 disabled:opacity-50 transition-all cursor-pointer shrink-0"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Génération...</span>
              </>
            ) : (
              <>
                <GraduationCap className="w-4 h-4" />
                <span>Lancer la Révision</span>
              </>
            )}
          </button>
        </div>

        {/* Quick Topic Chips */}
        {!session && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1 mr-1">
              <Flame className="w-3.5 h-3.5 text-amber-500" />
              Suggestions :
            </span>
            {suggestedTopics.map((top, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setTopicInput(top);
                  startRevision(top);
                }}
                className="text-xs px-2.5 py-1 rounded-lg bg-secondary hover:bg-indigo-500/10 hover:text-indigo-600 dark:hover:text-indigo-400 border border-border/60 transition-all cursor-pointer"
              >
                {top}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
        {isLoading && (
          <div className="flex flex-col items-center justify-center h-72 gap-4 text-center">
            <div className="relative flex items-center justify-center">
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center animate-pulse">
                <Brain className="w-8 h-8 text-indigo-500 animate-spin" />
              </div>
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Analyse de vos notes et création du parcours...</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-md">
                L'IA extrait les concepts clés, prépare des questions de mémorisation et conçoit des exercices de code adaptés.
              </p>
            </div>
          </div>
        )}

        {!isLoading && !session && (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center max-w-lg mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4">
              <GraduationCap className="w-8 h-8 text-indigo-500" />
            </div>
            <h3 className="text-lg font-bold text-foreground">Entraînement & Révision Intelligente</h3>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              Consolidez votre mémoire sur n'importe quel sujet de programmation. L'IA se base sur vos notes existantes ou génère une fiche complète avec QCM et défis de code.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full mt-6 text-left">
              <div className="p-3.5 rounded-xl bg-card border border-border/70 flex flex-col gap-1.5 shadow-sm">
                <div className="flex items-center gap-2 text-indigo-500 font-bold text-xs">
                  <FileText className="w-4 h-4" />
                  <span>Fiche Mémo</span>
                </div>
                <p className="text-[11px] text-muted-foreground">Synthèse percutante avec alertes et code annoté.</p>
              </div>

              <div className="p-3.5 rounded-xl bg-card border border-border/70 flex flex-col gap-1.5 shadow-sm">
                <div className="flex items-center gap-2 text-emerald-500 font-bold text-xs">
                  <Layers className="w-4 h-4" />
                  <span>Flashcards</span>
                </div>
                <p className="text-[11px] text-muted-foreground">Mémorisation active pour ancrer les définitions clés.</p>
              </div>

              <div className="p-3.5 rounded-xl bg-card border border-border/70 flex flex-col gap-1.5 shadow-sm">
                <div className="flex items-center gap-2 text-amber-500 font-bold text-xs">
                  <Code2 className="w-4 h-4" />
                  <span>Défis Code</span>
                </div>
                <p className="text-[11px] text-muted-foreground">Pratique d'écriture avec correction et retour IA en direct.</p>
              </div>
            </div>
          </div>
        )}

        {/* ACTIVE REVISION SESSION */}
        {!isLoading && session && (
          <div className="flex flex-col gap-5 max-w-4xl mx-auto">
            {/* Header info & Tabs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-transparent border border-indigo-500/20">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-500 text-white shadow-sm">
                    Session de Révision
                  </span>
                  {session.isFromExistingNotes ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                      <BookOpen className="w-3 h-3" />
                      Basé sur vos notes ({session.sourceNoteTitles?.length || 1})
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Fiche générée par l'IA
                    </span>
                  )}
                </div>
                <h2 className="text-xl font-black text-foreground">{session.topic}</h2>
              </div>

              {/* Action: Save to notes */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleSaveToNotes}
                  disabled={isSavedToNotes}
                  className={cn(
                    "flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer",
                    isSavedToNotes
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                      : "bg-secondary hover:bg-indigo-500/10 border-border hover:border-indigo-500/40 text-foreground"
                  )}
                >
                  {isSavedToNotes ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-500" />
                      <span>Enregistré dans vos notes</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 text-indigo-500" />
                      <span>Ajouter la fiche à mes Notes</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Session Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-border/80 pb-2 overflow-x-auto">
              <button
                onClick={() => setActiveSessionTab('memo')}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0",
                  activeSessionTab === 'memo'
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                )}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Fiche Mémo</span>
              </button>

              <button
                onClick={() => setActiveSessionTab('flashcards')}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0",
                  activeSessionTab === 'flashcards'
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                )}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Flashcards ({session.flashcards?.length || 0})</span>
              </button>

              <button
                onClick={() => setActiveSessionTab('quiz')}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0",
                  activeSessionTab === 'quiz'
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                )}
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>QCM & Quiz ({answeredQuiz}/{totalQuiz})</span>
              </button>

              <button
                onClick={() => setActiveSessionTab('code')}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0",
                  activeSessionTab === 'code'
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                )}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>Défis Code ({session.exercises?.length || 0})</span>
              </button>
            </div>

            {/* TAB 1: FICHE MÉMO */}
            {activeSessionTab === 'memo' && (
              <div className="p-6 rounded-2xl bg-card border border-border/80 shadow-sm flex flex-col gap-4">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <Markdown content={session.summary} />
                </div>

                {session.suggestedNote?.snippets?.[0] && (
                  <div className="mt-4 pt-4 border-t border-border/60">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Code2 className="w-3.5 h-3.5 text-indigo-500" />
                        {session.suggestedNote.snippets[0].title || "Exemple de code annoté"}
                      </span>
                      <span className="text-[10px] font-mono bg-secondary px-2 py-0.5 rounded text-muted-foreground">
                        {session.suggestedNote.snippets[0].language}
                      </span>
                    </div>
                    <pre className="p-4 rounded-xl bg-muted/50 border border-border/60 font-mono text-xs overflow-x-auto text-foreground">
                      <code>{session.suggestedNote.snippets[0].code}</code>
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: FLASHCARDS */}
            {activeSessionTab === 'flashcards' && session.flashcards && session.flashcards.length > 0 && (
              <div className="flex flex-col items-center gap-5">
                <div className="w-full flex items-center justify-between text-xs text-muted-foreground">
                  <span>Carte {currentCardIndex + 1} sur {session.flashcards.length}</span>
                  <div className="flex items-center gap-1">
                    <Award className="w-4 h-4 text-indigo-500" />
                    <span>{Object.values(masteredCards).filter(Boolean).length} / {session.flashcards.length} maîtrisées</span>
                  </div>
                </div>

                {/* Card Container with Flip */}
                {(() => {
                  const card = session.flashcards[currentCardIndex];
                  return (
                    <div
                      onClick={() => setIsCardFlipped(!isCardFlipped)}
                      className={cn(
                        "w-full min-h-[260px] p-8 rounded-3xl border transition-all duration-300 cursor-pointer flex flex-col justify-between select-none shadow-md",
                        isCardFlipped
                          ? "bg-indigo-950/20 dark:bg-indigo-950/40 border-indigo-500/40"
                          : "bg-card hover:border-indigo-500/30 border-border/80"
                      )}
                    >
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="font-semibold uppercase tracking-wider text-[10px]">
                          {isCardFlipped ? "💡 Réponse & Explication" : "❓ Question de Réflexion"}
                        </span>
                        <span className="text-[11px] text-indigo-500 font-medium flex items-center gap-1">
                          <RotateCcw className="w-3 h-3" />
                          Cliquez pour retourner
                        </span>
                      </div>

                      <div className="my-6">
                        {!isCardFlipped ? (
                          <p className="text-lg sm:text-xl font-bold text-foreground leading-snug">
                            {card.question}
                          </p>
                        ) : (
                          <div className="flex flex-col gap-3">
                            <p className="text-base sm:text-lg font-medium text-foreground leading-relaxed">
                              {card.answer}
                            </p>
                            {card.keyTakeaway && (
                              <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-600 dark:text-indigo-300 font-semibold flex items-center gap-2">
                                <Lightbulb className="w-4 h-4 shrink-0 text-amber-500" />
                                <span>À retenir : {card.keyTakeaway}</span>
                              </div>
                            )}
                            {card.codeSnippet && (
                              <pre className="p-3 rounded-lg bg-black/40 border border-border/40 font-mono text-xs overflow-x-auto mt-2">
                                <code>{card.codeSnippet}</code>
                              </pre>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-border/40 text-[11px] text-muted-foreground">
                        <span>DevNotes Memory Engine</span>
                        {masteredCards[card.id] && (
                          <span className="text-emerald-500 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Maîtrisé
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Card Controls */}
                <div className="flex items-center justify-between w-full gap-3">
                  <button
                    onClick={() => {
                      setIsCardFlipped(false);
                      setCurrentCardIndex(prev => Math.max(0, prev - 1));
                    }}
                    disabled={currentCardIndex === 0}
                    className="px-4 py-2 rounded-xl bg-secondary hover:bg-secondary/80 disabled:opacity-30 text-xs font-semibold transition-all cursor-pointer"
                  >
                    Précédent
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const card = session.flashcards[currentCardIndex];
                        setMasteredCards(prev => ({ ...prev, [card.id]: !prev[card.id] }));
                      }}
                      className={cn(
                        "px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5",
                        masteredCards[session.flashcards[currentCardIndex].id]
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                          : "bg-secondary border-border text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{masteredCards[session.flashcards[currentCardIndex].id] ? "Maîtrisé" : "Marquer comme su"}</span>
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      setIsCardFlipped(false);
                      setCurrentCardIndex(prev => Math.min(session.flashcards.length - 1, prev + 1));
                    }}
                    disabled={currentCardIndex === session.flashcards.length - 1}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-30 text-xs font-semibold transition-all cursor-pointer"
                  >
                    Suivant
                  </button>
                </div>
              </div>
            )}

            {/* TAB 3: QUIZ & QCM */}
            {activeSessionTab === 'quiz' && session.quiz && (
              <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/50 border border-border/60 text-xs">
                  <span className="font-semibold text-foreground">Score au Quiz :</span>
                  <span className="font-mono font-bold text-indigo-500">
                    {correctQuizCount} / {session.quiz.length} ({Math.round((correctQuizCount / session.quiz.length) * 100)}%)
                  </span>
                </div>

                {session.quiz.map((q, qIdx) => {
                  const isSubmitted = quizSubmitted[q.id];
                  const selectedIdx = quizAnswers[q.id];
                  const isCorrect = isSubmitted && selectedIdx === q.correctIndex;

                  return (
                    <div key={q.id} className="p-6 rounded-2xl bg-card border border-border/80 shadow-sm flex flex-col gap-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold text-xs flex items-center justify-center shrink-0">
                            {qIdx + 1}
                          </span>
                          <h3 className="text-sm font-bold text-foreground">{q.question}</h3>
                        </div>
                        {isSubmitted && (
                          <span className={cn(
                            "px-2.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1",
                            isCorrect ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                          )}>
                            {isCorrect ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                            {isCorrect ? "Correct" : "Incorrect"}
                          </span>
                        )}
                      </div>

                      {q.code && (
                        <pre className="p-3.5 rounded-xl bg-muted/50 border border-border/60 font-mono text-xs overflow-x-auto text-foreground">
                          <code>{q.code}</code>
                        </pre>
                      )}

                      {/* Options */}
                      <div className="grid grid-cols-1 gap-2.5 pt-1">
                        {q.options.map((opt, optIdx) => {
                          const isChosen = selectedIdx === optIdx;
                          const isOptionCorrect = q.correctIndex === optIdx;

                          let btnStyle = "bg-secondary/40 hover:bg-secondary border-border/60 text-foreground";
                          if (isSubmitted) {
                            if (isOptionCorrect) {
                              btnStyle = "bg-emerald-500/15 border-emerald-500/50 text-emerald-600 dark:text-emerald-300 font-semibold";
                            } else if (isChosen && !isOptionCorrect) {
                              btnStyle = "bg-rose-500/15 border-rose-500/50 text-rose-600 dark:text-rose-300 font-semibold";
                            }
                          } else if (isChosen) {
                            btnStyle = "bg-indigo-500/15 border-indigo-500 text-indigo-600 dark:text-indigo-300 font-semibold";
                          }

                          return (
                            <button
                              key={optIdx}
                              disabled={isSubmitted}
                              onClick={() => {
                                setQuizAnswers(prev => ({ ...prev, [q.id]: optIdx }));
                                setQuizSubmitted(prev => ({ ...prev, [q.id]: true }));
                              }}
                              className={cn(
                                "flex items-center gap-3 p-3.5 rounded-xl border text-left text-xs transition-all cursor-pointer",
                                btnStyle
                              )}
                            >
                              <span className="w-5 h-5 rounded-lg bg-background/60 border border-border/80 flex items-center justify-center text-[10px] font-mono shrink-0">
                                {String.fromCharCode(65 + optIdx)}
                              </span>
                              <span className="flex-1">{opt}</span>
                              {isSubmitted && isOptionCorrect && (
                                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                              )}
                              {isSubmitted && isChosen && !isOptionCorrect && (
                                <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Explanation */}
                      {isSubmitted && (
                        <div className="p-3.5 rounded-xl bg-muted/40 border border-border/40 text-xs text-muted-foreground flex flex-col gap-1 animate-in fade-in duration-300">
                          <span className="font-bold text-foreground flex items-center gap-1.5">
                            <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                            Explication :
                          </span>
                          <p className="leading-relaxed">{q.explanation}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* TAB 4: CODING CHALLENGES */}
            {activeSessionTab === 'code' && session.exercises && session.exercises.length > 0 && (
              <div className="flex flex-col gap-5">
                {/* Exercise Selector */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {session.exercises.map((ex, idx) => (
                    <button
                      key={ex.id}
                      onClick={() => setActiveExerciseIndex(idx)}
                      className={cn(
                        "flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0",
                        activeExerciseIndex === idx
                          ? "bg-indigo-500/15 border border-indigo-500 text-indigo-600 dark:text-indigo-400"
                          : "bg-secondary border border-border/60 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Code2 className="w-3.5 h-3.5" />
                      <span>{ex.title}</span>
                      {evaluations[ex.id]?.isCorrect && (
                        <CheckCircle2 className="w-3 h-3 text-emerald-500 ml-1" />
                      )}
                    </button>
                  ))}
                </div>

                {(() => {
                  const currentEx = session.exercises[activeExerciseIndex];
                  if (!currentEx) return null;
                  const currentCode = userCodes[currentEx.id] ?? currentEx.starterCode;
                  const evaluation = evaluations[currentEx.id];

                  return (
                    <div className="p-6 rounded-2xl bg-card border border-border/80 shadow-sm flex flex-col gap-4">
                      {/* Exercise Header & Instructions */}
                      <div>
                        <h3 className="text-base font-black text-foreground flex items-center gap-2">
                          <Code2 className="w-5 h-5 text-indigo-500" />
                          {currentEx.title}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed bg-muted/30 p-3 rounded-xl border border-border/40">
                          {currentEx.instructions}
                        </p>
                      </div>

                      {/* Hints Accordion */}
                      {currentEx.hints && currentEx.hints.length > 0 && (
                        <div>
                          <button
                            onClick={() => setShowHints(prev => ({ ...prev, [currentEx.id]: !prev[currentEx.id] }))}
                            className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5 hover:underline cursor-pointer"
                          >
                            <Lightbulb className="w-3.5 h-3.5" />
                            <span>{showHints[currentEx.id] ? "Masquer les indices" : "Besoin d'un indice ?"}</span>
                          </button>
                          {showHints[currentEx.id] && (
                            <ul className="mt-2 space-y-1 pl-4 list-disc text-xs text-muted-foreground">
                              {currentEx.hints.map((h, hIdx) => (
                                <li key={hIdx}>{h}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}

                      {/* Code Editor Area */}
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="font-mono text-[11px] font-bold text-foreground">Écrivez votre solution Python :</span>
                          <button
                            onClick={() => setUserCodes(prev => ({ ...prev, [currentEx.id]: currentEx.starterCode }))}
                            className="text-[11px] hover:text-foreground flex items-center gap-1 cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Réinitialiser
                          </button>
                        </div>
                        <textarea
                          value={currentCode}
                          onChange={(e) => setUserCodes(prev => ({ ...prev, [currentEx.id]: e.target.value }))}
                          rows={10}
                          className="w-full bg-[#1e1e1e] text-slate-100 font-mono text-xs p-4 rounded-xl border border-border/80 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 leading-relaxed custom-scrollbar"
                          placeholder="# Tapez votre code ici..."
                          spellCheck={false}
                        />
                      </div>

                      {/* Evaluation Result */}
                      {evaluation && (
                        <div className={cn(
                          "p-4 rounded-xl border flex flex-col gap-2 animate-in fade-in duration-300",
                          evaluation.isCorrect
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-300"
                            : "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-300"
                        )}>
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs flex items-center gap-1.5">
                              {evaluation.isCorrect ? <CheckCircle2 className="w-4 h-4" /> : <Lightbulb className="w-4 h-4" />}
                              Évaluation IA : Score {evaluation.score}/10
                            </span>
                            <span className="text-[10px] font-mono uppercase tracking-wider font-semibold">
                              {evaluation.isCorrect ? "Défi Validé !" : "À peaufiner"}
                            </span>
                          </div>
                          <p className="text-xs leading-relaxed">{evaluation.feedback}</p>
                          {evaluation.suggestion && (
                            <p className="text-[11px] font-mono text-muted-foreground mt-1">
                              💡 Conseil : {evaluation.suggestion}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Solution View */}
                      {showSolution[currentEx.id] && (
                        <div className="p-4 rounded-xl bg-muted/40 border border-border/60 flex flex-col gap-2">
                          <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            Solution recommandée :
                          </span>
                          <pre className="p-3.5 rounded-lg bg-black/60 font-mono text-xs overflow-x-auto text-emerald-400">
                            <code>{currentEx.solutionCode}</code>
                          </pre>
                          <p className="text-xs text-muted-foreground mt-1">{currentEx.explanation}</p>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex items-center justify-between pt-2 border-t border-border/60">
                        <button
                          onClick={() => setShowSolution(prev => ({ ...prev, [currentEx.id]: !prev[currentEx.id] }))}
                          className="text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1.5 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>{showSolution[currentEx.id] ? "Masquer la solution" : "Voir la solution"}</span>
                        </button>

                        <button
                          onClick={() => evaluateCodeAttempt(currentEx)}
                          disabled={isEvaluatingCode}
                          className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-500/20 disabled:opacity-50 transition-all cursor-pointer"
                        >
                          {isEvaluatingCode ? (
                            <>
                              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              <span>Vérification IA...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>Vérifier mon code avec l'IA</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
