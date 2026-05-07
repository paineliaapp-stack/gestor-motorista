import axios from 'axios';
import { config } from '../config/index.js';
import { scoreArticle, getScoreLabel } from './scoringService.js';

const NEWS_API_BASE = 'https://newsapi.org/v2';
const cache = { data: {}, timestamps: {}, TTL: 10 * 60 * 1000 };
const isCacheValid = (k) => cache.data[k] && cache.timestamps[k] && Date.now() - cache.timestamps[k] < cache.TTL;

function transform(article, index) {
  const viralScore = scoreArticle(article);
  const scoreInfo = getScoreLabel(viralScore);
  return {
    id: `intl_${index}_${Date.now()}`,
    title: article.title,
    description: article.description || '',
    url: article.url,
    image: article.urlToImage,
    source: article.source?.name || 'Unknown',
    publishedAt: article.publishedAt,
    viral_score: viralScore,
    score_label: scoreInfo.label,
    score_color: scoreInfo.color,
    content_preview: (article.content?.split('[+')[0] || article.description || '').slice(0, 500),
  };
}

export async function fetchFromNewsAPI({ category = 'general', query } = {}) {
  const key = query || category;
  if (isCacheValid(key)) return cache.data[key];
  if (!config.newsApiKey) throw new Error('NEWS_API_KEY not configured');
  const queries = { general: 'breaking news', technology: 'technology', business: 'business economy', entertainment: 'entertainment', health: 'health medicine', science: 'science discovery', sports: 'sports' };
  const params = { apiKey: config.newsApiKey, language: 'en', pageSize: 40, sortBy: 'popularity' };
  params.q = query || queries[category] || 'news';
  const res = await axios.get(`${NEWS_API_BASE}/everything`, { params, headers: { 'User-Agent': 'ViralNewsAI/1.0' } });
  const articles = (res.data.articles || []).filter(a => a.title && a.title !== '[Removed]').map(transform).sort((a, b) => b.viral_score - a.viral_score);
  cache.data[key] = articles;
  cache.timestamps[key] = Date.now();
  return articles;
}
