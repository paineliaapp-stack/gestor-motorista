/**
 * utils/index.js
 */

/**
 * Format a date relative to now.
 */
export function formatRelativeTime(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Truncate text to a max length.
 */
export function truncate(text, maxLength = 100) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + '…';
}

/**
 * Get viral score color classes.
 */
export function getScoreClasses(score) {
  if (score >= 8) return { text: 'score-ultra', bg: 'bg-red-500/10 border-red-500/20', dot: 'bg-red-500' };
  if (score >= 6) return { text: 'score-high', bg: 'bg-orange-500/10 border-orange-500/20', dot: 'bg-orange-500' };
  if (score >= 4) return { text: 'score-moderate', bg: 'bg-yellow-500/10 border-yellow-500/20', dot: 'bg-yellow-500' };
  return { text: 'text-white/40', bg: 'bg-white/5 border-white/10', dot: 'bg-white/40' };
}

/**
 * Platform display config.
 */
export const PLATFORM_CONFIG = {
  tiktok: { label: 'TikTok', icon: '🎵', color: 'from-pink-500 to-cyan-500' },
  youtube_shorts: { label: 'YouTube Shorts', icon: '▶️', color: 'from-red-500 to-red-600' },
  youtube_long: { label: 'YouTube Long', icon: '🎬', color: 'from-red-600 to-red-800' },
};

/**
 * Style display config.
 */
export const STYLE_CONFIG = {
  dark_channel: { label: 'Humor', emoji: '🌑', desc: 'Leve, engraçado e viral' },
  storytelling: { label: 'Storytelling', emoji: '📖', desc: 'Narrative-driven' },
  controversial: { label: 'Debate', emoji: '⚖️', desc: 'Dois lados, sem sensacionalismo' },
  educational: { label: 'Educational', emoji: '🧠', desc: 'Facts & insights' },
};

/**
 * Format hashtags for display.
 */
export function formatHashtags(hashtags = []) {
  return hashtags.map((tag) => (tag.startsWith('#') ? tag : `#${tag}`)).join(' ');
}
