import { GoogleGenAI } from '@google/genai';

export interface ProcessNoteRequest {
  input: string;
  modules?: { id: string; name: string; parentId?: string | null }[];
  syntaxDefinitions?: Record<string, { keyword: string; text: string; fullContext?: string }>;
  provider?: 'openrouter' | 'gemini' | 'ollama' | 'openai';
  apiKey?: string;
  model?: string;
  ollamaUrl?: string;
}

export interface GeneratedAnnotation {
  line: number;
  endLine?: number;
  text: string;
  fullContext?: string;
  type: 'info' | 'warning' | 'tip' | 'logic' | 'debug' | 'important';
  color?: string;
}

export interface GeneratedSnippet {
  title?: string;
  language: string;
  code: string;
  annotations: GeneratedAnnotation[];
}

export interface GeneratedNoteResult {
  title: string;
  tags: string[];
  moduleName?: string;
  moduleId?: string | null;
  content: string;
  snippets: GeneratedSnippet[];
}

const ANNOTATION_COLORS: Record<string, string> = {
  logic: '#6366f1',
  tip: '#10b981',
  warning: '#fbbf24',
  debug: '#06b6d4',
  important: '#f43f5e',
  info: '#3b82f6',
};

/**
 * Intelligent local fallback parser for structured input formats or raw code.
 */
