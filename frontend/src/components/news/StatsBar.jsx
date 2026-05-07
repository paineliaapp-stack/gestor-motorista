/**
 * components/news/StatsBar.jsx
 * Shows aggregate stats for loaded articles.
 */

import { Zap, TrendingUp, Flame } from 'lucide-react';

export function StatsBar({ articles = [] }) {
  if (!articles.length) return null;

  const avgScore = Math.round(
    articles.reduce((sum, a) => sum + a.viral_score, 0) / articles.length
  );
  const ultraViral = articles.filter((a) => a.viral_score >= 8).length;
  const highPotential = articles.filter((a) => a.viral_score >= 6 && a.viral_score < 8).length;

  return (
    <div className="flex items-center gap-4 sm:gap-6 overflow-x-auto pb-1">
      <div className="flex items-center gap-2 flex-shrink-0">
        <Zap size={14} className="text-brand-400" fill="currentColor" />
        <span className="text-xs font-body text-white/50">
          <span className="font-mono font-bold text-white">{articles.length}</span> articles found
        </span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Flame size={14} className="text-red-400" />
        <span className="text-xs font-body text-white/50">
          <span className="font-mono font-bold text-red-400">{ultraViral}</span> ultra viral
        </span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <TrendingUp size={14} className="text-orange-400" />
        <span className="text-xs font-body text-white/50">
          <span className="font-mono font-bold text-orange-400">{highPotential}</span> high potential
        </span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
        <span className="text-xs font-body text-white/30">Score médio</span>
        <span className="font-mono text-sm font-bold text-brand-400">{avgScore}/10</span>
      </div>
    </div>
  );
}
