/**
 * services/aiService.js
 * AI script generation via Google Gemini
 */

import axios from 'axios';

async function fetchArticleText(url) {
  if (!url) return '';
  try {
    const res = await axios.get(url, {
      timeout: 8000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' },
      maxRedirects: 3,
    });
    const html = res.data || '';
    // Remove scripts, styles, nav, footer
    const clean = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s{2,}/g, ' ')
      .trim();
    // Retorna até 3000 caracteres do corpo
    return clean.slice(0, 5000);
  } catch {
    return '';
  }
}


const PLATFORMS = {
  youtube_shorts: {
    name: 'YouTube Shorts',
    format: '60-90 segundos, video vertical',
    maxWords: 200,
  },
  tiktok: {
    name: 'TikTok / Instagram Reels',
    format: '60-90 segundos, video vertical',
    maxWords: 200,
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
const GEMINI_API_URL_FALLBACK = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent';

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
    revelacao: `ESTRUTURA OBRIGATÓRIA — REVELAÇÃO:
1. Primeira frase: defina o objeto central contradizendo o que o espectador assume. Sem pergunta retórica, sem "você sabia".
2. Meio: use exatamente 2 dados numéricos ou comparações concretas extraídos do conteúdo. Zero dado inventado.
3. Final: uma pergunta ou afirmação que aponta consequência real e específica — algo que o espectador vai pensar depois que fechar o vídeo.
Proibido: abrir com pergunta retórica, terminar com metáfora vaga, usar "o jogo é maior", "as ondas vão chegar", "nem imagina o que vem por aí".`,

    conflito: `ESTRUTURA OBRIGATÓRIA — CONFLITO:
1. Primeira frase: apresente a tensão central sem revelar qual lado você defende.
2. Meio: argumento concreto do lado A com dado real, depois argumento concreto do lado B com dado real. Igual peso para os dois.
3. Final: uma pergunta direta que divide — sem resposta certa. O espectador deve sair sem saber quem está certo.
Proibido: tomar partido, linguagem emocional só para um lado, terminar com conclusão.`,

    historia: `ESTRUTURA OBRIGATÓRIA — HISTÓRIA:
1. Primeira frase: coloque o espectador num momento específico e concreto extraído da notícia. Sem nome inventado, sem Bia, sem Paula.
2. Meio: desenvolva usando fatos reais do conteúdo como detalhes da cena. O espectador deve se ver na situação.
3. Final: revele a consequência real — o que aquele momento significou de verdade.
Proibido: personagens com nomes genéricos, exemplos banais, começar com "Imagina você", terminar com moral explícita.`,

    impacto: `ESTRUTURA OBRIGATÓRIA — IMPACTO:
1. Primeira frase: comece pela consequência concreta na vida de quem assiste — não pela causa.
2. Meio: explique por que isso acontece usando 2 fatos específicos do conteúdo.
3. Final: uma ação ou decisão diferente que o espectador vai considerar a partir de hoje.
Proibido: começar pelo contexto, terminar com sensação genérica, usar "o mundo mudou", "nada será como antes".`,
  };
  const styleNameMap = {
    storytelling: 'historia',
    educational: 'revelacao',
    dark_channel: 'impacto',
    controversial: 'conflito',
  };
  const styleName = styleSpec?.name?.toLowerCase();
  const mappedStyle = styleNameMap[styleName] || styleName;
  const styleNote = styleInstructions[mappedStyle] || styleInstructions.revelacao;

  return `Você é um roteirista de vídeos virais curtos — um dos melhores do Brasil.
Português coloquial. Máximo ${platformSpec.maxWords} palavras. Plataforma: ${platformSpec.name}.${biasNote}${versionNote}${sensitiveNote}

${styleNote}

Extraia os fatos do conteúdo abaixo. Não invente dados. Não resuma. Construa narrativa com o que está lá.
REGRA JURÍDICA AUTOMÁTICA: Se o conteúdo envolver investigação, denúncia, operação policial ou processo judicial EM CURSO, use obrigatoriamente linguagem de alegação — "é acusado de", "segundo a denúncia", "as investigações apontam", "suspeito de". NUNCA afirme culpa como fato estabelecido antes de condenação transitada em julgado. Isso não limita o impacto narrativo — mantém o drama mas com precisão factual.
OBRIGATÓRIO: use pelo menos 2 informações concretas do conteúdo — nomes reais, números, porcentagens, datas, comparações específicas. Roteiro sem dados concretos é inválido.
O roteiro deve usar entre 180 e ${platformSpec.maxWords} palavras. Termine sempre com uma tensão aberta ou pergunta que o espectador não consegue responder sozinho.

Os campos screen_captions são frases curtas (máximo 6 palavras cada) para aparecer sobrepostas no vídeo nos primeiros segundos — devem provocar curiosidade imediata.
Os campos image_prompts são descrições visuais detalhadas em inglês para geração de imagem por IA — cenário, estilo, iluminação, composição. Uma imagem a cada 4 segundos para shorts/TikTok, a cada 6 segundos para vídeos longos. Para TikTok e Shorts: formato vertical 9:16, composição centrada, sujeito no centro. Para YouTube Longo: formato horizontal 16:9, composição cinematográfica. Fundo cinematográfico, sem texto na imagem.

Proibido em qualquer estilo:
- Frases mecânicas de retenção ("Mas espera", "Pensa bem", "E não para por aí")
- Apresentar o tema no início ("hoje vou falar sobre...")
- Terminar com metáfora vaga ou sensação genérica

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
  "thumbnail_prompt": "descrição visual para thumbnail",
  "screen_captions": [
    "frase curta impactante para aparecer nos primeiros 5s",
    "segunda frase para chamar atenção",
    "terceira frase de gancho visual"
  ],
  "image_prompts": [
    "prompt detalhado para imagem 1 — aparece em 0s",
    "prompt detalhado para imagem 2 — aparece em 4s",
    "prompt detalhado para imagem 3 — aparece em 8s",
    "prompt detalhado para imagem 4 — aparece em 12s",
    "prompt detalhado para imagem 5 — aparece em 16s"
  ]
}`;
}
// END_BUILD_PROMPT