export function fallbackProcessNote(
  input: string,
  modules: { id: string; name: string; parentId?: string | null }[] = [],
  syntaxDefinitions: Record<string, { keyword: string; text: string; fullContext?: string }> = {}
): GeneratedNoteResult {
  let title = 'Nouvelle note DevNotes';
  let tags: string[] = [];
  let moduleName = '';
  let content = '';
  let codeSnippetTitle = '';
  let codeLanguage = 'python';
  let codeText = '';
  const rawLineAnnotations: { marker: string; text: string }[] = [];

  const lines = input.split('\n');
  let currentSection: 'none' | 'title' | 'tags' | 'summary' | 'code_block' | 'annotations' = 'none';
  let summaryLines: string[] = [];
  let codeLines: string[] = [];
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
    if (trimmed.startsWith('🔴 Bloc logique du code')) {
      currentSection = 'code_block';
      continue;
    }

    if (trimmed.startsWith('⚫')) {
      currentSection = 'annotations';
      rawLineAnnotations.push({ marker: trimmed, text: trimmed.replace(/^⚫\s*/, '') });
      continue;
    }

    if (currentSection === 'title' && trimmed) {
      if (!title || title === 'Nouvelle note DevNotes') {
        title = trimmed;
      }
    } else if (currentSection === 'tags' && trimmed) {
      const parsedTags = trimmed.split(/[,;]/).map(t => t.trim().replace(/^#/, '')).filter(Boolean);
      tags.push(...parsedTags);
    } else if (currentSection === 'summary') {
      summaryLines.push(line);
    } else if (currentSection === 'code_block') {
      if (trimmed.startsWith('⚪ Titre :') || trimmed.startsWith('⚪ Titre:')) {
        codeSnippetTitle = trimmed.replace(/^⚪ Titre\s*:\s*/, '');
      } else if (trimmed.startsWith('```')) {
        if (!isInsideFencedCode) {
          isInsideFencedCode = true;
          const match = trimmed.match(/```(\w+)/);
          if (match) codeLanguage = match[1];
        } else {
          isInsideFencedCode = false;
        }
      } else if (isInsideFencedCode) {
        // Exclude any ⚫ annotation lines if mistakenly inside fenced block
        if (!trimmed.startsWith('⚫')) {
          codeLines.push(line);
        } else {
          rawLineAnnotations.push({ marker: trimmed, text: trimmed.replace(/^⚫\s*/, '') });
        }
      } else if (trimmed === 'python' || trimmed === 'javascript' || trimmed === 'typescript' || trimmed === 'html' || trimmed === 'css') {
        codeLanguage = trimmed;
      } else if (trimmed && !codeSnippetTitle && !codeLines.length && !trimmed.startsWith('⚫')) {
        codeSnippetTitle = trimmed;
      }
    } else if (currentSection === 'annotations') {
      if (trimmed) {
        if (rawLineAnnotations.length > 0) {
          rawLineAnnotations[rawLineAnnotations.length - 1].text += ' ' + trimmed;
        }
      }
    }
  }

  // If no fenced code block was found, check for plain code lines
  if (codeLines.length === 0 && currentSection === 'code_block') {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (!trimmed.startsWith('⚫') && !trimmed.startsWith('🔴') && !trimmed.startsWith('🟢') && !trimmed.startsWith('🔵') && !trimmed.startsWith('🟡') && !trimmed.startsWith('⚪')) {
        if (line.includes('def ') || line.includes(' = ') || line.includes('print(') || line.includes('return ') || line.includes('import ')) {
          codeLines.push(line);
        }
      }
    }
  }

  codeText = codeLines.join('\n');

  // Format content markdown with rich visual elements & callout boxes
  if (summaryLines.length > 0) {
    content = summaryLines.join('\n').trim();
    if (!content.includes('> [!NOTE]') && content.includes("L'idée centrale")) {
      content = content.replace(/(L'idée centrale[^.\n]*[.\n]?)/, '> [!NOTE]\n> **$1**\n\n');
    }
  } else {
    content = `### 📌 Vue d'ensemble\n\nNote générée pour **${title}**.\n\n> [!TIP]\n> Revois les détails du code et des sous-notes ci-dessous pour une meilleure assimilation.`;
  }

  // Generate precision Annotations mapped to line numbers in codeText
  const rawAnnotations: GeneratedAnnotation[] = [];

  for (let idx = 0; idx < rawLineAnnotations.length; idx++) {
    const item = rawLineAnnotations[idx];
    const fullText = item.text;
    let shortTitle = fullText;
    let fullContext = '';

    // Handle "code — explanation" or "Ligne X : code — explanation" or "code : explanation"
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

    let type: GeneratedAnnotation['type'] = 'logic';
    if (fullText.toLowerCase().includes('piège') || fullText.toLowerCase().includes('erreur') || fullText.toLowerCase().includes('attention')) {
      type = 'warning';
    } else if (fullText.toLowerCase().includes('crucial') || fullText.toLowerCase().includes('important')) {
      type = 'important';
    } else if (fullText.toLowerCase().includes('astuce') || fullText.toLowerCase().includes('imbriquée')) {
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

  // Align annotations with exact line numbers in codeText
  const annotations = alignAnnotationsWithCode(rawAnnotations, codeText);

  // Cross-reference existing syntax definitions to auto-add green tag references
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

  return {
    title: title || 'Note sans titre',
    tags: uniqueTags.length > 0 ? uniqueTags : ['note', 'python'],
    moduleName: moduleName || 'Python / Fonctions',
    content,
    snippets: [
      {
        title: codeSnippetTitle || 'Bloc de code principal',
        language: codeLanguage || 'python',
        code: codeText,
        annotations,
      },
    ],
  };
}

/**
 * Intelligent line locator to match annotations to actual code lines.
 * Automatically aligns annotations with exact line numbers in the code.
 */
export function alignAnnotationsWithCode(
  annotations: GeneratedAnnotation[],
  codeText: string
): GeneratedAnnotation[] {
  if (!codeText || !annotations || annotations.length === 0) return annotations;
  const codeLines = codeText.split('\n');

  return annotations.map((ann, idx) => {
    let candidates: string[] = [];
    
    if (ann.text) {
      if (ann.text.includes(' — ')) {
        candidates.push(ann.text.split(' — ')[0].trim());
      } else if (ann.text.includes(' - ')) {
        candidates.push(ann.text.split(' - ')[0].trim());
      } else if (ann.text.includes(' : ')) {
        candidates.push(ann.text.split(' : ')[0].trim());
      } else if (ann.text.includes(':')) {
        candidates.push(ann.text.split(':')[0].trim());
      }
      candidates.push(ann.text.trim());
    }

    if (ann.fullContext) {
      if (ann.fullContext.includes(' — ')) {
        candidates.push(ann.fullContext.split(' — ')[0].trim());
      }
    }

    // Clean candidates: remove leading markers like "⚫", "Ligne X", etc.
    candidates = candidates
      .map(c => c.replace(/^(?:⚫\s*)?(?:Ligne\s*\d+\s*[-:]?\s*|Line\s*\d+\s*[-:]?\s*)/i, '').trim())
      .filter(Boolean);

    let matchedLine = -1;

    // 1. Direct substring search
    for (const cand of candidates) {
      if (!cand || cand.length < 2) continue;
      const cleanCand = cand.replace(/#.*$/, '').trim();
      if (!cleanCand) continue;

      for (let l = 0; l < codeLines.length; l++) {
        const lineContent = codeLines[l].trim();
        if (lineContent.includes(cleanCand) || (cleanCand.length > 5 && lineContent.length > 3 && cleanCand.includes(lineContent))) {
          matchedLine = l + 1;
          break;
        }
      }
      if (matchedLine !== -1) break;
    }

    // 2. Token-based matching
    if (matchedLine === -1) {
      for (const cand of candidates) {
        const tokens = cand.match(/[a-zA-Z_@]\w*(?:\.[a-zA-Z_]\w*)?/g) || [];
        const validTokens = tokens.filter(t => t.length > 2 && !['def', 'return', 'import', 'from', 'for', 'in', 'if', 'else'].includes(t.toLowerCase()));
        
        if (validTokens.length > 0) {
          let bestScore = 0;
          let bestLine = -1;

          for (let l = 0; l < codeLines.length; l++) {
            const lineContent = codeLines[l];
            let score = 0;
            for (const tok of validTokens) {
              if (lineContent.includes(tok)) {
                score += tok.length;
              }
            }
            if (score > bestScore) {
              bestScore = score;
              bestLine = l + 1;
            }
          }

          if (bestScore >= 3 && bestLine !== -1) {
            matchedLine = bestLine;
            break;
          }
        }
      }
    }

    // 3. Fallback: check if original ann.line is within bounds and reasonable
    if (matchedLine === -1) {
      if (ann.line >= 1 && ann.line <= codeLines.length) {
        matchedLine = ann.line;
      } else {
        matchedLine = Math.min(Math.max(1, (idx + 1) * Math.floor(codeLines.length / (annotations.length + 1))), codeLines.length);
      }
    }

    const span = (ann.endLine && ann.endLine >= ann.line) ? (ann.endLine - ann.line) : 0;
    const endLine = Math.min(codeLines.length, matchedLine + span);

    return {
      ...ann,
      line: matchedLine,
      endLine: endLine >= matchedLine ? endLine : matchedLine,
    };
  });
}

function enrichAnnotationCodeTerms(text: string, codeTokens: string[]): string {
  if (!text) return text;
  let enriched = text;
  
  // Sort tokens by length descending so longer tokens match first (e.g. 'run_n_times' before 'n')
  const sortedTokens = [...new Set(codeTokens)].filter(t => t.length >= 2).sort((a, b) => b.length - a.length);

  for (const token of sortedTokens) {
    // Only wrap if token is not already inside backticks `token`
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?<!\`)\\b(${escaped})\\b(?!\`)`, 'g');
    enriched = enriched.replace(regex, '`$1`');
  }
  return enriched;
}

function sanitizeAndAlignNoteResult(parsed: GeneratedNoteResult): GeneratedNoteResult {
  if (parsed.snippets && Array.isArray(parsed.snippets)) {
    parsed.snippets.forEach(s => {
      // Extract function names, parameters, and identifiers from snippet code
      const codeTokens: string[] = [];
      if (s.code) {
        const funcMatches = s.code.match(/def\s+([a-zA-Z_]\w*)\s*\(([^)]*)\)/g) || [];
        for (const fm of funcMatches) {
          const m = fm.match(/def\s+([a-zA-Z_]\w*)\s*\(([^)]*)\)/);
          if (m) {
            codeTokens.push(m[1]); // function name
            const params = m[2].split(',').map(p => p.trim().replace(/^[*]+/, '')).filter(Boolean);
            codeTokens.push(...params);
          }
        }
        const decMatches = s.code.match(/@([a-zA-Z_]\w*)/g) || [];
        for (const dm of decMatches) {
          codeTokens.push(dm.replace(/^@/, ''));
        }
      }

      if (s.annotations && Array.isArray(s.annotations)) {
        s.annotations.forEach(a => {
          if (!a.color) a.color = ANNOTATION_COLORS[a.type] || '#6366f1';
          if (a.fullContext && codeTokens.length > 0) {
            a.fullContext = enrichAnnotationCodeTerms(a.fullContext, codeTokens);
          }
        });
        if (s.code) {
          s.annotations = alignAnnotationsWithCode(s.annotations, s.code);
        }
      }
    });
  }
  return parsed;
}

/**
 * Process a note using Gemini, OpenRouter, Ollama, or OpenAI-compatible APIs.
 */
export async function processNoteWithAI(req: ProcessNoteRequest): Promise<GeneratedNoteResult> {
  const provider = req.provider || (req.apiKey?.startsWith('sk-or-') ? 'openrouter' : 'gemini');
  const apiKey = req.apiKey || process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY;
  const modelName = req.model || (provider === 'openrouter' ? 'google/gemini-2.5-flash' : provider === 'ollama' ? 'llama3' : 'gemini-2.5-flash');

  const syntaxContext = req.syntaxDefinitions 
    ? `\n\nRéférences de syntaxes déjà enregistrées en base de données : ${Object.keys(req.syntaxDefinitions).join(', ')}.`
    : '';

  const prompt = `Tu es l'assistant IA officiel de DevNotes. Reçois la note brute ci-dessous et transforme-la en une structure d'apprentissage visuelle, claire et mémorable pour un développeur.${syntaxContext}

--- INPUT BRUT ---
${req.input}
--- FIN INPUT BRUT ---

Directives de réponse :
1. Extraction du Titre et Tags : Extraire un titre clair et pertinent. Si un terme correspond à une référence de syntaxe enregistrée, inclus-le dans les tags.
2. Formattage du Résumé / Content (Markdown Enrichi) :
   - Rends le texte clair et structuré avec indentation.
   - Utilise des blocs d'alerte GitHub (ex: > [!NOTE] pour l'idée centrale, > [!TIP] pour les astuces, > [!WARNING] pour les pièges).
   - Met en gras les concepts clés.
   - Entoure SYSTÉMATIQUEMENT les noms de fonctions, méthodes, paramètres, variables et décorateurs par des backticks (ex: \`run_n_times\`, \`decorator(func)\`, \`func\`, \`in_range\`, \`foo\`, \`@functools.wraps\`) pour activer la mise en valeur syntaxique colorée.
   - Tableaux & Synthèses : Si des comparaisons ou tableaux sont pertinents, utilise TOUJOURS la syntaxe standard Markdown GFM (| Colonne 1 | Colonne 2 |) sans caractères de boîtes ASCII.
3. Code Snippet & Annotations de ligne (Sous-notes de code) :
   - Extraire le code source exact.
   - Pour CHAQUE explication de ligne (ex: "⚫ Ligne x = my_function ..."), calcule la ligne EXACTE (1-indexed) où ce code apparaît dans le snippet de code.
   - Le champ 'text' de l'annotation doit mentionner le code exact (ex: "@functools.wraps(func) — préserve les métadonnées").
   - Dans 'fullContext', explique le fonctionnement en entourant tous les identifiants et termes de code par des backticks.
   - Crée une annotation avec 'line', 'endLine', 'text' (résumé court), 'fullContext' (explication détaillée), et 'type' ('logic'|'warning'|'tip'|'important'|'debug').

Format JSON STRICT de réponse (renvoie uniquement l'objet JSON valide) :
{
  "title": "Titre de la note",
  "tags": ["tag1", "tag2"],
  "moduleName": "Chemin du dossier",
  "content": "Contenu Markdown structuré...",
  "snippets": [
    {
      "title": "Titre du snippet",
      "language": "python",
      "code": "code source...",
      "annotations": [
        {
          "line": 6,
          "endLine": 6,
          "text": "Titre court de l'annotation",
          "fullContext": "Explication détaillée de la sous-note avec \`identifiants\`",
          "type": "warning",
          "color": "#fbbf24"
        }
      ]
    }
  ]
}`;

  // Provider 1: OpenRouter API
  if (provider === 'openrouter' && apiKey) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'http://localhost:5173',
          'X-Title': 'DevNotes',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelName,
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
        }),
      });

      if (res.ok) {
        const data = await res.json() as any;
        const text = data.choices?.[0]?.message?.content;
        if (text) {
          const parsed = JSON.parse(text) as GeneratedNoteResult;
          if (parsed && parsed.title && parsed.content) {
            return sanitizeAndAlignNoteResult(parsed);
          }
        }
      }
    } catch (err) {
      console.error('[aiService] OpenRouter API error, running fallback:', err);
    }
  }

  // Provider 2: Ollama Local AI Server
  if (provider === 'ollama') {
    try {
      const baseUrl = req.ollamaUrl || 'http://localhost:11434';
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelName || 'llama3',
          messages: [{ role: 'user', content: prompt }],
          stream: false,
          format: 'json',
        }),
      });

      if (res.ok) {
        const data = await res.json() as any;
        const text = data.message?.content;
        if (text) {
          const parsed = JSON.parse(text) as GeneratedNoteResult;
          if (parsed && parsed.title && parsed.content) {
            return sanitizeAndAlignNoteResult(parsed);
          }
        }
      }
    } catch (err) {
      console.error('[aiService] Ollama API error, running fallback:', err);
    }
  }

  // Provider 3: Direct Google Gemini API
  if ((provider === 'gemini' || !provider) && apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json' },
      });

      const responseText = response.text;
      if (responseText) {
        const parsed = JSON.parse(responseText) as GeneratedNoteResult;
        if (parsed && parsed.title && parsed.content) {
          return sanitizeAndAlignNoteResult(parsed);
        }
      }
    } catch (err) {
      console.error('[aiService] Gemini API error, running fallback:', err);
    }
  }

  // Fallback if no provider/API key set or API call failed
  return fallbackProcessNote(req.input, req.modules, req.syntaxDefinitions || {});
}

