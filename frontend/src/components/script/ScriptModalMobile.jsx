import { useState } from 'react';

const PLATFORMS = [
  { id: 'tiktok',         label: 'TikTok',    icon: '🎵', duration: '15–60s' },
  { id: 'youtube_shorts', label: 'YT Shorts', icon: '▶️', duration: '60s' },
  { id: 'youtube_long',   label: 'YT Longo',  icon: '🎬', duration: '5–15min' },
];

const STYLES = [
  { id: 'educational',   label: 'Educacional', icon: '🎓' },
  { id: 'storytelling',  label: 'Storytelling', icon: '📖' },
  { id: 'dark_channel',  label: 'Entreten.',   icon: '🎭' },
  { id: 'controversial', label: 'Debate',      icon: '⚖️' },
];

export function ScriptModalMobile({ article, onClose, onGenerate, glowColor = '91,155,255', accentColor = '#5b9bff' }) {
  const [platform, setPlatform] = useState('youtube_shorts');
  const [style, setStyle] = useState('storytelling');

  if (!article) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
    }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#0d0d1a',
          borderRadius: '20px 20px 0 0',
          border: `1px solid rgba(${glowColor},0.2)`,
          padding: '0 0 32px',
          display: 'flex', flexDirection: 'column', gap: 0,
          maxHeight: '90vh',
        }}
      >
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)' }} />
        </div>

        {/* Notícia */}
        <div style={{ padding: '8px 16px 12px', borderBottom: `1px solid rgba(${glowColor},0.08)`, display: 'flex', gap: 10, alignItems: 'center' }}>
          {article.image && <img src={article.image} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} onError={e => e.target.style.display='none'} />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, fontWeight: 600, color: '#fff', margin: 0, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{article.title}</p>
            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: `rgba(${glowColor},0.7)`, letterSpacing: '0.1em' }}>{article.source?.name}</span>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>✕</button>
        </div>

        {/* Plataforma */}
        <div style={{ padding: '14px 16px 8px' }}>
          <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.4)', margin: '0 0 10px' }}>PLATAFORMA</p>
          <div style={{ display: 'flex', gap: 8 }}>
            {PLATFORMS.map(p => (
              <button key={p.id} onClick={() => setPlatform(p.id)} style={{
                flex: 1, padding: '10px 6px', borderRadius: 12, cursor: 'pointer',
                border: platform === p.id ? `1px solid rgba(${glowColor},0.7)` : '1px solid rgba(255,255,255,0.08)',
                background: platform === p.id ? `rgba(${glowColor},0.15)` : 'rgba(255,255,255,0.03)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              }}>
                <span style={{ fontSize: 18 }}>{p.icon}</span>
                <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, fontWeight: 600, color: platform === p.id ? accentColor : 'rgba(255,255,255,0.7)' }}>{p.label}</span>
                <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>{p.duration}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Estilo */}
        <div style={{ padding: '12px 16px 8px' }}>
          <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.4)', margin: '0 0 10px' }}>ESTILO</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {STYLES.map(s => (
              <button key={s.id} onClick={() => setStyle(s.id)} style={{
                padding: '10px 12px', borderRadius: 12, cursor: 'pointer',
                border: style === s.id ? `1px solid rgba(${glowColor},0.7)` : '1px solid rgba(255,255,255,0.08)',
                background: style === s.id ? `rgba(${glowColor},0.15)` : 'rgba(255,255,255,0.03)',
                display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left',
              }}>
                <span style={{ fontSize: 16 }}>{s.icon}</span>
                <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, fontWeight: 600, color: style === s.id ? accentColor : 'rgba(255,255,255,0.8)' }}>{s.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Botão gerar */}
        <div style={{ padding: '16px 16px 0' }}>
          <button
            onClick={() => onGenerate(article, { platform, style })}
            style={{
              width: '100%', padding: '14px', borderRadius: 14, cursor: 'pointer',
              background: `linear-gradient(135deg, rgba(${glowColor},0.3), rgba(${glowColor},0.15))`,
              border: `1px solid rgba(${glowColor},0.5)`,
              color: accentColor, fontFamily: 'Space Mono, monospace',
              fontSize: 13, fontWeight: 700, letterSpacing: '0.1em',
            }}
          >
            ⚡ GERAR ROTEIRO
          </button>
        </div>
      </div>
    </div>
  );
}
