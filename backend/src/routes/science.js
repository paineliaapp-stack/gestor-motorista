/**
 * routes/science.js
 * Proxy backend para PubMed e Gemini Search.
 * Resolve CORS — o frontend chama /api/science em vez das APIs diretamente.
 */

import { Router } from 'express';
import axios from 'axios';

const router = Router();

// ── Cache ─────────────────────────────────────────────────────────────────────
const cache = { data: {}, ts: {}, TTL: 10 * 60 * 1000 };
function fromCache(key) {
  if (cache.data[key] && Date.now() - cache.ts[key] < cache.TTL) return cache.data[key];
  return null;
}
function toCache(key, val) { cache.data[key] = val; cache.ts[key] = Date.now(); }

// ── PubMed ────────────────────────────────────────────────────────────────────
async function searchPubMed(query) {
  const cKey = `pubmed:${query}`;
  const cached = fromCache(cKey);
  if (cached) return cached;

  const PUBMED_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
  const sRes = await axios.get(`${PUBMED_BASE}/esearch.fcgi`, {
    params: { db: 'pubmed', term: query, retmax: 20, retmode: 'json', sort: 'relevance' },
    timeout: 10000,
  });
  const ids = sRes.data.esearchresult?.idlist || [];
  if (!ids.length) return [];

  const sumRes = await axios.get(`${PUBMED_BASE}/esummary.fcgi`, {
    params: { db: 'pubmed', id: ids.join(','), retmode: 'json' },
    timeout: 10000,
  });
  const result = sumRes.data.result || {};

  const articles = ids.map(id => {
    const a = result[id] || {};
    const year = (a.pubdate || '').slice(0, 4);
    return {
      id: 'pubmed_' + id,
      title: a.title || '',
      description: `${a.source || 'PubMed'} · ${year}`,
      url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
      source: a.source || 'PubMed',
      publishedAt: a.pubdate || '',
      viral_score: 7,
      content_preview: a.title || '',
      image: null,
    };
  }).filter(a => a.title);

  toCache(cKey, articles);
  return articles;
}

// ── Gemini Search Grounding ───────────────────────────────────────────────────
async function searchGeminiWeb(query, type = 'science') {
  const cKey = `gemini:${type}:${query}`;
  const cached = fromCache(cKey);
  if (cached) return cached;

  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_KEY) throw new Error('GEMINI_API_KEY not set');

  const prompt = type === 'health'
    ? `Busque as notícias e estudos mais recentes sobre saúde: "${query}". Retorne APENAS um JSON com array "articles" contendo até 15 itens, cada um com: title, description (1-2 frases), url (URL real), source (veículo), publishedAt (data ISO). Sem markdown.`
    : `Busque artigos científicos recentes sobre: "${query}". Retorne APENAS um JSON com array "articles" contendo até 15 itens, cada um com: title, description (1-2 frases), url (URL real), source (journal/veículo), publishedAt (data ISO). Sem markdown.`;

  const res = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
    {
      contents: [{ parts: [{ text: prompt }] }],
      tools: [{ googleSearch: {} }],
    },
    { timeout: 20000 }
  );

  const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  const clean = text.replace(/```json|```/g, '').trim();

  let parsed;
  try { parsed = JSON.parse(clean); } catch { parsed = { articles: [] }; }

  const articles = (parsed.articles || []).map((a, i) => ({
    id: `gemini_${type}_${i}_${Date.now()}`,
    title: a.title || '',
    description: a.description || '',
    url: a.url || '',
    source: a.source || 'Gemini Search',
    publishedAt: a.publishedAt || new Date().toISOString(),
    viral_score: 8,
    content_preview: a.description || a.title || '',
    image: null,
  })).filter(a => a.title && a.url);

  toCache(cKey, articles);
  return articles;
}

// ── Rota ──────────────────────────────────────────────────────────────────────
// GET /api/science?q=neuroscience&source=pubmed
router.get('/', async (req, res) => {
  const query = (req.query.q || '').trim();
  const source = req.query.source || 'pubmed';

  if (!query || query.length < 2) {
    return res.status(400).json({ success: false, error: 'query param ?q= required (min 2 chars)' });
  }

  try {
    let articles = []; if (source === 'gemini' || source === 'health') {
      articles = await searchGeminiWeb(query, source);
    } else {
      articles = await searchPubMed(query);
    }

    return res.json({ success: true, source, query, count: articles.length, articles });
  } catch (err) {
    console.error('[GET /api/science]', source, err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
