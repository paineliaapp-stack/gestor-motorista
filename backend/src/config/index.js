import 'dotenv/config';

export const config = {
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  newsApiKey: process.env.NEWS_API_KEY,
  groqApiKey: process.env.GROQ_API_KEY,
  geminiApiKey: process.env.GEMINI_API_KEY,
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
};

export function validateConfig() {
  const required = ['newsApiKey', 'geminiApiKey'];
  const missing = required.filter((key) => !config[key]);
  if (missing.length > 0) {
    console.warn(`⚠️  Missing env vars: ${missing.join(', ')} — some features may not work.`);
  }
}
