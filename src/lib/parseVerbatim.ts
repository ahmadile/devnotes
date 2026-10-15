import { Module, SyntaxDefinition } from '../types';

export interface ClientParsedNote {
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

const ANNOTATION_COLORS: Record<string, string> = {
  logic: '#6366f1',
  tip: '#10b981',
  warning: '#fbbf24',
  debug: '#06b6d4',
  important: '#f43f5e',
  info: '#3b82f6',
};

function formatContentWithSchemas(rawSummary: string): string {
  if (!rawSummary) return '';
  const lines = rawSummary.split('\n');
  const processedLines: string[] = [];
  let inFenced = false;
  let inNakedCode = false;
  let nakedCodeLang = 'python';
  let nakedCodeLines: string[] = [];
  let inAsciiBlock = false;
  let asciiBlockLines: string[] = [];

  const isBoxCharLine = (l: string) => /[│┌─┐▼▲┼├└═║╒╓╔╕╖╗╘╙╚╛╜╝╞╟╠╡╢╣╤╥╦╧╨╩╪╫╬]/.test(l);
  const isLangHeader = (l: string) => /^(python|javascript|typescript|sql|bash|sh|css|html|json)$/i.test(l.trim());
  const isMermaidHeader = (l: string) => /^(mermaid|graph\s+[A-Za-z0-9_]+|flowchart\s+[A-Za-z0-9_]+|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|gitGraph|mindmap|timeline)/i.test(l.trim());
  const isFlowStart = (l: string) => /^\[.+?\s*\|\s*.+?\s*\|\s*(?:slate|emerald|indigo|terracotta|purple|blue|zinc|rose)\]/i.test(l.trim());

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      if (inNakedCode) {
        processedLines.push('```' + nakedCodeLang);
        processedLines.push(...nakedCodeLines);
        processedLines.push('```\n');
        inNakedCode = false;
        nakedCodeLines = [];
      }
      if (inAsciiBlock) {
        processedLines.push('```text');
        processedLines.push(...asciiBlockLines);
        processedLines.push('```\n');
        inAsciiBlock = false;
        asciiBlockLines = [];
      }
      inFenced = !inFenced;
      processedLines.push(line);
      continue;
    }

    if (inFenced) {
      processedLines.push(line);
      continue;
    }

    // Detect naked Mermaid diagram
    if (!inNakedCode && !inAsciiBlock && isMermaidHeader(trimmed)) {
      inNakedCode = true;
      nakedCodeLang = 'mermaid';
      nakedCodeLines = trimmed.toLowerCase() === 'mermaid' ? [] : [line];
      continue;
    }

    // Detect naked Flow diagram
    if (!inNakedCode && !inAsciiBlock && isFlowStart(trimmed)) {
      inNakedCode = true;
      nakedCodeLang = 'flow';
      nakedCodeLines = [line];
      continue;
    }

    // Check for naked language header like "python" on its own line
    if (!inNakedCode && !inAsciiBlock && isLangHeader(trimmed)) {
      inNakedCode = true;
      nakedCodeLang = trimmed.toLowerCase();
      nakedCodeLines = [];
      continue;
    }

    if (inNakedCode) {
      if (!trimmed && i + 1 < lines.length && !lines[i + 1].startsWith(' ') && !lines[i + 1].startsWith('\t') && !lines[i + 1].startsWith('#')) {
        processedLines.push('```' + nakedCodeLang);
        processedLines.push(...nakedCodeLines);
        processedLines.push('```\n');
        inNakedCode = false;
        nakedCodeLines = [];
        processedLines.push(line);
      } else {
        nakedCodeLines.push(line);
      }
      continue;
    }

    // Detect ASCII art diagrams
    if (!inAsciiBlock && !inNakedCode && isBoxCharLine(trimmed)) {
      inAsciiBlock = true;
      asciiBlockLines = [line];
      continue;
    }

    if (inAsciiBlock) {
      if (!trimmed && i + 1 < lines.length && !isBoxCharLine(lines[i + 1])) {
        processedLines.push('```text');
        processedLines.push(...asciiBlockLines);
        processedLines.push('```\n');
        inAsciiBlock = false;
        asciiBlockLines = [];
        processedLines.push(line);
      } else {
        asciiBlockLines.push(line);
      }
      continue;
    }

    processedLines.push(line);
  }

  if (inNakedCode) {
    processedLines.push('```' + nakedCodeLang);
    processedLines.push(...nakedCodeLines);
    processedLines.push('```\n');
  }

  if (inAsciiBlock) {
    processedLines.push('```text');
    processedLines.push(...asciiBlockLines);
    processedLines.push('```\n');
  }

  return processedLines.join('\n');
}

