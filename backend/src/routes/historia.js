import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import axios from 'axios';

const router = Router();

async function callGemini(prompt) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  const response = await axios.post(url, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: 8192, temperature: 0.9 },
  }, { timeout: 30000 });
  return response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

router.get('/', async (req, res) => {
  const seed = Math.random().toString(36).slice(2, 8);
  const agora = new Date().toISOString();
  const historico = req.query.historico ? JSON.parse(decodeURIComponent(req.query.historico)) : [];
  const historicoStr = historico.length > 0
    ? `\n\nHISTORICO JA VISTO - NAO REPITA NENHUMA DESTAS:\n${historico.map((h,i) => `${i+1}. ${h}`).join('\n')}`
    : '';
  const categorias = ['cientistas e inventores esquecidos','guerras e batalhas obscuras','crimes e escandalos historicos','desastres e acidentes inusitados','descobertas cientificas acidentais','personagens historicos excentricos','eventos politicos surpreendentes','historias de sobrevivencia extrema','fraudes e golpes historicos','curiosidades sobre animais e natureza'];
  const cat = categorias[Math.floor(Math.random() * categorias.length)];
  const prompt = `Seed: ${seed} | Momento: ${agora} | Categoria: ${cat}${historicoStr}\n\nEscolha UMA historia real pouco conhecida que aconteceu na historia mundial, dentro da categoria "${cat} e narre em português brasileiro no estilo storytelling viral para vídeo curto.

ESTRUTURA OBRIGATÓRIA:
1. Gancho: frase que gera curiosidade imediata (ex: "Pesquisa agora o nome X...")
2. Escalada: 4 a 6 fatos reais e absurdos em sequência crescente, frases curtas
3. Virada: o fato mais perturbador ou surpreendente de tudo
4. Moral: 2 a 3 frases finais com reflexão

REGRAS:
- 100% real e verificável, zero invenção
- Tom conversacional, como se contasse pra um amigo
- Entre 220 e 280 palavras
- Cada execução deve trazer uma história DIFERENTE
- A Escalada deve ter 5 fatos reais e absurdos, cada um mais surpreendente que o anterior, com detalhes específicos (nomes, datas, números)
- A Virada deve ser o momento mais impactante, com 2 a 3 frases fortes e detalhadas
- A Moral deve provocar reflexão genuína com uma perspectiva inesperada, não ser genérica

Responda APENAS com JSON válido:
{
  "titulo": "nome da pessoa ou evento",
  "periodo": "ex: 1914 / Segunda Guerra / etc",
  "narrativa": "o roteiro completo aqui",
  "hooks": ["hook estilo pergunta curiosa", "hook estilo fato absurdo", "hook estilo afirmação polêmica"],
  "wikipedia": "https://pt.wikipedia.org/wiki/...",
  "fonte_adicional": "nome ou url de fonte jornalística ou acadêmica"
}`;

  try {
    const raw = await callGemini(prompt);
    console.log('[historia] raw:', raw?.slice(0, 300));
    const clean = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const start = clean.indexOf('{');
    const end = clean.lastIndexOf('}');
    if (start === -1 || end === -1) {
      return res.status(500).json({ success: false, error: 'Resposta da IA inválida: ' + clean.slice(0, 100) });
    }
    let parsed;
    try {
      parsed = JSON.parse(clean.slice(start, end + 1));
    } catch(e) {
      // tenta sanitizar quebras de linha dentro de strings JSON
      const sanitized = clean.slice(start, end + 1).replace(/("narrativa"\s*:\s*")([\s\S]*?)("(?:\s*,|\s*\}))/g, (m,a,b,c) => a + b.replace(/\n/g,' ').replace(/"/g,'\\"') + c);
      parsed = JSON.parse(sanitized);
    }
    res.json({ success: true, historia: parsed });
  } catch (err) {
    console.error('[historia]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
