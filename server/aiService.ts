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

    // Clean leading markers from shortTitle
    shortTitle = shortTitle
      .replace(/^(?:⚫\s*)?(?:Ligne\s*\d+(?:\s*-\s*\d+)?\s*[-:]?\s*|Line\s*\d+(?:\s*-\s*\d+)?\s*[-:]?\s*)/i, '')
      .trim();
    if (!shortTitle) shortTitle = fullText;

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

  const assignedLines: number[] = [];

  return annotations.map((ann, idx) => {
    let candidates: string[] = [];
    
    // 0. Extract any backtick code segments from text or fullContext
    const backtickMatches = (ann.text + ' ' + (ann.fullContext || '')).match(/`([^`]+)`/g);
    if (backtickMatches) {
      backtickMatches.forEach(m => {
        const clean = m.replace(/`/g, '').trim();
        if (clean.length >= 2) candidates.push(clean);
      });
    }

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

    // 1. Direct substring search in code lines
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

    // 3. Keyword-heuristic mapping (decorators, wrappers, wraps, return)
    if (matchedLine === -1) {
      const combinedText = (ann.text + ' ' + (ann.fullContext || '')).toLowerCase();
      
      for (let l = 0; l < codeLines.length; l++) {
        const lineLower = codeLines[l].toLowerCase().trim();
        if (combinedText.includes('wraps') && (lineLower.includes('@functools.wraps') || lineLower.includes('@wraps'))) {
          matchedLine = l + 1;
          break;
        } else if ((combinedText.includes('wrapper') || combinedText.includes('niveau 3')) && lineLower.includes('def wrapper')) {
          matchedLine = l + 1;
          break;
        } else if ((combinedText.includes('vrai décorateur') || combinedText.includes('niveau 2')) && lineLower.includes('def decorator')) {
          matchedLine = l + 1;
          break;
        } else if ((combinedText.includes('fabrique') || combinedText.includes('niveau 1')) && lineLower.startsWith('def ')) {
          matchedLine = l + 1;
          break;
        } else if (combinedText.includes('renvoie wrapper') && lineLower.includes('return wrapper')) {
          matchedLine = l + 1;
          break;
        } else if (combinedText.includes('renvoie decorator') && lineLower.includes('return decorator')) {
          matchedLine = l + 1;
          break;
        }
      }
    }

    // 4. Fallback: check if original ann.line is reasonable
    if (matchedLine === -1) {
      if (ann.line >= 1 && ann.line <= codeLines.length) {
        matchedLine = ann.line;
      } else {
        matchedLine = Math.min(Math.max(1, (idx + 1) * Math.floor(codeLines.length / (annotations.length + 1))), codeLines.length);
      }
    }

    // Prevent duplicate clustering if multiple annotations target the same line without explicit match
    if (assignedLines.includes(matchedLine) && codeLines.length > annotations.length) {
      // Find the next closest available line
      for (let offset = 1; offset < codeLines.length; offset++) {
        if (matchedLine + offset <= codeLines.length && !assignedLines.includes(matchedLine + offset)) {
          matchedLine = matchedLine + offset;
          break;
        }
      }
    }
    assignedLines.push(matchedLine);

    const span = (ann.endLine && ann.endLine >= ann.line) ? (ann.endLine - ann.line) : 0;
    const endLine = Math.min(codeLines.length, matchedLine + span);

    return {
      ...ann,
      line: matchedLine,
      endLine: endLine >= matchedLine ? endLine : matchedLine,
    };
  });
}

