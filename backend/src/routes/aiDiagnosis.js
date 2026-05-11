import { Router } from 'express';
import axios from 'axios';

const router = Router();

async function callGemini(prompt) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  const response = await axios.post(url, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: 2048, temperature: 0.7 },
  }, { timeout: 30000 });
  return response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

router.post('/', async (req, res) => {
  try {
    const { channel, videos } = req.body;
    if (!channel) return res.status(400).json({ error: 'channel obrigatorio' });

    const topVideos = (videos || []).slice(0, 5).map(v =>
      `- "${v.title}" | ${v.views} views | ${v.likes} likes | ${v.comments} comentários | engajamento: ${v.viral_score}/10`
    ).join('\n');

    const prompt = `Você é um especialista em crescimento de canais do YouTube. Analise os dados abaixo e forneça um diagnóstico direto e acionável em português brasileiro.

CANAL: ${channel.title}
Inscritos: ${channel.subscribers}
Views totais: ${channel.totalViews}
Total de vídeos: ${channel.videoCount}

TOP VÍDEOS:
${topVideos || 'Nenhum vídeo disponível'}

Forneça:
1. Diagnóstico geral do canal (2-3 frases)
2. Pontos fortes (2 itens)
3. Pontos de melhoria (2-3 itens)
4. Próximos passos concretos (2-3 ações)

Seja direto, use dados concretos, evite clichês. Máximo 200 palavras.`;

    const text = await callGemini(prompt);
    res.json({ text });
  } catch (err) {
    console.error('[ai-diagnosis]', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
