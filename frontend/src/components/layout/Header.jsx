/**
 * components/layout/Header.jsx
 */

import { Zap, BookMarked } from 'lucide-react';
import { useLang } from '../../contexts/LanguageContext';
import { t } from '../../i18n/translations';

export function Header({ savedCount = 0, onOpenSaved, source = 'br', onToggleSource }) {
  const { lang, toggle } = useLang();
  const tx = t[lang];

  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-dark-900/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center animate-pulse-glow">
            <Zap size={16} className="text-white" fill="currentColor" />
          </div>
          <div>
            <span className="font-display font-bold text-white text-lg leading-none">
              Autor
            </span>
            <span className="font-display font-bold text-brand-400 text-lg leading-none">
              .AI
            </span>
          </div>
          <span className="hidden sm:block text-xs font-mono text-white/20 border border-white/10 px-2 py-0.5 rounded-md ml-1">
            v1.0
          </span>
        </div>

        {/* Tagline */}
        <p className="hidden md:block text-sm text-white/30 font-body">
          {tx.tagline}
        </p>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Source toggle */}
          <button
            onClick={onToggleSource}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-dark-700 text-xs font-mono text-white/50 hover:text-white/80 hover:border-white/20 transition-all duration-200"
            title="Trocar fonte de notícias"
          >
            {source === 'br' ? '🇧🇷 Nacional' : '🌍 Internacional'}
          </button>

          {/* Language toggle */}
          <button
            onClick={toggle}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-dark-700 text-xs font-mono text-white/50 hover:text-white/80 hover:border-white/20 transition-all duration-200"
            title="Trocar idioma / Switch language"
          >
            {lang === 'pt' ? '🇧🇷 PT' : '🇺🇸 EN'}
          </button>

          <button
            onClick={onOpenSaved}
            className="btn-ghost relative"
          >
            <BookMarked size={16} />
            <span className="hidden sm:block">{tx.saved}</span>
            {savedCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-brand-500 rounded-full text-xs flex items-center justify-center font-mono">
                {savedCount > 9 ? '9+' : savedCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
