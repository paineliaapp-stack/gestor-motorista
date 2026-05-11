import { Router } from 'express';
import axios from 'axios';

const router = Router();

async function callGemini(prompt) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  const response = await axios.post(url, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: 2048, temperature: 0.9 },
  }, { timeout: 30000 });
  return response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

router.post('/', async (req, res) => {
  const { tema, seed, historico = [] } = req.body;
  if (!tema) return res.status(400).json({ success: false, error: 'tema obrigatorio' });

  const historicoStr = historico.length > 0
    ? `\n\nHISTÓRIAS JÁ CONTADAS — PROIBIDO repetir qualquer uma destas:\n${historico.map((h,i) => `${i+1}. ${h}`).join('\n')}`
    : '';

  const categorias = [
    'cientistas e inventores esquecidos',
    'guerras e batalhas obscuras',
    'crimes e escândalos históricos',
    'desastres e acidentes',
    'descobertas científicas acidentais',
    'personagens históricos excêntricos',
    'eventos políticos surpreendentes',
    'histórias de sobrevivência extrema',
    'fraudes e golpes históricos',
    'fatos sobre animais e natureza',
  ];
  const cat = categorias[Math.floor(Math.random() * categorias.length)];

  const prompt = `Você é um pesquisador especialista em histórias reais obscuras e surpreendentes.

Tema geral: "${tema}"
Categoria desta vez: "${cat}"
Variação: ${seed}${historicoStr}

Escolha UMA história real POUCO CONHECIDA do grande público, preferencialmente fora do Brasil, sobre "${tema}" dentro da categoria "${cat}".

ESTRUTURA OBRIGATÓRIA:
1. Gancho: frase que gera curiosidade imediata (ex: "Pesquisa agora o nome X...")
2. Escalada: 4 a 6 fatos reais e absurdos em sequência crescente, frases curtas
3. Virada: o fato mais perturbador ou surpreendente de tudo
4. Moral: 2 a 3 frases finais com reflexão

REGRAS ABSOLUTAS:
- 100% real e verificável, zero invenção
- Tom conversacional, como se contasse pra um amigo
- Entre 120 e 150 palavras
- NUNCA repita as histórias já listadas acima
- Varie épocas: ancient, medieval, século XIX, XX, XXI
- Varie países e culturas

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
    if (start === -1 || end === -1) {
      return res.status(500).json({ success: false, error: 'Resposta da IA inválida' });
    }
    const parsed = JSON.parse(clean.slice(start, end + 1));
    res.json({ success: true, historia: parsed });
  } catch (err) {
    console.error('[historia-nicho]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
