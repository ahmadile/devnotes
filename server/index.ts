import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import helmet from 'helmet';
import { clerkMiddleware, getAuth } from '@clerk/express';
import { getMongoClient, getMongoDbName } from './db.js';
import { processNoteWithAI, chatWithAI, generateRevisionSession, evaluateRevisionCode } from './aiService.js';
import dns from 'dns';

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
        "img-src": ["'self'", "data:", "img.clerk.com"],
        "worker-src": ["'self'", "blob:"],
        "font-src": ["'self'", "fonts.gstatic.com"],
        "style-src": ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
      },
    },
  }));
  app.use(cors());
  app.use(clerkMiddleware());
  
  app.use(express.json({ limit: '2mb' }));

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
      const { input, modules, syntaxDefinitions, provider, apiKey, model, ollamaUrl } = req.body || {};
      if (!input || typeof input !== 'string') {
        res.status(400).json({ error: 'Input text is required' });
        return;
      }

      const result = await processNoteWithAI({ input, modules: modules || [], syntaxDefinitions, provider, apiKey, model, ollamaUrl });
      res.json({ ok: true, note: result });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'AI Processing error' });
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

    app.listen(PORT, () => {
      console.log(`[devnotes-api] listening on http://localhost:${PORT}`);
    });
  }
  
export default app;