// ─── Video / Novelinha Generation ────────────────────────────────────────────

const VIDEO_DURATIONS = {
  30: { scenes: 4, label: '30 segundos' },
  45: { scenes: 6, label: '45 segundos' },
  60: { scenes: 8, label: '1 minuto' },
};

const VIDEO_STYLES = {
  pixar_body: 'Narrative style: educational health story with anthropomorphic characters. Environment and characters must be chosen based on the topic — use the ENVIRONMENT RULES below to select the correct setting.',
  battle:     'Narrative style: epic battle between hero characters and villain characters. Dramatic action, explosions, magical effects. Environment based on topic.',
  superhero:  'Narrative style: characters with superpowers and capes saving the day. Epic and heroic tone. Environment based on topic.',
  drama:      'Narrative style: emotional drama — betrayal, love, discovery, conflict. Characters can be ANY objects, food, or household items. Bathroom, kitchen or fitting environment based on topic.',
  adventure:  'Narrative style: free adventure story. Characters can be ANY objects the user describes. Environment based on topic.',
};

function buildVideoPrompt(topic, style, durationSec, hint) {
  const { scenes } = VIDEO_DURATIONS[durationSec] || VIDEO_DURATIONS[60];
  const styleDesc = VIDEO_STYLES[style] || VIDEO_STYLES.pixar_body;

  return `You are a world-class expert in creating perfect prompts for Veo 3 (Google) and generating 3D Pixar/Dreamworks novelinha scripts. Your standards are maximum. You NEVER deliver mediocre work.

Concept: ${styleDesc}

### MANDATORY RULES FOR ALL PROMPTS:

1. VISUAL STYLE — always start every veo3_prompt with:
"Cinematic high-quality 3D Pixar/Dreamworks style, vibrant colors, dramatic cinematic lighting with volumetric god rays, magical glowing particles, smooth fluid animation, ultra realistic textures, ultra detailed 8k."

2. CHARACTERS (VERY IMPORTANT):
- Describe every character as "full anthropomorphic character"
- OBJECT characters (soap, shampoo, sponge, food, vitamins, bottles, fruits): maintain the base shape of the object and add: "with clear arms and legs, highly expressive face integrated into the object body, no human neck, no realistic human head"
- HUMAN characters (warriors, heroes, doctors, children): stylized Pixar/Dreamworks human with exaggerated proportions, big expressive eyes, strong body language
- NEVER create characters resembling SpongeBob SquarePants or any existing IP

3. CONSISTENCY — repeat the full character description in EVERY scene. Use the same Global Anchor in all scenes.

4. CINEMATIC QUALITY — use: slow camera pan, dramatic close-up, smooth zoom in, dynamic angle, orbiting shot, dolly in, slow motion.

5. ENVIRONMENT RULES (auto-select):
- Health/Body topics → "inside a transparent human torso with glowing organs and soft internal lighting"
- Bathroom/Objects topics → "luxurious modern bathroom shelf environment with soft reflections, elegant lighting and subtle steam"
- Kitchen topics → "bright modern kitchen counter with warm lighting and rich colors"
- Other topics → create a fitting, beautiful, cinematic environment

6. HIGH QUALITY:
- Transform any object into a living, charismatic character with strong personality
- Use exaggerated facial expressions and clear body language (shock, guilt, rage, seduction, crying, relief)
- In emotional scenes: dramatic close-ups, slight slow motion, cinematic angles
- Always use ALL named characters — never invent unnamed mysterious entities
- Story arc: Problem → Discovery → Conflict → Climax → Emotional Resolution

### MANDATORY SCENE STRUCTURE (in this exact order):
1. Global Anchor (exact style text above)
2. CHARACTER SHEET — create in scene 1 with maximum detail; copy WORD FOR WORD in all subsequent scenes:
   "CHARACTER SHEET: [Name]: [object type] body, [exact shape], [exact color], [face details], [accessories]. [Name 2]: ..."
3. Environment phrase (same across all scenes)
4. "Continuing from previous scene where [one sentence]..." + action + dominant emotion + camera movement
   CRITICAL: every time a character performs an action or appears in a scene, repeat their full physical description inline — do NOT rely only on the CHARACTER SHEET at the top. Example: "Vitamina C — full anthropomorphic character, orange segment body, crescent shape, bright vibrant orange color, cheerful face integrated into body, small leafy green cap, clear arms and legs — floats gracefully..." This prevents the AI video model from changing the character's appearance mid-scene.
5. DIALOGUE at the end of every veo3_prompt

### SCENE STRUCTURE RULES:
- Scene 1 (0-8s): start directly with the problem + character speaking (no silent scene)
- Maximum 2 dialogue lines per scene
- MANDATORY format at the end of every veo3_prompt:
[Character 1 name] says in Brazilian Portuguese: "Short natural phrase." [Character 2 name] says in Brazilian Portuguese: "Second short phrase." — lip sync, emotional voice acting, no subtitles, no text on screen.
- ALL dialogue must be in natural, emotional, fluid Brazilian Portuguese — NO English words in dialogue

Topic: ${topic}
Context/niche: ${hint}
Total scenes: exactly ${scenes} (each 8 seconds = ${durationSec} seconds total)

Return ONLY valid JSON, no markdown, no explanation:
{
  "title": "catchy video title in Portuguese",
  "hook": "1-sentence hook in Portuguese",
  "story_summary": "2-3 sentence story arc in Portuguese",
  "characters": [
    {
      "name": "Character name",
      "appearance": "detailed physical description for visual consistency"
    }
  ],
  "scenes": [
    {
      "scene_number": 1,
      "timestamp": "0:00-0:08",
      "scene_title": "short title in Portuguese",
      "veo3_prompt": "complete ready-to-paste English prompt: global anchor + character sheet + environment + action/emotion/camera + MANDATORY 2 dialogue lines at the end in format: [Name1] says in Brazilian Portuguese: \"frase.\" [Name2] says in Brazilian Portuguese: \"frase.\" — lip sync, emotional voice acting, no subtitles, no text on screen",
      "dialogue_pt": "MANDATORY 2 lines: '[Nome1]: frase em português.' and '[Nome2]: frase em português.' — always 2 characters speaking, never just 1",
      "visual_note": "what visually happens in Portuguese"
    }
  ],
  "thumbnail_prompts": [
    { "style": "Midjourney / DALL-E", "prompt": "English thumbnail prompt" },
    { "style": "IA de Imagem", "prompt": "English thumbnail prompt, different angle" }
  ],
  "posting_tips": ["tip 1 in Portuguese", "tip 2", "tip 3"]
}`;
}