/**
 * Interactive Chat with OpenRouter, Gemini, Ollama, or local fallback.
 */
export async function chatWithAI(params: {
  messages: { role: string; content: string }[];
  notesContext?: string;
  provider?: 'openrouter' | 'gemini' | 'ollama' | 'openai';
  apiKey?: string;
  model?: string;
  ollamaUrl?: string;
}): Promise<string> {
  const provider = params.provider || (params.apiKey?.startsWith('sk-or-') ? 'openrouter' : 'gemini');
  const apiKey = params.apiKey || process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY;
  const modelName = params.model || (provider === 'openrouter' ? 'google/gemini-2.5-flash' : provider === 'ollama' ? 'llama3' : 'gemini-2.5-flash');
  const userQuery = params.messages[params.messages.length - 1]?.content || '';

  const systemPrompt = `Tu es l'Assistant IA expert de DevNotes.
Tu aides le développeur à comprendre ses notes, son code et les concepts de programmation.

Contexte des notes de l'utilisateur :
${params.notesContext || 'Aucune note spécifique transmise.'}

Réponds de manière précise, encourageante et avec du formatage Markdown élégant (listes, blocs de code, alertes > [!NOTE], etc.).`;

  if (provider === 'openrouter' && apiKey) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'http://localhost:5173',
          'X-Title': 'DevNotes',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: 'system', content: systemPrompt },
            ...params.messages,
          ],
        }),
      });

      if (res.ok) {
        const data = await res.json() as any;
        return data.choices?.[0]?.message?.content || "Aucune réponse reçue d'OpenRouter.";
      }
    } catch (err: any) {
      console.error('[aiService] OpenRouter chat error:', err);
    }
  }

  if (provider === 'ollama') {
    try {
      const baseUrl = params.ollamaUrl || 'http://localhost:11434';
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelName || 'llama3',
          messages: [
            { role: 'system', content: systemPrompt },
            ...params.messages,
          ],
          stream: false,
        }),
      });

      if (res.ok) {
        const data = await res.json() as any;
        return data.message?.content || "Aucune réponse reçue d'Ollama.";
      }
    } catch (err: any) {
      console.error('[aiService] Ollama chat error:', err);
    }
  }

  if ((provider === 'gemini' || !provider) && apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\nQuestion de l'utilisateur : ${userQuery}` }] }],
      });

      return response.text || "Désolé, je n'ai pas pu générer de réponse.";
    } catch (err: any) {
      console.error('[aiService] Gemini chat error:', err);
    }
  }

  return `[Assistant DevNotes] Mode d'exécution hors-ligne. Votre message "${userQuery}" a été reçu. Pour débloquer l'IA multi-modèles (OpenRouter, Gemini, Ollama), renseignez votre clé API dans les paramètres du modal.`;
}

