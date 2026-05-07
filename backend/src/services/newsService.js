/**
 * newsService.js
 * Fetches news from Brazilian RSS feeds and enriches with viral scoring.
 * Fix: enriquecer 15 artigos sem imagem (era 5) + extração OG mais robusta
 */

import Parser from 'rss-parser';
import axios from 'axios';
import { scoreArticle, getScoreLabel } from './scoringService.js';

const parser = new Parser({
  customFields: { item: ['media:content', 'media:thumbnail', 'enclosure', 'media:group'] },
});

const MAX_PER_FEED = 8;

const RSS_FEEDS = {
  general: [
    // Portais grandes
    'https://g1.globo.com/rss/g1/',
    'https://feeds.folha.uol.com.br/emcimadahora/rss091.xml',
    'https://www.cnnbrasil.com.br/feed/',
    'https://agenciabrasil.ebc.com.br/rss/ultimasnoticias/feed.xml',
    'https://www.metropoles.com/feed',
    'https://jovempan.com.br/feed',
    // Novos — regionais e alternativos
    'https://www.cartacapital.com.br/feed/',
    'https://veja.abril.com.br/feed/',
    'https://oglobo.globo.com/rss/mundo/',
    'https://agenciabrasil.ebc.com.br/rss/politica/feed.xml',
    'https://www.uol.com.br/esporte/rss/ultimas-noticias.xml',
  ],
  technology: [
    'https://g1.globo.com/rss/g1/tecnologia/',
    'https://feeds.folha.uol.com.br/tec/rss091.xml',
    'https://canaltech.com.br/rss/',
    'https://tecnoblog.net/feed/',
    'https://olhardigital.com.br/feed/',
    'https://tecnoblog.net/feed/',
    'https://www.tudocelular.com/rss/',
    // Novos
    'https://www.hardware.com.br/rss/',
    'https://www.bbc.com/portuguese/topics/cnx753jej0xt/feed.rss',
    'https://startups.com.br/feed/',
    'https://www.tecnomente.com/feed/',
    'https://manualdousuario.net/feed/',
  ],
  business: [
    'https://g1.globo.com/rss/g1/economia/',
    'https://feeds.folha.uol.com.br/mercado/rss091.xml',
    'https://www.cnnbrasil.com.br/economia/feed/',
    'https://agenciabrasil.ebc.com.br/rss/economia/feed.xml',
    'https://exame.com/feed/',
    'https://www.infomoney.com.br/feed/',
    'https://braziljournal.com/feed/',
    // Novos
    'https://valor.globo.com/rss/valor/',
    'https://www.moneytimes.com.br/feed/',
    'https://epocanegocios.globo.com/rss/Ultimas/noticia/index.xml',
    'https://www.suno.com.br/feed/',
    'https://einvestidor.estadao.com.br/feed/',
  ],
  entertainment: [
    'https://g1.globo.com/rss/g1/pop-arte/',
    'https://feeds.folha.uol.com.br/ilustrada/rss091.xml',
    'https://www.cnnbrasil.com.br/entretenimento/feed/',
    'https://www.metropoles.com/entretenimento/feed',
    // Novos
    'https://oglobo.globo.com/rss/rio/diversao-e-arte/',
    'https://extra.globo.com/rss/famosos/',
    'https://www.quem.com.br/feed',
    'https://omelete.com.br/rss/artigos/',
    'https://pipoca-moderna.com/feed/',
    'https://www.papelpop.com/feed/',
    'https://www.omelete.com.br/rss/artigos/',
    'https://rollingstone.uol.com.br/feed/',
    'https://vejasp.abril.com.br/feed/',
  ],
  health: [
    'https://g1.globo.com/rss/g1/ciencia-e-saude/',
    'https://drauziovarella.uol.com.br/feed/',
    'https://portal.fiocruz.br/rss.xml',
    'https://www.cnnbrasil.com.br/saude/feed/',
    'https://saude.abril.com.br/feed/',
    'https://www.minhavida.com.br/rss/saude.xml',
    // Novos
    'https://www.tuasaude.com/rss/',
    'https://www.pebmed.com.br/feed/',
    'https://g1.globo.com/rss/g1/bem-estar/feed.xml',
    'https://www.uol.com.br/vivabem/rss/ultimas-noticias.xml',
    'https://saude.abril.com.br/feed/',
    'https://www.cnnbrasil.com.br/saude/feed/',
  ],
  science: [
    'https://g1.globo.com/rss/g1/ciencia-e-saude/',
    'https://super.abril.com.br/feed/',
    'https://www.nationalgeographicbrasil.com/feed',
    'https://agenciabrasil.ebc.com.br/rss/ciencia-e-tecnologia/feed.xml',
    'https://www.bbc.com/portuguese/topics/cnx753jej0xt/feed.rss',
    'https://www.inovacaotecnologica.com.br/boletim/rss20.xml',
    // Novos
    'https://cienciahoje.org.br/feed/',
    'https://www.universetoday.com/feed/',
    'https://www.nasa.gov/rss/dyn/breaking_news.rss',
    'https://feeds.sciencedaily.com/sciencedaily/top_news',
    'https://www.scientificamerican.com/platform/syndication/rss/',
    'https://agencia.fapesp.br/feed/',
  ],
  sports: [
    'https://ge.globo.com/rss/ge/',
    'https://www.espn.com.br/rss/',
    'https://www.cnnbrasil.com.br/esporte/feed/',
    'https://feeds.folha.uol.com.br/esporte/rss091.xml',
    'https://www.lance.com.br/rss',
    'https://trivela.com.br/feed/',
    // Novos
    'https://www.uol.com.br/esporte/rss/ultimas-noticias.xml',
    'https://www.gazetaesportiva.com/feed/',
    'https://www.torcedores.com/feed/',
    'https://futebolinterior.com.br/feed/',
  ],
};

