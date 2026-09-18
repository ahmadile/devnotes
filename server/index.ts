import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import helmet from 'helmet';
import { clerkMiddleware, getAuth } from '@clerk/express';
import { getMongoClient, getMongoDbName } from './db.js';
import { processNoteWithAI, chatWithAI, generateRevisionSession, evaluateRevisionCode, generateProjectBlueprint, explainNoteConcept, ingestCurriculumFromImageOrText, generateDiagramWithAI } from './aiService.js';
import dns from 'dns';

import fs from 'fs';

// Force IPv4 resolution to prevent Node.js 18+ from hanging on Clerk API/JWKS fetch via IPv6
try { dns.setDefaultResultOrder('ipv4first'); } catch (e) {}

dotenv.config({ path: '.env.local' });
dotenv.config();

if (!process.env.CLERK_PUBLISHABLE_KEY && process.env.VITE_CLERK_PUBLISHABLE_KEY) {
  process.env.CLERK_PUBLISHABLE_KEY = process.env.VITE_CLERK_PUBLISHABLE_KEY;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3001);

const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

type StoredNotesDoc = {
  userId: string;
  notes: unknown[];
  syntaxDefinitions?: Record<string, any>;
  modules?: unknown[];
  updatedAt: number;
};

const app = express();

// Security Middlewares
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "script-src": ["'self'", "'unsafe-inline'", "*.clerk.accounts.dev", "clerk.devnotes.local"],
      "connect-src": ["'self'", "*.clerk.accounts.dev", "clerk.devnotes.local"],
      "img-src": ["'self'", "data:", "blob:", "https:", "http:", "img.clerk.com"],
      "worker-src": ["'self'", "blob:"],
      "font-src": ["'self'", "fonts.gstatic.com"],
      "style-src": ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
    },
  },
}));
app.use(cors());
app.use((req, res, next) => {
  clerkMiddleware()(req, res, (err) => {
    if (err) {
      console.warn('[devnotes-api] Clerk auth warning (proceeding unauthenticated):', err.message);
    }
    next();
  });
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve uploaded images statically
app.use('/uploads', express.static(uploadsDir));

  function getAuthUserId(req: any): string | null {
    const apiKey = req.headers['x-api-key'];
    if (apiKey && process.env.AGENT_API_KEY && apiKey === process.env.AGENT_API_KEY) {
      return process.env.AGENT_USER_ID || null;
    }
    return getAuth(req).userId || null;
  }

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/upload-image', async (req, res) => {
    try {
      const { image, filename } = req.body || {};
      if (!image) {
        res.status(400).json({ error: 'No image data provided' });
        return;
      }

      // Check if it's a base64 data URL
      const match = image.match(/^data:image\/(\w+);base64,(.+)$/);
      if (!match) {
        if (typeof image === 'string' && (image.startsWith('http://') || image.startsWith('https://') || image.startsWith('/uploads/'))) {
          res.json({ ok: true, url: image });
          return;
        }
        res.status(400).json({ error: 'Invalid image format' });
        return;
      }

      const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
      const base64Data = match[2];
      const buffer = Buffer.from(base64Data, 'base64');

      const cleanName = (filename || 'note_image').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
      const fileName = `${cleanName}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;
      const filePath = path.join(uploadsDir, fileName);

      await fs.promises.writeFile(filePath, buffer);
      res.json({ ok: true, url: `/uploads/${fileName}` });
    } catch (err: any) {
      console.error('Image upload error:', err);
      res.status(500).json({ error: err.message || 'Failed to save image' });
    }
  });

  app.get('/api/notes', async (req, res) => {
    const userId = getAuthUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    try {
      const client = await getMongoClient();
      const db = client.db(getMongoDbName());
      const doc = await db.collection<StoredNotesDoc>('app').findOne({ userId });
      res.json({ 
        notes: doc?.notes ?? [], 
        syntaxDefinitions: doc?.syntaxDefinitions ?? {}, 
        modules: doc?.modules ?? [],
        updatedAt: doc?.updatedAt ?? null 
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  app.put('/api/notes', async (req, res) => {
    const userId = getAuthUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const body = req.body as { notes?: unknown; syntaxDefinitions?: unknown; modules?: unknown };
    if (!body || !Array.isArray(body.notes)) {
      res.status(400).json({ error: 'Body must be { notes: [] }' });
      return;
    }

    try {
      const client = await getMongoClient();
      const db = client.db(getMongoDbName());
      const updatedAt = Date.now();
      await db.collection<StoredNotesDoc>('app').updateOne(
        { userId },
        { $set: { notes: body.notes, syntaxDefinitions: body.syntaxDefinitions ?? {}, modules: Array.isArray(body.modules) ? body.modules : [], updatedAt } },
        { upsert: true },
      );
      res.json({ ok: true, updatedAt });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  app.post('/api/ai/process-note', async (req, res) => {
    try {
      console.log(`[API] POST /api/ai/process-note received - length: ${req.body?.input?.length || 0}, provider: ${req.body?.provider}`);
      const { input, mode, modules, syntaxDefinitions, provider, apiKey, model, ollamaUrl } = req.body || {};
      if (!input || typeof input !== 'string') {
        res.status(400).json({ error: 'Input text is required' });
        return;
      }

      const result = await processNoteWithAI({ input, mode, modules: modules || [], syntaxDefinitions, provider, apiKey, model, ollamaUrl });
      console.log(`[API] Note generated successfully: "${result.title}"`);
      res.json({ ok: true, note: result });
    } catch (err: any) {
      console.error('[API ERROR] /api/ai/process-note failed:', err);
      res.status(500).json({ error: err instanceof Error ? err.message : 'AI Processing error' });
    }
  });

  app.post('/api/ai/ingest-curriculum', async (req, res) => {
    try {
      const { image, text, provider, apiKey, model } = req.body || {};
      const result = await ingestCurriculumFromImageOrText({ image, text, provider, apiKey, model });
      res.json({ ok: true, curriculum: result });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Curriculum Ingestion error' });
    }
  });

  app.post('/api/ai/chat', async (req, res) => {
    try {
      const { messages, notesContext, provider, apiKey, model, ollamaUrl } = req.body || {};
      if (!Array.isArray(messages) || messages.length === 0) {
        res.status(400).json({ error: 'Messages array is required' });
        return;
      }

      const reply = await chatWithAI({ messages, notesContext, provider, apiKey, model, ollamaUrl });
      res.json({ ok: true, reply });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'AI Chat error' });
    }
  });

  app.post('/api/ai/revision', async (req, res) => {
    try {
      const { topic, existingNotes, syntaxDefinitions, activeNoteId, provider, apiKey, model, ollamaUrl } = req.body || {};
      if (!topic || typeof topic !== 'string') {
        res.status(400).json({ error: 'Topic is required' });
        return;
      }

      const session = await generateRevisionSession({
        topic,
        existingNotes: existingNotes || [],
        syntaxDefinitions,
        activeNoteId,
        provider,
        apiKey,
        model,
        ollamaUrl
      });
      res.json({ ok: true, session });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'AI Revision error' });
    }
  });

  app.post('/api/ai/revision/evaluate', async (req, res) => {
    try {
      const { exerciseTitle, exerciseInstructions, userCode, solutionCode, provider, apiKey, model, ollamaUrl } = req.body || {};
      if (!userCode || !exerciseTitle) {
        res.status(400).json({ error: 'userCode and exerciseTitle are required' });
        return;
      }

      const evaluation = await evaluateRevisionCode({
        exerciseTitle,
        exerciseInstructions: exerciseInstructions || '',
        userCode,
        solutionCode: solutionCode || '',
        provider,
        apiKey,
        model,
        ollamaUrl
      });
      res.json({ ok: true, evaluation });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'AI Evaluation error' });
    }
  });

  app.post('/api/ai/architect', async (req, res) => {
    try {
      const { projectIdea, notesContext, syntaxDefinitions, targetModuleName, provider, apiKey, model, ollamaUrl } = req.body || {};
      if (!projectIdea || typeof projectIdea !== 'string') {
        res.status(400).json({ error: 'Project idea is required' });
        return;
      }

      const blueprint = await generateProjectBlueprint({
        projectIdea,
        notesContext: notesContext || [],
        syntaxDefinitions,
        targetModuleName,
        provider,
        apiKey,
        model,
        ollamaUrl
      });
      res.json({ ok: true, blueprint });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'AI Architect error' });
    }
  });

  app.post('/api/ai/generate-diagram', async (req, res) => {
    try {
      const { title, content, provider, apiKey, model, ollamaUrl } = req.body || {};
      if (!content || typeof content !== 'string') {
        res.status(400).json({ error: 'Content is required to generate diagram' });
        return;
      }

      const result = await generateDiagramWithAI({
        title: title || 'Schéma Visuel',
        content,
        provider,
        apiKey,
        model,
        ollamaUrl,
      });

      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to generate diagram' });
    }
  });

  app.post('/api/ai/explain', async (req, res) => {
    try {
      const { noteTitle, noteContent, selectedText, userQuestion, analogyMode, allNotes, provider, apiKey, model, ollamaUrl } = req.body || {};
      if (!noteTitle && !noteContent && !selectedText) {
        res.status(400).json({ error: 'Note title, content or selected text is required' });
        return;
      }

      const result = await explainNoteConcept({
        noteTitle: noteTitle || 'Note sans titre',
        noteContent: noteContent || '',
        selectedText,
        userQuestion,
        analogyMode,
        allNotes: allNotes || [],
        provider,
        apiKey,
        model,
        ollamaUrl
      });
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'AI Explain error' });
    }
  });



  // Global API error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('[devnotes-api Server Error]', err);
    res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
  });

  // Serve static files when NOT running as a Vercel Serverless function
  if (!process.env.VERCEL) {
    const isCompiled = __dirname.endsWith(path.join('server', 'dist'));
    const distPath = isCompiled 
      ? path.join(__dirname, '../../dist') 
      : path.join(__dirname, '../dist');
      
    app.use(express.static(distPath));

    // Fallback for SPA (Single Page Application)
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(distPath, 'index.html'));
    });

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[devnotes-api] listening on http://localhost:${PORT} and http://127.0.0.1:${PORT}`);
    });
  }
  
export default app;