export async function generateVideoScript({ topic, style, durationSec, hint }) {
  const prompt = buildVideoPrompt(topic, style, durationSec, hint);
  let raw = '';
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const useFallback = attempt >= 2;
      raw = await withTimeout(callGemini(prompt, 8000, useFallback), 110000);
      const parsed = safeJSONParse(raw);
      if (parsed) return parsed;
      console.warn(`[VIDEO_JSON_RETRY] tentativa ${attempt + 1}`);
    } catch (err) {
      console.warn(`[VIDEO_API_RETRY] tentativa ${attempt + 1} — ${err.message}`);
      if (attempt === 3) throw err;
      await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
    }
  }
  throw new Error('JSON invalido retornado pelo modelo para video');
}

export async function generateScript({ article, platform, style, version = 1, lang = 'pt', bias = 'neutral' }) {
  const platformSpec = PLATFORMS[platform];
  const styleSpec = STYLES[style];

  if (!platformSpec || !styleSpec) throw new Error('Plataforma ou estilo invalido');

  // Se content está truncado (NewsAPI corta em ~200 chars), busca o texto completo
  let fullContent = article.content || '';
  const isTruncated = fullContent.includes('[+') || fullContent.length < 300;
  if (isTruncated && article.url) {
    console.log('[fetchArticleText] buscando conteúdo completo:', article.url);
    fullContent = await fetchArticleText(article.url) || fullContent;
    console.log('[fetchArticleText] chars obtidos:', fullContent.length, '| preview:', fullContent.slice(0, 300));
  }
  const articleText = `${article.title}\n\n${article.description || ''}\n\n${fullContent}`.trim();

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

  // Se content está truncado (NewsAPI corta em ~200 chars), busca o texto completo
  let fullContent = article.content || '';
  const isTruncated = fullContent.includes('[+') || fullContent.length < 300;
  if (isTruncated && article.url) {
    console.log('[fetchArticleText] buscando conteúdo completo:', article.url);
    fullContent = await fetchArticleText(article.url) || fullContent;
    console.log('[fetchArticleText] chars obtidos:', fullContent.length, '| preview:', fullContent.slice(0, 300));
  }
  const articleText = `${article.title}\n\n${article.description || ''}\n\n${fullContent}`.trim();

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
