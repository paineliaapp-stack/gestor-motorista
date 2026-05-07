/**
 * scoringService.js
 * Assigns a viral score (1–10) to a news article based on keyword weight,
 * emotional intensity, title length, and recency.
 */

// High-weight viral keywords
const VIRAL_KEYWORDS = {
  // Tier 1 – maximum impact (weight 2.5)
  tier1: [
    'scandal', 'exposed', 'arrested', 'dead', 'dies', 'killed', 'explosion',
    'war', 'attack', 'leaked', 'secret', 'banned', 'fired', 'resign',
    'breaking', 'urgent', 'crisis', 'collapse', 'crash', 'disaster',
  ],
  // Tier 2 – strong impact (weight 1.5)
  tier2: [
    'celebrity', 'viral', 'shocking', 'unbelievable', 'millions', 'billion',
    'ai', 'artificial intelligence', 'money', 'rich', 'lawsuit', 'court',
    'election', 'president', 'elon', 'trump', 'tesla', 'apple', 'google',
    'fbi', 'cia', 'nasa', 'pentagon', 'whitehouse',
  ],
  // Tier 3 – moderate impact (weight 0.8)
  tier3: [
    'new', 'first', 'record', 'biggest', 'massive', 'huge', 'incredible',
    'amazing', 'genius', 'worst', 'best', 'ever', 'historic', 'rare',
    'hidden', 'truth', 'real', 'fake', 'fraud', 'hack', 'data',
  ],
};

// Emotionally charged words
const EMOTION_WORDS = [
  'terrifying', 'heartbreaking', 'outrageous', 'disgusting', 'unbelievable',
  'shocking', 'devastating', 'explosive', 'furious', 'enraged', 'horrific',
  'devastating', 'jaw-dropping', 'mind-blowing', 'insane', 'crazy', 'wild',
];

/**
 * Calculates keyword score (0–5)
 */
function calculateKeywordScore(text) {
  const lower = text.toLowerCase();
  let score = 0;

  for (const kw of VIRAL_KEYWORDS.tier1) {
    if (lower.includes(kw)) score += 2.5;
  }
  for (const kw of VIRAL_KEYWORDS.tier2) {
    if (lower.includes(kw)) score += 1.5;
  }
  for (const kw of VIRAL_KEYWORDS.tier3) {
    if (lower.includes(kw)) score += 0.8;
  }

  return Math.min(score, 5); // cap at 5
}

/**
 * Calculates emotional intensity score (0–2)
 */
function calculateEmotionScore(title) {
  const lower = title.toLowerCase();
  const hits = EMOTION_WORDS.filter((w) => lower.includes(w)).length;
  // punctuation signals emotion too
  const exclamation = (title.match(/!/g) || []).length * 0.3;
  const allCaps = (title.match(/\b[A-Z]{3,}\b/g) || []).length * 0.4;
  return Math.min(hits * 0.8 + exclamation + allCaps, 2);
}

/**
 * Calculates title length score (0–1.5)
 * Sweet spot: 60–90 characters
 */
function calculateLengthScore(title) {
  const len = title.length;
  if (len >= 60 && len <= 90) return 1.5;
  if (len >= 40 && len < 60) return 1.0;
  if (len > 90 && len <= 120) return 1.0;
  return 0.5;
}

/**
 * Calculates recency bonus (0–1.5)
 */
function calculateRecencyScore(publishedAt) {
  if (!publishedAt) return 0;
  const hoursAgo = (Date.now() - new Date(publishedAt).getTime()) / 3_600_000;
  if (hoursAgo < 1) return 1.5;
  if (hoursAgo < 6) return 1.2;
  if (hoursAgo < 12) return 0.9;
  if (hoursAgo < 24) return 0.6;
  return 0.2;
}

/**
 * Main scoring function
 * @param {Object} article - NewsAPI article object
 * @returns {number} viral_score 1–10
 */
export function scoreArticle(article) {
  const text = `${article.title || ''} ${article.description || ''}`;

  const keywordScore = calculateKeywordScore(text);
  const emotionScore = calculateEmotionScore(article.title || '');
  const lengthScore = calculateLengthScore(article.title || '');
  const recencyScore = calculateRecencyScore(article.publishedAt);

  // Raw total out of ~10
  const raw = keywordScore + emotionScore + lengthScore + recencyScore;

  // Normalize to 1–10 range
  const normalized = Math.max(1, Math.min(10, Math.round(raw)));

  return normalized;
}

/**
 * Returns a label for the score
 */
export function getScoreLabel(score) {
  if (score >= 8) return { label: 'ULTRA VIRAL', color: 'red' };
  if (score >= 6) return { label: 'HIGH POTENTIAL', color: 'orange' };
  if (score >= 4) return { label: 'MODERATE', color: 'yellow' };
  return { label: 'LOW', color: 'gray' };
}
