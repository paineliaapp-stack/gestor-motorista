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
    desc: 'Narrativa com personagem, tensao e resolucao',
    structure: `1. Cena de abertura — coloca o espectador DENTRO do momento
2. Conflito — algo da errado ou surpreende
3. Escalada — tensao cresce a partir de consequencias reais
4. Virada ou resolucao inesperada
5. CTA emocional especifico`,
  },
  dark_channel: {
    name: 'Dark Channel',
    desc: 'Tom sombrio, revelacoes perturbadoras, clima de investigacao',
    structure: `1. Abertura perturbadora — dado ou cena que incomoda
2. Contexto sombrio — o que esta por tras
3. Revelacao progressiva — cada camada e pior
4. Pico de tensao — o momento mais perturbador
5. CTA que gera reflexao ou desconforto produtivo`,
  },
  controversial: {
    name: 'Controversial',
    desc: 'Angulo oposto ao esperado, quebra de narrativa dominante',
    structure: `1. Afirmacao que contradiz o senso comum
2. Por que a maioria acredita no contrario
3. Evidencias que sustentam o angulo alternativo
4. Implicacoes — o que muda se isso for verdade
5. CTA que divide opinioes`,
  },
  educational: {
    name: 'Educational',
    desc: 'Explica um conceito de forma clara, direta e pratica — professor direto ao ponto',
    structure: `1. AFIRMACAO CONTRAINTUITIVA — comece com algo que vai contra o senso comum sobre o tema
2. POR QUE A MAIORIA ERRA — explique o erro mais comum de forma especifica, com exemplo concreto
3. O CONCEITO CORRETO — explique a ideia central em 1-2 frases simples, sem jargao
4. COMO FUNCIONA NA PRATICA — mostre com exemplo real e especifico (nome, numero, situacao)
5. O QUE FAZER HOJE — uma acao concreta e minuscula que o espectador pode fazer agora`,
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

async function callGemini(prompt, maxTokens = 3000) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const response = await axios.post(
    `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
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
  const isPortuguese = lang === 'pt';

  const versionNote = version === 1
    ? '\nABORDAGEM: direta e impactante — va direto ao ponto mais forte.'
    : version === 2
    ? '\nABORDAGEM: narrativa e emocional — construa conexao antes do impacto.'
    : '\nABORDAGEM: misteriosa e indireta — revele o minimo possivel, construa suspense maximo.';

  // Temas sensíveis — instrução extra de cuidado
  const sensiveTopics = ['depressão', 'depressao', 'ansiedade', 'suicídio', 'suicidio', 'automutilação', 'autolesão', 'transtorno', 'saúde mental', 'saude mental', 'bipolar', 'esquizofrenia', 'burnout', 'trauma', 'abuso', 'violência', 'violencia'];
  const isSensitive = sensiveTopics.some(t => articleText.toLowerCase().includes(t));
  const sensitiveNote = isSensitive ? `
TEMA SENSÍVEL — REGRAS OBRIGATÓRIAS:
- Nunca apresente abordagens terapêuticas válidas como prejudiciais
- Sempre inclua ao final: "Se você está passando por isso, buscar apoio profissional faz diferença."
- Tom: acolhedor e esperançoso, nunca prescritivo ou alarmista
- Não romantize sofrimento nem prometa curas simples` : '';

  const scoreNote = viralScore >= 8
    ? '\nADAPTACAO: score ALTO — mais ousadia, frases mais curtas, impacto maximo.'
    : (viralScore >= 5
    ? '\nADAPTACAO: score MEDIO — equilibrio entre clareza e curiosidade.'
    : '\nADAPTACAO: score BAIXO — foco em identificacao humana e angulo pessoal.');

  const biasNote = (bias && bias !== 'neutral' && BIAS_MODIFIERS && BIAS_MODIFIERS[bias])
    ? `\nANGULO EDITORIAL: ${BIAS_MODIFIERS[bias]}`
    : '';

  return `Voce e um roteirista viral brasileiro de elite criando para ${platformSpec.name}.

IDIOMA: Portugues brasileiro coloquial — pessoa real falando, nunca apresentador ou locutor.
PLATAFORMA: ${platformSpec.name} | ${platformSpec.format} | MAXIMO ${platformSpec.maxWords} palavras no script
ESTILO OBRIGATORIO: ${styleSpec.name}
${biasNote}${versionNote}${scoreNote}${sensitiveNote}

ESTRUTURA DO ESTILO ${styleSpec.name.toUpperCase()} — SIGA EXATAMENTE:
${styleSpec.structure}

REGRAS DE QUALIDADE:
- Frases curtas: 5-12 palavras. Paragrafos de 1-2 linhas.
- Hook: entre no meio da acao com o dado mais especifico. NUNCA apresente o tema.
  BOM: "Ela perdeu 12kg. Depois recuperou 18. O estudo explica por que."
  RUIM: "Hoje vou falar sobre dietas."
- CTA final: especifico para este tema, nunca generico ("deixa o like", "se inscreve")
- Tom natural: pausas reais, cortes abruptos, imperfeicao gramatical ocasional

PROIBIDO usar: "voce sabia que" / "hoje vou te contar" / "neste video" / "o que ninguem te conta" /
"chocante" / "incrivel" / "surpreendente" / "vamos falar sobre" / "isso muda tudo" /
"E nao para por ai" / "Pensa bem" / "Mas espera" / "Sabe o que e mais bizarro"

PROIBIDO repetir estrutura entre regeneracoes — cada versao deve ter angulo diferente.
"e importante entender" / "preparado" / "fica ate o final"

PROIBIDO: marcadores [PAUSE] [BEAT] [HARD STOP] no texto
PROIBIDO: inventar dados — se nao estiver no conteudo fonte, reformule genericalmente

AUTO-CRITICA (ANTES DE RESPONDER):
Avalie 0-10 em retencao, curiosidade e naturalidade.
Se qualquer criterio < 8, reescreva antes de entregar.

PRIORIDADE em conflito: 1.Retencao  2.Naturalidade  3.Clareza  4.Regras

CONTEUDO FONTE:
${articleText}

Gere 3 hooks com estruturas cognitivas DIFERENTES:
1. DADO NUMERICO — numero especifico, concreto, verificavel
2. CENARIO PESSOAL — coloca o espectador dentro da historia
3. CONTRADICAO — quebra uma crenca comum
Se ficarem parecidos, reescreva ate ficarem cognitivamente distintos.

IMPORTANTE — JSON valido:
- Aspas duplas em tudo / Sem trailing commas / Sem texto fora do JSON

Responda APENAS com JSON puro:
{
  "hooks": [
    { "id": "dado_numerico", "label": "Dado que choca", "text": "hook aqui", "why_it_works": "por que prende" },
    { "id": "cenario_pessoal", "label": "Como te afeta", "text": "hook aqui", "why_it_works": "por que prende" },
    { "id": "contradicao", "label": "Contradicao", "text": "hook aqui", "why_it_works": "por que prende" }
  ],
  "script": "Roteiro completo. Paragrafos curtos. Sem marcadores entre colchetes.",
  "titles": ["Titulo 1", "Titulo 2", "Titulo 3"],
  "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5", "#tag6", "#tag7"],
  "captions": [
    "Legenda curta menos de 100 caracteres",
    "Legenda com contexto menos de 150 caracteres",
    "Pergunta que convida comentarios sobre este tema"
  ],
  "thumbnail_prompt": "Elemento visual principal + clima emocional. Sem pessoas reais."
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
      raw = await withTimeout(callGemini(prompt, 6000), 45000);
      parsed = safeJSONParse(raw);
      if (parsed) break;
      console.warn(`[JSON_RETRY] tentativa ${attempt + 1} falhou, tentando novamente...`);
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