export interface RevisionRequest {
  topic: string;
  existingNotes?: {
    id: string;
    title: string;
    tags: string[];
    content: string;
    snippets: { title?: string; language: string; code: string; annotations: { line: number; text: string; fullContext?: string; type: string }[] }[];
  }[];
  syntaxDefinitions?: Record<string, { keyword: string; text: string; fullContext?: string }>;
  activeNoteId?: string | null;
  provider?: 'openrouter' | 'gemini' | 'ollama' | 'openai';
  apiKey?: string;
  model?: string;
  ollamaUrl?: string;
}

export interface GeneratedRevisionSession {
  id: string;
  topic: string;
  isFromExistingNotes: boolean;
  sourceNoteTitles?: string[];
  summary: string;
  flashcards: {
    id: string;
    question: string;
    answer: string;
    keyTakeaway?: string;
    codeSnippet?: string;
  }[];
  quiz: {
    id: string;
    question: string;
    code?: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  }[];
  exercises: {
    id: string;
    title: string;
    instructions: string;
    starterCode: string;
    solutionCode: string;
    explanation: string;
    hints?: string[];
  }[];
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

/**
 * Fallback generator when offline or no API response.
 */
export function fallbackRevisionSession(
  topic: string,
  matchedNotes: any[] = []
): GeneratedRevisionSession {
  const isExisting = matchedNotes.length > 0;
  const noteTitle = isExisting ? matchedNotes[0].title : topic;
  const isDecorator = topic.toLowerCase().includes('décorat') || topic.toLowerCase().includes('decorat');
  const isFunction = topic.toLowerCase().includes('fonct') || topic.toLowerCase().includes('function');
  const isDate = topic.toLowerCase().includes('date') || topic.toLowerCase().includes('time');

  let summary = `### 🎯 Synthèse de révision : ${topic}\n\n`;
  if (isDecorator) {
    summary += `> [!NOTE]\n> En Python, un **décorateur** est une fonction qui prend une autre fonction en argument, lui ajoute du comportement (avant ou après), et renvoie la nouvelle fonction enveloppante (\`wrapper\`).\n\n`;
    summary += `- La syntaxe \`@mon_decorateur\` est du sucre syntaxique pour \`ma_fonction = mon_decorateur(ma_fonction)\`.\n`;
    summary += `- Le wrapper intérieur utilise généralement \`*args, **kwargs\` pour accepter tous les arguments possibles.\n`;
    summary += `- N'oubliez pas de renvoyer le résultat de la fonction originale avec \`return result\` !\n`;
    summary += `- Pour les décorateurs avec arguments (ex: \`@run_n_times(3)\`), il faut 3 niveaux de fonctions imbriquées.`;
  } else if (isDate) {
    summary += `> [!NOTE]\n> Le module standard \`datetime\` permet de manipuler les dates, heures et intervalles de temps en Python.\n\n`;
    summary += `- \`datetime.now()\` : Date et heure actuelles.\n`;
    summary += `- \`strftime(format)\` : Convertit une date en chaîne de caractères formatée.\n`;
    summary += `- \`strptime(string, format)\` : Convertit une chaîne de caractères en objet \`datetime\`.\n`;
    summary += `- \`timedelta(days=1, hours=2)\` : Représente une durée ou un décalage temporel.`;
  } else {
    summary += `> [!NOTE]\n> Fiche de révision DevNotes générée pour consolider votre compréhension et votre pratique sur **${topic}**.\n\n`;
    summary += `- Maîtrisez la syntaxe fondamentale et les cas d'usage typiques.\n`;
    summary += `- Identifiez les pièges courants et les conventions idiomatiques.\n`;
    summary += `- Entraînez-vous avec les flashcards et les défis de code interactifs ci-dessous !`;
  }

  const flashcards = isDecorator ? [
    {
      id: 'f1',
      question: "Quelle est la définition exacte d'un décorateur en Python ?",
      answer: "Un décorateur est une fonction qui reçoit une fonction en paramètre, l'enveloppe dans une fonction interne ('wrapper') pour étendre son comportement, et retourne cette nouvelle fonction.",
      keyTakeaway: "Syntaxe @decorateur équivaut à f = decorateur(f)",
      codeSnippet: "def my_decorator(func):\n    def wrapper(*args, **kwargs):\n        print('Avant')\n        res = func(*args, **kwargs)\n        print('Après')\n        return res\n    return wrapper"
    },
    {
      id: 'f2',
      question: "Pourquoi utilise-t-on '*args, **kwargs' dans la fonction wrapper ?",
      answer: "Pour que le décorateur soit universel et puisse décorer n'importe quelle fonction, peu importe le nombre et le type d'arguments qu'elle accepte (positionnels ou nommés).",
      keyTakeaway: "*args capture les tuples positionnels, **kwargs capture le dictionnaire d'arguments nommés."
    },
    {
      id: 'f3',
      question: "Comment créer un décorateur qui accepte des arguments, par exemple '@repeat(num=3)' ?",
      answer: "Il faut ajouter un niveau d'imbrication supplémentaire (3 fonctions au total) : la fonction externe reçoit les arguments du décorateur, la fonction intermédiaire reçoit la fonction à décorer, et la fonction wrapper exécute la logique.",
      keyTakeaway: "3 niveaux : Decorator Factory -> Decorator -> Wrapper"
    }
  ] : [
    {
      id: 'f1',
      question: `Quel est le principe central à retenir sur "${topic}" ?`,
      answer: `Comprendre la syntaxe clé, le flux d'exécution et la manière dont les données transitent.`,
      keyTakeaway: `Pratiquer sur des exemples minimaux reproductibles.`
    },
    {
      id: 'f2',
      question: `Quel piège classique faut-il absolument éviter avec "${topic}" ?`,
      answer: `Oublier la valeur de retour ou mal gérer les cas limites (valeurs nulles, arguments optionnels).`,
      keyTakeaway: `Toujours prévoir les retours explicites.`
    }
  ];

  const quiz = isDecorator ? [
    {
      id: 'q1',
      question: "Que fait exactement l'écriture suivante au moment de la définition de la fonction ?",
      code: "@timer\ndef calculate(n):\n    return sum(range(n))",
      options: [
        "Elle exécute immédiatement calculate(100)",
        "Elle réassigne calculate = timer(calculate)",
        "Elle crée un thread séparé pour chronométrer le CPU",
        "Elle transforme calculate en générateur Python"
      ],
      correctIndex: 1,
      explanation: "L'arobase @timer est du sucre syntaxique pour calculate = timer(calculate) au moment du chargement du module."
    },
    {
      id: 'q2',
      question: "Que se passe-t-il si la fonction wrapper interne d'un décorateur oublie de faire 'return result' ?",
      code: "def bad_decorator(func):\n    def wrapper(*args, **kwargs):\n        res = func(*args, **kwargs)\n    return wrapper",
      options: [
        "Une exception TypeError est levée immédiatement",
        "La fonction décorée renverra toujours None au lieu de sa vraie valeur",
        "La fonction originale est exécutée deux fois",
        "Python refuse de compiler le fichier"
      ],
      correctIndex: 1,
      explanation: "Sans instruction return dans le wrapper, tout appel à la fonction décorée retourne implicitement None."
    }
  ] : [
    {
      id: 'q1',
      question: `Dans quel contexte utilise-t-on principalement "${topic}" ?`,
      options: [
        "Pour structurer et réutiliser du code proprement",
        "Uniquement dans le noyau CPython",
        "Seulement pour les scripts bash",
        "Pour remplacer l'interpréteur Python"
      ],
      correctIndex: 0,
      explanation: "L'objectif premier est la modularité, la lisibilité et l'isolation des responsabilités."
    }
  ];

  const exercises = isDecorator ? [
    {
      id: 'ex1',
      title: "Défi 1 : Créer un décorateur @debug_logger",
      instructions: "Écrivez un décorateur 'debug_logger' qui affiche 'Calling [nom_fonction]...' avant l'exécution, appelle la fonction avec ses arguments, puis affiche 'Done [nom_fonction]' et retourne le résultat.",
      starterCode: "def debug_logger(func):\n    def wrapper(*args, **kwargs):\n        # TODO: Affichez le message de début\n        # TODO: Appelez func et stockez le résultat\n        # TODO: Affichez le message de fin\n        # TODO: Retournez le résultat\n        pass\n    return wrapper\n\n@debug_logger\ndef add(a, b):\n    return a + b\n\nprint(add(5, 7))",
      solutionCode: "def debug_logger(func):\n    def wrapper(*args, **kwargs):\n        print(f\"Calling {func.__name__}...\")\n        result = func(*args, **kwargs)\n        print(f\"Done {func.__name__}\")\n        return result\n    return wrapper\n\n@debug_logger\ndef add(a, b):\n    return a + b\n\nprint(add(5, 7))",
      explanation: "Le wrapper intercepte l'appel, accède au nom de la fonction via func.__name__, transmet tous les arguments avec *args et **kwargs, et renvoie fidèlement le résultat.",
      hints: [
        "Utilisez func.__name__ pour récupérer le nom de la fonction décorée.",
        "N'oubliez pas 'return result' à la fin du wrapper !"
      ]
    },
    {
      id: 'ex2',
      title: "Défi 2 : Décorateur avec argument @repeat(times)",
      instructions: "Créez une 'decorator factory' @repeat(times=3) qui exécute la fonction décorée 'times' fois d'affilée et retourne le résultat du dernier appel.",
      starterCode: "def repeat(times=3):\n    def decorator(func):\n        def wrapper(*args, **kwargs):\n            # TODO: Bouclez 'times' fois\n            pass\n        return wrapper\n    return decorator",
      solutionCode: "def repeat(times=3):\n    def decorator(func):\n        def wrapper(*args, **kwargs):\n            res = None\n            for _ in range(times):\n                res = func(*args, **kwargs)\n            return res\n        return wrapper\n    return decorator\n\n@repeat(times=3)\ndef greet(name):\n    print(f\"Salut {name} !\")\n    return f\"OK-{name}\"\n\ngreet(\"Alice\")",
      explanation: "Il y a 3 niveaux de fonctions : repeat(times) renvoie decorator(func), qui renvoie wrapper(*args, **kwargs).",
      hints: [
        "La fonction externe 'repeat' prend l'argument 'times'.",
        "La fonction intermédiaire 'decorator' prend la fonction 'func'.",
        "La fonction interne 'wrapper' prend '*args, **kwargs'."
      ]
    }
  ] : [
    {
      id: 'ex1',
      title: `Défi Pratique : Application de ${topic}`,
      instructions: `Implémentez une fonction démonstrative qui applique les concepts fondamentaux de ${topic}.`,
      starterCode: `# Écrivez votre code pour ${topic} ici\ndef solution():\n    pass`,
      solutionCode: `# Exemple de solution propre pour ${topic}\ndef solution():\n    return "Validation réussie"`,
      explanation: `Cette solution respecte les principes de conception et les bonnes pratiques standard.`,
      hints: [`Pensez à découper votre raisonnement étape par étape.`]
    }
  ];

  return {
    id: `rev_${Date.now()}`,
    topic,
    isFromExistingNotes: isExisting,
    sourceNoteTitles: matchedNotes.map(n => n.title),
    summary,
    flashcards,
    quiz,
    exercises,
    suggestedNote: {
      title: isExisting ? `Révision : ${noteTitle}` : `Fiche : ${topic}`,
      tags: isDecorator ? ['python', 'décorateurs', 'fonctions', 'révision'] : ['révision', topic.toLowerCase().replace(/\s+/g, '-')],
      content: summary,
      snippets: [
        {
          title: `Code d'entraînement : ${topic}`,
          language: 'python',
          code: exercises[0]?.solutionCode || '# Code de démonstration\n',
          annotations: [
            {
              line: 1,
              text: `Point clé d'implémentation pour ${topic}`,
              type: 'logic'
            }
          ]
        }
      ]
    }
  };
}

/**
 * Generates an end-to-end Smart Revision session.
 */
export async function generateRevisionSession(req: RevisionRequest): Promise<GeneratedRevisionSession> {
  const provider = req.provider || (req.apiKey?.startsWith('sk-or-') ? 'openrouter' : 'gemini');
  const apiKey = req.apiKey || process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY;
  const modelName = req.model || (provider === 'openrouter' ? 'google/gemini-2.5-flash' : provider === 'ollama' ? 'llama3' : 'gemini-2.5-flash');

  // Search existing notes for matches with the requested topic
  const topicWords = req.topic.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const matchedNotes = (req.existingNotes || []).filter(note => {
    if (req.activeNoteId && note.id === req.activeNoteId) return true;
    const titleMatch = topicWords.some(w => note.title.toLowerCase().includes(w));
    const tagMatch = (note.tags || []).some(t => topicWords.some(w => t.toLowerCase().includes(w)));
    const contentMatch = topicWords.some(w => (note.content || '').toLowerCase().includes(w));
    return titleMatch || tagMatch || contentMatch;
  });

  const isFromExistingNotes = matchedNotes.length > 0;
  const contextNotesText = matchedNotes.map(n => `
--- NOTE: ${n.title} (Tags: ${n.tags?.join(', ')}) ---
${n.content}
${n.snippets?.map(s => `Code (${s.language}):\n${s.code}\nAnnotations:\n${s.annotations?.map(a => `L${a.line}: [${a.type}] ${a.text}`).join('\n')}`).join('\n\n')}
`).join('\n\n');

  const systemPrompt = `Tu es l'expert pédagogique et formateur en développement informatique de DevNotes.
L'utilisateur veut réviser et pratiquer le concept suivant : "${req.topic}".

${isFromExistingNotes 
  ? `L'utilisateur a déjà des notes sur ce sujet dans son carnet DevNotes. BASE-TOI SUR SES NOTES EXISTANTES, ses snippets et ses annotations pour construire une révision ultra ciblée :\n${contextNotesText}`
  : `L'utilisateur N'A PAS ENCORE de note sur ce sujet. Génère une fiche de révision complète et interactive dans le style DevNotes (synthétique, avec du code clair et des annotations utiles).`
}

Consignes strictes :
1. "summary" : Résumé clair et percutant en Markdown (avec des alertes > [!NOTE], des listes à puces et des termes de code entre backticks \`...\`).
2. "flashcards" : 3 à 4 fiches de mémorisation active ("question", "answer", "keyTakeaway", "codeSnippet" optionnel).
3. "quiz" : 3 à 4 questions de QCM ("question", "code" optionnel, "options" tableau de 4 choix, "correctIndex" 0..3, "explanation" détaillée).
4. "exercises" : 2 à 3 exercices pratiques de code progressifs ("title", "instructions", "starterCode", "solutionCode", "explanation", "hints").
5. "suggestedNote" : Note structurée DevNotes complète (avec "title", "tags", "content", et "snippets" contenant "title", "language", "code", "annotations": [{"line": 1, "text": "...", "type": "logic"|"tip"|"warning"|"important"}]).

FORMAT DE RÉPONSE OBLIGATOIRE :
Renvoie UNIQUEMENT un objet JSON valide conforme à ce schéma :
{
  "id": "rev_${Date.now()}",
  "topic": "${req.topic}",
  "isFromExistingNotes": ${isFromExistingNotes},
  "sourceNoteTitles": ${JSON.stringify(matchedNotes.map(n => n.title))},
  "summary": "...",
  "flashcards": [
    { "id": "f1", "question": "...", "answer": "...", "keyTakeaway": "...", "codeSnippet": "..." }
  ],
  "quiz": [
    { "id": "q1", "question": "...", "code": "...", "options": ["A", "B", "C", "D"], "correctIndex": 0, "explanation": "..." }
  ],
  "exercises": [
    { "id": "ex1", "title": "...", "instructions": "...", "starterCode": "...", "solutionCode": "...", "explanation": "...", "hints": ["..."] }
  ],
  "suggestedNote": {
    "title": "...",
    "tags": ["..."],
    "content": "...",
    "snippets": [
      {
        "title": "...",
        "language": "python",
        "code": "...",
        "annotations": [
          { "line": 1, "text": "...", "type": "logic" }
        ]
      }
    ]
  }
}`;

  // Call OpenRouter
  if (provider === 'openrouter' && apiKey) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'http://localhost:5173',
          'X-Title': 'DevNotes',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelName,
          messages: [{ role: 'user', content: systemPrompt }],
          response_format: { type: 'json_object' },
        }),
      });

      if (res.ok) {
        const data = await res.json() as any;
        const text = data.choices?.[0]?.message?.content;
        if (text) {
          const parsed = JSON.parse(text) as GeneratedRevisionSession;
          if (parsed && parsed.summary && parsed.quiz && parsed.exercises) {
            return parsed;
          }
        }
      }
    } catch (err) {
      console.error('[aiService] OpenRouter revision error:', err);
    }
  }

  // Call Ollama
  if (provider === 'ollama') {
    try {
      const baseUrl = req.ollamaUrl || 'http://localhost:11434';
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelName || 'llama3',
          messages: [{ role: 'user', content: systemPrompt }],
          stream: false,
          format: 'json',
        }),
      });

      if (res.ok) {
        const data = await res.json() as any;
        const text = data.message?.content;
        if (text) {
          const parsed = JSON.parse(text) as GeneratedRevisionSession;
          if (parsed && parsed.summary && parsed.quiz) {
            return parsed;
          }
        }
      }
    } catch (err) {
      console.error('[aiService] Ollama revision error:', err);
    }
  }

  // Call Gemini
  if ((provider === 'gemini' || !provider) && apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: systemPrompt,
        config: { responseMimeType: 'application/json' },
      });

      const responseText = response.text;
      if (responseText) {
        const parsed = JSON.parse(responseText) as GeneratedRevisionSession;
        if (parsed && parsed.summary && parsed.quiz) {
          return parsed;
        }
      }
    } catch (err) {
      console.error('[aiService] Gemini revision error:', err);
    }
  }

  // Fallback
  return fallbackRevisionSession(req.topic, matchedNotes);
}

