import { Router } from 'express';
import fetch from 'node-fetch';
import { config } from '../config/index.js';

const router = Router();

// Modelo barato para conversa
const GEMINI_LITE = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent';
// Modelo normal só para recomendação final
const GEMINI_FULL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const PERSONAS = {
  lira: {
    name: 'Lira',
    emoji: '🎙️',
    system: `Você é Lira, uma criadora de conteúdo raiz com 5 anos de experiência viral no TikTok e Instagram.
Você pensa em retenção, comentários e compartilhamentos o tempo todo.
Fala de forma direta, usa gírias de criador ("isso vai bombar", "gancho perfeito", "retenção alta"), 
é animada mas objetiva. Nunca enrola. Faz perguntas curtas e certeiras para entender o criador.
Seu objetivo: descobrir sobre o que o criador quer falar e recomendar os livros certos da biblioteca.
Começa sempre com uma pergunta provocadora sobre o nicho ou assunto do criador.
Máximo 3 perguntas antes de recomendar. Responda sempre em português brasileiro.`,
  },
  atlas: {
    name: 'Atlas',
    emoji: '🌍',
    system: `Você é Atlas, um curador literário com visão de mundo ampla e profunda.
Você conecta livros a tendências culturais, históricas e filosóficas.
Fala de forma inteligente mas acessível, faz perguntas que ninguém faz, provoca reflexão.
Seu estilo: "Que tipo de transformação você quer provocar no espectador?" 
Pensa no público do criador como pessoas que querem entender o mundo melhor.
Seu objetivo: descobrir o propósito do criador e recomendar livros que gerem conteúdo com profundidade.
Máximo 3 perguntas antes de recomendar. Responda sempre em português brasileiro.`,
  },
  faisca: {
    name: 'Faísca',
    emoji: '⚡',
    system: `Você é Faísca, especialista em viralização agressiva.
Você pensa só em cliques, polêmica construtiva e gatilhos emocionais.
Fala rápido, usa emojis, é provocador: "isso vai gerar hate do bom", "controverso na medida certa".
Seu objetivo: descobrir o que o criador quer causar e recomendar livros com potencial viral explosivo.
Pensa sempre: qual livro vai gerar mais debate, mais compartilhamento, mais "nunca pensei nisso".
Máximo 3 perguntas antes de recomendar. Responda sempre em português brasileiro.`,
  },
};

async function callGemini(url, prompt, temperature = 0.8) {
  const response = await fetch(`${url}?key=${config.geminiApiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature, maxOutputTokens: 800, thinkingConfig: { thinkingBudget: 0 } },
    }),
  });
  if (!response.ok) throw new Error('Gemini error');
  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// POST /api/books/chat — conversa com o personagem
router.post('/chat', async (req, res) => {
  try {
    const { persona = 'lira', messages = [], books = [] } = req.body;
    if (!messages.length) return res.status(400).json({ error: 'messages obrigatório' });

    const p = PERSONAS[persona] || PERSONAS.lira;
    const history = messages.map(m => `${m.role === 'user' ? 'Criador' : p.name}: ${m.content}`).join('\n');

    const prompt = `${p.system}

Histórico:
${history}

Responda como ${p.name}. Seja breve (máximo 3 frases). Se já tiver informação suficiente sobre o criador, diga que vai recomendar os livros certos.`;

    const text = await callGemini(GEMINI_LITE, prompt, 0.85);
    res.json({ success: true, message: text, persona: p.name });
  } catch (err) {
    console.error('[BOOKS_CHAT]', err.message);
    res.status(500).json({ error: 'Erro no chat' });
  }
});

// POST /api/books/recommend — recomenda livros com base na conversa
router.post('/recommend', async (req, res) => {
  try {
    const { persona = 'lira', messages = [], books = [] } = req.body;
    if (!books.length) return res.status(400).json({ error: 'books obrigatório' });

    const p = PERSONAS[persona] || PERSONAS.lira;
    const history = messages.map(m => `${m.role === 'user' ? 'Criador' : p.name}: ${m.content}`).join('\n');
    const bookList = books.map((b, i) => `${i}: ${b.title} — ${b.author} (${b.cat})`).join('\n');

    const prompt = `Você é ${p.name}. Baseado na conversa abaixo, selecione os 5 livros mais relevantes da biblioteca para este criador.

Conversa:
${history}

Biblioteca disponível (índice: título — autor — categoria):
${bookList}

Responda APENAS com JSON válido neste formato, sem texto fora:
{"indices": [0, 5, 12, 23, 45], "justificativa": "frase curta explicando a escolha"}`;

    const raw = await callGemini(GEMINI_FULL, prompt, 0.3);
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    res.json({ success: true, ...parsed });
  } catch (err) {
    console.error('[BOOKS_RECOMMEND]', err.message);
    res.status(500).json({ error: 'Erro na recomendação' });
  }
});


// GET /api/books/cover?title=X&author=Y — proxy para evitar CORS
router.get('/cover', async (req, res) => {
  try {
    const { title = '', author = '' } = req.query;
    const a = author.split(' ').pop();
    const q = encodeURIComponent(title);
    const qa = encodeURIComponent(a);

    // Tenta Open Library
    const olRes = await fetch(`https://openlibrary.org/search.json?title=${q}&author=${qa}&limit=5&fields=cover_i,title,author_name`);
    if (olRes.ok) {
      const olData = await olRes.json();
      const docs = olData.docs || [];
      const match = docs.find(d => d.cover_i && d.title?.toLowerCase().includes(title.toLowerCase().slice(0, 6)));
      const withCover = match || docs.find(d => d.cover_i);
      if (withCover?.cover_i) {
        return res.json({ url: `https://covers.openlibrary.org/b/id/${withCover.cover_i}-L.jpg` });
      }
    }

    // Fallback Google Books
    const gbQ = encodeURIComponent(`intitle:${title} inauthor:${a}`);
    const gbRes = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${gbQ}&maxResults=3&fields=items(volumeInfo/imageLinks,volumeInfo/title)`);
    if (gbRes.ok) {
      const gbData = await gbRes.json();
      const item = gbData.items?.[0];
      const url = item?.volumeInfo?.imageLinks?.thumbnail?.replace('http:', 'https:') || null;
      if (url) return res.json({ url });
    }

    res.json({ url: null });
  } catch (err) {
    res.json({ url: null });
  }
});

export default router;
