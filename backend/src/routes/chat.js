import { Router } from 'express';
import fetch from 'node-fetch';
import { config } from '../config/index.js';

const router = Router();
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

router.post('/', async (req, res) => {
  try {
    const { book, messages, platform = 'youtube_shorts', style = 'educational' } = req.body;
    if (!book || !messages?.length) return res.status(400).json({ error: 'book e messages são obrigatórios' });

    const history = messages.map(m => `${m.role === 'user' ? 'Usuário' : 'IA'}: ${m.content}`).join('\n');

    const prompt = `Você é um especialista em criação de conteúdo viral para redes sociais, com profundo conhecimento do livro "${book.title}" de ${book.author}.

Seu papel: ajudar o criador a desenvolver roteiros virais baseados EXCLUSIVAMENTE no conteúdo deste livro.

Plataforma alvo: ${platform}
Estilo: ${style}

REGRAS ABSOLUTAS:
- Só use conceitos, histórias e ideias presentes no livro "${book.title}"
- Nunca invente fatos, estudos ou citações
- Se o usuário pedir um roteiro completo, gere um roteiro formatado e pronto para usar
- Seja direto, criativo e fale como um especialista em conteúdo viral
- Responda em português brasileiro
- Se o usuário descrever um ângulo ou tema, sugira como transformar isso em conteúdo viral

Histórico da conversa:
${history}

Responda de forma útil, direta e criativa. Se o usuário pedir um roteiro, gere um completo e pronto.`;

    const response = await fetch(`${GEMINI_URL}?key=${config.geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.9, maxOutputTokens: 2000, thinkingConfig: { thinkingBudget: 0 } },
      }),
    });

    if (!response.ok) throw new Error('Gemini error');
    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty response');

    res.json({ success: true, message: text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/help', async (req, res) => {
  try {
    const { messages, system } = req.body;
    if (!messages?.length) return res.status(400).json({ error: 'messages obrigatorio' });

    const history = messages.map(m => `${m.role === 'user' ? 'Usuário' : 'Assistente'}: ${m.content}`).join('\n');
    const prompt = `${system || 'Você é um assistente útil. Responda em português brasileiro.'}\n\nHistórico:\n${history}\n\nResposta:`;

    const response = await fetch(`${GEMINI_URL}?key=${config.geminiApiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 600, thinkingConfig: { thinkingBudget: 0 } },
      }),
    });

    if (!response.ok) throw new Error('Gemini error');
    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty response');
    res.json({ success: true, message: text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