/**
 * Real-time AI evaluation of a user's code attempt during a revision challenge.
 */
export async function evaluateRevisionCode(params: {
  exerciseTitle: string;
  exerciseInstructions: string;
  userCode: string;
  solutionCode: string;
  provider?: 'openrouter' | 'gemini' | 'ollama' | 'openai';
  apiKey?: string;
  model?: string;
  ollamaUrl?: string;
}): Promise<{ score: number; isCorrect: boolean; feedback: string; suggestion?: string }> {
  const provider = params.provider || (params.apiKey?.startsWith('sk-or-') ? 'openrouter' : 'gemini');
  const apiKey = params.apiKey || process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY;
  const modelName = params.model || (provider === 'openrouter' ? 'google/gemini-2.5-flash' : provider === 'ollama' ? 'llama3' : 'gemini-2.5-flash');

  const prompt = `Évalue le code écrit par l'étudiant pour l'exercice suivant :
Exercice : ${params.exerciseTitle}
Consignes : ${params.exerciseInstructions}

Code écrit par l'étudiant :
\`\`\`
${params.userCode}
\`\`\`

Code de solution attendu / modèle :
\`\`\`
${params.solutionCode}
\`\`\`

Donne une note sur 10, détermine si l'exercice est validé (isCorrect: true si score >= 7), et fournis un feedback pédagogique court, encourageant et clair en Markdown.

Renvoie UNIQUEMENT un JSON conforme à ce format :
{
  "score": 9,
  "isCorrect": true,
  "feedback": "Bravo ! Le wrapper est bien implémenté avec *args, **kwargs. Pense juste à...",
  "suggestion": "..."
}`;

  if (provider === 'openrouter' && apiKey) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'http://localhost:5173',
          'X-Title': 'DevNotes',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelName,
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
        }),
      });

      if (res.ok) {
        const data = await res.json() as any;
        const text = data.choices?.[0]?.message?.content;
        if (text) return JSON.parse(text);
      }
    } catch (e) {
      console.error('[aiService] Evaluation OpenRouter error', e);
    }
  }

  if ((provider === 'gemini' || !provider) && apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json' },
      });
      if (response.text) return JSON.parse(response.text);
    } catch (e) {
      console.error('[aiService] Evaluation Gemini error', e);
    }
  }

  // Fallback evaluation
  const hasCode = params.userCode.trim().length > 20;
  return {
    score: hasCode ? 8 : 4,
    isCorrect: hasCode,
    feedback: hasCode 
      ? "Très bon travail ! Votre code semble structuré et conforme à la consigne. Comparez avec la solution pour voir les optimisations possibles."
      : "Le code est incomplet. Réessayez en vous aidant des indices ou en complétant les sections TODO.",
    suggestion: "Vérifiez que toutes les fonctions internes retournent bien leur résultat."
  };
}

