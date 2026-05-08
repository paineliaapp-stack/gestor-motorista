/**
 * server.js
 * ViralNews AI — Express server entry point.
 */

import express from 'express';
import axios from 'axios';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { config, validateConfig } from './config/index.js';
import newsRoutes from './routes/news.js';
import generateRoutes from './routes/generate.js';
import chatRoutes from './routes/chat.js';
import nicheRoutes from './routes/niche.js';
import scienceRoutes from './routes/science.js';
import youtubeRoutes from './routes/youtube.js';
import authRoutes from './routes/auth.js';
import booksChatRouter from './routes/bookschat.js';
import paymentRoutes from './routes/payment.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

// Validate env on startup
validateConfig();

const app = express();

// ─── Security & Logging ───────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: config.corsOrigin,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ─── Body Parser ──────────────────────────────────────────────────────────────
app.use(express.static('public'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Rate Limiting ────────────────────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { success: false, error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const generateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: { success: false, error: 'Script generation limit reached. Please wait a moment.' },
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/news', apiLimiter, newsRoutes);
app.use('/api/generate', generateLimiter, generateRoutes);
app.use('/api/chat', apiLimiter, chatRoutes);
app.use('/api/niche', apiLimiter, nicheRoutes);
app.use('/api/science', apiLimiter, scienceRoutes);
app.use('/api/youtube', apiLimiter, youtubeRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/books', booksChatRouter);
app.use('/api/payment', apiLimiter, paymentRoutes);

// Headers para Google OAuth popup
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
  next();
});

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    status: 'online',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});



// ─── Start Server ─────────────────────────────────────────────────────────────

// Keep-alive: evita cold start no Railway
const BACKEND_URL = process.env.RAILWAY_PUBLIC_DOMAIN
  ? ('https://' + process.env.RAILWAY_PUBLIC_DOMAIN)
  : null;
if (BACKEND_URL) {
  setInterval(() => {
    fetch(BACKEND_URL + '/health').catch(() => {});
  }, 8 * 60 * 1000);
}

app.listen(config.port, () => {
  console.log(`\n🚀 ViralNews AI Backend running at http://localhost:${config.port}`);
  console.log(`📡 Environment: ${config.nodeEnv}`);
  console.log(`🔑 NewsAPI: ${config.newsApiKey ? '✅ configured' : '❌ missing'}`);
  console.log(`🤖 Gemini AI: ${process.env.GEMINI_API_KEY ? '✅ configured' : '❌ missing'}\n`);
});

// ─── 404 & Error Handlers ─────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);


export default app;






