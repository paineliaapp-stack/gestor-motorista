/**
 * services/aiService.js
 * AI script generation via Google Gemini
 */

import axios from 'axios';


const PLATFORMS = {
  youtube_shorts: {
    name: 'YouTube Shorts',
    format: '60-90 segundos, video vertical',
    maxWords: 180,
  },
  tiktok: {
    name: 'TikTok / Instagram Reels',
    format: '15-60 segundos, video vertical',
    maxWords: 130,
  },
  youtube_long: {
    name: 'YouTube formato longo',
    format: '8-15 minutos',
    maxWords: 1800,
  },
};

const STYLES = {
  storytelling: {
    name: 'Storytelling',
    desc: 'Uma historia real que o espectador sente na pele',
    instruction: `Conte uma historia de uma pessoa real (sem nome inventado — use "ele", "ela", "uma pessoa") vivendo o tema na pele.
A historia deve comecar no momento mais dificil, nao na introducao. O espectador precisa se ver na situacao antes de entender o que esta acontecendo.
Nao resolva o problema no final — mostre o inicio de uma mudanca. Termine com uma frase que fica na cabeca.
O roteiro nao pode parecer um conselho. Deve parecer uma historia que o espectador ja viveu.`,
  },
  dark_channel: {
    name: 'Dark Channel',
    desc: 'Tom sombrio, revelacoes perturbadoras, clima de investigacao',
    instruction: `Comece com algo perturbador e especifico sobre o tema. Construa tensao progressiva revelando camadas mais sombrias.
Nunca resolva o clima — termine no pico do desconforto produtivo. Fale como quem sabe de algo que os outros nao sabem.`,
  },
  controversial: {
    name: 'Controversial',
    desc: 'Angulo oposto ao esperado, quebra de narrativa dominante',
    instruction: `Comece contradizendo diretamente o que a maioria acredita sobre o tema.
Construa o caso contrario com argumentos especificos. Nao seja neutro — tome uma posicao clara e defenda.
Termine com uma pergunta que divide opinioes nos comentarios.`,
  },
  educational: {
    name: 'Educational',
    desc: 'Ensina algo que o espectador nao sabia que precisava saber',
    instruction: `Comece com uma afirmacao que contradiz o senso comum sobre o tema — algo que faca o espectador parar.
Explique por que a maioria pensa errado sobre isso. Apresente o conceito correto de forma simples, sem jargao.
Use um exemplo especifico com peso emocional real — algo que a pessoa no estado do tema acharia dificil, nao algo banal.
Termine com algo concreto que muda como o espectador pensa, nao uma tarefa generica.
Nao invente personagens com nome. Se precisar de exemplo, use "uma pessoa que..." ou situacoes reconheciveis.`,
  },
};

const BIAS_MODIFIERS = {
  facts: `ANGULO: SO OS FATOS
- Apresente os fatos sem julgamento ou interpretacao
- Use linguagem jornalistica direta e neutra
- Nao atribua merito ou critica a nenhum governo, partido ou lider
- Termine com contexto, nao com opiniao`,
  opportunity: `ANGULO: MOSTRAR COMO E BOM PRO BRASIL
- Destaque os beneficios, oportunidades e potencial positivo
- Use dados concretos para embasar o otimismo
- Nao atribua o merito a nenhum governo especifico — fale do Brasil como nacao
- Termine com otimismo fundamentado`,
  risk: `ANGULO: MOSTRAR OS RISCOS
- Destaque os riscos, problemas e o que pode dar errado
- Questione se os termos e condicoes sao realmente bons para o Brasil
- Nao ataque pessoas — critique decisoes e resultados
- Nao credite nem descredite nenhum governo — foque nos fatos criticos
- Termine convidando o espectador a questionar antes de aceitar`,
  debate: `ANGULO: MOSTRAR OS DOIS LADOS
- Apresente argumentos a favor E contra com igual profundidade
- Deixe claro que e uma questao complexa sem resposta facil
- Nao tome partido — force o espectador a formar sua propria opiniao
- Termine com uma pergunta que gere comentarios e debate`,
};