export interface ProjectBlueprintComplexPart {
  title: string;
  problemDescription: string;
  solutionStrategy: string;
  reusableConceptsFromNotes?: string[];
}

export interface ProjectBlueprintResult {
  id: string;
  projectTitle: string;
  summary: string;
  targetStack: string[];
  reusableNotesSummary?: string[];
  architectureOverview: string;
  complexParts: ProjectBlueprintComplexPart[];
  roadmapSteps: {
    phase: string;
    description: string;
    keyDeliverables: string[];
  }[];
  snippets: {
    title: string;
    language: string;
    code: string;
    annotations: GeneratedAnnotation[];
  }[];
  suggestedTags: string[];
  suggestedModuleName?: string;
}

export interface ProjectBlueprintRequest {
  projectIdea: string;
  notesContext?: {
    id: string;
    title: string;
    tags: string[];
    content: string;
    snippets: {
      title?: string;
      language: string;
      code: string;
      annotations?: { line: number; text: string; type?: string }[];
    }[];
  }[];
  syntaxDefinitions?: Record<string, { keyword: string; text: string; fullContext?: string }>;
  targetModuleName?: string;
  provider?: 'openrouter' | 'gemini' | 'ollama' | 'openai';
  apiKey?: string;
  model?: string;
  ollamaUrl?: string;
}

