export interface Annotation {
  id: string;
  line: number;
  endLine?: number; // Optional, for block annotations
  text: string;
  type: 'info' | 'warning' | 'tip' | 'logic' | 'debug' | 'important';
  color?: string; // The hex color code
  accentColor?: string; // The Tailwind color name or hex
  fullContext?: string;
}

export interface CodeSnippet {
  id: string;
  code: string;
  title?: string;
  language: string;
  annotations: Annotation[];
  highlightedLines: number[];
  backgroundColor?: string;
  activeAnnotationId?: string | null;
}

export interface Note {
  id: string;
  title: string;
  content: string; // Markdown content
  snippets: CodeSnippet[];
  createdAt: number;
  updatedAt: number;
  tags: string[];
  moduleId?: string | null;
}

export interface AppSettings {
  theme: 'dark' | 'light';
  fontSize: number;
  fontFamily: 'JetBrains Mono' | 'Inter' | 'Fira Code' | 'System';
  syntaxTheme: 'vscDarkPlus' | 'atomDark' | 'prism' | 'tomorrow';
}

export interface SyntaxDefinition {
  keyword: string;
  text: string;
  fullContext?: string;
  language?: string;
}

export interface Module {
  id: string;
  name: string;
  parentId?: string | null;
  createdAt: number;
}

export interface RevisionFlashcard {
  id: string;
  question: string;
  answer: string;
  keyTakeaway?: string;
  codeSnippet?: string;
}

export interface RevisionQuizItem {
  id: string;
  question: string;
  code?: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface RevisionCodingExercise {
  id: string;
  title: string;
  instructions: string;
  starterCode: string;
  solutionCode: string;
  explanation: string;
  hints?: string[];
}

export interface RevisionSession {
  id: string;
  topic: string;
  isFromExistingNotes: boolean;
  sourceNoteTitles?: string[];
  summary: string;
  flashcards: RevisionFlashcard[];
  quiz: RevisionQuizItem[];
  exercises: RevisionCodingExercise[];
  suggestedNote?: {
    title: string;
    tags: string[];
    content: string;
    snippets: {
      title?: string;
      language: string;
      code: string;
      annotations: {
        line: number;
        text: string;
        type: 'info' | 'warning' | 'tip' | 'logic' | 'debug' | 'important';
      }[];
    }[];
  };
}