const cache = { data: {}, timestamps: {}, TTL: 2 * 60 * 1000 };

function isCacheValid(key) {
  return cache.data[key] && (Date.now() - cache.timestamps[key]) < cache.TTL;
}

async function enrichWithOgImages(articles) {
  const needsImg = articles.filter(a => !a.image).slice(0, 15);
  await Promise.all(needsImg.map(async a => {
    try {
      const res = await axios.get(a.url, {
        timeout: 5000,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' },
        maxRedirects: 3
      });
      const html = res.data || '';
      const match = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
                 || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
      if (match?.[1]) a.image = match[1];
    } catch {}
  }));
  return articles.map(({ _needsOg, ...rest }) => rest);
}

function getSourceName(url) {
  if (url.includes('g1.globo') || url.includes('ge.globo')) return 'G1';
  if (url.includes('folha.uol')) return 'Folha de S.Paulo';
  if (url.includes('r7.com')) return 'R7';
  if (url.includes('noticias.uol') || url.includes('uol.com.br')) return 'UOL';
  if (url.includes('cnnbrasil')) return 'CNN Brasil';
  if (url.includes('band.uol')) return 'Band';
  if (url.includes('agenciabrasil.ebc')) return 'Agência Brasil';
  if (url.includes('metropoles')) return 'Metrópoles';
  if (url.includes('jovempan')) return 'Jovem Pan';
  if (url.includes('tecmundo')) return 'TecMundo';
  if (url.includes('canaltech')) return 'Canaltech';
  if (url.includes('olhardigital')) return 'Olhar Digital';
  if (url.includes('tudocelular')) return 'TudoCelular';
  if (url.includes('tecnoblog')) return 'Tecnoblog';
  if (url.includes('exame')) return 'Exame';
  if (url.includes('infomoney')) return 'InfoMoney';
  if (url.includes('braziljournal')) return 'Brazil Journal';
  if (url.includes('drauziovarella')) return 'Drauzio Varella';
  if (url.includes('fiocruz')) return 'Fiocruz';
  if (url.includes('saude.abril')) return 'Saúde';
  if (url.includes('minhavida')) return 'Minha Vida';
  if (url.includes('super.abril')) return 'Superinteressante';
  if (url.includes('nationalgeographic')) return 'National Geographic';
  if (url.includes('inovacaotecnologica')) return 'Inovação Tecnológica';
  if (url.includes('bbc.com/portuguese')) return 'BBC Brasil';
  if (url.includes('espn')) return 'ESPN Brasil';
  if (url.includes('lance')) return 'Lance!';
  if (url.includes('trivela')) return 'Trivela';
  if (url.includes('correiobraziliense')) return 'Correio Braziliense';
  if (url.includes('gauchazh')) return 'GaúchaZH';
  if (url.includes('correiodopovo')) return 'Correio do Povo';
  if (url.includes('em.com.br')) return 'Estado de Minas';
  if (url.includes('terra.com')) return 'Terra';
  if (url.includes('bbc.com/portuguese')) return 'BBC Brasil';
  if (url.includes('dw.com')) return 'DW Brasil';
  if (url.includes('cartacapital')) return 'Carta Capital';
  if (url.includes('veja.abril')) return 'Veja';
  if (url.includes('hardware.com.br')) return 'Hardware.com.br';
  if (url.includes('startups.com.br')) return 'Startups';
  if (url.includes('manualdousuario')) return 'Manual do Usuário';
  if (url.includes('tecnomente')) return 'Tecnomente';
  if (url.includes('valor.globo')) return 'Valor Econômico';
  if (url.includes('moneytimes')) return 'Money Times';
  if (url.includes('suno.com.br')) return 'Suno';
  if (url.includes('einvestidor')) return 'E-Investidor';
  if (url.includes('epocanegocios')) return 'Época Negócios';
  if (url.includes('extra.globo')) return 'Extra';
  if (url.includes('quem.com.br')) return 'Quem';
  if (url.includes('omelete')) return 'Omelete';
  if (url.includes('adorocinema')) return 'AdoroCinema';
  if (url.includes('pipoca-moderna')) return 'Pipoca Moderna';
  if (url.includes('tuasaude')) return 'Tua Saúde';
  if (url.includes('pebmed')) return 'PEBMED';
  if (url.includes('saudeemdia')) return 'Saúde em Dia';
  if (url.includes('scielo')) return 'SciELO';
  if (url.includes('cienciahoje')) return 'Ciência Hoje';
  if (url.includes('universetoday')) return 'Universe Today';
  if (url.includes('nasa.gov')) return 'NASA';
  if (url.includes('sciencedaily')) return 'Science Daily';
  if (url.includes('scientificamerican')) return 'Scientific American';
  if (url.includes('fapesp')) return 'FAPESP';
  if (url.includes('gazetaesportiva')) return 'Gazeta Esportiva';
  if (url.includes('torcedores')) return 'Torcedores';
  if (url.includes('futebolinterior')) return 'Futebol Interior';
  if (url.includes('esportividade')) return 'Esportividade';
  return 'Brasil';
}