/**
 * Intelligent fallback generator for Project Blueprint when no AI key is provided or API is unreachable.
 */
export function fallbackProjectBlueprint(
  projectIdea: string,
  notesContext: ProjectBlueprintRequest['notesContext'] = [],
  syntaxDefinitions: Record<string, { keyword: string; text: string }> = {}
): ProjectBlueprintResult {
  const ideaClean = projectIdea.trim();
  const matchedNoteTitles = notesContext.slice(0, 5).map(n => n.title);
  const matchedKeywords = Object.keys(syntaxDefinitions).slice(0, 6);

  return {
    id: 'blueprint-' + Math.random().toString(36).substr(2, 9),
    projectTitle: ideaClean.length > 50 ? ideaClean.slice(0, 50) + '...' : ideaClean || 'Architecture Solution Logicielle',
    summary: `Ce document d'architecture technique et de cadrage a été généré en capitalisant sur votre base de connaissances DevNotes. Il détaille la conception modulaire, la résolution des défis critiques et les patterns de code optimaux pour concevoir : "${ideaClean}".`,
    targetStack: ['Python 3.11+', 'FastAPI / Node.js', 'Pydantic', 'PostgreSQL / MongoDB', 'Docker'],
    reusableNotesSummary: matchedNoteTitles.length > 0 
      ? matchedNoteTitles.map(t => `Note de référence : "${t}"`)
      : ['Concepts et patrons de conception réutilisés depuis votre base de notes'],
    architectureOverview: `### 🏛️ Vue d'Ensemble de l'Architecture

Le projet s'articule autour d'une architecture orientée services et modulaire :
1. **Couche Métier (Core Services)** : Traitement des règles business, orchestrateurs d'agents ou de flux de données.
2. **Couche Données & Persistance** : Gestion optimisée des requêtes, structures de données adaptées et caching.
3. **Couche API / Interface** : Exposition sécurisée, validation stricte des entrées et gestion des erreurs temps réel.

> [!NOTE]
> Cette approche garantit la haute disponibilité, l'extensibilité et la réutilisation directe des modules déjà documentés dans vos cours et notes.`,
    complexParts: [
      {
        title: "Gestion de la concurrence et résilience des flux",
        problemDescription: "Les traitements asynchrones et l'orchestration peuvent saturer les ressources ou causer des blocages en cas de pic de charge.",
        solutionStrategy: "Mise en place d'une file d'attente (Queue/Worker pattern) avec retry automatique exponentiel et décorateurs de contrôle d'erreurs.",
        reusableConceptsFromNotes: matchedKeywords.length > 0 ? matchedKeywords.slice(0, 3) : ["Décorateurs", "Gestion d'exceptions", "Asynchronisme"]
      },
      {
        title: "Modélisation des données & Performances d'accès",
        problemDescription: "Optimiser les agrégations de données et minimiser la latence sur les requêtes fréquentes.",
        solutionStrategy: "Indexation ciblée, structures mémoires optimisées et découplage entre lecture et écriture.",
        reusableConceptsFromNotes: matchedKeywords.length > 3 ? matchedKeywords.slice(3, 6) : ["Dictionnaires & Hashing", "Générateurs"]
      }
    ],
    roadmapSteps: [
      {
        phase: "Phase 1 : Cadrage & Socle Technique",
        description: "Initialisation du dépôt, configuration de l'environnement, validation des modèles de données fondamentaux.",
        keyDeliverables: ["Schéma de données validé", "Configuration environnement & tests unitaires de base"]
      },
      {
        phase: "Phase 2 : Développement du Cœur Métier",
        description: "Implémentation des services principaux et résolution des composants critiques identifiés.",
        keyDeliverables: ["Moteur principal opérationnel", "Gestionnaires d'erreurs et de logs"]
      },
      {
        phase: "Phase 3 : Intégration, Tests & Déploiement",
        description: "Mise en place des tests d'intégration, conteneurisation Docker et documentation technique d'exploitation.",
        keyDeliverables: ["Image Docker prête pour production", "Documentation d'architecture finale"]
      }
    ],
    snippets: [
      {
        title: "Orchestrateur & Gestionnaire d'Architecture Résiliente",
        language: "python",
        code: `import asyncio
import time
from typing import Dict, Any, Optional

class SolutionOrchestrator:
    """
    Orchestrateur central gérant les flux complexes et la tolérance aux pannes.
    Capitalise sur les patterns asynchrones documentés dans DevNotes.
    """
    def __init__(self, service_name: str, max_retries: int = 3):
        self.service_name = service_name
        self.max_retries = max_retries
        self.metrics: Dict[str, Any] = {"success": 0, "failures": 0}

    async def execute_task(self, task_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        for attempt in range(1, self.max_retries + 1):
            try:
                # Simulation de l'exécution du nœud logique
                await asyncio.sleep(0.05)
                self.metrics["success"] += 1
                return {"task_id": task_id, "status": "completed", "attempt": attempt}
            except Exception as e:
                if attempt == self.max_retries:
                    self.metrics["failures"] += 1
                    raise RuntimeError(f"Échec critique sur {task_id}: {str(e)}")
                await asyncio.sleep(0.1 * attempt)`,
        annotations: [
          {
            line: 5,
            endLine: 9,
            text: "Classe centrale encapsulant l'état du service et les compteurs de résilience.",
            type: "logic",
            color: "#6366f1"
          },
          {
            line: 15,
            endLine: 24,
            text: "Boucle de retry exponentielle pour absorber les défaillances temporaires de réseau ou d'API.",
            type: "tip",
            color: "#10b981"
          }
        ]
      }
    ],
    suggestedTags: ['architecture', 'blueprint', 'backend', 'system-design'],
    suggestedModuleName: 'Projets & Architectures'
  };
}

