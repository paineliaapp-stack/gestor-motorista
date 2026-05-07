/**
 * components/news/NewsFilters.jsx
 */

import { useState, useRef } from 'react';
import { Search, RefreshCw, X } from 'lucide-react';
import clsx from 'clsx';
import { useLang } from '../../contexts/LanguageContext';
import { t } from '../../i18n/translations';

const CATEGORIES = [
  { id: 'general',       emoji: '🌐' },
  { id: 'technology',    emoji: '💻' },
  { id: 'business',      emoji: '💼' },
  { id: 'entertainment', emoji: '🎬' },
  { id: 'health',        emoji: '🏥' },
  { id: 'science',       emoji: '🔬' },
  { id: 'sports',        emoji: '⚽' },
];

export function NewsFilters({ category, onCategoryChange, onSearch, onRefresh, loading }) {
  const { lang } = useLang();
  const tx = t[lang];

  const [searchValue, setSearchValue] = useState('');
  const inputRef = useRef(null);

  const handleSearch = (val) => {
    setSearchValue(val);
    onSearch(val);
  };

  const clearSearch = () => {
    setSearchValue('');
    onSearch('');
    inputRef.current?.focus();
  };

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={searchValue}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder={tx.searchPlaceholder}
          className="input-field pl-10 pr-10"
        />
        {searchValue && (
          <button
            onClick={clearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Category pills + refresh */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => onCategoryChange(cat.id)}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-all duration-200',
              'border font-body',
              category === cat.id
                ? 'bg-brand-500 border-brand-500 text-white font-medium'
                : 'border-white/5 bg-dark-700 text-white/50 hover:text-white/80 hover:border-white/10'
            )}
          >
            <span>{cat.emoji}</span>
            <span>{tx.categories[cat.id]}</span>
          </button>
        ))}

        <button
          onClick={onRefresh}
          disabled={loading}
          className="ml-auto flex-shrink-0 btn-ghost"
          title={tx.refresh}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span className="hidden sm:block">{tx.refresh}</span>
        </button>
      </div>
    </div>
  );
}