function sanitizeAndAlignNoteResult(parsed: GeneratedNoteResult): GeneratedNoteResult {
  if (parsed.snippets && Array.isArray(parsed.snippets)) {
    parsed.snippets.forEach(s => {
      if (s.annotations && Array.isArray(s.annotations)) {
        s.annotations.forEach(a => {
          if (!a.color) a.color = ANNOTATION_COLORS[a.type] || '#6366f1';
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

  const prompt = `Tu es l'assistant IA officiel de DevNotes, un environnement d'apprentissage de code inspiré du design et de la rigueur pédagogique de Claude Code.
Transforme la note brute fournie en une fiche d'apprentissage haut de gamme, claire, structurée et mémorable.${syntaxContext}

--- INPUT BRUT ---
${req.input}
--- FIN INPUT BRUT ---

Directives STRICTES de génération :

1. Extraction du Titre et Tags :
   - Titre concis, percutant et professionnel.
   - Tags pertinents (langage, concept, patterns).

2. Formatage du Résumé / "content" (Style Claude Code & Documentation Premium) :
   - Structure le contenu avec des sous-titres clairs (ex: "### 🚀 Le problème initial", "### 💡 La solution", "### 📊 Tableau comparatif").
   - Intègre des blocs d'alerte GitHub :
     > [!NOTE] pour le concept clé ou l'idée centrale.
     > [!TIP] pour les bonnes pratiques et optimisations.
     > [!WARNING] pour les pièges classiques ou erreurs fréquentes.
   - Insère des EXEMPLES DE CODE ILLUSTRATIFS (mini-snippets markdown comme \`\`\`python ... \`\`\` ou \`\`\`javascript ... \`\`\`) directement dans l'explication pour comparer avant/après ou montrer un cas d'usage.
   - Pour TOUT schéma, synthèse ou tableau comparatif :
     - Utilise EXCLUSIVEMENT la syntaxe Markdown GFM standard (tableaux avec \`| Colonne 1 | Colonne 2 | ... |\` et \`| :--- | :--- | ... |\`).
     - INTERDICTION FORMELLE d'utiliser des caractères de dessin ASCII décalés (\`┌─┬─┐\`, \`│ │\`, \`└───┘\`). Les tableaux Markdown doivent être propres et lisibles.
     - Tu peux aussi utiliser des blocs Mermaid \`\`\`mermaid pour les diagrammes de flux.

3. Code Snippet Principal & Annotations de ligne (Sous-notes) :
   - "code" : Le code source propre, complet et indenté.
   - "annotations" : Liste de sous-notes associées aux lignes exactes du code.
   - IMPORTANTISSIME : Les numéros de ligne ("line" et "endLine") DOIVENT être 1-indexés et correspondre EXACTEMENT à la ligne dans le bloc "code".
   - Chaque sous-note DOIT cibler sa ligne spécifique (ex: Ligne 1 pour la fonction externe, Ligne 3 pour le décorateur intermédiaire, Ligne 4 pour @wraps, Ligne 5 pour le wrapper, Ligne 8 pour le return wrapper, etc.).
   - INTERDICTION de regrouper toutes les sous-notes sur une seule et même ligne.
   - "text" : Titre court de l'annotation avec le code ou concept ciblé.
   - "fullContext" : Explication pédagogique détaillée avec mini-exemples si pertinent.
   - "type" : "logic" | "tip" | "warning" | "important" | "debug".

Format JSON STRICT de réponse (renvoie UNIQUEMENT le JSON valide, sans texte d'introduction ni de conclusion) :
{
  "title": "Titre de la note",
  "tags": ["python", "decorateurs", "closures"],
  "moduleName": "Python / Fonctions Avancées",
  "content": "### 🚀 Le concept\\n\\nExplication détaillée style Claude Code avec \`\`\`python\\n# Mini exemple\\n\`\`\`\\n\\n### 📊 Tableau Récapitulatif\\n\\n| Niveau | Fonction | Rôle |\\n| :--- | :--- | :--- |\\n| Niveau 1 | \`run_n_times(n)\` | Capture le paramètre \`n\` |\\n| Niveau 2 | \`decorator(func)\` | Reçoit la fonction cible |\\n| Niveau 3 | \`wrapper(*args, **kwargs)\` | Exécute \`func\` \`n\` fois |\\n\\n> [!TIP]\\n> Toujours utiliser \`@functools.wraps\` pour préserver les métadonnées.",
  "snippets": [
    {
      "title": "Décorateur à arguments (3 niveaux d'imbrication)",
      "language": "python",
      "code": "import functools\\n\\ndef run_n_times(n):\\n    def decorator(func):\\n        @functools.wraps(func)\\n        def wrapper(*args, **kwargs):\\n            for _ in range(n):\\n                func(*args, **kwargs)\\n        return wrapper\\n    return decorator",
      "annotations": [
        {
          "line": 3,
          "endLine": 3,
          "text": "run_n_times(n) — Fabrique de décorateurs (NIVEAU 1)",
          "fullContext": "Prend l'argument de configuration \`n\` et retourne le vrai décorateur.",
          "type": "logic",
          "color": "#6366f1"
        },
        {
          "line": 4,
          "endLine": 4,
          "text": "decorator(func) — Décorateur classique (NIVEAU 2)",
          "fullContext": "Reçoit la fonction à décorer \`func\`.",
          "type": "tip",
          "color": "#10b981"
        },
        {
          "line": 5,
          "endLine": 5,
          "text": "@functools.wraps(func) — Préservation des métadonnées",
          "fullContext": "Préserve le nom \`__name__\` et la docstring \`__doc__\` de la fonction originale.",
          "type": "important",
          "color": "#f43f5e"
        },
        {
          "line": 6,
          "endLine": 8,
          "text": "wrapper(*args, **kwargs) — Exécution répétée (NIVEAU 3)",
          "fullContext": "Boucle pour appeler \`func(*args, **kwargs)\` exactement \`n\` fois.",
          "type": "logic",
          "color": "#6366f1"
        },
        {
          "line": 9,
          "endLine": 9,
          "text": "return wrapper — Retourne la fonction enveloppante",
          "fullContext": "Le décorateur Niveau 2 renvoie le wrapper.",
          "type": "logic",
          "color": "#6366f1"
        },
        {
          "line": 10,
          "endLine": 10,
          "text": "return decorator — Retourne le décorateur prêt à l'emploi",
          "fullContext": "La fabrique Niveau 1 renvoie la fonction décorateur prête à être appliquée.",
          "type": "tip",
          "color": "#10b981"
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
