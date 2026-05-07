import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import healthRoutes from './routes/health.js';
import authRoutes from './routes/auth.js';
import discoverRoutes from './routes/discover.js';
import swipeRoutes from './routes/swipes.js';
import matchRoutes from './routes/matches.js';
import conversationRoutes from './routes/conversations.js';
import userRoutes from './routes/users.js';
import photoRoutes from './routes/photos.js';
import currentlyIntoRoutes from './routes/currentlyInto.js';

const app = express();

// --- Security middleware ---
app.use(helmet());
app.use(
  cors({
    origin: env.corsOrigin === '*'
      ? ['http://localhost:8081', 'http://localhost:19006']
      : env.corsOrigin.split(',').map((s) => s.trim()),
    credentials: true,
  })
);

// Global rate limit: 100 requests per minute per IP
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});
app.use(globalLimiter);

// Stricter limit for auth endpoints: 10 requests per minute
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth attempts, please try again later' },
});

// Per-endpoint rate limits for abuse-prone routes
const swipeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Swipe limit reached, slow down' },
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many uploads, please try again later' },
});

const discoverLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many discover requests, please try again later' },
});

app.use(express.json({ limit: '2mb' }));
app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

// Disable X-Powered-By (also handled by helmet, but explicit)
app.disable('x-powered-by');

app.get('/', (_req, res) => {
  res.json({ service: 'JuNubin API', status: 'running' });
});

app.use('/v1/health', healthRoutes);
app.use('/v1/auth', authLimiter, authRoutes);
app.use('/v1/discover', discoverLimiter, discoverRoutes);
app.use('/v1/swipes', swipeLimiter, swipeRoutes);
app.use('/v1/matches', matchRoutes);
app.use('/v1/conversations', conversationRoutes);
app.use('/v1/users', userRoutes);
app.use('/v1/users/me/photos', uploadLimiter, photoRoutes);
app.use('/v1/currently-into', currentlyIntoRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler — sanitize in production
app.use((err, _req, res, _next) => {
  if (err?.name === 'ZodError') {
    return res.status(400).json({ error: 'Validation failed', details: err.issues });
  }

  if (env.nodeEnv !== 'production') {
    console.error(err);
  }

  return res.status(err.status || 500).json({
    error: env.nodeEnv === 'production' ? 'Internal server error' : (err.message || 'Internal server error'),
  });
});

export default app;
