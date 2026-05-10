/**
 * routes/youtube.js
 * YouTube channel analytics endpoint
 */
import { Router } from 'express';
import axios from 'axios';

const router = Router();
const API_KEY = process.env.YOUTUBE_API_KEY;
const CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID;

// Cache por nicho
const cacheMap = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 min

router.get('/', async (req, res) => {
  try {
    const apiKey = req.query.apiKey || '';
    const channelId = req.query.channelId || '';
    if (!apiKey || !channelId) return res.status(400).json({ error: 'apiKey e channelId obrigatorios' });
    const cacheKey = channelId || 'default';
    const cache = cacheMap[cacheKey];
    if (cache && Date.now() - cache.ts < CACHE_TTL) {
      return res.json(cache.data);
    }

    // 1. Dados do canal
    const channelRes = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
      params: { part: 'snippet,statistics', id: channelId, key: apiKey }
    });
    const channel = channelRes.data.items?.[0];
    if (!channel) return res.status(404).json({ error: 'Canal não encontrado' });

    // 2. Últimos 20 vídeos
    const searchRes = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: { part: 'snippet', channelId: channelId, order: 'date', maxResults: 20, type: 'video', key: apiKey }
    });
    const videoIds = searchRes.data.items?.map(i => i.id.videoId).join(',');

    // 3. Estatísticas dos vídeos
    const videosRes = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
      params: { part: 'snippet,statistics,contentDetails', id: videoIds, key: apiKey }
    });

    const videos = videosRes.data.items?.map(v => ({
      id: v.id,
      title: v.snippet.title,
      publishedAt: v.snippet.publishedAt,
      thumbnail: v.snippet.thumbnails?.medium?.url,
      views: parseInt(v.statistics.viewCount || 0),
      likes: parseInt(v.statistics.likeCount || 0),
      comments: parseInt(v.statistics.commentCount || 0),
      duration: v.contentDetails.duration,
    })) || [];

    // 4. Score viral por vídeo (views/likes ratio)
    const maxViews = Math.max(...videos.map(v => v.views), 1);
    const videosWithScore = videos.map(v => ({
      ...v,
      viral_score: Math.round((v.views / maxViews) * 10),
    }));

    const result = {
      channel: {
        id: channel.id,
        title: channel.snippet.title,
        description: channel.snippet.description,
        thumbnail: channel.snippet.thumbnails?.medium?.url,
        subscribers: parseInt(channel.statistics.subscriberCount || 0),
        totalViews: parseInt(channel.statistics.viewCount || 0),
        videoCount: parseInt(channel.statistics.videoCount || 0),
      },
      videos: videosWithScore,
    };

    cacheMap[cacheKey] = { data: result, ts: Date.now() };
    res.json(result);
  } catch (err) {
    console.error('[YouTube]', err.message);
    res.status(500).json({ error: err.message });
  }
});


// ─── Mineração de canal concorrente ───────────────────────────────────────────
const mineCache = new Map();
const MINE_TTL = 10 * 60 * 1000; // 10 min

