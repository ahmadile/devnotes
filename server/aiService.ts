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
  const annotations: GeneratedAnnotation[] = [];
  const codeLinesArray = codeText.split('\n');

  for (let idx = 0; idx < rawLineAnnotations.length; idx++) {
    const item = rawLineAnnotations[idx];
    const fullText = item.text;
    let shortTitle = fullText;
    let fullContext = '';

    if (fullText.includes(' : ')) {
      const parts = fullText.split(' : ');
      shortTitle = parts[0].trim();
      fullContext = parts.slice(1).join(' : ').trim();
    }

    let targetLine = -1;
    let targetEndLine: number | undefined = undefined;

    const lineNumMatch = shortTitle.match(/Ligne\s+(\d+)(?:\s*-\s*(\d+))?/i);
    if (lineNumMatch) {
      targetLine = parseInt(lineNumMatch[1], 10);
      if (lineNumMatch[2]) {
        targetEndLine = parseInt(lineNumMatch[2], 10);
      }
    } else {
      const cleanSnippetTarget = shortTitle.replace(/^Ligne\s*/i, '').split(':')[0].trim();
      if (cleanSnippetTarget) {
        for (let l = 0; l < codeLinesArray.length; l++) {
          if (codeLinesArray[l].includes(cleanSnippetTarget) || (cleanSnippetTarget.length > 5 && codeLinesArray[l].toLowerCase().includes(cleanSnippetTarget.toLowerCase()))) {
            targetLine = l + 1;
            break;
          }
        }
      }
    }

    if (targetLine === -1 || targetLine > codeLinesArray.length) {
      targetLine = Math.min(Math.max(1, (idx + 1) * Math.floor(codeLinesArray.length / (rawLineAnnotations.length + 1))), Math.max(1, codeLinesArray.length));
    }

    let type: GeneratedAnnotation['type'] = 'logic';
    if (fullText.toLowerCase().includes('piège') || fullText.toLowerCase().includes('erreur') || fullText.toLowerCase().includes('attention')) {
      type = 'warning';
    } else if (fullText.toLowerCase().includes('crucial') || fullText.toLowerCase().includes('important')) {
      type = 'important';
    } else if (fullText.toLowerCase().includes('astuce') || fullText.toLowerCase().includes('imbriquée')) {
      type = 'tip';
    }

    annotations.push({
      line: targetLine,
      endLine: targetEndLine || targetLine,
      text: shortTitle,
      fullContext: fullContext || fullText,
      type,
      color: ANNOTATION_COLORS[type],
    });
  }

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
3. Code Snippet & Annotations de ligne (Sous-notes de code) :
   - Extraire le code source exact.
   - Pour CHAQUE explication de ligne (ex: "⚫ Ligne x = my_function ..."), calcule la ligne EXACTE (1-indexed) où ce code apparaît dans le snippet de code.
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
          "fullContext": "Explication détaillée de la sous-note",
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
            return parsed;
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
            return parsed;
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
          if (parsed.snippets) {
            parsed.snippets.forEach(s => {
              if (s.annotations) {
                s.annotations.forEach(a => {
                  if (!a.color) a.color = ANNOTATION_COLORS[a.type] || '#6366f1';
                });
              }
            });
          }
          return parsed;
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
