/**
 * routes/niche.js
 * Endpoint /api/niche — combina 4 fontes para qualquer nicho:
 *  1. Google News RSS
 *  2. Reddit JSON
 *  3. PubMed (artigos — Semantic Scholar bloqueado por rate limit de IP)
 *  4. Google Books → Open Library fallback (livros)
 */

import express from 'express';
import Parser from 'rss-parser';
import axios from 'axios';

const router = express.Router();
const rssParser = new Parser({
  customFields: { item: ['media:content', 'media:thumbnail', 'enclosure'] },
  timeout: 8000,
});

const cache = { data: {}, ts: {}, TTL: 8 * 60 * 1000 };
function fromCache(key) {
  if (cache.data[key] && Date.now() - cache.ts[key] < cache.TTL) return cache.data[key];
  return null;
}
function toCache(key, val) { cache.data[key] = val; cache.ts[key] = Date.now(); }

function scoreItem(title = '', description = '') {
  const text = (title + ' ' + description).toLowerCase();
  let score = 5;
  ['viral','urgente','exclusivo','revelação','polêmica','impacto','surpreende','record','histórico','inédito','alerta','choca','top','novo','descoberta']
    .forEach(w => { if (text.includes(w)) score++; });
  if (title.length > 60) score++;
  if (description.length > 100) score++;
  return Math.min(10, score);
}

function extractImage(item) {
  return item['media:content']?.$.url
    || item['media:thumbnail']?.$.url
    || item.enclosure?.url
    || null;
}

// ── 1. Google News RSS ────────────────────────────────────────────────────────
async function fetchGoogleNews(query) {
  const cKey = `gnews:${query}`;
  const cached = fromCache(cKey);
  if (cached) return cached;

  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;
  try {
    const feed = await rssParser.parseURL(url);
    const items = (feed.items || []).slice(0, 12).map(item => ({
      id: `gnews_${Buffer.from(item.link || item.title || '').toString('base64').slice(0, 16)}`,
      type: 'news',
      title: item.title?.replace(/ - [^-]+$/, '') || '',
      description: item.contentSnippet || item.content || '',
      url: item.link || '',
      source: 'Google News',
      publishedAt: item.isoDate || item.pubDate || '',
      image: extractImage(item),
      viral_score: scoreItem(item.title, item.contentSnippet),
    }));
    toCache(cKey, items);
    return items;
  } catch (e) {
    console.error('[niche] Google News error:', e.message);
    return [];
  }
}

// ── 2. Reddit ─────────────────────────────────────────────────────────────────
const REDDIT_MAP = {
  marketing: 'marketing', financas: 'personalfinance', tecnologia: 'technology',
  saude: 'health', fitness: 'Fitness', games: 'gaming',
  empreendedorismo: 'entrepreneur', espiritualidade: 'spirituality',
};

async function fetchReddit(query) {
  const cKey = `reddit:${query}`;
  const cached = fromCache(cKey);
  if (cached) return cached;

  const q = query.toLowerCase();
  const sub = Object.entries(REDDIT_MAP).find(([k]) => q.includes(k))?.[1] || 'worldnews';

  try {
    const res = await axios.get(`https://www.reddit.com/r/${sub}/hot.json?limit=8`, {
      headers: { 'User-Agent': 'ViralNewsAI/1.0' }, timeout: 7000,
    });
    const posts = (res.data?.data?.children || [])
      .filter(p => !p.data.stickied && p.data.score > 10).slice(0, 6)
      .map(p => ({
        id: `reddit_${p.data.id}`,
        type: 'discussion',
        title: p.data.title,
        description: p.data.selftext?.length > 400 ? p.data.selftext.slice(0, 400) + '...' : `${p.data.ups?.toLocaleString()} upvotes · r/${p.data.subreddit}`,
        url: `https://reddit.com${p.data.permalink}`,
        source: `r/${p.data.subreddit}`,
        publishedAt: new Date(p.data.created_utc * 1000).toISOString(),
        image: p.data.thumbnail?.startsWith('http') ? p.data.thumbnail : null,
        viral_score: Math.min(10, 5 + Math.floor(Math.log10(Math.max(p.data.score, 1)))),
        upvotes: p.data.ups,
        comments: p.data.num_comments,
      }));
    toCache(cKey, posts);
    return posts;
  } catch (e) {
    console.error('[niche] Reddit error:', e.message);
    return [];
  }
}

