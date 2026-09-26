import express, { type ErrorRequestHandler, type RequestHandler } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import type { VercelRequest, VercelResponse } from '@vercel/node';

import googleAuthUrl from './api/auth/google/url';
import googleAuthExchange from './api/auth/google/exchange';
import googleAuthRefresh from './api/auth/google/refresh';
import serviceAccountStatus from './api/spreadsheets/service-account/status';
import serviceAccountSession from './api/spreadsheets/service-account/session';
import serviceAccountProxy from './api/spreadsheets/service-account/proxy';

dotenv.config();

type ApiHandler = (req: VercelRequest, res: VercelResponse) => unknown;

const asExpressHandler = (handler: ApiHandler): RequestHandler => (req, res, next) => {
  void Promise.resolve(handler(
    req as unknown as VercelRequest,
    res as unknown as VercelResponse,
  )).catch(next);
};

const apiRoutes: Array<[path: string, handler: ApiHandler]> = [
  ['/api/auth/google/url', googleAuthUrl],
  ['/api/auth/google/exchange', googleAuthExchange],
  ['/api/auth/google/refresh', googleAuthRefresh],
  ['/api/spreadsheets/service-account/status', serviceAccountStatus],
  ['/api/spreadsheets/service-account/session', serviceAccountSession],
  ['/api/spreadsheets/service-account/proxy', serviceAccountProxy],
];

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3010;

  app.set('trust proxy', true);
  app.use(cors());
  app.use(express.json());
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  apiRoutes.forEach(([path, handler]) => app.all(path, asExpressHandler(handler)));

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    const path = await import('node:path');
    app.get('/{*splat}', (_req, res) => res.sendFile(path.resolve('dist/index.html')));
  }

  const handleError: ErrorRequestHandler = (error, _req, res, next) => {
    if (res.headersSent) return next(error);
    console.error('Unhandled server error:', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Internal server error' });
  };
  app.use(handleError);

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exitCode = 1;
});
