/**
 * components/news/NewsCard.jsx
 * Cards de notícias com skeleton loader, botão CTA destacado e polish geral
 */

import { useState } from 'react';
import { Zap, ExternalLink, Clock } from 'lucide-react';
import clsx from 'clsx';
import { truncate, formatRelativeTime, getScoreClasses } from '../../utils';

// ── Skeleton loader (exibido enquanto a lista carrega) ──────────────────────
export function NewsCardSkeleton() {
  return (
    <div className="glass-card overflow-hidden animate-pulse">
      <div className="h-44 bg-dark-700" style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s ease infinite' }} />
      <div className="p-4 space-y-3">
        <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.06)', width: '40%' }} />
        <div style={{ height: 12, borderRadius: 4, background: 'rgba(255,255,255,0.06)', width: '90%' }} />
        <div style={{ height: 12, borderRadius: 4, background: 'rgba(255,255,255,0.04)', width: '75%' }} />
        <div style={{ height: 10, borderRadius: 4, background: 'rgba(255,255,255,0.04)', width: '55%' }} />
        <div style={{ height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.04)', marginTop: 8 }} />
      </div>
    </div>
  );
}

// ── Card principal ──────────────────────────────────────────────────────────
export function NewsCard({ article, onClick, index = 0 }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const scoreClasses = getScoreClasses(article.viral_score);

  const handleClick = (e) => {
    e.preventDefault();
    onClick(article);
  };

  return (
    <div
      className="glass-card-hover cursor-pointer overflow-hidden group animate-fade-in"
      style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'backwards' }}
      onClick={handleClick}
    >
      {/* ── Imagem ── */}
      <div className="relative overflow-hidden bg-dark-700" style={{ height: 176 }}>
        {/* Shimmer enquanto carrega */}
        {!imgLoaded && !imgFailed && article.image && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 1,
            background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.03) 75%)',
            backgroundSize: '200% 100%', animation: 'shimmer 1.5s ease infinite',
          }} />
        )}

        {article.image && !imgFailed ? (
          <img
            src={article.image}
            alt={article.title}
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            style={{ opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.4s ease, transform 0.5s ease' }}
          />
        ) : null}

        {/* Fallback sem imagem */}
        {(!article.image || imgFailed) && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #1a1a24 0%, #111118 100%)' }}
          >
            <span style={{ fontSize: 40, opacity: 0.2 }}>📰</span>
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-dark-800/80 to-transparent" />

        {/* Badge viral score */}
        <div
          className={clsx(
            'absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg',
            'border backdrop-blur-sm animate-score-pop',
            scoreClasses.bg
          )}
        >
          <Zap size={11} className={clsx(scoreClasses.text)} fill="currentColor" />
          <span className={clsx('font-mono text-xs font-bold', scoreClasses.text)}>
            {article.viral_score}/10
          </span>
        </div>

        {/* Source badge */}
        <div className="absolute bottom-3 left-3">
          <span className="text-xs font-body font-medium text-white/70 bg-dark-900/70 backdrop-blur-sm px-2 py-1 rounded-md">
            {article.source}
          </span>
        </div>
      </div>

      {/* ── Conteúdo ── */}
      <div className="p-4" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Score label + tempo */}
        <div className="flex items-center gap-2">
          <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', scoreClasses.dot)} />
          <span className={clsx('text-xs font-mono font-semibold tracking-wider', scoreClasses.text)}>
            {article.score_label}
          </span>
          <div className="flex-1" />
          <div className="flex items-center gap-1 text-white/30 text-xs font-body">
            <Clock size={10} />
            <span>{formatRelativeTime(article.publishedAt)}</span>
          </div>
        </div>

        {/* Título */}
        <h3 className="font-display font-semibold text-white text-sm leading-snug line-clamp-3 group-hover:text-brand-300 transition-colors">
          {article.title}
        </h3>

        {/* Descrição */}
        {article.description && (
          <p className="text-xs text-white/40 font-body leading-relaxed line-clamp-2">
            {truncate(article.description, 120)}
          </p>
        )}

        {/* ── CTA destacado ── */}
        <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={handleClick}
            style={{
              flex: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '9px 14px', borderRadius: 8, cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
              letterSpacing: '0.02em',
              color: '#0a0a14',
              background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
              border: 'none',
              boxShadow: '0 2px 12px rgba(139,92,246,0.35)',
              transition: 'opacity 0.15s, transform 0.15s, box-shadow 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.opacity = '0.9';
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(139,92,246,0.5)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.opacity = '1';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 12px rgba(139,92,246,0.35)';
            }}
          >
            <Zap size={12} fill="currentColor" />
            Gerar Roteiro
          </button>

          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 36, height: 36, borderRadius: 8, flexShrink: 0,
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.3)',
              background: 'rgba(255,255,255,0.03)',
              transition: 'color 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = 'rgba(255,255,255,0.65)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.16)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = 'rgba(255,255,255,0.3)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
            }}
            title="Ler artigo original"
          >
            <ExternalLink size={13} />
          </a>
        </div>
      </div>
    </div>
  );
}
