import { Router } from 'express';
import fetch from 'node-fetch';
import { config } from '../config/index.js';

const router = Router();

const GEMINI_LITE = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent';
const GEMINI_FULL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const PERSONAS = {
  lira: {
    name: 'Lira',
    emoji: '🎙️',
    system: `Você é Lira, criadora de conteúdo com 5 anos de experiência viral no TikTok e Instagram.
Fala como criador: direta, animada, usa gírias do meio.
Sua missão é descobrir o que o criador quer falar — mas você só descobre perguntando.

FLUXO OBRIGATÓRIO:
- Turno 1: faça UMA pergunta sobre o nicho ou canal do criador.
- Turno 2: com base na resposta, faça UMA pergunta mais específica sobre o público ou objetivo do vídeo.
- Turno 3: agora sim você tem informação suficiente. Sintetize o que entendeu e diga que vai recomendar os livros certos.

Cada turno = uma pergunta. Sem pular etapas. Sem antecipar recomendações.
Responda sempre em português brasileiro.`,
  },
  atlas: {
    name: 'Atlas',
    emoji: '🌍',
    system: `Você é Atlas, curador literário com visão ampla de mundo.
Faz perguntas que ninguém faz. Conecta livros a ideias maiores.
Sua missão é descobrir o propósito do criador — mas você só descobre ouvindo.

FLUXO OBRIGATÓRIO:
- Turno 1: faça UMA pergunta sobre o propósito ou tema central do canal.
- Turno 2: com base na resposta, faça UMA pergunta sobre que transformação o criador quer provocar no espectador.
- Turno 3: agora sim você tem o contexto. Sintetize o que entendeu e diga que vai recomendar os livros certos.

Cada turno = uma pergunta. Sem pular etapas.
Responda sempre em português brasileiro.`,
  },
  faisca: {
    name: 'Faísca',
    emoji: '⚡',
    system: `Você é Faísca, especialista em viralização. Pensa em cliques, debate e gatilhos.
Fala rápido, é provocador na medida certa.
Sua missão é descobrir o que o criador quer causar — mas você só descobre perguntando.

FLUXO OBRIGATÓRIO:
- Turno 1: faça UMA pergunta sobre o que o criador quer provocar ou o efeito que quer causar.
- Turno 2: com base na resposta, faça UMA pergunta sobre o público — quem são e o que os faz reagir.
- Turno 3: agora sim você entende o jogo. Sintetize e diga que vai recomendar os livros com maior potencial de explosão.

Cada turno = uma pergunta. Sem pular etapas.
Responda sempre em português brasileiro.`,
  },
};

async function callGemini(url, prompt, temperature = 0.8) {
  const response = await fetch(`${url}?key=${config.geminiApiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature, maxOutputTokens: 400, thinkingConfig: { thinkingBudget: 0 } },
    }),
  });
  if (!response.ok) throw new Error('Gemini error');
  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

router.post('/chat', async (req, res) => {
  try {
    const { persona = 'lira', messages = [] } = req.body;
    if (!messages.length) return res.status(400).json({ error: 'messages obrigatório' });

    const p = PERSONAS[persona] || PERSONAS.lira;
    const history = messages.map(m => `${m.role === 'user' ? 'Criador' : p.name}: ${m.content}`).join('\n');
    const turnCount = messages.filter(m => m.role === 'user').length;

    const prompt = `${p.system}

Histórico da conversa (${turnCount} mensagens do criador até agora):
${history}

Responda como ${p.name}. Máximo 3 frases. Siga rigorosamente o fluxo de turnos definido acima.`;

    const text = await callGemini(GEMINI_LITE, prompt, 0.85);
    res.json({ success: true, message: text, persona: p.name });
  } catch (err) {
    console.error('[BOOKS_CHAT]', err.message);
    res.status(500).json({ error: 'Erro no chat' });
  }
});

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

router.get('/cover', async (req, res) => {
  try {
    const { title = '', author = '' } = req.query;
    const a = author.split(' ').pop();
    const q = encodeURIComponent(title);
    const qa = encodeURIComponent(a);

    const olRes = await fetch('https://openlibrary.org/search.json?title=' + q + '&author=' + qa + '&limit=5&fields=cover_i,title,author_name');
    if (olRes.ok) {
      const olData = await olRes.json();
      const docs = olData.docs || [];
      const match = docs.find(d => d.cover_i && d.title?.toLowerCase().includes(title.toLowerCase().slice(0, 6)));
      const withCover = match || docs.find(d => d.cover_i);
      if (withCover?.cover_i) {
        return res.json({ url: 'https://covers.openlibrary.org/b/id/' + withCover.cover_i + '-L.jpg' });
      }
    }

    const gbQ = encodeURIComponent('intitle:' + title + ' inauthor:' + a);
    const gbRes = await fetch('https://www.googleapis.com/books/v1/volumes?q=' + gbQ + '&maxResults=3&fields=items(volumeInfo/imageLinks,volumeInfo/title)');
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
