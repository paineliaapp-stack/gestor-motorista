/**
 * routes/news.js
 * News endpoint: fetch trending articles with viral scores.
 */

import { Router } from 'express';
import { fetchTrendingNews, NEWS_CATEGORIES } from '../services/newsService.js';

const router = Router();

/**
 * GET /api/news
 * Query params:
 *   - category: news category (default: 'general')
 *   - q: search query
 *   - country: country code (default: 'us')
 */
router.get('/', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const { category = 'general', q: query, country = 'us', source = 'br' } = req.query;

    // Validate category
    if (category && !NEWS_CATEGORIES.includes(category)) {
      return res.status(400).json({
        success: false,
        error: `Invalid category. Valid options: ${NEWS_CATEGORIES.join(', ')}`,
      });
    }

    const articles = await fetchTrendingNews({ category, query, country, source });

    return res.json({
      success: true,
      count: articles.length,
      category: query ? 'search' : category,
      articles,
    });
  } catch (err) {
    console.error('[GET /api/news]', err.message);
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

/**
 * GET /api/news/categories
 * Returns available news categories.
 */
router.get('/categories', (_req, res) => {
  res.json({ success: true, categories: NEWS_CATEGORIES });
});

export default router;

// ─── Headlines para ticker ────────────────────────────────────────────────────
let headlinesCache = { data: null, ts: 0 };
router.get('/headlines', async (req, res) => {
  try {
    if (headlinesCache.data && Date.now() - headlinesCache.ts < 10 * 60 * 1000) {
      return res.json(headlinesCache.data);
    }
    const articles = await fetchTrendingNews({ category: 'general', country: 'br' });
    const headlines = articles
      .slice(0, 12)
      .map(a => a.title?.split('|')[0]?.split(' - ')[0]?.trim())
      .filter(Boolean)
      .map(t => t.length > 60 ? t.slice(0, 57) + '...' : t);
    headlinesCache = { data: headlines, ts: Date.now() };
    res.json(headlines);
  } catch (err) {
    console.error('[headlines]', err.message);
    res.status(500).json([]);
  }
});
