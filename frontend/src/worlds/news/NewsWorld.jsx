import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useScriptGenerator } from '../../hooks/useScriptGenerator';
import { ScriptModal } from '../../components/script/ScriptModal';
import { ScriptModalMobile } from '../../components/script/ScriptModalMobile';

const CATEGORIES = [
  { id: 'general', label: 'Geral' },
  { id: 'technology', label: 'Tech' },
  { id: 'health', label: 'Saúde' },
  { id: 'science', label: 'Ciência' },
  { id: 'business', label: 'Negócios' },
  { id: 'entertainment', label: 'Entretenimento' },
  { id: 'sports', label: 'Esportes' },
];

function SkeletonCard() {
  return (
    <div style={{
      borderRadius: 14, overflow: 'hidden',
      border: '1px solid rgba(255,255,255,0.06)',
      background: 'rgba(255,255,255,0.02)',
    }}>
      <div style={{
        height: 176,
        background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.03) 75%)',
        backgroundSize: '200% 100%',
        animation: 'nwShimmer 1.5s ease infinite',
      }} />
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.06)', width: '35%' }} />
        <div style={{ height: 13, borderRadius: 4, background: 'rgba(255,255,255,0.06)', width: '92%' }} />
        <div style={{ height: 13, borderRadius: 4, background: 'rgba(255,255,255,0.04)', width: '70%' }} />
        <div style={{ height: 10, borderRadius: 4, background: 'rgba(255,255,255,0.04)', width: '50%' }} />
        <div style={{ height: 34, borderRadius: 8, background: 'rgba(255,255,255,0.04)', marginTop: 4 }} />
      </div>
    </div>
  );
}