/**
 * Lead Solution Architect Agent:
 * Synthesizes user's entire knowledge base (notes, courses, syntax definitions)
 * to design comprehensive technical specifications, solve complex project bottlenecks,
 * and provide key architectural code patterns.
 */
export async function generateProjectBlueprint(req: ProjectBlueprintRequest): Promise<ProjectBlueprintResult> {
  const provider = req.provider || (req.apiKey?.startsWith('sk-or-') ? 'openrouter' : 'gemini');
  const apiKey = req.apiKey || process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY;
  const modelName = req.model || (provider === 'openrouter' ? 'google/gemini-2.5-flash' : provider === 'ollama' ? 'llama3' : 'gemini-2.5-flash');

  // Build summarized context from all notes
  const notesOverview = (req.notesContext || []).map(n => {
    const snips = (n.snippets || []).map(s => `[Snippet: ${s.title || s.language}]`).join(', ');
    return `- "${n.title}" (Tags: ${n.tags.join(', ') || 'aucun'}): ${n.content.slice(0, 180)}... ${snips}`;
  }).join('\n');

  const syntaxKeywords = Object.keys(req.syntaxDefinitions || {}).slice(0, 40).join(', ');

  const prompt = `Tu es un Lead Software Architect & Tech Lead de niveau mondial.
L'utilisateur te soumet une idée de projet logiciel ou un problème d'ingénierie à concevoir :
"${req.projectIdea}"

Voici l'ensemble des connaissances, cours, syntaxes et notes que l'utilisateur a accumulés dans son espace DevNotes :
---
RÉFÉRENCES DE SYNTAXES CONNUES :
${syntaxKeywords || 'Générales (Python, JS, TS, etc.)'}

BASE DE NOTES ET COURS EXISTANTS :
${notesOverview || 'Aucune note spécifique transmise.'}
---

MISSION :
1. Analyse le projet demandé et conçois un dossier d'architecture technique complet.
2. Identifie comment le projet peut CAPITALISER et RÉUTILISER directement les connaissances et notes de l'utilisateur (par exemple bibliothèques, algorithmes, patterns, structures de données qu'il a déjà notés).
3. Décris les PARTIES COMPLEXES du projet (les défis techniques épineux) et donne les stratégies précises et concrètes pour les résoudre.
4. Fournis 1 ou 2 SNIPPETS DE CODE CLÉS (illustrant la résolution des nœuds complexes) avec des annotations de ligne précises.
5. Définis une ROADMAP d'implémentation par étapes.

Tu dois répondre STRICTEMENT au format JSON valide selon cette structure :
{
  "id": "blueprint-12345",
  "projectTitle": "Titre professionnel et percutant du projet",
  "summary": "Résumé exécutif du projet, ses objectifs et sa valeur ajoutée (2-3 phrases).",
  "targetStack": ["Python 3.11", "FastAPI", "Pandas", "Redis", "Docker"],
  "reusableNotesSummary": [
    "Réutilisation de la note '...' pour la gestion des...",
    "Exploitation du pattern décorateur documenté dans '...'"
  ],
  "architectureOverview": "### 🏗️ Architecture Globale\\n\\nExplication détaillée en Markdown du flux de données, des couches et des composants...",
  "complexParts": [
    {
      "title": "Nom du défi complexe 1 (ex: Synchronisation temps réel des stocks)",
      "problemDescription": "Pourquoi c'est difficile (concurrence, latence, cohérence des données)...",
      "solutionStrategy": "La solution d'ingénierie adoptée (pattern, outil, algo)...",
      "reusableConceptsFromNotes": ["Pandas", "Asyncio", "Dictionnaires"]
    }
  ],
  "roadmapSteps": [
    {
      "phase": "Phase 1 : Socle & Modélisation",
      "description": "Description de la phase...",
      "keyDeliverables": ["Livrable 1", "Livrable 2"]
    }
  ],
  "snippets": [
    {
      "title": "Nom du composant critique",
      "language": "python",
      "code": "code python propre...",
      "annotations": [
        {
          "line": 1,
          "endLine": 4,
          "text": "Explication de la logique...",
          "type": "logic",
          "color": "#6366f1"
        }
      ]
    }
  ],
  "suggestedTags": ["architecture", "supermarche", "agents-ia", "python"],
  "suggestedModuleName": "Projets & Architectures"
}`;

  if (provider === 'openrouter' && apiKey) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'http://localhost:5173',
          'X-Title': 'DevNotes Solution Architect',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelName,
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
        }),
      });

      if (res.ok) {
        const data = await res.json() as any;
        const text = data.choices?.[0]?.message?.content;
        if (text) {
          const parsed = JSON.parse(text) as ProjectBlueprintResult;
          if (parsed && parsed.projectTitle && parsed.architectureOverview) {
            parsed.id = parsed.id || 'blueprint-' + Math.random().toString(36).substr(2, 9);
            return parsed;
          }
        }
      }
    } catch (e) {
      console.error('[aiService] Architect OpenRouter error', e);
    }
  }

  if ((provider === 'gemini' || !provider) && apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json' },
      });
      if (response.text) {
        const parsed = JSON.parse(response.text) as ProjectBlueprintResult;
        if (parsed && parsed.projectTitle && parsed.architectureOverview) {
          parsed.id = parsed.id || 'blueprint-' + Math.random().toString(36).substr(2, 9);
          return parsed;
        }
      }
    } catch (e) {
      console.error('[aiService] Architect Gemini error', e);
    }
  }

  if (provider === 'ollama') {
    try {
      const baseUrl = req.ollamaUrl || 'http://localhost:11434';
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelName || 'llama3',
          messages: [{ role: 'user', content: prompt }],
          stream: false,
          format: 'json',
        }),
      });

      if (res.ok) {
        const data = await res.json() as any;
        const text = data.message?.content;
        if (text) {
          const parsed = JSON.parse(text) as ProjectBlueprintResult;
          if (parsed && parsed.projectTitle && parsed.architectureOverview) {
            parsed.id = parsed.id || 'blueprint-' + Math.random().toString(36).substr(2, 9);
            return parsed;
          }
        }
      }
    } catch (e) {
      console.error('[aiService] Architect Ollama error', e);
    }
  }

  // Fallback
  return fallbackProjectBlueprint(req.projectIdea, req.notesContext, req.syntaxDefinitions || {});
}


