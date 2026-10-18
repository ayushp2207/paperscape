import dotenv from 'dotenv';
import express from 'express';
import path from 'node:path';

import { connectDb } from './db/connection.js';
import { ensureIndexes } from './db/indexes.js';
import { requireOwner } from './middleware/owner.js';
import { apiNotFound, errorHandler } from './middleware/errors.js';
import conferencesRouter from './routes/conferences.js';
import plansRouter from './routes/plans.js';
import reviewsRouter from './routes/reviews.js';
import entriesRouter from './routes/entries.js';
import papersRouter from './routes/papers.js';
import reportsRouter from './routes/reports.js';

dotenv.config({ quiet: true });

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(import.meta.dirname, 'public')));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api', requireOwner);
app.use('/api/conferences', conferencesRouter);
app.use('/api/plans', plansRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/entries', entriesRouter);
app.use('/api/papers', papersRouter);
app.use('/api/reports', reportsRouter);
app.use('/api', apiNotFound);

app.use(errorHandler);

try {
  await connectDb();
  await ensureIndexes();
  app.listen(PORT, () => console.log(`Paperscape running at http://localhost:${PORT}`));
} catch (err) {
  console.error('Failed to start:', err.message);
  process.exit(1);
}
