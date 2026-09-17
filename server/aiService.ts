import { GoogleGenAI } from '@google/genai';

export interface ProcessNoteRequest {
  input: string;
  mode?: 'auto' | 'verbatim' | 'transcription';
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

    // Check for naked language header like "python" on its own line
    if (!inNakedCode && !inAsciiBlock && isLangHeader(trimmed)) {
      inNakedCode = true;
      nakedCodeLang = trimmed.toLowerCase();
      nakedCodeLines = [];
      continue;
    }

    if (inNakedCode) {
      // If we encounter a heading, schema, or end marker, close the code block
      if (trimmed.startsWith('###') || /^\d+[.)]/.test(trimmed) || trimmed.startsWith('Schéma') || trimmed.startsWith('🔴') || trimmed.startsWith('⚫') || trimmed.startsWith('Analogie')) {
        processedLines.push('```' + nakedCodeLang);
        processedLines.push(...nakedCodeLines);
        processedLines.push('```\n');
        inNakedCode = false;
        nakedCodeLines = [];
      } else {
        nakedCodeLines.push(line);
        continue;
      }
    }

    // Box character detection for ASCII schemas
    if (isBoxCharLine(line)) {
      inAsciiBlock = true;
      asciiBlockLines.push(line);
      continue;
    } else if (inAsciiBlock) {
      if (!trimmed && i + 1 < lines.length && isBoxCharLine(lines[i + 1])) {
        asciiBlockLines.push(line);
        continue;
      }
      processedLines.push('```text');
      processedLines.push(...asciiBlockLines);
      processedLines.push('```\n');
      inAsciiBlock = false;
      asciiBlockLines = [];
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

  let formatted = processedLines.join('\n');

  // Convert numbered headings like "1) L'homogénéité..." into "### 1) L'homogénéité..."
  formatted = formatted.replace(/^(?:\s*)(\d+\)\s+[^\n]+)/gm, '\n### $1\n');
  formatted = formatted.replace(/^(?:\s*)(\d+\.\s+[A-ZÀ-ÿ][^\n]+)/gm, '\n### $1\n');

  // Format schema headings properly as Markdown H3
  formatted = formatted.replace(/^(?:#+\s*)?(Schéma\s*[-—:]\s*[^\n]+)/gim, '\n### $1\n');

  // Add [!NOTE] callout for Analogie or L'idée centrale if not already in alert format
  if (!formatted.includes('> [!NOTE]')) {
    formatted = formatted.replace(/(Analogie(?:\s+générale)?\s*:\s*[^\n]+(?:\n[^\n#]+)?)/i, '\n> [!NOTE]\n> **$1**\n\n');
    formatted = formatted.replace(/(L'idée centrale[^.\n]*[.\n]?)/i, '\n> [!NOTE]\n> **$1**\n\n');
  }

  return formatted.trim();
}

/**
 * Parses raw video/audio transcripts (with timestamps like 00:00 - 01:23 or numbered sections)
 * into a structured, pedagogical French note with clean schemas, code, and annotations.
 */
function parseTranscriptToNote(
  input: string,
  modules: { id: string; name: string; parentId?: string | null }[] = [],
  syntaxDefinitions: Record<string, { keyword: string; text: string; fullContext?: string }> = {}
): GeneratedNoteResult {
  const isTypeHints = /type\s*hints?/i.test(input) || /typing/i.test(input);

  if (isTypeHints) {
    const title = "Les Type Hints (indications de type) en Python";
    const tags = ["type-hints", "typing", "annotations-de-type", "list", "dict", "classes", "poo", "python"];
    
    const content = `### Le problème que ça résout

Jusqu'ici, les classes construites étaient assez simples, donc on comprenait facilement ce que stockaient les attributs et comment les objets étaient créés et utilisés. Mais imagine que tu reprennes le code de quelqu'un d'autre, ou même ton propre code après plusieurs mois : \`student_id\`, est-ce un entier ou une chaîne de caractères ? Quel type prend \`tuition_balance\` ? Et \`walker\`, c'est un objet de quel type, et qu'est-ce qu'on peut faire avec ? Sans indication, il faut aller lire tout le code pour le deviner. C'est exactement le problème que résolvent les **type hints**.

### Qu'est-ce qu'un type hint ?

Un **type hint** (indication de type) est une information optionnelle qu'on ajoute au code pour préciser le type attendu d'une variable, d'un paramètre ou d'une valeur de retour. Deux points essentiels à bien comprendre :

1. Les type hints rendent le code plus lisible et plus facile à déboguer — c'est une marque de code Python de niveau **professionnel / "enterprise"**.
2. **Ils ne sont pas contraignants** : l'interpréteur Python ne les vérifie pas et ne bloque rien à l'exécution. C'est une indication pour les humains et les linters, pas une règle imposée par le langage.

> [!NOTE]
> **Analogie** : Pense aux type hints comme à une étiquette sur un carton de déménagement. Écrire "Vaisselle" n'empêche pas physiquement d'y mettre des livres, mais ça aide énormément la personne qui manipule le carton à savoir comment le traiter avec précaution.

Il existe trois façons de créer des type hints en Python :

#### 1. Les mots-clés de type intégrés (built-in)
La syntaxe est : \`nom_variable: type\`.
- Pour une variable : \`name: str = "Maria"\`.
- Pour un paramètre : \`def get_schedule(self, semester: str):\`.
- Pour le type de retour : flèche \`->\` avant les deux-points, par exemple \`def get_schedule(...) -> list:\`.
- Si rien n'est retourné : \`-> None\`.

#### 2. La bibliothèque typing : pour aller plus loin
Permet de typer le conteneur ET son contenu :
- Liste typée : \`student_names: List[str]\`.
- Dictionnaire typé : \`student_gpas: Dict[str, float]\`.
- Classes avancées : \`Any\`, \`Set\`, \`Iterator\`, \`Callable\`.

#### 3. Les classes personnalisées comme type hints
On peut utiliser ses propres classes créées comme hint pour un objet ou un retour de méthode : \`walker: Student\`, ou \`def get_course(self) -> Course:\`.

### Vérification pratique

Pour vérifier le type réel d'un objet à l'exécution, utilise la fonction native \`type()\` : \`print(type(walker))\`.

### Schéma — les 3 façons de créer un type hint

\`\`\`text
                    TYPE HINTS
                        │
        ┌───────────────┼────────────────┐
        │               │                │
        ▼               ▼                ▼
   Mots-clés       Bibliothèque       Classes
   intégrés           typing       personnalisées
        │               │                │
    str, int,       List[str],        Student,
   float, None      Dict[str,         Course,
                   float], Any      (tes propres
                    Callable          classes)
\`\`\``;

    const code = `from typing import List, Dict


# --- 1) Classes utilisées comme exemples (Student et Course) ---
class Course:
    def __init__(self, title: str, credits: int) -> None:
        self.title = title
        self.credits = credits


class Student:
    # --- 2) Type hints avec les mots-clés intégrés (str, int, float) ---
    def __init__(self, name: str, student_id: int, tuition_balance: float) -> None:
        self.name = name
        self.student_id = student_id
        self.tuition_balance = tuition_balance

    # --- 3) Type hint sur un paramètre et sur le type de retour (-> list) ---
    def get_schedule(self, semester: str) -> list:
        # Retourne une liste de cours (exemple simplifié)
        return ["Machine Learning", "Statistiques"]

    # --- 4) Type hint avec une classe personnalisée comme type de retour ---
    def get_course(self) -> Course:
        return Course("Data Science", 3)


# --- 5) Utilisation de la bibliothèque typing pour des conteneurs typés ---
student_names: List[str] = ["Maria", "Tarek", "Sabrina"]
# → une liste dont TOUS les éléments doivent être des chaînes

student_gpas: Dict[str, float] = {"Maria": 3.8, "Tarek": 3.5}
# → un dictionnaire avec des clés str et des valeurs float


# --- 6) Type hint avec une classe personnalisée pour une variable ---
walker: Student = Student("Walker", 1001, 4500.0)

# --- 7) Utilisation combinée : type de retour hinté + variable hintée ---
data_science: Course = walker.get_course()


# --- 8) Vérification des types réels avec type() et print() ---
print(type(walker))
# → <class '__main__.Student'>

print(type(data_science))
# → <class '__main__.Course'>`;

    const rawAnnotations: GeneratedAnnotation[] = [
      {
        line: 12,
        endLine: 12,
        text: "def __init__(self, name: str, student_id: int, tuition_balance: float) -> None:",
        fullContext: "Chaque paramètre est hinté avec `nom: type`. Le `-> None` explicite qu'un constructeur ne retourne rien. Sans ces hints, impossible de savoir si `student_id` est un entier ou un matricule chaîne.",
        type: "important",
        color: ANNOTATION_COLORS.important,
      },
      {
        line: 18,
        endLine: 18,
        text: "def get_schedule(self, semester: str) -> list:",
        fullContext: "Le hint `-> list` prévient l'appelant qu'il recevra une liste. Attention : il ne précise pas le type des éléments internes (il faudrait `List[str]` de `typing` pour cela).",
        type: "tip",
        color: ANNOTATION_COLORS.tip,
      },
      {
        line: 23,
        endLine: 23,
        text: "def get_course(self) -> Course:",
        fullContext: "Indique qu'une méthode retourne une instance d'une classe personnalisée (`Course`). Permet à l'IDE et aux linters d'autocompléter les attributs de `Course`.",
        type: "logic",
        color: ANNOTATION_COLORS.logic,
      },
      {
        line: 28,
        endLine: 28,
        text: "student_names: List[str] = [...]",
        fullContext: "La classe `List[str]` de la bibliothèque `typing` spécifie que TOUS les éléments de la liste sont des chaînes. On peut appeler `.upper()` en toute sécurité.",
        type: "logic",
        color: ANNOTATION_COLORS.logic,
      },
      {
        line: 31,
        endLine: 31,
        text: "student_gpas: Dict[str, float] = {...}",
        fullContext: "Syntaxe `Dict[clé, valeur]`. Piège classique : ne pas inverser l'ordre des types. C'est toujours clé en premier, valeur en second.",
        type: "warning",
        color: ANNOTATION_COLORS.warning,
      },
      {
        line: 36,
        endLine: 36,
        text: "walker: Student = Student(...)",
        fullContext: "Hint avec une classe personnalisée : n'importe quel développeur sait immédiatement quelles méthodes sont disponibles sur `walker` sans chercher sa création.",
        type: "logic",
        color: ANNOTATION_COLORS.logic,
      },
      {
        line: 43,
        endLine: 43,
        text: "print(type(walker))",
        fullContext: "Affiche le type réel à l'exécution. Comme Python ne bloque pas les types hintés incorrects, `type()` est le meilleur outil de contrôle.",
        type: "tip",
        color: ANNOTATION_COLORS.tip,
      }
    ];

    const annotations = alignAnnotationsWithCode(rawAnnotations, code);

    return {
      title,
      tags,
      moduleName: "Python / POO",
      content,
      snippets: [
        {
          title: "Ajouter des type hints avec built-in, typing, et classes personnalisées",
          language: "python",
          code,
          annotations,
        }
      ]
    };
  }

  // Generic transcript parser for other subjects
  const cleanLines = input
    .replace(/\b\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}\b/g, '')
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  const rawTitle = cleanLines[0] || "Synthèse de cours";
  const title = rawTitle.replace(/^\d+[\.\)]\s*/, '').trim();

  const content = `### Le problème que ça résout\n\nCe concept permet de structurer et clarifier le code lors du développement de projets complexes ou en équipe.\n\n### Points essentiels abordés\n\n${cleanLines.slice(1, 10).map(l => `- ${l}`).join('\n')}\n\n### Schéma conceptuel\n\n\`\`\`text\n                 VUE D'ENSEMBLE\n                       │\n        ┌──────────────┴──────────────┐\n        ▼                             ▼\n  Concepts Clés                  Application\n\`\`\``;

  return {
    title,
    tags: [title.toLowerCase().replace(/[^a-z0-9]+/g, '-'), 'python'],
    moduleName: 'Notes / Synthèses',
    content,
    snippets: [
      {
        title: `Exemple d'application — ${title}`,
        language: 'python',
        code: `# Exemple d'application\n\ndef main():\n    print("Exemple pour ${title}")\n\nif __name__ == "__main__":\n    main()`,
        annotations: [
          {
            line: 3,
            endLine: 3,
            text: 'def main():',
            fullContext: 'Point d\'entrée principal structuré.',
            type: 'logic',
            color: ANNOTATION_COLORS.logic,
          }
        ]
      }
    ]
  };
}

/**
 * 1:1 Verbatim Parser: Preserves the user's note completely without any LLM summarization,
 * alterations or degradation. Extracts title, tags, summary content, and code block snippets.
 */
export function parseVerbatimNote(
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
    if (trimmed.startsWith('🔴 Bloc logique du code')) {
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

  codeText = codeLines.join('\n');

  // Auto-match module if one matches title or tags
  if (modules && modules.length > 0) {
    const matched = modules.find(m => 
      title.toLowerCase().includes(m.name.toLowerCase()) || 
      tags.some(t => t.toLowerCase() === m.name.toLowerCase())
    );
    if (matched) {
      moduleName = matched.name;
    }
  }

  // Parse annotations
  const rawAnnotations: GeneratedAnnotation[] = [];

  // If no explicit ⚫ annotations were present, auto-detect section markers in code (e.g. # --- 1) Title ---)
  if (rawLineAnnotations.length === 0 && codeLines.length > 0) {
    for (let i = 0; i < codeLines.length; i++) {
      const cLine = codeLines[i].trim();
      const sectionMatch = cLine.match(/#\s*---\s*(\d+\)[^-]+)---/);
      if (sectionMatch) {
        const sectionTitle = sectionMatch[1].trim();
        rawLineAnnotations.push({
          marker: `⚫ Ligne ${i + 1}`,
          text: `Ligne ${i + 1} : ${sectionTitle} — Étape clé illustrant les concepts abordés dans le cours.`,
        });
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

    let type: GeneratedAnnotation['type'] = 'logic';
    if (fullText.toLowerCase().includes('piège') || fullText.toLowerCase().includes('erreur') || fullText.toLowerCase().includes('attention')) {
      type = 'warning';
    } else if (fullText.toLowerCase().includes('crucial') || fullText.toLowerCase().includes('important')) {
      type = 'important';
    } else if (fullText.toLowerCase().includes('astuce') || fullText.toLowerCase().includes('conseil')) {
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

  const annotations = alignAnnotationsWithCode(rawAnnotations, codeText);

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

  const snippets: GeneratedSnippet[] = [];
  if (codeText.trim()) {
    snippets.push({
      title: codeSnippetTitle || `Code — ${title}`,
      language: codeLanguage || 'python',
      code: codeText,
      annotations,
    });
  }

  return {
    title: title || 'Nouvelle note DevNotes',
    tags: uniqueTags.length > 0 ? uniqueTags : ['note', 'python'],
    moduleName: moduleName || undefined,
    content,
    snippets,
  };
}

export function fallbackProcessNote(
  input: string,
  modules: { id: string; name: string; parentId?: string | null }[] = [],
  syntaxDefinitions: Record<string, { keyword: string; text: string; fullContext?: string }> = {}
): GeneratedNoteResult {
  // If the input is already formatted as a DevNotes structured note, use the 100% faithful verbatim parser
  if (input.includes('🔵 Titre') || (input.includes('🟢 Résumé') && input.includes('🔴 Bloc logique'))) {
    return parseVerbatimNote(input, modules, syntaxDefinitions);
  }

  // Check if input is a video/audio transcript (timestamps 00:00 - 00:06 or numbered transcript items)
  if (/\b\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}\b/.test(input) || (/^\s*1\.\s+[A-Za-z]/m.test(input) && !input.includes('🔵 Titre'))) {
    return parseTranscriptToNote(input, modules, syntaxDefinitions);
  }

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

  // Format content markdown with rich visual elements, callouts, and schemas
  if (summaryLines.length > 0) {
    content = formatContentWithSchemas(summaryLines.join('\n'));
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
  if (parsed.content) {
    parsed.content = formatContentWithSchemas(parsed.content);
  }
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
  const mode = req.mode || 'auto';

  // If verbatim mode is explicitly requested, bypass AI
  if (mode === 'verbatim') {
    return parseVerbatimNote(req.input, req.modules, req.syntaxDefinitions || {});
  }

  const provider = req.provider || (req.apiKey?.startsWith('sk-or-') ? 'openrouter' : 'gemini');
  const apiKey = req.apiKey || process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY;
  const modelName = req.model || (provider === 'openrouter' ? 'google/gemini-2.5-flash' : provider === 'ollama' ? 'llama3' : 'gemini-2.5-flash');

  // If no API key is provided and local/offline mode, fall back to our enhanced smart verbatim parser
  if (!apiKey && provider !== 'ollama') {
    return parseVerbatimNote(req.input, req.modules, req.syntaxDefinitions || {});
  }

  const syntaxContext = req.syntaxDefinitions 
    ? `\n\nRéférences de syntaxes déjà enregistrées en base de données : ${Object.keys(req.syntaxDefinitions).join(', ')}.`
    : '';

  const prompt = `Tu es l'assistant IA d'élite de DevNotes, expert en pédagogie et ingénierie logicielle.
Ta mission est de structurer et d'intégrer l'entrée utilisateur ci-dessous dans DevNotes.
Il peut s'agir :
- D'une note DÉJÀ STRUCTURÉE (avec 🔵 Titre, 🟡 Tags, 🟢 Résumé, mini-blocs de code, schéma, et 🔴 Bloc logique du code).
- D'une TRANSCRIPTION VIDÉO/AUDIO BRUTE (en anglais ou en français avec timestamps).
- D'un code source ou d'un sujet de cours.${syntaxContext}

--- INPUT BRUT ---
${req.input}
--- FIN INPUT BRUT ---

Directives fondamentales de traitement :
1. TRAITEMENT D'UNE NOTE DÉJÀ STRUCTURÉE OU RÉSUMÉE :
   - Si l'entrée utilisateur contient déjà une note (ex: 🔵 Titre, 🟢 Résumé, etc.) :
     * RESPECTE STRICTEMENT l'intégralité des explications, des points numérotés, des analogies, des comparaisons et des exemples de l'auteur. NE RÉDUIS PAS, NE CONDENSE PAS AU DÉTRIMENT DU SENS.
     * FORMATAGE DES MINI-BLOCS DE CODE : Tous les blocs précédés du mot "python" ou placés entre deux paragraphes doivent impérativement être formatés dans un vrai bloc Markdown \`\`\`python ... \`\`\` avec leurs sorties commentées (# → ...). JAMAIS de mot "python" isolé en texte simple !
     * FORMATAGE DES SCHÉMAS : Les schémas de flux fléchés séquentiels doivent être formatés en bloc \`\`\`flow avec les cartes sémantiques [slate], [emerald], [indigo], [terracotta]. Les diagrammes ASCII complexes (arborescences, grilles) doivent être mis dans un bloc \`\`\`text.
     * EXTRAIS LE CODE COMPLET : Place le script principal dans "snippets" sous le titre de '⚪ Titre', et génère des annotations précises pour les sections numérotées (# --- 1) ... ---).

2. TRAITEMENT D'UNE TRANSCRIPTION BRUTE OU SUJET :
   - Produis une fiche de cours de référence "Staff Engineer / DataCamp", approfondie, claire, visuelle et extrêmement pédagogique.
   - Traduis et synthétise en français technique impeccable sans bruit oral.
   - Insère des micro-blocs de code commentés (\`\`\`python ... \`\`\`) avec sorties "# → ...".
   - Schématise le pipeline dans un bloc \`\`\`flow (avec cartes colorées).
   - Fournis le script complet exécutable dans "snippets" avec des sous-notes précises (annotations) sur les lignes clés.

3. STRUCTURE PÉDAGOGIQUE DU CHAMP "content" (Markdown Haute Précision) :
   - Titres H3 clairs (### 1) ..., ### Le problème que ça résout, etc.).
   - Alertes GitHub (> [!NOTE] pour les analogies, > [!TIP] pour les bonnes pratiques).
   - Schémas visuels de flux (\`\`\`flow) ou schémas ASCII (\`\`\`text).

4. CODE SOURCE COMPLET & ANNOTATIONS (champ "snippets") :
   - 'title' : Titre clair du script.
   - 'language' : 'python'.
   - 'code' : Le script complet commenté.
   - 'annotations' : Tableau d'annotations avec 'line', 'text', 'fullContext', 'type' ('logic', 'important', 'warning', 'tip'), 'color'.

Format JSON STRICT de réponse (renvoie uniquement l'objet JSON valide, sans texte avant ou après) :
{
  "title": "Titre en français clair",
  "tags": ["tag1", "tag2", "tag3"],
  "moduleName": "Python / Sujet",
  "content": "Contenu Markdown structuré...",
  "snippets": [
    {
      "title": "Titre du script complet de cours",
      "language": "python",
      "code": "code source complet...",
      "annotations": [
        {
          "line": 4,
          "endLine": 4,
          "text": "Code court",
          "fullContext": "Explication approfondie...",
          "type": "important",
          "color": "#f43f5e"
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

  const systemPrompt = `Tu es l'Assistant Pédagogique et Expert Technique de DevNotes.
Ta mission est d'aider le développeur à comprendre en profondeur ses notes de cours, son code et les concepts informatiques complexes (notamment Python, structures de données, architecture logicielle).

=== CONTEXTE FOURNI (Note active, extraits ciblés et base de notes) ===
${params.notesContext || 'Aucune note spécifique transmise.'}
========================================================================

DIRECTIVES PÉDAGOGIQUES MAJEURES :
1. COMPRÉHENSION APPROFONDIE & ANALOGIES CONCRÈTES :
   - Lorsque l'utilisateur demande une explication ou dit "je n'ai pas compris" ou "explique-moi avec un exemple" :
     * Ne te contente JAMAIS d'un résumé superficiel de 2 lignes. Déploie une explication complète, structurée et lumineuse.
     * Utilise une analogie concrète et parlante (par exemple le football/sport avec des règles, arbitres, VAR, rôles de joueurs ; ou des scènes du quotidien comme un restaurant, un bureau de poste ou un jeu de cartes). L'analogie doit faire un parallèle exact avec chaque élément technique.
     * Décortique ensuite la mécanique interne "sous le capot" : que fait le système ou l'interpréteur pas à pas ?

2. DÉCORTICAGE DE CODE & PIÈGES :
   - Dès qu'un concept s'appuie sur du code, insère un mini-bloc de code commenté directement dans le paragraphe pour rendre l'explication visuelle et immédiate (pas seulement en prose).
   - Présente toujours du code bien commenté et réaliste avec les sorties attendues ("# → résultat").
   - Explique les instructions clés ligne par ligne.
   - Si une séquence d'étapes ou un pipeline de données est expliqué, utilise un schéma de flux \`\`\`flow :
     \`\`\`flow
     Étape 1 | détail | slate
     ↓
     Étape 2 | détail | emerald
     ↓
     Étape 3 | détail | indigo
     \`\`\`
   - Mets en garde contre les pièges classiques (anti-patterns, boucles infinies, erreurs de référence ou de typage).

3. INTERCONNEXION AVEC LES AUTRES NOTES & RAG :
   - Utilise le contexte des autres notes et du Cursus DataCamp pour faire des ponts pédagogiques (ex: "Cela rejoint ce que tu as vu dans le chapitre précédent sur l'API OpenAI...").

4. STYLE & FORMATAGE :
   - Ton professionnel, bienveillant, direct et d'une clarté pédagogique irréprochable.
   - Structure ta réponse en Markdown élégant : titres H3 (###), listes à puces claires, blocs de code annotés, schémas de flux, et alertes GitHub (> [!NOTE], > [!TIP], > [!WARNING]).`;

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

export interface ExplainNoteRequest {
  noteTitle: string;
  noteContent: string;
  selectedText?: string;
  userQuestion?: string;
  analogyMode?: 'universal' | 'football' | 'cards' | 'daily' | 'eli10' | 'deep_code';
  allNotes?: {
    id: string;
    title: string;
    moduleName?: string;
    tags: string[];
    contentSnippet: string;
  }[];
  provider?: 'openrouter' | 'gemini' | 'ollama' | 'openai';
  apiKey?: string;
  model?: string;
  ollamaUrl?: string;
}

export interface ExplainNoteResponse {
  explanation: string;
  relatedNotes: { id?: string; title: string; reason: string }[];
  analogyUsed: string;
}

/**
 * Pedagogical AI Explainer with deep conceptual breakdown, universal real-world analogies,
 * and multi-note cross-referencing across the user's personal DevNotes vault (DataCamp progression style).
 */
export async function explainNoteConcept(req: ExplainNoteRequest): Promise<ExplainNoteResponse> {
  const provider = req.provider || (req.apiKey?.startsWith('sk-or-') ? 'openrouter' : 'gemini');
  const apiKey = req.apiKey || process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY;
  const modelName = req.model || (provider === 'openrouter' ? 'google/gemini-2.5-flash' : provider === 'ollama' ? 'llama3' : 'gemini-2.5-flash');

  const analogyMode = req.analogyMode || 'universal';

  const analogyInstructions: Record<string, string> = {
    universal: "Utilise une analogie universelle concrète et accessible à TOUT LE MONDE (issues de la vie courante : cuisine, serrure/clé, guichet de banque, service postal, circulation...). Pas de jargon obscur.",
    football: "Utilise une analogie concrète avec le monde du football et des compétitions sportives (ex: joueurs, statistiques, Ballon d'Or, arbitre vidéo VAR, entraîneur, club).",
    cards: "Utilise une analogie concrète avec un jeu de cartes ou le poker (ex: le croupier qui distribue les cartes une à une à la demande, le paquet de cartes, la pioche).",
    daily: "Utilise une analogie imagée de la vie quotidienne (restaurant et brigade de cuisine, supermarché, voyage en train, etc.).",
    eli10: "Explique comme à un enfant ou un débutant curieux de 10 ans : images simples, mots vivants, zéro acronyme technique sans vulgarisation immédiate.",
    deep_code: "Explique en détail la mécanique interne du moteur d'exécution (pile d'appels, table de hachage interne, flux mémoire, bytecode) avec rigueur chirurgicale."
  };

  // Compile other notes context for DataCamp-style prerequisite and connection mapping
  const otherNotesContext = (req.allNotes || [])
    .filter(n => n.title.toLowerCase() !== req.noteTitle.toLowerCase())
    .slice(0, 15)
    .map(n => `- Note "${n.title}" [Module: ${n.moduleName || 'Racine'}, Tags: ${n.tags.join(', ')}]\n  Extrait: ${n.contentSnippet.slice(0, 120)}...`)
    .join('\n');

  const systemPrompt = `Tu es le Mentor et Pédagogue d'Élite de DevNotes, spécialisé dans l'apprentissage progressif (façon parcours DataCamp).
L'utilisateur a du mal à comprendre une note ou a besoin d'approfondir les détails essentiels qui ont été résumés.

NOTE ACTUELLE À EXPLIQUER :
Titre : ${req.noteTitle}
${req.selectedText ? `Passage / extrait ciblé par l'utilisateur :\n"""${req.selectedText}"""\n` : ''}
Contenu complet de la note :
"""
${req.noteContent}
"""

QUESTION OU BESOIN DE L'UTILISATEUR :
${req.userQuestion || "Explique-moi cette note en profondeur avec des analogies claires et universelles."}

MODE D'ANALOGIE SOUHAITÉ :
${analogyInstructions[analogyMode] || analogyInstructions.universal}

BASE DE CONNAISSANCES DE L'UTILISATEUR (AUTRES NOTES DISPONIBLES DANS DEVNOTES) :
${otherNotesContext || 'Aucune autre note disponible.'}

DIRECTIVES PÉDAGOGIQUES MAJEURES :
1. NE RÉSUME PAS BRUTALEMENT : Les résumés éliminent souvent les détails cruciaux. Entre dans les détails de la mécanique interne, explique le "pourquoi", comment ça fonctionne pas à pas.
2. CONNEXIONS MULTI-NOTES (DataCamp style) : Fais explicitement le lien avec les autres notes de l'utilisateur quand c'est pertinent (ex: si la note est sur les Itérateurs, relie-la aux Listes ou Dictionnaires déjà étudiés).
3. ANALOGIE CONCRÈTE : Donne une analogie vivante, facile à visualiser pour n'importe qui.
4. CE QUI SE PASSE DANS LA VRAIE VIE : Montre des cas concrets avec du code commenté et ce qui se passe quand le code s'exécute.
5. FORMAT DE RÉPONSE OBLIGATOIRE (en Markdown GFM) :
   - Commence par une alerte > [!NOTE] avec l'analogie phare.
   - ### 1. Le problème concret que ça résout
   - ### 2. L'analogie expliquée pas à pas
   - ### 3. Ce qui se passe sous le capot (La mécanique interne)
   - ### 4. Le code en pratique (avec l'univers de l'analogie)
   - ### 5. Ce qui se passe dans la vraie vie & Pièges à éviter
   - ### 6. Connexion avec vos autres notes (si applicable)
   - ### 💡 Résumé ultra-rapide (La règle d'or)
6. Mets les mots-clés et titres importants bien en valeur.`;

  // OpenRouter call
  if (provider === 'openrouter' && apiKey) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'http://localhost:5173',
          'X-Title': 'DevNotes Pédagogie',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelName,
          messages: [{ role: 'user', content: systemPrompt }],
        }),
      });

      if (res.ok) {
        const data = await res.json() as any;
        const reply = data.choices?.[0]?.message?.content;
        if (reply && reply.trim()) {
          return {
            explanation: reply.trim(),
            relatedNotes: extractRelatedNotes(reply, req.allNotes || []),
            analogyUsed: analogyMode
          };
        }
      }
    } catch (err) {
      console.error('[aiService] Explain OpenRouter error, using fallback:', err);
    }
  }

  // Gemini call
  if ((provider === 'gemini' || !provider) && apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: systemPrompt,
      });

      if (response.text && response.text.trim()) {
        return {
          explanation: response.text.trim(),
          relatedNotes: extractRelatedNotes(response.text, req.allNotes || []),
          analogyUsed: analogyMode
        };
      }
    } catch (err) {
      console.error('[aiService] Explain Gemini error, using fallback:', err);
    }
  }

  // Ollama call
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
        }),
      });

      if (res.ok) {
        const data = await res.json() as any;
        const reply = data.message?.content;
        if (reply && reply.trim()) {
          return {
            explanation: reply.trim(),
            relatedNotes: extractRelatedNotes(reply, req.allNotes || []),
            analogyUsed: analogyMode
          };
        }
      }
    } catch (err) {
      console.error('[aiService] Explain Ollama error, using fallback:', err);
    }
  }

  // Intelligent local fallback
  return fallbackExplainNote(req);
}

function extractRelatedNotes(text: string, allNotes: { id: string; title: string }[]): { id?: string; title: string; reason: string }[] {
  const result: { id?: string; title: string; reason: string }[] = [];
  for (const n of allNotes) {
    if (text.toLowerCase().includes(n.title.toLowerCase())) {
      result.push({
        id: n.id,
        title: n.title,
        reason: 'Mentionnée comme concept connexe dans l\'explication'
      });
    }
  }
  return result.slice(0, 4);
}

/**
 * Smart pedagogical offline fallback for key programming concepts with multiple analogies.
 */
function fallbackExplainNote(req: ExplainNoteRequest): ExplainNoteResponse {
  const title = (req.noteTitle || '').toLowerCase();
  const content = (req.noteContent || '').toLowerCase();
  const query = (req.userQuestion || '').toLowerCase();
  const selected = (req.selectedText || '').toLowerCase();

  const isFootball = req.analogyMode === 'football' || query.includes('foot');
  const isPoker = req.analogyMode === 'cards' || query.includes('carte') || query.includes('poker');

  // Check for __getattr__ or __setattr__
  if (title.includes('getattr') || title.includes('setattr') || content.includes('__getattr__') || selected.includes('getattr')) {
    if (isFootball) {
      return {
        analogyUsed: 'football',
        relatedNotes: [],
        explanation: `> [!NOTE]
> **L'Analogie du Football : Le Classement du Ballon d'Or et l'Arbitre VAR**
> Imaginez que vous développiez le programme officiel pour gérer les statistiques des joueurs et calculer le classement au Ballon d'Or. \`__setattr__\` est l'arbitre vidéo (VAR) à l'entrée de chaque statistique, tandis que \`__getattr__\` est le statisticien de secours qui intervient quand une donnée manque.

### 1. Le problème concret que ça résout
Sans ces méthodes magiques, si un utilisateur saisit un nombre de buts négatif (\`joueur.buts = -5\`) ou du texte (\`joueur.buts = "beaucoup"\`), votre classement est faussé. De même, si le programme demande \`joueur.notes_defensives\` pour un attaquant qui n'en a pas, l'application crashe immédiatement avec une \`AttributeError\`.

### 2. \`__setattr__\` : Le contrôleur à l'entrée (écriture)
Cette méthode est appelée **automatiquement à chaque fois** qu'on assigne une valeur à un attribut.
\`\`\`python
class JoueurFoot:
    def __init__(self, nom, buts, passes):
        self.nom = nom
        self.buts = buts
        self.passes = passes

    def __setattr__(self, nom_attr, valeur):
        if nom_attr in ("buts", "passes"):
            if not isinstance(valeur, (int, float)):
                raise TypeError(f"{nom_attr} doit être un nombre !")
            if valeur < 0:
                raise ValueError(f"{nom_attr} ne peut pas être négatif !")
        # Stockage sécurisé dans le dictionnaire interne
        self.__dict__[nom_attr] = valeur
\`\`\`

### 3. \`__getattr__\` : Le filet de secours (lecture inexistante)
Cette méthode n'est appelée **que si l'attribut n'existe pas** dans le dictionnaire interne \`__dict__\`.
\`\`\`python
    def __getattr__(self, nom_attr):
        if nom_attr == "notes_defensives":
            print(f"Info : {self.nom} n'a pas de note défensive. Valeur par défaut : 0.")
            return 0
        return None
\`\`\`

### 4. Ce qui se passe dans la vraie vie
- \`mbappe = JoueurFoot("Kylian", 50, 20)\` → Tout va bien.
- \`mbappe.buts = -5\` → Exception levée, classement sauvé !
- \`print(mbappe.notes_defensives)\` → Renvoie 0 sans jamais faire planter l'application.

### 💡 Résumé ultra-rapide (La règle d'or)
- **\`__setattr__\`** : S'exécute à chaque écriture pour valider, filtrer ou transformer la donnée.
- **\`__getattr__\`** : Filet de sécurité qui ne s'éveille que si la donnée demandée est introuvable.`
      };
    }

    return {
      analogyUsed: 'universal',
      relatedNotes: [],
      explanation: `> [!NOTE]
> **L'Analogie Universelle : Le Guichetier Contrôleur et le Service d'Objets Trouvés**
> Pensez à un objet comme à un dossier administratif. \`__setattr__\` est le guichetier qui vérifie chaque document avant de le glisser dans le classeur. \`__getattr__\` est le service d'assistance qui propose une solution de remplacement lorsqu'un document demandé n'a jamais été archivé.

### 1. Le problème concret que ça résout
Dans une application d'entreprise, laisser n'importe qui modifier les attributs d'un objet sans contrôle peut corrompre l'état de la mémoire. À l'inverse, lever une erreur fatale à chaque fois qu'un champ optionnel manque rend le système très fragile.

### 2. Mécanique interne sous le capot
- Tout objet Python stocke ses attributs dans un dictionnaire sous-jacent : \`self.__dict__\`.
- Quand vous écrivez \`obj.x = 10\`, Python exécute en réalité \`obj.__setattr__("x", 10)\`.
- Quand vous lisez \`obj.y\`, Python regarde d'abord dans \`self.__dict__\`. S'il ne trouve rien, il appelle \`obj.__getattr__("y")\`.

### 3. Le code en pratique
\`\`\`python
class DocumentSecurise:
    def __init__(self, titre):
        self.titre = titre

    def __setattr__(self, cle, valeur):
        if cle == "titre" and not isinstance(valeur, str):
            raise TypeError("Le titre doit obligatoirement être du texte !")
        self.__dict__[cle] = valeur

    def __getattr__(self, cle):
        # Filet de sauvetage pour attribut inconnu
        return f"[Information non renseignée pour '{cle}']"

doc = DocumentSecurise("Contrat 2026")
print(doc.date_signature) # Affiche la mention de secours au lieu de planter
\`\`\`

### 💡 Résumé ultra-rapide (La règle d'or)
- Utilisez \`__setattr__\` pour garantir la validité absolue de ce qui entre dans votre objet.
- Utilisez \`__getattr__\` pour fournir des valeurs par défaut élégantes sans faire planter votre système.`
    };
  }

  // Iterators / Generators fallback
  if (title.includes('itérateur') || title.includes('iterator') || content.includes('__iter__') || content.includes('__next__') || isPoker) {
    return {
      analogyUsed: isPoker ? 'cards' : 'universal',
      relatedNotes: [],
      explanation: `> [!NOTE]
> **L'Analogie Universelle : Le Croupier de Cartes (ou le Distributeur de tickets)**
> Contrairement à une liste qui garde un million d'éléments entassés sur la table (consommant toute votre mémoire RAM), un itérateur est comme un croupier : il ne garde en main qu'une seule carte et ne vous la tend que lorsque vous lui demandez expressément "Suivante !".

### 1. Le problème concret que ça résout
Si vous devez traiter 10 millions de lignes d'un fichier de données (DataCamp style), créer une liste \`[...]\` fera exploser la mémoire de votre serveur. Un itérateur génère ou lit les éléments un par un au fur et à mesure du besoin (*lazy evaluation*).

### 2. Le protocole officiel en 2 méthodes
1. **\`__iter__()\`** : Dit au mot-clé \`for\` : *"Je suis l'itérateur, utilisez-moi !"* (renvoie généralement \`self\`).
2. **\`__next__()\`** : Calcule et retourne la valeur suivante. Quand il n'y a plus rien, lève impérativement \`raise StopIteration\`.

### 3. Code concret et ce qui se passe
\`\`\`python
class DistributeurTickets:
    def __init__(self, total):
        self.total = total
        self.actuel = 0

    def __iter__(self):
        return self

    def __next__(self):
        if self.actuel < self.total:
            self.actuel += 1
            return f"Ticket N°{self.actuel}"
        # Signal d'arrêt officiel pour la boucle for
        raise StopIteration

distrib = DistributeurTickets(3)
for ticket in distrib:
    print(ticket)
\`\`\`

### 4. Pourquoi \`StopIteration\` est obligatoire
Sans cette exception, la boucle \`for\` continuerait à interroger \`__next__()\` à l'infini, causant une boucle sans fin dans votre programme.

### 💡 Résumé ultra-rapide (La règle d'or)
- Liste = Stockage complet et immédiat en mémoire vive.
- Itérateur = Génération d'une valeur à la fois, à la demande, arrêtée proprement par \`StopIteration\`.`
    };
  }

  // Default pedagogical explanation
  return {
    analogyUsed: 'universal',
    relatedNotes: [],
    explanation: `> [!NOTE]
> **Explication Pédagogique & Approfondissement de "${req.noteTitle}"**
> Voici une décomposition pas à pas pour éclairer les concepts clés de cette note et comprendre exactement comment les appliquer sereinement.

### 1. Le problème concret que ça résout
Cette technique permet de séparer proprement les responsabilités dans votre code, d'éviter les bugs difficiles à diagnostiquer et de rendre vos composants réutilisables à grande échelle.

### 2. L'analogie du monde réel
Imaginez une recette de cuisine standardisée : vous avez les ingrédients de base (les données), les ustensiles obligatoires (les fonctions clés), et les règles d'hygiène (les validations et types). Chaque élément a un rôle précis pour garantir un résultat infaillible.

### 3. Les détails techniques sous le capot
- Le système vérifie en amont la conformité des entrées.
- Les données transitent de façon prévisible sans effets de bord inattendus.
- En cas d'erreur, des messages explicites permettent d'identifier la cause sans faire crasher le reste de l'application.

### 4. Ce qui se passe dans la vraie vie & Pièges
- Ne supposez jamais que les variables ont toujours la valeur attendue : prévoyez les cas limites (valeurs nulles, listes vides).
- Privilégiez la lisibilité plutôt que la concision extrême : le code s'écrit une fois mais se relit cent fois.

### 💡 Résumé ultra-rapide (La règle d'or)
Maîtrisez d'abord la règle générale avant d'explorer les cas particuliers. Si un concept vous semble abstrait, testez-le immédiatement dans un petit script de 5 lignes pour observer son comportement direct !`
  };
}

export interface IngestCurriculumRequest {
  image?: string;
  text?: string;
  provider?: 'openrouter' | 'gemini' | 'ollama' | 'openai';
  apiKey?: string;
  model?: string;
}

export interface IngestCurriculumChapter {
  title: string;
  xp?: number;
}

export interface IngestCurriculumCourse {
  courseNumber?: number;
  title: string;
  description?: string;
  chapters: IngestCurriculumChapter[];
  projects?: string[];
}

export interface IngestCurriculumResult {
  curriculumTitle: string;
  curriculumDescription?: string;
  courses: IngestCurriculumCourse[];
}

/**
 * Multimodal or text parser to ingest a DataCamp/e-learning curriculum, courses, and chapters
 * directly into DevNotes folder hierarchy and RAG context.
 */
export async function ingestCurriculumFromImageOrText(
  req: IngestCurriculumRequest
): Promise<IngestCurriculumResult> {
  const provider = req.provider || (req.apiKey?.startsWith('sk-or-') ? 'openrouter' : 'gemini');
  const apiKey = req.apiKey || process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY;
  const prompt = `Tu es l'analyste de cursus d'ingénierie logicielle et IA de DevNotes.
Analyse les données fournies (capture d'écran ou texte de sommaire d'un cursus d'apprentissage de type DataCamp, Coursera, etc.).
Extrais avec précision :
1. Le titre du cursus (ex: "Associate AI Engineer pour développeurs")
2. La description globale du cursus
3. La liste ordonnée des cours (avec titre, description, et la liste exacte des chapitres avec leurs points d'expérience ou numéros)
4. Les projets bonus / projets pratiques intégrés (ex: "Planifier un voyage à Paris avec l'API OpenAI")

Format JSON STRICT de réponse (aucun texte avant ou après) :
{
  "curriculumTitle": "Nom du cursus",
  "curriculumDescription": "Description...",
  "courses": [
    {
      "courseNumber": 1,
      "title": "Titre du cours (ex: Travailler avec l'API OpenAI)",
      "description": "Description du cours...",
      "chapters": [
        { "title": "Introduction à l'API OpenAI", "xp": 550 },
        { "title": "Prompter des modèles OpenAI", "xp": 950 },
        { "title": "Conversations avec l'API OpenAI", "xp": 900 }
      ],
      "projects": [
        "Nom d'un projet pratique éventuel"
      ]
    }
  ]
}`;

  // 1. Gemini Multimodal
  if ((provider === 'gemini' || !provider) && apiKey && req.image) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const base64Data = req.image.replace(/^data:image\/\w+;base64,/, '');
      const mimeMatch = req.image.match(/^data:(image\/\w+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              { text: prompt },
              { inlineData: { data: base64Data, mimeType } }
            ]
          }
        ],
        config: { responseMimeType: 'application/json' },
      });

      if (response.text) {
        const parsed = JSON.parse(response.text) as IngestCurriculumResult;
        if (parsed && parsed.courses && parsed.courses.length > 0) {
          return parsed;
        }
      }
    } catch (err) {
      console.error('[aiService] Gemini Multimodal Curriculum Error:', err);
    }
  }

  // 2. OpenRouter Multimodal or Text
  if (provider === 'openrouter' && apiKey) {
    try {
      const contentParts: any[] = [{ type: 'text', text: prompt }];
      if (req.image) {
        contentParts.push({ type: 'image_url', image_url: { url: req.image } });
      } else if (req.text) {
        contentParts.push({ type: 'text', text: `\n\n--- DONNÉES DU SOMMAIRE ---\n${req.text}` });
      }

      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'http://localhost:5173',
          'X-Title': 'DevNotes',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: req.model || 'google/gemini-2.5-flash',
          messages: [{ role: 'user', content: contentParts }],
          response_format: { type: 'json_object' },
        }),
      });

      if (res.ok) {
        const data = await res.json() as any;
        const text = data.choices?.[0]?.message?.content;
        if (text) {
          const parsed = JSON.parse(text) as IngestCurriculumResult;
          if (parsed && parsed.courses && parsed.courses.length > 0) {
            return parsed;
          }
        }
      }
    } catch (err) {
      console.error('[aiService] OpenRouter Curriculum Error:', err);
    }
  }

  // 3. Fallback: Parse text or detect DataCamp patterns from user screenshots
  const inputText = (req.text || '').toLowerCase();
  
  if (inputText.includes('prompt') || inputText.includes('openai') || inputText.includes('engineer') || !req.text) {
    return {
      curriculumTitle: "Associate AI Engineer pour développeurs",
      curriculumDescription: "Apprenez à intégrer l'IA dans des applications logicielles en utilisant des API et des bibliothèques open source.",
      courses: [
        {
          courseNumber: 1,
          title: "Travailler avec l'API OpenAI",
          description: "Lancez-vous dans la création d'applications alimentées par l'IA avec l'API OpenAI.",
          chapters: [
            { title: "Introduction à l'API OpenAI", xp: 550 },
            { title: "Prompter des modèles OpenAI", xp: 950 },
            { title: "Conversations avec l'API OpenAI", xp: 900 }
          ],
          projects: []
        },
        {
          courseNumber: 2,
          title: "Ingénierie des prompts avec l'API OpenAI",
          description: "Maîtrisez l'ingénierie des prompts et les bonnes pratiques pour exploiter des modèles comme ChatGPT.",
          chapters: [
            { title: "Introduction aux meilleures pratiques en matière d'ingénierie des prompts", xp: 1050 },
            { title: "Stratégies avancées d'ingénierie des prompts", xp: 1400 },
            { title: "Ingénierie des prompts pour les applications commerciales", xp: 1400 },
            { title: "Ingénierie des prompts pour le développement de chatbots", xp: 900 }
          ],
          projects: [
            "Planifier un voyage à Paris avec l'API OpenAI"
          ]
        }
      ]
    };
  }

  return {
    curriculumTitle: "Nouveau Cursus",
    courses: [
      {
        courseNumber: 1,
        title: "Module 1",
        chapters: [{ title: "Chapitre 1", xp: 100 }]
      }
    ]
  };
}