export function parseVerbatimClient(
  input: string,
  modules: Module[] = [],
  syntaxDefinitions: Record<string, SyntaxDefinition> = {}
): ClientParsedNote {
  let title = 'Nouvelle note DevNotes';
  const tags: string[] = [];
  let moduleName = '';
  let content = '';
  let codeSnippetTitle = '';
  let codeLanguage = 'python';
  const rawLineAnnotations: { marker: string; text: string }[] = [];

  const lines = input.split('\n');
  let currentSection: 'none' | 'title' | 'tags' | 'summary' | 'code_block' | 'annotations' = 'none';
  const summaryLines: string[] = [];
  const codeLines: string[] = [];
  let isInsideFencedCode = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('🔵 Titre')) {
      currentSection = 'title';
      continue;
    }
    if (trimmed.startsWith('🟡 Tags')) {
      currentSection = 'tags';
      continue;
    }
    if (trimmed.startsWith('🟢 Résumé')) {
      currentSection = 'summary';
      continue;
    }
    if (trimmed.startsWith('🔴 Bloc logique du code') || trimmed.startsWith('🔴 Bloc logique')) {
      currentSection = 'code_block';
      continue;
    }
    if (trimmed.startsWith('⚫')) {
      currentSection = 'annotations';
      rawLineAnnotations.push({ marker: trimmed, text: trimmed.replace(/^⚫\s*/, '') });
      continue;
    }

    if (currentSection === 'title') {
      if (trimmed && (title === 'Nouvelle note DevNotes' || !title)) {
        title = trimmed;
      }
    } else if (currentSection === 'tags') {
      if (trimmed) {
        const parsed = trimmed.split(/[,;]/).map(t => t.trim().replace(/^#/, '')).filter(Boolean);
        tags.push(...parsed);
      }
    } else if (currentSection === 'summary') {
      summaryLines.push(line);
    } else if (currentSection === 'code_block') {
      if (trimmed.startsWith('⚪ Titre :') || trimmed.startsWith('⚪ Titre:')) {
        codeSnippetTitle = trimmed.replace(/^⚪ Titre\s*:\s*/, '');
      } else if (trimmed.startsWith('```')) {
        isInsideFencedCode = !isInsideFencedCode;
        const match = trimmed.match(/```(\w+)/);
        if (match) codeLanguage = match[1];
      } else if (['python', 'javascript', 'typescript', 'html', 'css', 'sql', 'bash', 'json'].includes(trimmed.toLowerCase())) {
        codeLanguage = trimmed.toLowerCase();
      } else {
        codeLines.push(line);
      }
    } else if (currentSection === 'annotations') {
      if (trimmed && rawLineAnnotations.length > 0) {
        rawLineAnnotations[rawLineAnnotations.length - 1].text += ' ' + trimmed;
      }
    }
  }

  // If title was not explicitly set via 🔵 Titre, detect from Markdown headings (# Title) or first line
  if (title === 'Nouvelle note DevNotes' || !title) {
    const headingMatch = input.match(/^#+\s*(.+)$/m);
    if (headingMatch) {
      title = headingMatch[1].trim();
    } else {
      const firstLine = lines.find(l => l.trim() && !l.trim().startsWith('```') && !l.trim().startsWith('🟡') && !l.trim().startsWith('🟢') && !l.trim().startsWith('🔴'));
      if (firstLine) {
        title = firstLine.trim().slice(0, 80);
      }
    }
  }

  // If no code was found in 🔴 Bloc logique, auto-extract real code block from input (skipping diagrams/flow)
  if (codeLines.length === 0) {
    const codeBlockRegex = /```([a-zA-Z0-9_\-]+)?\s*\n([\s\S]*?)```/g;
    let match: RegExpExecArray | null;
    let fallbackBlock: { lang: string; code: string } | null = null;
    let preferredBlock: { lang: string; code: string } | null = null;

    while ((match = codeBlockRegex.exec(input)) !== null) {
      const lang = (match[1] || 'python').toLowerCase();
      const code = match[2];
      if (['flow', 'text', 'ascii', 'schema', 'mermaid'].includes(lang)) {
        continue;
      }
      if (['python', 'py', 'javascript', 'js', 'typescript', 'ts', 'sql', 'bash', 'sh'].includes(lang)) {
        preferredBlock = { lang, code };
        break;
      }
      if (!fallbackBlock) {
        fallbackBlock = { lang, code };
      }
    }

    const chosen = preferredBlock || fallbackBlock;
    if (chosen) {
      codeLanguage = chosen.lang === 'py' ? 'python' : chosen.lang === 'js' ? 'javascript' : chosen.lang === 'ts' ? 'typescript' : chosen.lang;
      const extracted = chosen.code.split('\n');
      codeLines.push(...extracted);
      if (!codeSnippetTitle) {
        codeSnippetTitle = `Code — ${title}`;
      }
    }
  }

  // Auto-extract tags from #hashtags in input if none provided
  if (tags.length === 0) {
    const tagMatches = input.match(/(?:^|\s)#([a-zA-Z0-9_\-]+)/g);
    if (tagMatches) {
      tags.push(...tagMatches.map(t => t.trim().replace(/^#/, '')));
    }
  }

  // Clean leading and trailing blank lines from code
  while (codeLines.length > 0 && !codeLines[0].trim()) {
    codeLines.shift();
  }
  while (codeLines.length > 0 && !codeLines[codeLines.length - 1].trim()) {
    codeLines.pop();
  }

  // Verbatim summary: format with proper code block fences, headings and schemas
  content = formatContentWithSchemas(summaryLines.join('\n')).trim();
  if (!content) {
    content = formatContentWithSchemas(input).trim();
  }

  const codeText = codeLines.join('\n');

  // Auto-match module safely if one matches title or tags
  if (modules && Array.isArray(modules) && modules.length > 0) {
    const matched = modules.find(m => {
      if (!m || typeof m.name !== 'string') return false;
      const mName = m.name.toLowerCase();
      return (title && typeof title === 'string' && title.toLowerCase().includes(mName)) || 
             tags.some(t => typeof t === 'string' && t.toLowerCase() === mName);
    });
    if (matched) {
      moduleName = matched.name;
    }
  }

  // Parse annotations
  const rawAnnotations: {
    line: number;
    endLine?: number;
    text: string;
    fullContext?: string;
    type: 'info' | 'warning' | 'tip' | 'logic' | 'debug' | 'important';
    color?: string;
  }[] = [];

  // Auto-detect section markers if none explicit
  if (rawLineAnnotations.length === 0 && codeLines.length > 0) {
    for (let i = 0; i < codeLines.length; i++) {
      const cLine = codeLines[i].trim();
      const sectionMatch = cLine.match(/#\s*(?:---\s*)?(\d+[\.\)\-][^-]+)(?:---)?/);
      if (sectionMatch) {
        const sectionTitle = sectionMatch[1].trim();
        rawLineAnnotations.push({
          marker: `⚫ Ligne ${i + 1}`,
          text: `Ligne ${i + 1} : ${sectionTitle} — Étape clé du code.`,
        });
      } else if (cLine.startsWith('def ') || cLine.startsWith('class ')) {
        const defMatch = cLine.match(/(?:def|class)\s+([a-zA-Z0-9_]+)/);
        if (defMatch) {
          rawLineAnnotations.push({
            marker: `⚫ Ligne ${i + 1}`,
            text: `Ligne ${i + 1} : ${cLine.startsWith('def') ? 'Fonction' : 'Classe'} \`${defMatch[1]}\` — Point d'entrée logique.`,
          });
        }
      }
    }
  }

  for (let idx = 0; idx < rawLineAnnotations.length; idx++) {
    const fullText = rawLineAnnotations[idx].text;
    let shortTitle = fullText;
    let fullContext = '';

    if (fullText.includes(' — ')) {
      const parts = fullText.split(' — ');
      shortTitle = parts[0].trim();
      fullContext = parts.slice(1).join(' — ').trim();
    } else if (fullText.includes(' : ')) {
      const parts = fullText.split(' : ');
      shortTitle = parts[0].trim();
      fullContext = parts.slice(1).join(' : ').trim();
    }

    let explicitLine: number | undefined = undefined;
    let explicitEndLine: number | undefined = undefined;
    const lineNumMatch = shortTitle.match(/Ligne\s+(\d+)(?:\s*-\s*(\d+))?/i);
    if (lineNumMatch) {
      explicitLine = parseInt(lineNumMatch[1], 10);
      if (lineNumMatch[2]) {
        explicitEndLine = parseInt(lineNumMatch[2], 10);
      }
    }

    let type: 'info' | 'warning' | 'tip' | 'logic' | 'debug' | 'important' = 'logic';
    const lowerFull = fullText.toLowerCase();
    if (lowerFull.includes('piège') || lowerFull.includes('erreur') || lowerFull.includes('attention')) {
      type = 'warning';
    } else if (lowerFull.includes('crucial') || lowerFull.includes('important')) {
      type = 'important';
    } else if (lowerFull.includes('astuce') || lowerFull.includes('conseil')) {
      type = 'tip';
    }

    rawAnnotations.push({
      line: explicitLine || (idx + 1),
      endLine: explicitEndLine || explicitLine || (idx + 1),
      text: shortTitle,
      fullContext: fullContext || fullText,
      type,
      color: ANNOTATION_COLORS[type],
    });
  }

  // Cross-reference existing syntax definitions
  const syntaxKeys = Object.keys(syntaxDefinitions || {});
  if (syntaxKeys.length > 0) {
    const fullSearchText = (input + ' ' + codeText).toLowerCase();
    syntaxKeys.forEach(key => {
      const cleanKey = key.trim().toLowerCase();
      if (cleanKey && fullSearchText.includes(cleanKey)) {
        if (!tags.some(t => t.toLowerCase() === cleanKey)) {
          tags.push(key);
        }
      }
    });
  }

  const uniqueTags = Array.from(new Set(tags.map(t => t.replace(/^#/, '').trim()))).filter(Boolean);

  const snippets: ClientParsedNote['snippets'] = [];
  if (codeText.trim()) {
    snippets.push({
      title: codeSnippetTitle || `Code — ${title}`,
      language: codeLanguage || 'python',
      code: codeText,
      annotations: rawAnnotations,
    });
  }

  return {
    title: title || 'Nouvelle note DevNotes',
    tags: uniqueTags.length > 0 ? uniqueTags : ['note'],
    moduleName: moduleName || undefined,
    content,
    snippets,
  };
}
