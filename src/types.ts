export interface Annotation {
  id: string;
  line: number;
  endLine?: number; // Optional, for block annotations
  text: string;
  type: 'info' | 'warning' | 'tip' | 'logic' | 'debug' | 'important';
  color?: string; // The hex color code
  accentColor?: string; // The Tailwind color name or hex
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
}

export interface AppSettings {
  theme: 'dark' | 'cyberpunk' | 'minimal';
  fontSize: number;
  fontFamily: string;
  syntaxTheme: string;
}