// ── 3. PubMed (substitui Semantic Scholar enquanto IP estiver bloqueado) ───────
async function fetchArticles(query) {
  const cKey = `pubmed_niche:${query}`;
  const cached = fromCache(cKey);
  if (cached) return cached;

  try {
    const PUBMED = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
    const searchRes = await axios.get(`${PUBMED}/esearch.fcgi`, {
      params: { db: 'pubmed', term: query, retmax: 8, retmode: 'json', sort: 'relevance' },
      timeout: 10000,
    });
    const ids = searchRes.data.esearchresult?.idlist || [];
    if (!ids.length) return [];

    const sumRes = await axios.get(`${PUBMED}/esummary.fcgi`, {
      params: { db: 'pubmed', id: ids.join(','), retmode: 'json' },
      timeout: 10000,
    });
    const result = sumRes.data.result || {};

    const items = ids.map(id => {
      const a = result[id] || {};
      const year = (a.pubdate || '').slice(0, 4);
      const authors = (a.authors || []).slice(0, 3).map(au => au.name).join(', ');
      return {
        id: `pubmed_${id}`,
        type: 'article',
        title: a.title || '',
        description: `${a.source || 'PubMed'} · ${year}${authors ? ' · ' + authors : ''}`,
        url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
        source: a.source || 'PubMed',
        publishedAt: a.pubdate || '',
        image: null,
        viral_score: 7,
        authors,
        year,
        citations: 0,
      };
    }).filter(a => a.title);

    toCache(cKey, items);
    return items;
  } catch (e) {
    console.error('[niche] PubMed error:', e.message);
    return [];
  }
}

// ── 4. Livros — Google Books + Open Library fallback ─────────────────────────

async function fetchOpenLibraryBooks(query) {
  const res = await axios.get('https://openlibrary.org/search.json', {
    params: { q: query, limit: 8, fields: 'key,title,author_name,cover_i,isbn,first_publish_year,ratings_average', lang: 'por' },
    timeout: 8000,
  });
  const docs = res.data?.docs || [];
  return docs.filter(d => d.title && d.cover_i).slice(0, 6).map(d => {
    const title = d.title;
    const author = (d.author_name || []).slice(0, 2).join(', ');
    const cover = `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg`;
    const isbn = d.isbn?.[0];
    return {
      id: `ol_${d.key?.replace('/works/', '') || Math.random()}`,
      type: 'book',
      title,
      description: author + (d.first_publish_year ? ` · ${d.first_publish_year}` : ''),
      url: `https://openlibrary.org${d.key}`,

      source: 'Open Library',
      publishedAt: d.first_publish_year ? `${d.first_publish_year}-01-01` : '',
      image: cover,
      viral_score: Math.min(10, 5 + Math.round((d.ratings_average || 0) * 0.8)),
      authors: author,
      rating: d.ratings_average ? Math.round(d.ratings_average * 10) / 10 : null,
      isbn,
    };
  });
}

async function fetchBooks(query) {
  const cKey = `books_niche:${query}`;
  const cached = fromCache(cKey);
  if (cached) return cached;

  // Tenta Google Books primeiro
  try {
    const res = await axios.get('https://www.googleapis.com/books/v1/volumes', {
      params: { q: query, maxResults: 8, langRestrict: 'pt', orderBy: 'relevance', printType: 'books' },
      timeout: 8000,
    });
    const volumes = res.data?.items || [];
    if (volumes.length > 0) {
      const items = volumes.filter(v => v.volumeInfo?.title).map(v => {
        const info = v.volumeInfo;
        const cover = info.imageLinks?.thumbnail
          ?.replace('zoom=1', 'zoom=3').replace('&edge=curl', '').replace('http://', 'https://') || null;
        const author = (info.authors || []).slice(0, 2).join(', ');
        return {
          id: `book_${v.id}`,
          type: 'book',
          title: info.title,
          description: `${author}${info.publishedDate ? ' · ' + info.publishedDate.slice(0, 4) : ''}`,
      url: info.infoLink || `https://books.google.com/books?id=${v.id}`,

          source: 'Google Books',
          publishedAt: info.publishedDate || '',
          image: cover,
          viral_score: Math.min(10, 5 + Math.round((info.averageRating || 0) * 0.8)),
          authors: author,
          rating: info.averageRating,
        };
      });
      toCache(cKey, items);
      return items;
    }
  } catch (e) {
    console.error('[niche] Google Books error:', e.message, '— trying Open Library');
  }

  // Fallback: Open Library
  try {
    const items = await fetchOpenLibraryBooks(query);
    toCache(cKey, items);
    return items;
  } catch (e) {
    console.error('[niche] Open Library error:', e.message);
    return [];
  }
}

// ── Rota principal ────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const query = (req.query.q || '').trim();
  if (!query) return res.status(400).json({ success: false, error: 'query param ?q= required' });

  const [news, reddit, articles, books] = await Promise.allSettled([
    fetchGoogleNews(query),
    fetchReddit(query),
    fetchArticles(query),
    fetchBooks(query),
  ]);

  res.json({
    success: true,
    query,
    news:     news.status     === 'fulfilled' ? news.value     : [],
    reddit:   reddit.status   === 'fulfilled' ? reddit.value   : [],
    articles: articles.status === 'fulfilled' ? articles.value : [],
    books:    books.status    === 'fulfilled' ? books.value    : [],
  });
});

export default router;
