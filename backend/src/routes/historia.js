import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import axios from 'axios';

const router = Router();

async function callGemini(prompt) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  const response = await axios.post(url, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: 1024, temperature: 0.9 },
  }, { timeout: 30000 });
  return response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

router.get('/', requireAuth, async (req, res) => {
  const prompt = `Escolha UMA história real pouco conhecida que aconteceu na história mundial e narre em português brasileiro no estilo storytelling viral para vídeo curto.

ESTRUTURA OBRIGATÓRIA:
1. Gancho: frase que gera curiosidade imediata (ex: "Pesquisa agora o nome X...")
2. Escalada: 4 a 6 fatos reais e absurdos em sequência crescente, frases curtas
3. Virada: o fato mais perturbador ou surpreendente de tudo
4. Moral: 2 a 3 frases finais com reflexão

REGRAS:
- 100% real e verificável, zero invenção
- Tom conversacional, como se contasse pra um amigo
- Entre 120 e 150 palavras
- Cada execução deve trazer uma história DIFERENTE

Responda APENAS com JSON válido:
{
  "titulo": "nome da pessoa ou evento",
  "periodo": "ex: 1914 / Segunda Guerra / etc",
  "narrativa": "o roteiro completo aqui",
  "wikipedia": "https://pt.wikipedia.org/wiki/...",
  "fonte_adicional": "nome ou url de fonte jornalística ou acadêmica"
}`;

  try {
    const raw = await callGemini(prompt);
    const clean = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const start = clean.indexOf('{');
    const end = clean.lastIndexOf('}');
    const parsed = JSON.parse(clean.slice(start, end + 1));
    res.json({ success: true, historia: parsed });
  } catch (err) {
    console.error('[historia]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