function detectContentType(article) {
  const text = ((article.title || '') + ' ' + (article.description || '')).toLowerCase();
  if (/lei|congresso|senado|partido|presidente|governo|politica|eleicao|reforma|ideologia|religiao|aborto/.test(text)) return { type: 'politics', risk: 'red' };
  if (/guerra|conflito|exercito|bomba|invasao|terrorismo|ataque|massacre/.test(text)) return { type: 'conflict', risk: 'red' };
  if (/greve|sindicato|salario|clt|demissao|desemprego/.test(text)) return { type: 'law', risk: 'red' };
  if (/dinheiro|investimento|mercado|bitcoin|inflacao|financas|imposto|economia|juros/.test(text)) return { type: 'economy', risk: 'yellow' };
  if (/saude|vacina|remedio|doenca|virus|cancer|dieta|exercicio|mental/.test(text)) return { type: 'health', risk: 'yellow' };
  return { type: 'general', risk: 'green' };
}

// ── CACHE COM TTL ─────────────────────────────────────────────────────────────
const scriptCache = new Map();
const CACHE_TTL = 1000 * 60 * 10;

function setCache(key, value) {
  scriptCache.set(key, { value: JSON.parse(JSON.stringify(value)), expires: Date.now() + CACHE_TTL });
}
function getCache(key) {
  const entry = scriptCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) { scriptCache.delete(key); return null; }
  return JSON.parse(JSON.stringify(entry.value));
}
function getCacheKey(articleText, styleName, version) {
  const raw = `${articleText}::${styleName}::${version}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash) + raw.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(36);
}

// ── JSON PARSER ROBUSTO ───────────────────────────────────────────────────────
function safeJSONParse(str) {
  if (!str) return null;
  // Remove markdown fences
  let cleaned = str.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  // Extrai primeiro bloco JSON
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  cleaned = cleaned.slice(start, end + 1);
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    return null;
  }
}

// ── TIMEOUT ───────────────────────────────────────────────────────────────────
function withTimeout(promise, ms = 20000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout: modelo nao respondeu')), ms)
    )
  ]);
}

// ── RETRY COM BACKOFF ─────────────────────────────────────────────────────────
async function generateWithRetry(fn, attempts = 4) {
  const traceId = Date.now().toString(36);
  try {
    return await fn();
  } catch (e) {
    if (e.message && e.message.includes('JSON invalido')) throw e;
    if (attempts <= 0) {
      console.error(`[AI_ERROR][${traceId}] Falhou apos todas tentativas:`, e.message);
      throw e;
    }
    const delay = 1000 * (3 - attempts);
    console.warn(`[AI_RETRY][${traceId}] Aguardando ${delay}ms... (${attempts} restantes)`);
    await new Promise(r => setTimeout(r, delay));
    return generateWithRetry(fn, attempts - 1);
  }
}

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
const GEMINI_API_URL_FALLBACK = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

async function callGemini(prompt, maxTokens = 3000, fallback = false) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const response = await axios.post(
    `${fallback ? GEMINI_API_URL_FALLBACK : GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
    {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.85 },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      ],
    },
    { timeout: 90000 }
  );
  const candidate = response.data?.candidates?.[0];
  if (!candidate) throw new Error('Gemini bloqueou a resposta (safety filter ou erro interno)');
  const raw = candidate?.content?.parts?.[0]?.text || '';
  if (!raw) throw new Error('Resposta vazia do modelo');
  return raw;
}

