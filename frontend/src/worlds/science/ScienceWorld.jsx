/**
 * ScienceWorld.jsx — cards visuais, busca via backend proxy, 3 fontes
 * Fix: auto-load categoria padrão ao montar + fallback 429 Semantic Scholar
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useScriptGenerator } from '../../hooks/useScriptGenerator';
import { ScriptModal } from '../../components/script/ScriptModal';

if (typeof document !== 'undefined' && !document.getElementById('sw-fonts')) {
  const l = document.createElement('link');
  l.id = 'sw-fonts'; l.rel = 'stylesheet';
  l.href = 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&family=DM+Sans:wght@300;400;500&family=Space+Mono:wght@400;700&display=swap';
  document.head.appendChild(l);
}

const SOURCES = [
  { id: 'pubmed',     label: 'PubMed',          color: '#00e5b0', glow: '0,229,176' },
  { id: 'europepmc', label: 'Europe PMC',        color: '#4a9eff', glow: '74,158,255' },
  { id: 'semantic',  label: 'Semantic Scholar',  color: '#a78bfa', glow: '167,139,250' },
];

const CATEGORIES = [
  { id: 'neuroscience', label: 'Neurociência',  icon: '🧠', query: 'neuroscience brain cognitive' },
  { id: 'psychology',   label: 'Psicologia',    icon: '💬', query: 'psychology mental health behavior' },
  { id: 'nutrition',    label: 'Nutrição',      icon: '🥦', query: 'nutrition diet health longevity' },
  { id: 'fitness',      label: 'Exercício',     icon: '⚡', query: 'exercise fitness physical activity benefits' },
  { id: 'physio',       label: 'Fisioterapia',  icon: '🦴', query: 'physiotherapy rehabilitation pain' },
  { id: 'medicine',     label: 'Medicina',      icon: '⚕️', query: 'clinical medicine treatment breakthrough' },
];

const DEFAULT_CATEGORY = CATEGORIES[0]; // Neurociência carrega ao entrar

const PLATFORMS = [['tiktok','TikTok / Instagram'],['youtube_shorts','YT Shorts'],['youtube_long','YT Longo']];
const STYLES    = [['educational','Educacional'],['storytelling','Storytelling'],['dark_channel','Entretenimento'],['controversial','Debate']];

// ── Busca via backend proxy ───────────────────────────────────────────────────
async function searchScience(query, sourceId) {
  try {
    const res = await fetch(`/api/science?q=${encodeURIComponent(query)}&source=${sourceId}`);
    if (res.status === 429) {
      // Rate limit — tenta PubMed como fallback
      if (sourceId !== 'pubmed') {
        const fallback = await fetch(`/api/science?q=${encodeURIComponent(query)}&source=pubmed`);
        if (fallback.ok) {
          const data = await fallback.json();
          return { articles: data.articles || [], rateLimited: true };
        }
      }
      return { articles: [], rateLimited: true };
    }
    if (!res.ok) throw new Error('backend error');
    const data = await res.json();
    return { articles: data.articles || [], rateLimited: false };
  } catch {
    return { articles: [], rateLimited: false, error: true };
  }
}

function useIsMobile() {
  const [m, setM] = useState(typeof window !== 'undefined' && window.innerWidth < 640);
  useEffect(() => {
    const fn = () => setM(window.innerWidth < 640);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return m;
}

function SkeletonCard() {
  return (
    <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
      <div style={{ height: 140, background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.03) 75%)', backgroundSize: '200% 100%', animation: 'swShimmer 1.5s ease infinite' }} />
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.06)', width: '40%' }} />
        <div style={{ height: 13, borderRadius: 4, background: 'rgba(255,255,255,0.06)', width: '92%' }} />
        <div style={{ height: 13, borderRadius: 4, background: 'rgba(255,255,255,0.04)', width: '70%' }} />
        <div style={{ height: 34, borderRadius: 8, background: 'rgba(255,255,255,0.04)', marginTop: 4 }} />
      </div>
    </div>
  );
}

const SOURCE_ICONS = { pubmed: '🧬', europepmc: '🔬', semantic: '📊' };
const FALLBACK_GRADIENTS = [
  ['#020f0c', '#00e5b0'], ['#020a12', '#4a9eff'], ['#0a0614', '#a78bfa'],
  ['#0f0a02', '#ffbe4d'], ['#0a0202', '#ff6b6b'], ['#02080f', '#38bdf8'],
];
function getFallback(title) {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) & 0xffffffff;
  return FALLBACK_GRADIENTS[Math.abs(h) % FALLBACK_GRADIENTS.length];
}

function ScienceCard({ article, index, sourceId, onSelect }) {
  const [hovered, setHovered] = useState(false);
  const [showOpts, setShowOpts] = useState(false);
  const [platform, setPlatform] = useState('youtube_shorts');
  const [style, setStyle] = useState('educational');
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);

  const src = SOURCES.find(s => s.id === sourceId) || SOURCES[0];
  const score = article.viral_score || 7;
  const scoreColor = score >= 9 ? '#00e5b0' : score >= 7 ? '#ffbe4d' : 'rgba(255,255,255,0.4)';
  const scoreLabel = score >= 9 ? 'ULTRA VIRAL' : score >= 7 ? 'POTENCIAL' : 'NORMAL';
  const [bgDark, bgAccent] = getFallback(article.title);
  const initials = article.title.split(' ').filter(w => w.length > 3).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const year = String(article.publishedAt || '').slice(0, 4);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.05 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 14, overflow: 'hidden',
        border: `1px solid ${hovered ? `rgba(${src.glow},0.28)` : 'rgba(255,255,255,0.06)'}`,
        background: hovered ? `rgba(${src.glow},0.04)` : 'rgba(255,255,255,0.02)',
        transform: visible ? (hovered ? 'translateY(-4px)' : 'translateY(0)') : 'translateY(18px)',
        opacity: visible ? 1 : 0,
        boxShadow: hovered ? `0 16px 48px rgba(0,0,0,0.65), 0 0 0 1px rgba(${src.glow},0.1)` : '0 2px 12px rgba(0,0,0,0.3)',
        transition: `transform 0.28s ease, box-shadow 0.28s ease, border-color 0.2s, background 0.2s, opacity 0.5s ease ${index * 0.04}s`,
        display: 'flex', flexDirection: 'column', cursor: 'pointer',
      }}
    >
      <div style={{ position: 'relative', height: 140, overflow: 'hidden', background: bgDark, flexShrink: 0 }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: `linear-gradient(135deg, ${bgDark} 0%, #000 100%)`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 32, opacity: 0.18 }}>{SOURCE_ICONS[sourceId] || '🔬'}</span>
          <span style={{ fontFamily: 'Playfair Display, serif', fontSize: 28, fontWeight: 900, color: bgAccent, opacity: 0.22, letterSpacing: 6 }}>{initials}</span>
        </div>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${src.color}, transparent)`, opacity: hovered ? 0.8 : 0.3, transition: 'opacity 0.3s' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(2,13,11,0.75) 0%, transparent 60%)', pointerEvents: 'none' }} />

        <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', alignItems: 'center', gap: 5, padding: '4px 9px', borderRadius: 8, background: 'rgba(2,13,11,0.82)', backdropFilter: 'blur(12px)', border: `1px solid ${scoreColor}33` }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: scoreColor, boxShadow: score >= 7 ? `0 0 6px ${scoreColor}` : 'none', animation: score >= 9 ? 'swPulse 2s ease infinite' : 'none' }} />
          <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: scoreColor, fontWeight: 700 }}>{score}/10</span>
        </div>

        <div style={{ position: 'absolute', bottom: 10, left: 10 }}>
          <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 7, letterSpacing: '0.12em', color: src.color, background: 'rgba(2,13,11,0.82)', backdropFilter: 'blur(12px)', padding: '3px 8px', borderRadius: 4 }}>{src.label.toUpperCase()}</span>
        </div>

        {article.citations > 0 && (
          <div style={{ position: 'absolute', top: 10, left: 10, padding: '3px 8px', borderRadius: 6, background: 'rgba(2,13,11,0.78)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 7, color: 'rgba(255,255,255,0.45)' }}>
              {article.citations >= 1000 ? `${(article.citations / 1000).toFixed(1)}k` : article.citations} citações
            </span>
          </div>
        )}
      </div>

      <div style={{ padding: '14px 16px 16px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: scoreColor, flexShrink: 0 }} />
          <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, letterSpacing: '0.14em', color: scoreColor, fontWeight: 700 }}>{scoreLabel}</span>
          {year && (<><div style={{ flex: 1 }} /><span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>{year}</span></>)}
        </div>

        <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 13, fontWeight: 700, color: hovered ? '#fff' : 'rgba(255,255,255,0.9)', margin: 0, lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', transition: 'color 0.2s' }}>{article.title}</h3>

        {article.description && (
          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, fontWeight: 300, color: 'rgba(255,255,255,0.38)', margin: 0, lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{article.description}</p>
        )}

        <div style={{ flex: 1 }} />

        {showOpts && (
          <div style={{ padding: '10px 12px', borderRadius: 10, background: `rgba(${src.glow},0.06)`, border: `1px solid rgba(${src.glow},0.18)`, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={platform} onChange={e => setPlatform(e.target.value)} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '5px 8px', color: 'rgba(255,255,255,0.8)', fontSize: 11, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
              {PLATFORMS.map(([v, l]) => <option key={v} value={v} style={{ background: '#020d0b' }}>{l}</option>)}
            </select>
            <select value={style} onChange={e => setStyle(e.target.value)} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: '5px 8px', color: 'rgba(255,255,255,0.8)', fontSize: 11, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
              {STYLES.map(([v, l]) => <option key={v} value={v} style={{ background: '#020d0b' }}>{l}</option>)}
            </select>
            <button onClick={() => onSelect(article, { platform, style })} style={{ marginLeft: 'auto', padding: '6px 14px', borderRadius: 6, background: `rgba(${src.glow},0.18)`, border: `1px solid rgba(${src.glow},0.45)`, color: src.color, fontFamily: 'Space Mono, monospace', fontSize: 9, letterSpacing: '0.16em', cursor: 'pointer' }}>GERAR →</button>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
          <button
            onClick={() => setShowOpts(!showOpts)}
            style={{ flex: 1, padding: '9px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontSize: 12, fontWeight: 600, color: showOpts ? src.color : '#020d0b', background: showOpts ? `rgba(${src.glow},0.15)` : `linear-gradient(135deg, ${src.color} 0%, rgba(${src.glow},0.7) 100%)`, boxShadow: showOpts ? 'none' : `0 2px 14px rgba(${src.glow},0.32)`, transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            <span style={{ fontSize: 13 }}>🔬</span>
            {showOpts ? 'Fechar opções' : 'Gerar Roteiro'}
          </button>
          {article.url && (
            <a href={article.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
              style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.03)', textDecoration: 'none', fontSize: 13, transition: 'color 0.15s, border-color 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.3)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
              title="Ver artigo original"
            >↗</a>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function ScienceWorld() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const generator = useScriptGenerator();

  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState(DEFAULT_CATEGORY.id);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSource, setActiveSource] = useState('pubmed');
  const [selected, setSelected] = useState(null);
  const [pendingArticle, setPendingArticle] = useState(null);
  const [topic, setTopic] = useState('');
  const [topicError, setTopicError] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [rateLimitedMsg, setRateLimitedMsg] = useState('');
  const debounceRef = useRef(null);
  const didAutoLoad = useRef(false);

  const src = SOURCES.find(s => s.id === activeSource) || SOURCES[0];

  const fetchArticles = useCallback(async (query, sourceId) => {
    if (!query || query.length < 3) return;
    setLoading(true);
    setHasSearched(true);
    setRateLimitedMsg('');
    try {
      const result = await searchScience(query, sourceId);
      if (result.rateLimited) {
        setRateLimitedMsg('Semantic Scholar está com limite de requisições. Mostrando resultados do PubMed.');
      }
      setArticles(result.articles);
    } catch {
      setArticles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Auto-load categoria padrão ao montar ────────────────────────────────────
  useEffect(() => {
    if (didAutoLoad.current) return;
    didAutoLoad.current = true;
    fetchArticles(DEFAULT_CATEGORY.query, 'pubmed');
  }, [fetchArticles]);

  const handleCategoryClick = (cat) => {
    setCategory(cat.id);
    setSearchQuery('');
    fetchArticles(cat.query, activeSource);
  };

  const handleSourceChange = (srcId) => {
    setActiveSource(srcId);
    const q = searchQuery.trim() || (category ? CATEGORIES.find(c => c.id === category)?.query : '');
    if (q) fetchArticles(q, srcId);
  };

  const handleSelect = (article) => {
    setPendingArticle(article);
    setTopic('');
    setTopicError(false);
  };

  const handleConfirmTopic = () => {
    if (!topic.trim()) { setTopicError(true); return; }
    const article = { ...pendingArticle, content_preview: (pendingArticle.content_preview || '') + `\n\nFOCO DO ROTEIRO: ${topic.trim()}. Conecte os conceitos do artigo a este tema.` };
    setSelected(article);
    setPendingArticle(null);
    generator.reset();
    generator.generate(article, { platform: 'youtube_shorts', style: 'educational', version: 1 });
  };

  return (
    <div style={{ minHeight: '100vh', background: '#020d0b', color: '#fff', fontFamily: 'DM Sans, sans-serif' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        *, *::before, *::after { box-sizing: border-box; }
        @keyframes swShimmer { 0%{background-position:200% 0;} 100%{background-position:-200% 0;} }
        @keyframes swPulse { 0%,100%{opacity:1;} 50%{opacity:0.3;} }
        input::placeholder { color: rgba(255,255,255,0.22); }
        input:focus { outline: none; border-color: rgba(0,229,176,0.45) !important; box-shadow: 0 0 0 3px rgba(0,229,176,0.06); }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(0,229,176,0.2); border-radius: 2px; }
        .sw-cat { transition: all 0.18s; white-space: nowrap; flex-shrink: 0; }
        .sw-cat:hover { border-color: rgba(0,229,176,0.3) !important; color: rgba(255,255,255,0.7) !important; }
        .sw-src-btn { transition: all 0.18s; }
        .sw-src-btn:hover { opacity: 0.8; }
      ` }} />
{/* EM BREVE */}
<div style={{ position:"fixed", inset:0, zIndex:9999, background:"rgba(2,13,11,0.93)", backdropFilter:"blur(12px)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16 }}>
<div style={{ fontSize:48 }}>🔬</div>
<p style={{ fontFamily:"Syne,sans-serif", fontSize:24, fontWeight:700, color:"#fff", margin:0 }}>Em Breve</p>
<p style={{ fontFamily:"DM Sans,sans-serif", fontSize:14, color:"rgba(255,255,255,0.45)", margin:0, fontWeight:300 }}>O Mundo Ciencia esta sendo preparado</p>
<button onClick={()=>window.history.back()} style={{ marginTop:8, padding:"9px 24px", borderRadius:10, background:"rgba(0,229,176,0.1)", border:"1px solid rgba(0,229,176,0.3)", color:"#00e5b0", fontFamily:"Space Mono,monospace", fontSize:11, letterSpacing:"0.12em", cursor:"pointer" }}>VOLTAR</button>
</div>
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse at 15% 0%, rgba(0,80,60,0.3) 0%, transparent 50%), radial-gradient(ellipse at 85% 100%, rgba(0,100,80,0.18) 0%, transparent 50%)' }} />
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, transparent, #00e5b0, transparent)', zIndex: 200, opacity: 0.65 }} />

      <header style={{ position: 'sticky', top: 42, zIndex: 100, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '0 16px' : '0 24px', background: 'rgba(2,13,11,0.97)', backdropFilter: 'blur(32px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={() => navigate('/')} style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, letterSpacing: '0.22em', color: 'rgba(255,255,255,0.38)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>← PORTAL</button>
          <span style={{ color: 'rgba(255,255,255,0.1)' }}>|</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: src.color, boxShadow: `0 0 10px rgba(${src.glow},0.9)`, animation: 'swPulse 2.5s ease-in-out infinite', transition: 'background 0.3s' }} />
            <span style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, fontWeight: 700, color: '#fff', letterSpacing: '-0.5px' }}>Ciência</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 3, border: '1px solid rgba(255,255,255,0.07)' }}>
          {SOURCES.map(s => (
            <button key={s.id} className="sw-src-btn" onClick={() => handleSourceChange(s.id)}
              style={{ padding: isMobile ? '5px 8px' : '5px 12px', borderRadius: 7, border: 'none', cursor: 'pointer', fontFamily: 'Space Mono, monospace', fontSize: 8, letterSpacing: '0.12em', background: activeSource === s.id ? `rgba(${s.glow},0.2)` : 'transparent', color: activeSource === s.id ? s.color : 'rgba(255,255,255,0.35)', transition: 'all 0.18s' }}
            >{isMobile ? s.label.split(' ')[0] : s.label}</button>
          ))}
        </div>
      </header>

      <div style={{ padding: isMobile ? '28px 16px 20px' : '40px 24px 28px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: `linear-gradient(180deg, rgba(${src.glow},0.05) 0%, transparent 100%)`, transition: 'background 0.4s', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 175, background: 'linear-gradient(180deg, rgba(2,13,11,0.97) 0%, rgba(2,13,11,0.88) 42%, rgba(2,13,11,0.45) 75%, transparent 100%)', pointerEvents: 'none', zIndex: 0 }} />
        <p style={{ position: 'relative', zIndex: 1, fontFamily: 'Space Mono, monospace', fontSize: 8, letterSpacing: '0.5em', color: `rgba(${src.glow},0.6)`, marginBottom: 10, marginTop: 8 }}>ROTEIROS VIRAIS</p>
        <h1 style={{ position: 'relative', zIndex: 1, fontFamily: 'Playfair Display, serif', fontSize: isMobile ? 'clamp(28px,9vw,44px)' : 'clamp(36px,5vw,60px)', fontWeight: 900, margin: '0 0 6px', lineHeight: 0.92, letterSpacing: '-2px' }}>
          <span style={{ fontStyle: 'italic', color: '#fff' }}>Artigos</span>{' '}
          <span style={{ color: 'transparent', WebkitTextStroke: `1.5px rgba(${src.glow},0.8)` }}>Científicos</span>
        </h1>
        <p style={{ position: 'relative', zIndex: 1, fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'rgba(255,255,255,0.45)', margin: '8px 0 0', fontWeight: 300 }}>Pesquise e gere roteiros precisos em {src.label}</p>
      </div>

      <div style={{ padding: '12px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(2,13,11,0.65)', backdropFilter: 'blur(20px)', position: 'sticky', top: 98, zIndex: 40 }}>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {CATEGORIES.map(cat => (
            <button key={cat.id} className="sw-cat" onClick={() => handleCategoryClick(cat)}
              style={{ padding: '6px 16px', borderRadius: 20, border: category === cat.id ? `1px solid rgba(${src.glow},0.6)` : '1px solid rgba(255,255,255,0.08)', background: category === cat.id ? `rgba(${src.glow},0.15)` : 'rgba(255,255,255,0.04)', color: category === cat.id ? src.color : 'rgba(255,255,255,0.45)', fontFamily: 'DM Sans, sans-serif', fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all 0.18s' }}
            >{cat.icon} {cat.label}</button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: isMobile ? '20px 16px 80px' : '28px 24px 100px', position: 'relative', zIndex: 5 }}>
        {/* Texto explicativo */}
        <div style={{ marginBottom: 16, padding: '14px 18px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <p style={{ margin: 0, fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>
            🔬 <strong style={{ color: 'rgba(255,255,255,0.8)' }}>Digite qualquer assunto</strong> — a IA varre PubMed, Europe PMC e Semantic Scholar e traz os estudos mais relevantes. Escolha um artigo e transforme em roteiro viral.
          </p>
        </div>

        <div style={{ position: 'relative', marginBottom: 24 }}>
          <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 15, color: `rgba(${src.glow},0.45)`, pointerEvents: 'none' }}>⌕</span>
          <input
            type="text"
            placeholder="Ex: hipertrofia, sono profundo, ansiedade..."
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              setCategory('');
              if (debounceRef.current) clearTimeout(debounceRef.current);
              debounceRef.current = setTimeout(() => {
                const q = e.target.value.trim();
                if (q.length >= 3) fetchArticles(q, activeSource);
              }, 600);
            }}
            style={{ width: '100%', background: `rgba(${src.glow},0.04)`, border: `1px solid rgba(${src.glow},0.18)`, borderRadius: 12, padding: '13px 20px 13px 48px', fontSize: 14, color: 'white', fontFamily: 'DM Sans, sans-serif', fontWeight: 300, transition: 'border-color 0.2s, box-shadow 0.2s' }}
          />
        </div>

        {/* Aviso de rate limit */}
        {rateLimitedMsg && (
          <div style={{ marginBottom: 16, padding: '10px 16px', borderRadius: 8, background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14 }}>⚠️</span>
            <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: 'rgba(167,139,250,0.85)' }}>{rateLimitedMsg}</span>
          </div>
        )}

        {!loading && articles.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, letterSpacing: '0.2em', color: `rgba(${src.glow},0.55)` }}>
              {articles.length} ARTIGOS — {rateLimitedMsg ? 'PUBMED (FALLBACK)' : src.label.toUpperCase()}
            </span>
            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, letterSpacing: '0.2em', color: 'rgba(255,190,77,0.5)' }}>
              {articles.filter(a => a.viral_score >= 8).length} ALTA RELEVÂNCIA
            </span>
          </div>
        )}

        {loading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {!loading && articles.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {articles.map((article, i) => (
              <ScienceCard key={article.id || i} article={article} index={i} sourceId={rateLimitedMsg ? 'pubmed' : activeSource} onSelect={handleSelect} />
            ))}
          </div>
        )}

        {!loading && articles.length === 0 && hasSearched && (
          <div style={{ textAlign: 'center', padding: '80px 0', border: '1px dashed rgba(0,229,176,0.1)', borderRadius: 16 }}>
            <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, letterSpacing: '0.3em', color: 'rgba(255,255,255,0.2)', marginBottom: 8 }}>SEM RESULTADOS</p>
            <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'rgba(255,255,255,0.22)', fontWeight: 300 }}>Tente outro termo ou troque de fonte</p>
          </div>
        )}
      </div>

      {pendingArticle && (
        <div onClick={e => e.target === e.currentTarget && setPendingArticle(null)} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(2,13,11,0.93)', backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#020d0b', border: `1px solid rgba(${src.glow},0.2)`, borderRadius: 16, padding: 32, maxWidth: 480, width: '100%' }}>
            <div style={{ height: 3, background: `linear-gradient(90deg, transparent, ${src.color}, transparent)`, borderRadius: 2, marginBottom: 24 }} />
            <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, letterSpacing: '0.3em', color: `rgba(${src.glow},0.5)`, margin: '0 0 8px' }}>ROTEIRO SOBRE</p>
            <h3 style={{ fontFamily: 'Playfair Display, serif', fontSize: 16, color: '#fff', margin: '0 0 20px', lineHeight: 1.4 }}>{pendingArticle.title}</h3>
            <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, letterSpacing: '0.25em', color: `rgba(${src.glow},0.5)`, margin: '0 0 10px' }}>SOBRE O QUE VOCÊ QUER FALAR?</p>
            <input
              value={topic}
              onChange={e => { setTopic(e.target.value); setTopicError(false); }}
              onKeyDown={e => e.key === 'Enter' && handleConfirmTopic()}
              placeholder="ex: como aplicar no dia a dia, benefícios práticos..."
              autoFocus
              style={{ width: '100%', fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: '#fff', background: 'rgba(255,255,255,0.04)', border: topicError ? `1px solid rgba(255,80,80,0.5)` : `1px solid rgba(${src.glow},0.2)`, borderRadius: 8, padding: '10px 14px', outline: 'none', boxSizing: 'border-box', marginBottom: 6 }}
            />
            {topicError && <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, color: 'rgba(255,80,80,0.7)', margin: '0 0 12px' }}>Digite o assunto para continuar</p>}
            <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, color: 'rgba(255,255,255,0.3)', margin: '0 0 16px', fontWeight: 300 }}>Opcional — deixe em branco para gerar sobre o artigo completo</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setPendingArticle(null)} style={{ flex: 1, padding: '10px', borderRadius: 8, background: 'none', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)', fontFamily: 'DM Sans, sans-serif', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleConfirmTopic} style={{ flex: 2, padding: '10px', borderRadius: 8, background: `linear-gradient(135deg, ${src.color} 0%, rgba(${src.glow},0.7) 100%)`, border: 'none', color: '#020d0b', fontFamily: 'Space Mono, monospace', fontSize: 9, letterSpacing: '0.18em', fontWeight: 700, cursor: 'pointer' }}>GERAR ROTEIRO →</button>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <ScriptModal
          article={selected}
          generator={generator}
          onClose={() => setSelected(null)}
          onGenerate={opts => generator.generate(selected, opts)}
          accentColor={src.color}
          glowColor={src.glow}
        />
      )}
    </div>
  );
}
