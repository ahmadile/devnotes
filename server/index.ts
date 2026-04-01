import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import helmet from 'helmet';
import { clerkMiddleware, getAuth } from '@clerk/express';
import { getMongoClient, getMongoDbName } from './db.js';

dotenv.config({ path: '.env.local' });
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3001);

type StoredNotesDoc = {
  userId: string;
  notes: unknown[];
  updatedAt: number;
};

async function main() {
  const app = express();
  
  // Security Middlewares
  app.use(helmet({
    contentSecurityPolicy: false, 
  }));
  app.use(cors());
  app.use(clerkMiddleware());
  
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/notes', async (req, res) => {
    const { userId } = getAuth(req);
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    try {
      const client = await getMongoClient();
      const db = client.db(getMongoDbName());
      const doc = await db.collection<StoredNotesDoc>('app').findOne({ userId });
      res.json({ notes: doc?.notes ?? [], updatedAt: doc?.updatedAt ?? null });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  app.put('/api/notes', async (req, res) => {
    const { userId } = getAuth(req);
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const body = req.body as { notes?: unknown };
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
        { $set: { notes: body.notes, updatedAt } },
        { upsert: true },
      );
      res.json({ ok: true, updatedAt });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  // Serve static files in production
  // We check if we are in 'dist' (compiled) or 'server' (source)
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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