// START_BUILD_PROMPT
function buildPrompt(platformSpec, styleSpec, articleText, version, lang, viralScore, bias) {
  const { type: contentType } = detectContentType({ title: articleText, description: '' });

  const sensiveTopics = ['depressão','depressao','ansiedade','suicídio','suicidio','automutilação','transtorno','saúde mental','saude mental','bipolar','burnout','trauma','abuso'];
  const isSensitive = sensiveTopics.some(t => articleText.toLowerCase().includes(t));
  const sensitiveNote = isSensitive ? `\nIMPORTANTE: tema sensível. Tom acolhedor, nunca prescritivo. Não romantize sofrimento. Inclua ao final: "Se você está passando por isso, buscar apoio profissional faz diferença."` : '';

  const biasMap = {
    facts: 'Apresente só os fatos, sem julgamento.',
    opportunity: 'Destaque oportunidades e potencial positivo.',
    risk: 'Destaque riscos e o que pode dar errado.',
    debate: 'Apresente os dois lados com igual profundidade.',
  };
  const biasNote = bias && bias !== 'neutral' ? `\nÂNGULO: ${biasMap[bias] || ''}` : '';

  const versionSeeds = ['direto e impactante', 'narrativo e emocional', 'misterioso e indireto', 'provocativo e questionador'];
  const versionNote = `\nABORDAGEM desta versão: ${versionSeeds[(version - 1) % versionSeeds.length]}. Seja completamente diferente de versões anteriores.`;

  const styleInstructions = {
    storytelling: 'Conte como uma história vivida por alguém real. Comece no momento mais difícil, não na introdução. O espectador deve se ver na situação antes de entender o que está acontecendo.',
    educational: 'Ensine algo que o espectador não sabia que precisava saber. Comece contradizendo o senso comum. Use exemplos com peso emocional real, não ações banais.',
    dark_channel: 'Tom investigativo e perturbador. Revele camadas progressivamente. Termine no pico do desconforto, nunca na resolução.',
    controversial: 'Tome uma posição que contradiz o esperado. Defenda com argumentos específicos. Termine dividindo opiniões.',
  };
  const styleNote = styleInstructions[styleSpec?.name?.toLowerCase()] || styleInstructions.storytelling;

  return `Você é um roteirista de vídeos virais curtos — um dos melhores do Brasil.

Seu objetivo não é parecer copywriter. É parecer uma pessoa real compartilhando algo impossível de ignorar.

PLATAFORMA: ${platformSpec.name} — máximo ${platformSpec.maxWords} palavras. Português coloquial.
ESTILO: ${styleSpec.name} — ${styleNote}${biasNote}${versionNote}${sensitiveNote}

O roteiro deve:
- Gerar curiosidade que cresce frase a frase
- Soar humano — imperfeito, com ritmo natural
- Criar tensão emocional sem anunciá-la
- Parecer espontâneo, nunca engenheirado

Evite:
- Apresentar o tema ("hoje vou falar sobre...")
- Personagens inventados com nome sem contexto
- Exemplos banais (beber água, arrumar a cama, mover um dedo)
- Frases mecânicas de retenção ("Mas espera", "Pensa bem", "E não para por aí")
- Estrutura perceptível — se der pra sentir o "gancho", refaça

O espectador deve sentir: curiosidade, reconhecimento, tensão psicológica — não perceber que está sendo retido.

Use o conteúdo abaixo apenas como matéria-prima. Não resuma. Transforme em narrativa.

CONTEÚDO:
${articleText}

Responda APENAS com JSON válido, sem texto fora:
{
  "hooks": [
    { "id": "h1", "label": "Hook principal", "text": "..." },
    { "id": "h2", "label": "Hook alternativo", "text": "..." },
    { "id": "h3", "label": "Hook experimental", "text": "..." }
  ],
  "script": "roteiro completo aqui",
  "titles": ["Título 1", "Título 2", "Título 3"],
  "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"],
  "captions": ["legenda curta", "legenda com contexto", "pergunta que gera comentários"],
  "thumbnail_prompt": "descrição visual para thumbnail"
}`;
}
// END_BUILD_PROMPT

