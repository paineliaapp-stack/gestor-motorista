/**
 * components/news/NewsGrid.jsx
 */

import { AlertCircle, RefreshCw, Newspaper } from 'lucide-react';
import { NewsCard } from './NewsCard';

function SkeletonCard() {
  return (
    <div className="glass-card overflow-hidden">
      <div className="h-44 shimmer-bg" />
      <div className="p-4 space-y-3">
        <div className="flex gap-2">
          <div className="w-2 h-2 rounded-full shimmer-bg" />
          <div className="h-3 w-20 rounded shimmer-bg" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-full rounded shimmer-bg" />
          <div className="h-4 w-5/6 rounded shimmer-bg" />
          <div className="h-4 w-3/4 rounded shimmer-bg" />
        </div>
        <div className="h-3 w-full rounded shimmer-bg" />
        <div className="h-3 w-2/3 rounded shimmer-bg" />
      </div>
    </div>
  );
}

export function NewsGrid({ articles, loading, error, onSelect, onRetry }) {
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
          <AlertCircle size={24} className="text-red-400" />
        </div>
        <div className="text-center">
          <p className="font-display font-semibold text-white mb-1">Failed to load news</p>
          <p className="text-sm text-white/40 font-body max-w-sm">{error}</p>
        </div>
        {onRetry && (
          <button onClick={onRetry} className="btn-secondary">
            <RefreshCw size={14} />
            Try Again
          </button>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (!articles.length) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/5">
          <Newspaper size={24} className="text-white/30" />
        </div>
        <div className="text-center">
          <p className="font-display font-semibold text-white mb-1">No articles found</p>
          <p className="text-sm text-white/40 font-body">Try a different category or search term.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {articles.map((article, index) => (
        <NewsCard
          key={article.id}
          article={article}
          index={index}
          onClick={onSelect}
        />
      ))}
    </div>
  );
}