function NewsCard({ article, index, onSelect }) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [showOpts, setShowOpts] = useState(false);
  const [platform, setPlatform] = useState('youtube_shorts');
  const [style, setStyle] = useState('educational');

  const accent = '#5b9bff';
  const glow = '91,155,255';
  const score = article.viral_score || 0;
  const scoreColor = score >= 8 ? '#00e5b0' : score >= 6 ? '#ffbe4d' : 'rgba(255,255,255,0.4)';
  const scoreLabel = score >= 8 ? 'ULTRA VIRAL' : score >= 6 ? 'POTENCIAL' : 'NORMAL';
  const sourceName = typeof article.source === 'string' ? article.source : (article.source?.name || 'RSS');

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 14, overflow: 'hidden',
        border: `1px solid ${hovered ? 'rgba(91,155,255,0.22)' : 'rgba(255,255,255,0.06)'}`,
        background: hovered ? 'rgba(91,155,255,0.04)' : 'rgba(255,255,255,0.02)',
        transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
        boxShadow: hovered ? '0 16px 48px rgba(0,0,0,0.6)' : '0 2px 12px rgba(0,0,0,0.3)',
        transition: 'transform 0.28s ease, box-shadow 0.28s ease, border-color 0.2s, background 0.2s',
        animation: 'nwFadeIn 0.45s ease both',
        animationDelay: `${index * 0.04}s`,
        display: 'flex', flexDirection: 'column',
      }}
    >
      <div style={{ position: 'relative', height: 176, overflow: 'hidden', background: '#0a0e1a', flexShrink: 0 }}>
        {!imgLoaded && !imgFailed && article.image && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 1,
            background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.03) 75%)',
            backgroundSize: '200% 100%', animation: 'nwShimmer 1.5s ease infinite',
          }} />
        )}
        {article.image && !imgFailed ? (
          <img
            src={article.image} alt={article.title}
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgFailed(true)}
            style={{
              width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center',
              opacity: imgLoaded ? 1 : 0,
              transition: 'opacity 0.4s ease, transform 0.4s ease',
              transform: hovered ? 'scale(1.05)' : 'scale(1)',
            }}
          />
        ) : null}
        {(!article.image || imgFailed) && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(135deg, #0d1220 0%, #060a12 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: 8,
          }}>
            <span style={{ fontSize: 28, opacity: 0.5 }}>📰</span>
            <span style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
              color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase',
              textAlign: 'center', padding: '0 12px',
              fontFamily: '-apple-system, sans-serif',
            }}>{article.source?.name || 'Notícia'}</span>
          </div>
        )}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to top, rgba(4,8,15,0.8) 0%, transparent 55%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', top: 10, right: 10,
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '4px 9px', borderRadius: 8,
          background: 'rgba(4,8,15,0.75)', backdropFilter: 'blur(12px)',
          border: `1px solid ${scoreColor}33`,
        }}>
          <div style={{
            width: 5, height: 5, borderRadius: '50%', background: scoreColor,
            boxShadow: score >= 8 ? `0 0 6px ${scoreColor}` : 'none',
            animation: score >= 8 ? 'nwPulse 2s ease infinite' : 'none',
          }} />
          <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: scoreColor, fontWeight: 700 }}>
            {score}/10
          </span>
        </div>
        <div style={{ position: 'absolute', bottom: 10, left: 10 }}>
          <span style={{
            fontFamily: 'Space Mono, monospace', fontSize: 8, color: 'rgba(255,255,255,0.6)',
            background: 'rgba(4,8,15,0.72)', backdropFilter: 'blur(12px)',
            padding: '3px 8px', borderRadius: 4, letterSpacing: '0.08em',
          }}>{sourceName}</span>
        </div>
      </div>

      <div style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: scoreColor, flexShrink: 0 }} />
          <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, letterSpacing: '0.14em', color: scoreColor, fontWeight: 700 }}>{scoreLabel}</span>
          {article.publishedAt && (
            <>
              <div style={{ flex: 1 }} />
              <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>
                {formatTime(article.publishedAt)}
              </span>
            </>
          )}
        </div>

        <h3 style={{
          fontFamily: 'DM Sans, sans-serif', fontSize: 13, fontWeight: 500,
          color: hovered ? '#fff' : 'rgba(255,255,255,0.88)',
          margin: '0 0 4px', lineHeight: 1.4,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          transition: 'color 0.2s',
        }}>{article.title}</h3>

        {article.description && (
          <p style={{
            fontFamily: 'DM Sans, sans-serif', fontSize: 11, fontWeight: 300,
            color: 'rgba(255,255,255,0.55)', margin: '0 0 4px', lineHeight: 1.5,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {article.description?.slice(0, 100)}{article.description?.length > 100 ? '...' : ''}
          </p>
        )}

        <div style={{ flex: 1 }} />

        {showOpts && (
          <div style={{
            padding: '10px 12px', borderRadius: 10,
            background: `rgba(${glow},0.06)`, border: `1px solid rgba(${glow},0.18)`,
            display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center',
          }}>
            <select value={platform} onChange={e => setPlatform(e.target.value)} style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 6, padding: '5px 8px', color: 'rgba(255,255,255,0.8)',
              fontSize: 11, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
            }}>
              <option value="tiktok">TikTok</option>
              <option value="youtube_shorts">YouTube Shorts</option>
              <option value="youtube_long">YouTube Longo</option>
            </select>
            <select value={style} onChange={e => setStyle(e.target.value)} style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 6, padding: '5px 8px', color: 'rgba(255,255,255,0.8)',
              fontSize: 11, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
            }}>
              <option value="educational">Educacional</option>
              <option value="storytelling">Storytelling</option>
              <option value="dark_channel">Entretenimento</option>
              <option value="controversial">Debate</option>
            </select>
            <button
              onClick={() => onSelect(article, { platform, style })}
              style={{
                marginLeft: 'auto', padding: '6px 14px', borderRadius: 6,
                background: `rgba(${glow},0.18)`, border: `1px solid rgba(${glow},0.45)`,
                color: accent, fontFamily: 'Space Mono, monospace',
                fontSize: 9, letterSpacing: '0.16em', cursor: 'pointer',
              }}
            >GERAR →</button>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
          <button
            onClick={() => setShowOpts(!showOpts)}
            style={{
              flex: 1, padding: '9px 14px', borderRadius: 8,
              border: 'none', cursor: 'pointer',
              fontFamily: 'DM Sans, sans-serif', fontSize: 12, fontWeight: 600,
              color: '#fff',
              background: showOpts
                ? `rgba(${glow},0.25)`
                : `linear-gradient(135deg, rgba(${glow},0.9) 0%, rgba(60,100,220,0.9) 100%)`,
              boxShadow: showOpts ? 'none' : `0 2px 14px rgba(${glow},0.3)`,
              transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <span style={{ fontSize: 13 }}>⚡</span>
            {showOpts ? 'Fechar opções' : 'Gerar Roteiro'}
          </button>

          {article.url && (
            <a
              href={article.url} target="_blank" rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              style={{
                width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.6)',
                background: 'rgba(255,255,255,0.03)',
                textDecoration: 'none', fontSize: 13,
                transition: 'color 0.15s, border-color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.3)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
              title="Ler artigo original"
            >↗</a>
          )}
        </div>
      </div>
    </div>
  );
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const diff = (Date.now() - d.getTime()) / 60000;
    if (diff < 60) return `${Math.floor(diff)}m atrás`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h atrás`;
    return `${Math.floor(diff / 1440)}d atrás`;
  } catch { return ''; }
}

const isMobileNews = typeof window !== 'undefined' && window.innerWidth < 640;

export function NewsWorld() {
  const navigate = useNavigate();
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState('general');
  const [selected, setSelected] = useState(null);
  const [mobilePick, setMobilePick] = useState(null);
  const [sourceMode, setSourceMode] = useState('br'); // 'br' | 'intl'
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('viral'); // 'viral' | 'date'
  const [savedScripts, setSavedScripts] = useState(() => {
    try { return JSON.parse(localStorage.getItem('vn_saved_scripts') || '[]'); } catch { return []; }
  });
  const [showSaved, setShowSaved] = useState(false);
  const generator = useScriptGenerator();

  // Filtra e ordena artigos
  const filteredArticles = articles
    .filter(a => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (a.title || '').toLowerCase().includes(q) ||
             (a.description || '').toLowerCase().includes(q) ||
             (typeof a.source === 'string' ? a.source : a.source?.name || '').toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (sortBy === 'date') {
        return new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0);
      }
      return (b.viral_score || 0) - (a.viral_score || 0);
    });

  function saveCurrentScript(article) {
    if (!generator.script) return;
    const entry = {
      id: 'saved_' + Date.now(),
      article_title: article?.title || '',
      article_image: article?.image || '',
      article_source: article?.source || '',
      savedAt: new Date().toISOString(),
      script: typeof generator.script === 'object' ? generator.script : { script: generator.script },
    };
    const updated = [entry, ...savedScripts].slice(0, 50);
    setSavedScripts(updated);
    try { localStorage.setItem('vn_saved_scripts', JSON.stringify(updated)); } catch {}
    return entry.id;
  }

  function deleteSavedScript(id) {
    const updated = savedScripts.filter(s => s.id !== id);
    setSavedScripts(updated);
    try { localStorage.setItem('vn_saved_scripts', JSON.stringify(updated)); } catch {}
  }

  const accent = '#5b9bff';
  const glow = '91,155,255';

  const fetchNews = useCallback(async (cat, mode) => {
    setLoading(true);
    setArticles([]);
    try {
      const r = await fetch(`/api/news?category=${cat}&source=${mode}`);
      const d = await r.json();
      setArticles((d.articles || d).slice(0, 100));
    } catch (e) { setArticles([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchNews(category, sourceMode); }, [category, sourceMode]);

  return (
    <div style={{ minHeight: '100vh', background: '#04080f', color: '#fff', fontFamily: 'DM Sans, sans-serif' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&family=DM+Sans:wght@300;400;500&family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(91,155,255,0.25); border-radius: 2px; }
        @keyframes nwFadeIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes nwShimmer { 0% { background-position:200% 0; } 100% { background-position:-200% 0; } }
        @keyframes nwPulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
        @keyframes nwSpin { to { transform:rotate(360deg); } }
        .cat-btn { transition: all 0.18s; white-space: nowrap; }
        .cat-btn:hover { color: #fff !important; border-color: rgba(91,155,255,0.4) !important; }
        .sort-btn { transition: all 0.18s; }
        .sort-btn:hover { border-color: rgba(91,155,255,0.4) !important; color: #fff !important; }
        .saved-card:hover { border-color: rgba(91,155,255,0.25) !important; background: rgba(91,155,255,0.05) !important; }
      ` }} />

      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse at 15% 0%, rgba(30,60,140,0.3) 0%, transparent 55%), radial-gradient(ellipse at 85% 100%, rgba(20,40,100,0.2) 0%, transparent 55%)' }} />

      {/* Header */}
      <header style={{
        position: 'sticky', top: 42, zIndex: 50, height: 56, marginTop: -1,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px',
        background: 'rgba(7,7,15,0.97)', backdropFilter: 'blur(32px)', WebkitBackdropFilter: 'blur(32px)',

      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={() => navigate('/')} style={{
            fontFamily: 'Space Mono', fontSize: 9, letterSpacing: '0.22em',
            color: 'rgba(255,255,255,0.7)', background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          }}>← PORTAL</button>
          <span style={{ color: 'rgba(255,255,255,0.1)' }}>|</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%', background: accent,
              boxShadow: `0 0 10px rgba(${glow},0.9)`, animation: 'nwPulse 2s ease-in-out infinite',
            }} />
            <span style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, fontWeight: 700, color: '#fff', letterSpacing: '-0.5px' }}>Notícias</span>
          </div>
        </div>

        {/* Toggle BR / Internacional */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 2,
          background: 'rgba(255,255,255,0.05)', borderRadius: 10, padding: 3,
          border: '1px solid rgba(255,255,255,0.08)',
        }}>
          <button
            onClick={() => setSourceMode('br')}
            style={{
              padding: '5px 14px', borderRadius: 7, border: 'none', cursor: 'pointer',
              fontFamily: 'Space Mono', fontSize: 9, letterSpacing: '0.14em',
              background: sourceMode === 'br' ? `rgba(${glow},0.2)` : 'transparent',
              color: sourceMode === 'br' ? accent : 'rgba(255,255,255,0.35)',
              borderColor: sourceMode === 'br' ? `rgba(${glow},0.4)` : 'transparent',
              transition: 'all 0.18s',
            }}
          >🇧🇷 BR</button>
          <button
            onClick={() => setSourceMode('intl')}
            style={{
              padding: '5px 14px', borderRadius: 7, border: 'none', cursor: 'pointer',
              fontFamily: 'Space Mono', fontSize: 9, letterSpacing: '0.14em',
              background: sourceMode === 'intl' ? `rgba(${glow},0.2)` : 'transparent',
              color: sourceMode === 'intl' ? accent : 'rgba(255,255,255,0.35)',
              transition: 'all 0.18s',
            }}
          >🌍 INTL</button>
        </div>
      </header>
      <div style={{
        height: 48,
        background: 'linear-gradient(180deg, rgba(7,7,15,0.97) 0%, transparent 100%)',
        pointerEvents: 'none',
        position: 'sticky',
        top: 98,
        zIndex: 49,
        marginBottom: -48,
      }} />





      {/* Hero */}
      <div style={{
        padding: '32px 24px 28px', borderBottom: '1px solid rgba(255,255,255,0.05)',
        background: `linear-gradient(180deg, rgba(${glow},0.25) 0%, rgba(${glow},0.08) 60%, transparent 100%)`,
        position: 'relative',
      }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 175, background: 'linear-gradient(180deg, rgba(7,7,15,1) 0%, rgba(7,7,15,0.88) 42%, rgba(7,7,15,0.45) 75%, transparent 100%)', pointerEvents: 'none', zIndex: 0 }} />
        <p style={{ position: 'relative', zIndex: 1, fontFamily: 'Space Mono', fontSize: 8, letterSpacing: '0.5em', color: `rgba(${glow},0.9)`, marginBottom: 10 }}>ROTEIROS VIRAIS</p>
        <h1 style={{ position: 'relative', zIndex: 1, fontFamily: 'Playfair Display, serif', fontSize: 'clamp(32px,6vw,64px)', fontWeight: 900, margin: '0 0 6px', lineHeight: 0.92, letterSpacing: '-2px' }}>
          <span style={{ fontStyle: 'italic', color: '#fff' }}>Breaking</span>{' '}
          <span style={{ color: 'transparent', WebkitTextStroke: '1.5px rgba(255,255,255,0.8)' }}>News</span>
        </h1>
        <p style={{ position: 'relative', zIndex: 1, fontFamily: 'DM Sans', fontSize: 13, color: 'rgba(255,255,255,0.75)', margin: '16px 0 0', fontWeight: 300 }}>
          {sourceMode === 'br'
            ? 'Notícias brasileiras — G1, Folha, CNN Brasil, R7, UOL e mais'
            : 'International news via NewsAPI'}
        </p>
{sourceMode === 'br' && <p style={{ position:'relative', zIndex:1, fontFamily:'DM Sans', fontSize:11, color:'rgba(255,255,255,0.28)', margin:'5px 0 0', fontWeight:300 }}>Roteiros gerados por IA com base no titulo e resumo · Fatos de responsabilidade da fonte original</p>}
      </div>

      {/* ── Busca + Ordenação ── */}
      <div style={{ padding: '12px 24px 0', display: 'flex', gap: 10, alignItems: 'center' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, opacity: 0.4, pointerEvents: 'none' }}>🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por palavra-chave, fonte..."
            style={{
              width: '100%', padding: '9px 14px 9px 36px',
              borderRadius: 10, border: '1px solid rgba(91,155,255,0.15)',
              background: 'rgba(255,255,255,0.04)', color: '#fff',
              fontFamily: 'DM Sans, sans-serif', fontSize: 13,
              outline: 'none', transition: 'border-color 0.2s',
            }}
            onFocus={e => e.target.style.borderColor = 'rgba(91,155,255,0.45)'}
            onBlur={e => e.target.style.borderColor = 'rgba(91,155,255,0.15)'}
          />
          {search && (
            <button onClick={() => setSearch('')}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: 14, padding: '2px 6px' }}>✕</button>
          )}
        </div>

        {/* Ordenação */}
        <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
          {[{id:'viral',label:'🔥 Viral'},{id:'date',label:'🕐 Recente'}].map(s => (
            <button key={s.id} className="sort-btn" onClick={() => setSortBy(s.id)}
              style={{ padding: '8px 12px', borderRadius: 9, fontSize: 12, fontFamily: 'DM Sans, sans-serif', fontWeight: 500, cursor: 'pointer', border: sortBy === s.id ? '1px solid rgba(91,155,255,0.6)' : '1px solid rgba(255,255,255,0.08)', background: sortBy === s.id ? 'rgba(91,155,255,0.14)' : 'rgba(255,255,255,0.03)', color: sortBy === s.id ? '#5b9bff' : 'rgba(255,255,255,0.5)', transition: 'all 0.18s' }}>
              {s.label}
            </button>
          ))}
        </div>

        {/* Roteiros salvos */}
        <button onClick={() => setShowSaved(!showSaved)}
          style={{ position: 'relative', padding: '8px 14px', borderRadius: 9, fontSize: 12, fontFamily: 'DM Sans, sans-serif', fontWeight: 500, cursor: 'pointer', border: showSaved ? '1px solid rgba(91,155,255,0.6)' : '1px solid rgba(255,255,255,0.08)', background: showSaved ? 'rgba(91,155,255,0.14)' : 'rgba(255,255,255,0.03)', color: showSaved ? '#5b9bff' : 'rgba(255,255,255,0.5)', flexShrink: 0, transition: 'all 0.18s' }}>
          📁 Salvos
          {savedScripts.length > 0 && (
            <span style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: '50%', background: '#5b9bff', color: '#07070f', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Space Mono, monospace' }}>{savedScripts.length}</span>
          )}
        </button>
      </div>

      {/* ── Painel de Roteiros Salvos ── */}
      {showSaved && (
        <div style={{ margin: '12px 24px 0', borderRadius: 14, border: '1px solid rgba(91,155,255,0.12)', background: 'rgba(4,8,15,0.95)', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(91,155,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, letterSpacing: '0.2em', color: 'rgba(91,155,255,0.8)', fontWeight: 700 }}>📁 ROTEIROS SALVOS — {savedScripts.length}</span>
            {savedScripts.length > 0 && (
              <button onClick={() => { setSavedScripts([]); localStorage.removeItem('vn_saved_scripts'); }} style={{ fontSize: 10, color: 'rgba(255,80,80,0.5)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Limpar tudo</button>
            )}
          </div>
          {savedScripts.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 13, fontFamily: 'DM Sans, sans-serif' }}>Nenhum roteiro salvo ainda.<br/>Clique em 💾 Salvar após gerar um roteiro.</div>
          ) : (
            <div style={{ maxHeight: 320, overflowY: 'auto', padding: '8px' }}>
              {savedScripts.map(s => (
                <div key={s.id} className="saved-card" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)', background: 'transparent', marginBottom: 6, transition: 'all 0.18s', cursor: 'default' }}>
                  {s.article_image && <img src={s.article_image} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} onError={e => e.target.style.display='none'} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'rgba(255,255,255,0.85)', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.article_title || 'Roteiro salvo'}</p>
                    <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'rgba(255,255,255,0.6)', margin: 0 }}>{new Date(s.savedAt).toLocaleDateString('pt-BR')} · {(s.script?.script || '').split(' ').slice(0,6).join(' ')}...</p>
                  </div>
                  <button onClick={() => { navigator.clipboard?.writeText(s.script?.script || JSON.stringify(s.script)); }} style={{ padding: '4px 10px', borderRadius: 6, background: 'rgba(91,155,255,0.1)', border: '1px solid rgba(91,155,255,0.2)', color: '#5b9bff', fontSize: 10, cursor: 'pointer', fontFamily: 'Space Mono, monospace', flexShrink: 0 }}>Copiar</button>
                  <button onClick={() => deleteSavedScript(s.id)} style={{ padding: '4px 8px', borderRadius: 6, background: 'transparent', border: '1px solid rgba(255,80,80,0.15)', color: 'rgba(255,80,80,0.4)', fontSize: 10, cursor: 'pointer', flexShrink: 0 }}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Categorias */}
      <div style={{
        padding: '14px 24px', display: 'flex', gap: 8, flexWrap: 'wrap',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        background: 'rgba(4,8,15,0.6)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        position: 'sticky', top: 98, zIndex: 40,
      }}>
        {CATEGORIES.map(cat => (
          <button key={cat.id} className="cat-btn" onClick={() => setCategory(cat.id)} style={{
            padding: '6px 16px', borderRadius: 20,
            border: category === cat.id ? `1px solid rgba(${glow},0.6)` : '1px solid rgba(255,255,255,0.08)',
            background: category === cat.id ? `rgba(${glow},0.15)` : 'rgba(255,255,255,0.04)',
            backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            color: category === cat.id ? accent : 'rgba(255,255,255,0.45)',
            fontFamily: 'DM Sans', fontSize: 12, fontWeight: 500, cursor: 'pointer',
          }}>{cat.label}</button>
        ))}
      </div>

      {/* Grid */}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '28px 24px 100px', position: 'relative', zIndex: 5 }}>
        {loading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px, calc(50vw - 28px)), 1fr))', gap: 12 }}>
            {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {!loading && articles.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'Space Mono', fontSize: 9, letterSpacing: '0.2em', color: `rgba(${glow},0.5)` }}>
                {filteredArticles.length} ARTIGOS
              </span>
              <span style={{ fontFamily: 'Space Mono', fontSize: 9, letterSpacing: '0.2em', color: 'rgba(0,229,176,0.5)' }}>
                {filteredArticles.filter(a => (a.viral_score || 0) >= 8).length} ULTRA VIRAL
              </span>
              <span style={{ fontFamily: 'Space Mono', fontSize: 9, letterSpacing: '0.2em', color: 'rgba(255,190,77,0.5)' }}>
                {filteredArticles.filter(a => (a.viral_score || 0) >= 6 && (a.viral_score || 0) < 8).length} POTENCIAL
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px, calc(50vw - 28px)), 1fr))', gap: 12 }}>
              {filteredArticles.map((article, i) => (
                <NewsCard
                  key={article.id || i}
                  article={article}
                  index={i}
                  onSelect={(a, opts) => {
                    if (isMobileNews) { setMobilePick(a); return; }
                    setSelected(a);
                    generator.reset();
                    // Pautas sensíveis (red/yellow) — não gera automaticamente
                    // O usuário precisa escolher o ângulo primeiro no modal
                    const text = ((a.title || '') + ' ' + (a.description || '')).toLowerCase();
                    const isRed = /lei|projeto de lei|congresso|senado|câmara|votação|partido|presidente|governo|politica|eleicao|reforma|ideologia|esquerda|direita|religiao|aborto|greve|sindicato|escala|jornada|guerra|conflito|terrorismo|trump|biden|lula|bolsonaro|milei|putin|russia|china|eua|israel|palestina|gaza|ucrania|casa branca|tarifa|otan|nato|ministro|stf|tse|impeachment|supremo|golpe|diplomacia/.test(text);
                    const isYellow = /dinheiro|investimento|bitcoin|inflacao|imposto|economia|saude|vacina|doenca|psicologia|comportamento|tecnologia|privacidade/.test(text);
                    if (!isRed && !isYellow) {
                      generator.generate(a, opts);
                    }
                    // Para pautas sensíveis: modal abre, usuário escolhe ângulo e clica Gerar
                  }}
                />
              ))}
            </div>
          </>
        )}

        {!loading && filteredArticles.length === 0 && (
          <div style={{ textAlign: 'center', padding: '100px 0', border: '1px dashed rgba(91,155,255,0.1)', borderRadius: 16 }}>
            <p style={{ fontFamily: 'Space Mono', fontSize: 9, letterSpacing: '0.3em', color: 'rgba(255,255,255,0.2)', marginBottom: 8 }}>SEM NOTÍCIAS</p>
            <p style={{ fontFamily: 'DM Sans', fontSize: 13, color: 'rgba(255,255,255,0.22)', fontWeight: 300 }}>Tente outra categoria</p>
          </div>
        )}
      </div>

      {mobilePick && isMobileNews && (
        <ScriptModalMobile
          article={mobilePick}
          onClose={() => setMobilePick(null)}
          onGenerate={(a, opts) => {
            setMobilePick(null);
            setSelected(a);
            generator.reset();
            setTimeout(() => generator.generate(a, { ...opts, version: 1 }), 100);
          }}
        />
      )}
      {selected && (
        <ScriptModal
          article={selected}
          generator={generator}
          onClose={() => setSelected(null)}
          onSave={() => saveCurrentScript(selected)}
          onGenerate={opts => generator.generate(selected, opts)}
          accentColor="#5b9bff"
          glowColor="91,155,255"
        />
      )}
    </div>
  );
}