export async function generateScript({ article, platform, style, version = 1, lang = 'pt', bias = 'neutral' }) {
  const platformSpec = PLATFORMS[platform];
  const styleSpec = STYLES[style];

  if (!platformSpec || !styleSpec) throw new Error('Plataforma ou estilo invalido');

  const articleText = `${article.title}\n\n${article.description || ''}\n\n${article.content || ''}`.trim();

  const cacheKey = getCacheKey(articleText, styleSpec.name, version);
  // cache desabilitado para diversidade
  // const cached = getCache(cacheKey);
  // if (cached) return cached;

  const { type: contentType, risk: contentRisk } = detectContentType(article);
  const prompt = buildPrompt(platformSpec, styleSpec, articleText, version, lang, article.viral_score, bias);

  let raw = '';
  try {
    let parsed = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const useFallback = attempt >= 2;
        if (useFallback) console.warn(`[FALLBACK] gemini-1.5-flash tentativa ${attempt + 1}`);
        raw = await withTimeout(callGemini(prompt, 6000, useFallback), 45000);
        parsed = safeJSONParse(raw);
        if (parsed) break;
        console.warn(`[JSON_RETRY] JSON invalido na tentativa ${attempt + 1}`);
      } catch (err) {
        const is503 = err?.response?.status === 503 || err?.message?.includes('503');
        const is429 = err?.response?.status === 429 || err?.message?.includes('429');
        console.warn(`[API_RETRY] tentativa ${attempt + 1} — ${err.message}`);
        if (attempt === 3) throw err;
        const wait = is503 || is429 ? 6000 : 1500 * (attempt + 1);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
    if (!parsed) throw new Error('JSON invalido retornado pelo modelo');
    parsed.content_type = contentType;
    parsed.content_risk = contentRisk;
    // setCache(cacheKey, parsed);
    return parsed;
  } catch (err) {
    console.error('[aiService] generateScript error:', err.message);
    throw err;
  }
}

export const PLATFORM_SPECS = PLATFORMS;
export const STYLE_SPECS = Object.fromEntries(
  Object.entries(STYLES).map(([k, v]) => [k, { ...v }])
);

export async function regenerateHooks({ article, platform, style, existingHooks }) {
  const platformSpec = PLATFORMS[platform];
  const styleSpec = STYLES[style];

  if (!platformSpec || !styleSpec) throw new Error('Plataforma ou estilo invalido');

  const articleText = `${article.title}\n\n${article.description || ''}\n\n${article.content || ''}`.trim();

  const existing = existingHooks
    ? `\nHOOKS ANTERIORES (gere alternativas DIFERENTES destes):\n${existingHooks.map(h => `- ${h.text}`).join('\n')}`
    : '';

  const prompt = `Voce e um especialista em hooks virais. Gere 3 hooks completamente diferentes para este conteudo.

PLATAFORMA: ${platformSpec.name} | ${platformSpec.format}
ESTILO: ${styleSpec.name}
${existing}

CONTEUDO FONTE:
${articleText}

Gere 3 hooks com estruturas cognitivas DIFERENTES:
1. DADO NUMERICO — numero especifico, concreto, verificavel
2. CENARIO PESSOAL — coloca o espectador dentro da historia
3. CONTRADICAO — quebra uma crenca comum

IMPORTANTE — JSON valido, sem texto fora do JSON:
{
  "hooks": [
    { "id": "dado_numerico", "label": "Dado que choca", "text": "hook aqui", "why_it_works": "por que prende" },
    { "id": "cenario_pessoal", "label": "Como te afeta", "text": "hook aqui", "why_it_works": "por que prende" },
    { "id": "contradicao", "label": "Contradicao", "text": "hook aqui", "why_it_works": "por que prende" }
  ]
}`;

  const raw = await generateWithRetry(() => withTimeout(callGemini(prompt, 1000), 20000));
  const parsed = safeJSONParse(raw);
  return parsed.hooks;
}