// ── Gemini Search para categorias com poucos feeds RSS ───────────────────────
export async function fetchWithGemini(query, category = 'health') {
  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_KEY) return [];

  try {
    const prompt = `Busque as ${category === 'health' ? 'notícias de saúde' : 'notícias'} mais recentes sobre: "${query || category}". Retorne APENAS JSON com array "articles" (até 20 itens), cada um com: title, description (2-3 frases), url (URL real e válida), source (veículo), publishedAt (data ISO recente), image (URL de imagem se disponível ou null). Sem markdown.`;

    const res = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ googleSearch: {} }],
      },
      { timeout: 40000 }
    );

    const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const clean = text.replace(/```json|```/g, '').trim();
    let parsed;
    try { parsed = JSON.parse(clean); } catch { return []; }

    return (parsed.articles || []).map((a, i) => ({
      id: `gemini_news_${i}_${Date.now()}`,
      title: a.title || '',
      description: (a.description || '').slice(0, 300),
      url: a.url || '',
      source: a.source || 'Gemini Search',
      publishedAt: a.publishedAt || new Date().toISOString(),
      viral_score: 8,
      score_label: 'VIRAL',
      score_color: '#a78bfa',
      content_preview: (a.description || '').slice(0, 500),
      image: a.image || null,
    })).filter(a => a.title && a.url);
  } catch (err) {
    console.error('[Gemini News]', err.message);
    return [];
  }
}


