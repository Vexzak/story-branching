import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { env, isProduction } from './env.js';
import authRoutes from './routes/auth.js';
import meRoutes from './routes/me.js';
import storyRoutes from './routes/stories.js';
import sessionRoutes from './routes/sessions.js';
import adminContentRoutes from './routes/adminContent.js';
import adminStudentRoutes from './routes/adminStudents.js';
import adminRoutes from './routes/admin.js';
import adminAccountRoutes from './routes/adminAccounts.js';
import { notFound, errorHandler } from './middleware/error.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

app.set('trust proxy', 1);

app.use(
  helmet({
    // The built client is served from the same origin in production; allow its
    // images/fonts to load from Supabase Storage.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

app.use(
  cors({
    origin: isProduction ? env.CLIENT_ORIGIN : true,
    credentials: true,
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(isProduction ? 'combined' : 'dev'));

// Health check - useful for deployment platforms.
app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'branching-story-api', env: env.NODE_ENV });
});

app.use('/api/auth', authRoutes);
app.use('/api/me', meRoutes);
app.use('/api/stories', storyRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/admin/content', adminContentRoutes);
app.use('/api/admin/accounts', adminAccountRoutes);
app.use('/api/admin/records', adminStudentRoutes);
app.use('/api/admin', adminRoutes);

// In production, serve the built React client from the same process.
const clientDist = path.resolve(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use('/api', notFound);
app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`Branching Story API listening on http://localhost:${env.PORT}`);
  if (!fs.existsSync(clientDist)) {
    console.log('Client build not found - run the Vite dev server for the UI.');
  }
});