router.get('/mine', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'URL obrigatória' });

    // Extrai channel handle, ID ou username da URL
    let channelId = null;
    let handle = null;

    const patterns = [
      { re: /youtube\.com\/channel\/(UC[\w-]+)/, type: 'id' },
      { re: /youtube\.com\/@([\w.-]+)/, type: 'handle' },
      { re: /youtube\.com\/c\/([\w.-]+)/, type: 'custom' },
      { re: /youtube\.com\/user\/([\w.-]+)/, type: 'user' },
    ];

    for (const { re, type } of patterns) {
      const m = url.match(re);
      if (m) { handle = m[1]; break; }
    }

    if (!handle) return res.status(400).json({ error: 'URL de canal inválida' });

    // Cache
    const cacheKey = handle.toLowerCase();
    const cached = mineCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < MINE_TTL) return res.json(cached.data);

    // Resolve channel ID pelo handle/username
    let resolvedId = null;

    // Tenta por handle (@usuario)
    try {
      const r = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
        params: { part: 'snippet,statistics', forHandle: handle, key: API_KEY }
      });
      resolvedId = r.data.items?.[0]?.id;
      if (!resolvedId) {
        // Tenta por username legado
        const r2 = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
          params: { part: 'snippet,statistics', forUsername: handle, key: API_KEY }
        });
        resolvedId = r2.data.items?.[0]?.id;
      }
    } catch {}

    // Tenta busca por nome se ainda não achou
    if (!resolvedId) {
      const sr = await axios.get('https://www.googleapis.com/youtube/v3/search', {
        params: { part: 'snippet', q: handle, type: 'channel', maxResults: 1, key: API_KEY }
      });
      resolvedId = sr.data.items?.[0]?.id?.channelId;
    }

    if (!resolvedId) return res.status(404).json({ error: 'Canal não encontrado' });

    // Dados do canal
    const chRes = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
      params: { part: 'snippet,statistics', id: resolvedId, key: API_KEY }
    });
    const ch = chRes.data.items?.[0];
    if (!ch) return res.status(404).json({ error: 'Canal não encontrado' });

    // Top 20 vídeos por visualizações (busca por data e pega mais vistos)
    const searchRes = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: { part: 'snippet', channelId: resolvedId, order: 'viewCount', maxResults: 20, type: 'video', key: API_KEY }
    });
    const videoIds = searchRes.data.items?.map(i => i.id.videoId).filter(Boolean).join(',');

    if (!videoIds) return res.status(404).json({ error: 'Nenhum vídeo encontrado' });

    // Stats dos vídeos
    const vRes = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
      params: { part: 'snippet,statistics,contentDetails', id: videoIds, key: apiKey }
    });

    const videos = vRes.data.items?.map(v => ({
      id: v.id,
      title: v.snippet.title,
      publishedAt: v.snippet.publishedAt,
      thumbnail: v.snippet.thumbnails?.medium?.url,
      views: parseInt(v.statistics.viewCount || 0),
      likes: parseInt(v.statistics.likeCount || 0),
      comments: parseInt(v.statistics.commentCount || 0),
      duration: v.contentDetails.duration,
      tags: v.snippet.tags?.slice(0, 8) || [],
    })) || [];

    const maxViews = Math.max(...videos.map(v => v.views), 1);
    const videosWithScore = videos.map(v => ({
      ...v,
      viral_score: Math.round((v.views / maxViews) * 10),
      engagement_rate: v.views > 0 ? (((v.likes + v.comments) / v.views) * 100).toFixed(2) : '0',
    }));

    const result = {
      channel: {
        id: resolvedId,
        title: ch.snippet.title,
        thumbnail: ch.snippet.thumbnails?.medium?.url,
        subscribers: parseInt(ch.statistics.subscriberCount || 0),
        totalViews: parseInt(ch.statistics.viewCount || 0),
        videoCount: parseInt(ch.statistics.videoCount || 0),
        country: ch.snippet.country || null,
      },
      videos: videosWithScore,
      minedAt: new Date().toISOString(),
    };

    mineCache.set(cacheKey, { data: result, ts: Date.now() });
    res.json(result);
  } catch (err) {
    console.error('[YouTube/mine]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Trending BR ──────────────────────────────────────────────────────────────
let trendingCache = { data: null, ts: 0 };
router.get('/trending', async (req, res) => {
  try {
    if (trendingCache.data && Date.now() - trendingCache.ts < 15 * 60 * 1000) {
      return res.json(trendingCache.data);
    }
    const r = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
      params: { part: 'snippet', chart: 'mostPopular', regionCode: 'BR', maxResults: 10, key: API_KEY }
    });
    const titles = r.data.items?.map(v => v.snippet.title.split('|')[0].split('-')[0].trim().slice(0, 40)) || [];
    trendingCache = { data: titles, ts: Date.now() };
    res.json(titles);
  } catch (err) {
    res.status(500).json([]);
  }
});


// Rota nova — usa chave do servidor, usuário passa só o handle
router.get('/canal', async (req, res) => {
  try {
    const handle = (req.query.handle || '').trim().replace(/^@/, '');
    if (!handle) return res.status(400).json({ error: 'handle obrigatorio' });
    const key = API_KEY;
    if (!key) return res.status(500).json({ error: 'YOUTUBE_API_KEY nao configurada no servidor' });

    // Resolve handle -> channelId
    const searchRes = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: { part: 'snippet', q: handle, type: 'channel', maxResults: 1, key }
    });
    const channelId = searchRes.data.items?.[0]?.id?.channelId;
    if (!channelId) return res.status(404).json({ error: 'Canal nao encontrado para @' + handle });

    // Dados do canal
    const channelRes = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
      params: { part: 'snippet,statistics', id: channelId, key }
    });
    const channel = channelRes.data.items?.[0];
    if (!channel) return res.status(404).json({ error: 'Canal nao encontrado' });

    // Ultimos 20 videos
    const videosSearch = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: { part: 'snippet', channelId, order: 'date', maxResults: 20, type: 'video', key }
    });
    const videoIds = videosSearch.data.items?.map(i => i.id.videoId).join(',');

    const videosRes = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
      params: { part: 'snippet,statistics,contentDetails', id: videoIds, key }
    });
    const videos = videosRes.data.items?.map(v => ({
      id: v.id,
      title: v.snippet.title,
      publishedAt: v.snippet.publishedAt,
      thumbnail: v.snippet.thumbnails?.medium?.url,
      views: parseInt(v.statistics.viewCount || 0),
      likes: parseInt(v.statistics.likeCount || 0),
      comments: parseInt(v.statistics.commentCount || 0),
      duration: v.contentDetails.duration,
    })) || [];

    const maxViews = Math.max(...videos.map(v => v.views), 1);
    const videosWithScore = videos.map(v => ({
      ...v,
      viral_score: Math.round((v.views / maxViews) * 10),
    }));

    res.json({
      channel: {
        id: channelId,
        title: channel.snippet.title,
        description: channel.snippet.description,
        thumbnail: channel.snippet.thumbnails?.medium?.url,
        subscribers: parseInt(channel.statistics.subscriberCount || 0),
        totalViews: parseInt(channel.statistics.viewCount || 0),
        videoCount: parseInt(channel.statistics.videoCount || 0),
      },
      videos: videosWithScore,
    });
  } catch (err) {
    console.error('[youtube/canal]', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