async function fetchFeed(url, sourceName) {
  try {
    const feed = await parser.parseURL(url);
    return (feed.items || []).slice(0, MAX_PER_FEED).map(item => {
      const image =
        item['media:content']?.['$']?.url ||
        item['media:thumbnail']?.['$']?.url ||
        item.enclosure?.url ||
        null;
      const score = scoreArticle(item);
      return {
        title: item.title || '',
        description: item.contentSnippet || item.content || '',
        url: item.link || '',
        publishedAt: item.pubDate || item.isoDate || new Date().toISOString(),
        source: { name: sourceName || feed.title || 'RSS' },
        image,
        viral_score: score,
        score_label: getScoreLabel(score),
      };
    });
  } catch(e) {
    console.warn('[fetchFeed] falhou:', url, e.message);
    return [];
  }
}

export async function fetchTrendingNews({ category = 'general', query, source = 'br' } = {}) {
  if (source === 'intl') {
    const { fetchFromNewsAPI } = await import('./newsApiService.js');
    return fetchFromNewsAPI({ category, query });
  }

  if (query && query.length >= 3) {
    const allFeeds = RSS_FEEDS[category] || RSS_FEEDS.general;
    const results = await Promise.all(allFeeds.map(url => fetchFeed(url, getSourceName(url))));
    const filtered = results.flat().filter(a =>
      a.title?.toLowerCase().includes(query.toLowerCase()) ||
      a.description?.toLowerCase().includes(query.toLowerCase())
    );
    const sorted = filtered.sort((a, b) => b.viral_score - a.viral_score);
    return enrichWithOgImages(sorted);
  }

  if (isCacheValid(category) && !query) {
    console.log('[RSS] Cache hit:', category, cache.data[category]?.length);
    return cache.data[category];
  }

  const feeds = RSS_FEEDS[category] || RSS_FEEDS.general;
  const results = await Promise.all(feeds.map(url => fetchFeed(url, getSourceName(url))));

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const articles = results.flat().filter(a => {
    if (!a.title || a.title === '[Removed]') return false;
    const pub = new Date(a.publishedAt).getTime();
    return !isNaN(pub) && pub > sevenDaysAgo;
  });

  const seen = new Set();
  const unique = articles.filter(a => {
    const key = a.title.slice(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  unique.sort((a, b) => {
    const scoreDiff = b.viral_score - a.viral_score;
    if (Math.abs(scoreDiff) > 1) return scoreDiff;
    return Math.random() - 0.5;
  });

  let enriched = await enrichWithOgImages(unique);

  // Se health tiver menos de 25 artigos, complementa com Gemini Search
  if (category === 'health' && enriched.length < 25) {
    console.log('[Health] Poucos artigos RSS (' + enriched.length + '), complementando com Gemini Search...');
    const geminiArts = await fetchWithGemini('saúde bem-estar medicina brasil noticias recentes', 'health');
    const allIds = new Set(enriched.map(a => a.title.slice(0, 40)));
    const newArts = geminiArts.filter(a => !allIds.has(a.title.slice(0, 40)));
    enriched = [...enriched, ...newArts];
  }

  cache.data[category] = enriched;
  cache.timestamps[category] = Date.now();
  return enriched;
}

export const NEWS_CATEGORIES = ['general','technology','business','entertainment','health','science','sports'];
