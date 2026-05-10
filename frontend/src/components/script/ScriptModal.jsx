/**
 * components/script/ScriptModal.jsx
 * Modal de geração de roteiro com hooks, títulos, hashtags, legendas e thumbnail.
 */

import { useEffect, useRef, useState } from 'react';
import { useLang } from '../../contexts/LanguageContext';

const PLATFORMS = [
  { id: 'tiktok',         label: 'TikTok / Instagram', icon: '🎵', duration: '15–60s' },
  { id: 'youtube_shorts', label: 'YT Shorts',          icon: '▶️', duration: '60s' },
  { id: 'youtube_long',   label: 'YouTube Longo',      icon: '🎬', duration: '5–15min' },
];

// Classificação de risco para detectar pauta sensível no frontend
function detectRiskLevel(article) {
  if (!article) return 'green';
  const text = ((article.title || '') + ' ' + (article.description || '')).toLowerCase();
  if (/lei|projeto de lei|congresso|senado|câmara|votação|partido|presidente|governo|politica|eleicao|reforma|ideologia|esquerda|direita|religiao|aborto|greve|sindicato|escala|jornada|guerra|conflito|terrorismo/.test(text)) return 'red';
  if (/dinheiro|investimento|bitcoin|inflacao|imposto|economia|saude|vacina|doenca|psicologia|comportamento|tecnologia|privacidade/.test(text)) return 'yellow';
  return 'green';
}

const BIAS_OPTIONS = [
  { id: 'facts',       label: 'Só contar o que aconteceu', icon: '📰', desc: 'sem opinião' },
  { id: 'opportunity', label: 'Mostrar como é bom pro Brasil', icon: '🌟', desc: 'destacar as vantagens' },
  { id: 'risk',        label: 'Mostrar os riscos', icon: '⚠️', desc: 'sem dar crédito a ninguém' },
  { id: 'debate',      label: 'Mostrar os dois lados', icon: '⚖️', desc: 'deixar o espectador decidir' },
];

const STYLES = [
  { id: 'educational',   label: 'Educacional',    icon: '🎓', desc: 'Facts & info' },
  { id: 'storytelling',  label: 'Storytelling',   icon: '📖', desc: 'Narrativa' },
  { id: 'dark_channel',  label: 'Entreten.',      icon: '🎭', desc: 'Engajamento' },
  { id: 'controversial', label: 'Debate',         icon: '⚖️', desc: 'Dois lados' },
];


// ─── ViralTicker ─────────────────────────────────────────────────────────────
const VIRAL_DATA = [
  { stat: "0.3%", text: "dos vídeos passam de 1M de views no YouTube.", motivation: "Volume é o único caminho garantido." },
  { stat: "73º vídeo", text: "é a mediana do primeiro viral de criadores de sucesso.", motivation: "Cada roteiro publicado conta." },
  { stat: "96.5%", text: "dos criadores desistem antes de 100 vídeos.", motivation: "Chegar a 100 já é top 3.5% do planeta." },
  { stat: "3 anos", text: "foi o tempo que MrBeast levou para decolar.", motivation: "Consistência bate talento. Sempre." },
  { stat: "1 em 300", text: "Shorts viralizam acima de 500K organicamente.", motivation: "Quem posta 300 tem 1 viral garantido." },
  { stat: "62%", text: "dos criadores virais quase desistiram antes do primeiro hit.", motivation: "A virada está mais perto do que parece." },
  { stat: "7x", text: "mais chances de viralizar postando 4x/semana vs 1x.", motivation: "Frequência é o algoritmo mais poderoso." },
  { stat: "8 segundos", text: "é tudo que você tem antes do skip.", motivation: "É por isso que o hook é tudo." },
  { stat: "90 dias", text: "de consistência mudam o desempenho de um canal.", motivation: "3 meses separa quem tentou de quem construiu." },
  { stat: "67%", text: "dos vídeos virais foram publicados em dias comuns.", motivation: "Não espere o momento perfeito. Publique." },
  { stat: "2 anos", text: "o PewDiePie ficou estagnado antes de explodir.", motivation: "Platôs são parte do processo." },
  { stat: "Khaby Lame", text: "foi demitido antes de criar seu primeiro viral.", motivation: "O melhor momento é agora." },
];

const TICKER_ITEMS = [
  "0.3% dos vídeos passam de 1M",
  "73º vídeo — mediana do primeiro viral",
  "96.5% desistem antes de 100 vídeos",
  "7x mais viral postando 4x/semana",
  "8 segundos antes do skip",
  "Khaby Lame foi demitido antes do primeiro viral",
  "MrBeast: 3 anos até decolar",
  "90 dias mudam um canal",
  "1 em 300 Shorts passa de 500K",
];

function ViralTicker({ glowColor, accentColor }) {
  const [dataIdx, setDataIdx] = useState(() => Math.floor(Math.random() * VIRAL_DATA.length));

  useEffect(() => {
    const interval = setInterval(() => {
      setDataIdx(i => (i + 1) % VIRAL_DATA.length);
    }, 7000);
    return () => clearInterval(interval);
  }, []);

  const msg = VIRAL_DATA[dataIdx];
  const tickerText = TICKER_ITEMS.join('   ·   ') + '   ·   ' + TICKER_ITEMS.join('   ·   ');

  return (
    <div style={{ width: '100%', borderTop: `1px solid rgba(${glowColor},0.1)` }}>
      {/* Mensagem principal */}
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: '-apple-system, SF Pro Display, SF Pro Text, sans-serif', fontSize: 22, fontWeight: 800, color: accentColor, lineHeight: 1 }}>{msg.stat}</span>
          <span style={{ fontFamily: '-apple-system, SF Pro Text, sans-serif', fontSize: 12, color: 'rgba(255,255,255,0.35)', fontWeight: 400 }}>{msg.text}</span>
        </div>
        <p style={{ fontFamily: '-apple-system, SF Pro Text, sans-serif', fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: 500, margin: 0, lineHeight: 1.5 }}>{msg.motivation}</p>
      </div>
      {/* Ticker rodapé */}
      <div style={{ width: '100%', background: `rgba(${glowColor},0.05)`, borderTop: `1px solid rgba(${glowColor},0.1)`, overflow: 'hidden', height: 30, display: 'flex', alignItems: 'center' }}>
        <div style={{ background: `rgba(${glowColor},0.15)`, padding: '0 12px', height: '100%', display: 'flex', alignItems: 'center', flexShrink: 0, borderRight: `1px solid rgba(${glowColor},0.12)` }}>
          <span style={{ fontFamily: '-apple-system, SF Pro Text, sans-serif', fontSize: 9, letterSpacing: '0.12em', color: accentColor, fontWeight: 700 }}>DADOS</span>
        </div>
        <div style={{ overflow: 'hidden', flex: 1 }}>
          <div style={{ whiteSpace: 'nowrap', animation: 'tickerScroll 45s linear infinite', display: 'inline-block', paddingLeft: '100%' }}>
            <span style={{ fontFamily: '-apple-system, SF Pro Text, sans-serif', fontSize: 12, color: 'rgba(255,255,255,0.35)', fontWeight: 300, letterSpacing: '0.01em' }}>
              {tickerText}
            </span>
          </div>
        </div>
      </div>
      <style>{"@keyframes tickerScroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }"}</style>
    </div>
  );
}

// ─── LoadingInsight ──────────────────────────────────────────────────────────
const LOADING_INSIGHTS = [
  { num: "1 roteiro", msg: "publicado hoje já te coloca à frente de quem ficou pensando." },
  { num: "Hook forte", msg: "retém 3x mais audiência nos primeiros 8 segundos. A IA está trabalhando nisso." },
  { num: "Título + thumbnail", msg: "respondem por 80% do CTR. Você vai receber sugestões de ambos." },
  { num: "Criadores consistentes", msg: "crescem em média 40% mais rápido do que os que postam esporadicamente." },
  { num: "Cada formato", msg: "tem um algoritmo diferente. Você escolheu o certo para o seu objetivo." },
  { num: "Roteiros estruturados", msg: "reduzem o tempo de edição em até 60%. Você está economizando agora." },
  { num: "O primeiro minuto", msg: "define se o algoritmo vai distribuir seu vídeo. Estamos construindo ele." },
  { num: "CTA no lugar certo", msg: "pode triplicar a taxa de inscrição. A IA sabe onde colocar." },
  { num: "Vídeos com gancho claro", msg: "têm taxa de retenção 2x maior. É o que estamos gerando." },
  { num: "Seu próximo vídeo", msg: "pode ser o que o algoritmo precisava para te empurrar." },
];

function LoadingInsight({ glowColor, accentColor }) {
  const [idx, setIdx] = useState(() => Math.floor(Math.random() * LOADING_INSIGHTS.length));
  const [fade, setFade] = useState(true);

  useEffect(() => {
    const id = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setIdx(i => (i + 1) % LOADING_INSIGHTS.length);
        setFade(true);
      }, 400);
    }, 5000);
    return () => clearInterval(id);
  }, []);

  const item = LOADING_INSIGHTS[idx];
  return (
    <div style={{
      maxWidth: 340, textAlign: 'center', padding: '14px 20px',
      borderRadius: 12,
      background: `rgba(${glowColor},0.05)`,
      border: `1px solid rgba(${glowColor},0.12)`,
      transition: 'opacity 0.4s ease',
      opacity: fade ? 1 : 0,
    }}>
      <span style={{ fontFamily: '-apple-system, SF Pro Text, sans-serif', fontSize: 13, fontWeight: 700, color: accentColor }}>{item.num} </span>
      <span style={{ fontFamily: '-apple-system, SF Pro Text, sans-serif', fontSize: 13, fontWeight: 400, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>{item.msg}</span>
    </div>
  );
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const diff = (Date.now() - d.getTime()) / 60000;
    if (diff < 60) return `${Math.floor(diff)}m atrás`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h atrás`;
    if (diff < 43200) return `${Math.floor(diff / 1440)}d atrás`;
    return d.getFullYear().toString();
  } catch { return dateStr; }
}

function safeScript(raw) {
  if (!raw) return '';
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'object') {
    if (typeof raw.script === 'string') return raw.script;
    if (typeof raw.body === 'string') return raw.body;
    if (typeof raw.text === 'string') return raw.text;
    if (typeof raw.content === 'string') return raw.content;
    const choice = raw.choices?.[0];
    if (choice?.message?.content) return choice.message.content;
    return JSON.stringify(raw, null, 2);
  }
  return String(raw);
}

function safeArray(raw, key) {
  if (!raw || typeof raw !== 'object') return [];
  const arr = raw[key];
  return Array.isArray(arr) ? arr : [];
}

function CopyButton({ text, label = 'Copiar', accent, glow }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button
      onClick={copy}
      style={{
        padding: '4px 12px', borderRadius: 6, background: copied ? `rgba(${glow},0.18)` : 'transparent',
        border: `1px solid rgba(${glow},${copied ? 0.5 : 0.2})`,
        color: copied ? accent : `rgba(${glow},0.7)`,
        fontFamily: 'DM Sans, sans-serif', fontSize: 11, cursor: 'pointer', transition: 'all 0.2s',
        flexShrink: 0,
      }}
    >{copied ? '✓ Copiado' : label}</button>
  );
}

function Section({ title, icon, children, accent, glow, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderRadius: 12, border: `1px solid rgba(${glow},0.1)`, overflow: 'hidden', marginBottom: 16 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 14px', background: `rgba(${glow},0.05)`,
          border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, letterSpacing: '0.25em', color: `rgba(${glow},0.8)`, fontWeight: 700 }}>{title}</span>
        <span style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && <div style={{ padding: '14px' }}>{children}</div>}
    </div>
  );
}

const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

export function ScriptModal({
  article,
  onClose,
  onSave,
  generator,
  accentColor = '#a78bfa',
  glowColor   = '167,139,250',
  subtitle = null,
}) {
  const { lang } = useLang();
  const overlayRef = useRef(null);
  const outputRef  = useRef(null);
  const [activeHook, setActiveHook] = useState(null);
  const [bias, setBias] = useState('neutral');
  const [saved, setSaved] = useState(false);
  const [genVersion, setGenVersion] = useState(1);
  const riskLevel = detectRiskLevel(article);

  const {
    platform, setPlatform,
    style, setStyle,
    script: rawScript, loading, error,
    generate, reset,
  } = generator;

  const script          = safeScript(rawScript);
  useEffect(() => { if (rawScript) { try { localStorage.setItem('vn_generated', '1'); } catch {} } }, [rawScript]);
  const hooks           = safeArray(rawScript, 'hooks');
  const titles          = safeArray(rawScript, 'titles');
  const hashtags        = safeArray(rawScript, 'hashtags');
  const captions        = safeArray(rawScript, 'captions');
  const thumbnailPrompt  = rawScript?.thumbnail_prompt || '';
  const screenCaptions   = safeArray(rawScript, 'screen_captions');
  const imagePrompts     = safeArray(rawScript, 'image_prompts');

  const scriptText = script && typeof script === 'object' ? (script.script || '') : (script || '');
  const wordCount = scriptText ? scriptText.split(/\s+/).filter(Boolean).length : 0;
  const readTime  = Math.ceil(wordCount / 150);

  const hasExtras = titles.length > 0 || hashtags.length > 0 || captions.length > 0 || thumbnailPrompt || screenCaptions.length > 0 || imagePrompts.length > 0;

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = 0;
  }, [script]);

  if (!article) return null;

  const score = article.viral_score || 0;
  const scoreColor = score >= 8 ? '#00e5b0' : score >= 6 ? '#ffbe4d' : 'rgba(255,255,255,0.35)';

  const handleGenerate = () => {
    reset();
    setActiveHook(null);
    const nextVersion = genVersion + 1;
    setGenVersion(nextVersion);
    setTimeout(() => generate(article, { platform, style, version: nextVersion, bias }), 0);
  };

  const fullCopy = [
    activeHook ? `HOOK:\n${activeHook.text}\n\n` : '',
    `ROTEIRO:\n${script}`,
    titles.length ? `\n\nTÍTULOS:\n${titles.map((t,i) => `${i+1}. ${t}`).join('\n')}` : '',
    hashtags.length ? `\n\nHASHTAGS:\n${hashtags.join(' ')}` : '',
    captions.length ? `\n\nLEGENDAS:\n${captions.map((c,i) => `${i+1}. ${c}`).join('\n')}` : '',
    thumbnailPrompt ? `\n\nPROMPT THUMBNAIL:\n${thumbnailPrompt}` : '',
    rawScript?.content_risk === 'red' ? '\n\n— Roteiro gerado como ferramenta criativa. Conteúdo de responsabilidade exclusiva do criador.' : '',
  ].join('');

  return (
    <div
      ref={overlayRef}
      onClick={e => e.target === overlayRef.current && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(20px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px', animation: 'smFadeIn 0.18s ease',
        fontFamily: 'DM Sans, sans-serif',
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&family=Space+Mono:wght@400;700&family=Syne:wght@700;800&display=swap');
        @keyframes smFadeIn { from{opacity:0;} to{opacity:1;} }
        @keyframes smSlideUp { from{opacity:0;transform:translateY(30px) scale(0.98);} to{opacity:1;transform:none;} }
        @keyframes smPulse { 0%,100%{opacity:1;} 50%{opacity:0.3;} }
        @keyframes smCursor { 0%,100%{opacity:1;} 50%{opacity:0;} }
        .sm-scroll::-webkit-scrollbar { width: 3px; }
        .sm-scroll::-webkit-scrollbar-thumb { background: rgba(${glowColor},0.2); border-radius: 2px; }
        .sm-btn-platform { transition: all 0.16s; }
        .sm-btn-platform:hover { border-color: rgba(${glowColor},0.5) !important; }
        .sm-btn-style { transition: all 0.16s; }
        .sm-btn-style:hover { border-color: rgba(${glowColor},0.5) !important; }
        .hook-btn { transition: all 0.18s; }
        .hook-btn:hover { border-color: rgba(${glowColor},0.4) !important; background: rgba(${glowColor},0.06) !important; }
      ` }} />

      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 980, maxHeight: '92vh',
          background: '#0a0a14', border: `1px solid rgba(${glowColor},0.15)`,
          borderRadius: 18, overflow: isMobile ? 'visible' : 'hidden',
          display: 'flex', flexDirection: 'column',
          animation: 'smSlideUp 0.28s cubic-bezier(0.34,1.1,0.64,1)',
          boxShadow: `0 40px 100px rgba(0,0,0,0.85)`,
        }}
      >
        {/* Barra de cor topo */}
        <div style={{ height: 3, background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`, flexShrink: 0 }} />

        {/* Header */}
        <div style={{ padding: '14px 20px', flexShrink: 0, borderBottom: `1px solid rgba(${glowColor},0.08)`, display: 'flex', alignItems: 'center', gap: 12 }}>
          {article.image && (
            <img src={article.image} alt="" style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover', flexShrink: 0, border: '1px solid rgba(255,255,255,0.08)' }} onError={e => e.target.style.display='none'} />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 12, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.5)' }}>
                {typeof article.source === 'string' ? article.source : article.source?.name || ''}
              </span>
              <span style={{ color: 'rgba(255,255,255,0.1)' }}>·</span>
              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{formatTime(article.publishedAt)}</span>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: scoreColor }} />
                <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 12, color: scoreColor, fontWeight: 700 }}>{score}/10</span>
              </div>
            </div>
            <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: 14, fontWeight: 700, color: '#fff', margin: 0, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{article.title}</h2>
            {subtitle && <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, color: `rgba(${glowColor},0.7)`, margin: '3px 0 0', fontWeight: 300 }}>{subtitle}</p>}
          </div>
          <button onClick={onClose}
            style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,0.08)'; e.currentTarget.style.color='#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,0.04)'; e.currentTarget.style.color='rgba(255,255,255,0.4)'; }}
          >✕</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0, flexDirection: isMobile ? 'column' : 'row' }}>

          {/* Painel esquerdo — controles */}
          {isMobile ? (
            <div style={{ display: 'flex', flexDirection: 'row', gap: 6, padding: '8px 12px', overflowX: 'auto', flexShrink: 0, borderBottom: `1px solid rgba(${glowColor},0.07)`, alignItems: 'center', WebkitOverflowScrolling: 'touch' }}>
              {PLATFORMS.map(p => (
                <button key={p.id} onClick={() => { setPlatform(p.id); reset(); }} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 20, cursor: 'pointer', border: platform === p.id ? `1px solid rgba(${glowColor},0.65)` : '1px solid rgba(255,255,255,0.1)', background: platform === p.id ? `rgba(${glowColor},0.15)` : 'rgba(255,255,255,0.04)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  <span style={{ fontSize: 12 }}>{p.icon}</span>
                  <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, fontWeight: 500, color: platform === p.id ? accentColor : 'rgba(255,255,255,0.75)' }}>{p.label}</span>
                </button>
              ))}
              <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.12)', flexShrink: 0, margin: '0 2px' }} />
              {STYLES.map(s => (
                <button key={s.id} onClick={() => { setStyle(s.id); reset(); }} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 20, cursor: 'pointer', border: style === s.id ? `1px solid rgba(${glowColor},0.65)` : '1px solid rgba(255,255,255,0.1)', background: style === s.id ? `rgba(${glowColor},0.15)` : 'rgba(255,255,255,0.04)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  <span style={{ fontSize: 12 }}>{s.icon}</span>
                  <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, fontWeight: 500, color: style === s.id ? accentColor : 'rgba(255,255,255,0.75)' }}>{s.label}</span>
                </button>
              ))}
            </div>
          ) : (
          <div style={{ width: isMobile ? '100%' : 234, flexShrink: 0, borderRight: isMobile ? 'none' : `1px solid rgba(${glowColor},0.07)`, borderBottom: isMobile ? `1px solid rgba(${glowColor},0.07)` : 'none', padding: isMobile ? '10px 12px' : '16px 14px', overflowY: isMobile ? 'hidden' : 'auto', overflowX: isMobile ? 'auto' : 'hidden', display: 'flex', flexDirection: isMobile ? 'row' : 'column', gap: isMobile ? 12 : 16, alignItems: isMobile ? 'flex-start' : 'stretch' }} className="sm-scroll">

            <div>
              <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.55)', marginBottom: 10 }}>PLATFORM</p>
              <div style={{ display: 'flex', flexDirection: isMobile ? 'row' : 'column', gap: 5, flexShrink: 0 }}>
                {PLATFORMS.map(p => (
                  <button key={p.id} className="sm-btn-platform" onClick={() => { setPlatform(p.id); reset(); }}
                    style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 5 : 9, padding: isMobile ? '6px 10px' : '8px 11px', borderRadius: 10, cursor: 'pointer', border: platform === p.id ? `1px solid rgba(${glowColor},0.65)` : '1px solid rgba(255,255,255,0.06)', background: platform === p.id ? `rgba(${glowColor},0.12)` : 'rgba(255,255,255,0.025)', textAlign: 'left', whiteSpace: 'nowrap', flexShrink: 0 }}
                  >
                    <span style={{ fontSize: 13, flexShrink: 0 }}>{p.icon}</span>
                    {!isMobile && <div style={{ flex: 1 }}>
                      <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 14, fontWeight: 500, color: platform === p.id ? accentColor : 'rgba(255,255,255,0.85)', margin: 0 }}>{p.label}</p>
                      <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: 'rgba(255,255,255,0.45)', margin: 0 }}>{p.duration}</p>
                    </div>}
                    {isMobile && <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, fontWeight: 500, color: platform === p.id ? accentColor : 'rgba(255,255,255,0.75)' }}>{p.label}</span>}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.55)', marginBottom: 10 }}>ESTILO</p>
              <div style={{ display: isMobile ? 'flex' : 'grid', gridTemplateColumns: '1fr 1fr', flexDirection: 'row', gap: 5, flexShrink: 0 }}>
                {STYLES.map(s => (
                  <button key={s.id} className="sm-btn-style" onClick={() => { setStyle(s.id); reset(); }}
                    style={{ padding: isMobile ? '6px 10px' : '8px 9px', borderRadius: 10, cursor: 'pointer', border: style === s.id ? `1px solid rgba(${glowColor},0.65)` : '1px solid rgba(255,255,255,0.06)', background: style === s.id ? `rgba(${glowColor},0.12)` : 'rgba(255,255,255,0.025)', textAlign: 'left', whiteSpace: isMobile ? 'nowrap' : 'normal', flexShrink: 0 }}
                  >
                    <p style={{ fontSize: 15, margin: '0 0 3px' }}>{s.icon}</p>
                    <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, fontWeight: 500, color: style === s.id ? accentColor : 'rgba(255,255,255,0.85)', margin: 0 }}>{s.label}</p>
                    <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, fontWeight: 300, color: 'rgba(255,255,255,0.45)', margin: '2px 0 0' }}>{s.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* ── ÂNGULO EDITORIAL — só aparece para pautas sensíveis ── */}
            {(riskLevel === 'red' || riskLevel === 'yellow') && (
              <div>
                <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, letterSpacing: '0.2em', color: riskLevel === 'red' ? 'rgba(255,120,80,0.8)' : 'rgba(255,200,80,0.7)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {riskLevel === 'red' ? '🔴' : '🟡'} ÂNGULO
                </p>
                <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, color: 'rgba(255,255,255,0.35)', margin: '0 0 8px', fontWeight: 300, lineHeight: 1.4 }}>
                  {riskLevel === 'red' ? 'Pauta sensível — como você quer abordar?' : 'Como você quer posicionar esse conteúdo?'}
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                  {BIAS_OPTIONS.map(b => (
                    <button key={b.id} onClick={() => setBias(b.id)}
                      style={{ padding: '7px 8px', borderRadius: 9, cursor: 'pointer', border: bias === b.id ? `1px solid rgba(${glowColor},0.65)` : '1px solid rgba(255,255,255,0.06)', background: bias === b.id ? `rgba(${glowColor},0.12)` : 'rgba(255,255,255,0.02)', textAlign: 'left', transition: 'all 0.15s' }}
                    >
                      <p style={{ fontSize: 13, margin: '0 0 2px' }}>{b.icon}</p>
                      <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, fontWeight: 500, color: bias === b.id ? accentColor : 'rgba(255,255,255,0.8)', margin: 0 }}>{b.label}</p>
                      <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 10, fontWeight: 300, color: 'rgba(255,255,255,0.35)', margin: '1px 0 0' }}>{b.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button onClick={handleGenerate} disabled={loading}
              style={{ width: '100%', padding: '11px', borderRadius: 10, background: loading ? 'rgba(255,255,255,0.05)' : `linear-gradient(135deg, ${accentColor} 0%, rgba(${glowColor},0.75) 100%)`, border: 'none', color: loading ? 'rgba(255,255,255,0.3)' : '#07070f', fontFamily: 'Syne, sans-serif', fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', boxShadow: loading ? 'none' : `0 4px 20px rgba(${glowColor},0.35)`, transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
            >
              {loading
                ? <><span style={{ animation: 'smPulse 1s ease infinite' }}>⏳</span>Gerando...</>
                : <><span>⚡</span>{script ? 'Regerar' : 'Gerar Roteiro'}</>}
            </button>

            {script && !loading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 11px', borderRadius: 8, background: `rgba(${glowColor},0.05)`, border: `1px solid rgba(${glowColor},0.1)` }}>
                  <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>PALAVRAS</span>
                  <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: accentColor }}>{wordCount}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 11px', borderRadius: 8, background: `rgba(${glowColor},0.05)`, border: `1px solid rgba(${glowColor},0.1)` }}>
                  <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>LEITURA</span>
                  <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: accentColor }}>~{readTime} min</span>
                </div>
                {/* Copiar tudo */}
                <button
                  onClick={() => navigator.clipboard?.writeText(fullCopy)}
                  style={{ width: '100%', padding: '8px', borderRadius: 8, background: `rgba(${glowColor},0.08)`, border: `1px solid rgba(${glowColor},0.2)`, color: accentColor, fontFamily: 'Space Mono, monospace', fontSize: 11, letterSpacing: '0.12em', cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.background=`rgba(${glowColor},0.16)`; }}
                  onMouseLeave={e => { e.currentTarget.style.background=`rgba(${glowColor},0.08)`; }}
                >📋 COPIAR TUDO</button>

                {onSave && (
                  <button
                    onClick={() => { onSave(); setSaved(true); setTimeout(() => setSaved(false), 2500); }}
                    style={{ width: '100%', padding: '8px', borderRadius: 8, background: saved ? `rgba(0,229,176,0.12)` : `rgba(${glowColor},0.06)`, border: `1px solid ${saved ? 'rgba(0,229,176,0.4)' : `rgba(${glowColor},0.15)`}`, color: saved ? '#00e5b0' : `rgba(${glowColor},0.6)`, fontFamily: 'Space Mono, monospace', fontSize: 11, letterSpacing: '0.12em', cursor: 'pointer', transition: 'all 0.25s' }}
                    onMouseEnter={e => { if (!saved) e.currentTarget.style.background=`rgba(${glowColor},0.12)`; }}
                    onMouseLeave={e => { if (!saved) e.currentTarget.style.background=`rgba(${glowColor},0.06)`; }}
                  >{saved ? '✓ SALVO' : '💾 SALVAR'}</button>
                )}
              </div>
            )}
          </div>

          )}

          {/* Painel direito — output */}
          <div ref={outputRef} style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }} className="sm-scroll">

            {loading && !script && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 200, gap: 20 }}>
                <div style={{ width: 60, height: 60, borderRadius: 16, background: `rgba(${glowColor},0.1)`, border: `1px solid rgba(${glowColor},0.2)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, animation: 'smPulse 1.6s ease infinite' }}>⚡</div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontFamily: 'Syne, sans-serif', fontSize: 17, fontWeight: 700, color: '#fff', margin: '0 0 5px' }}>Criando seu roteiro</p>
                  <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: 'rgba(255,255,255,0.35)', margin: 0, fontWeight: 300 }}>A IA está analisando o conteúdo...</p>
                </div>
                <LoadingInsight glowColor={glowColor} accentColor={accentColor} />
              </div>
            )}

            {!loading && error && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 200, gap: 14 }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(220,60,60,0.08)', border: '1px solid rgba(220,60,60,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>⚠️</div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontFamily: 'Syne, sans-serif', fontSize: 15, fontWeight: 700, color: '#fff', margin: '0 0 5px' }}>Erro ao gerar</p>
                  <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: 'rgba(255,100,100,0.7)', margin: 0, fontWeight: 300, maxWidth: 340 }}>{error}</p>
                </div>
                <button onClick={handleGenerate} style={{ padding: '8px 20px', borderRadius: 8, background: `rgba(${glowColor},0.12)`, border: `1px solid rgba(${glowColor},0.3)`, color: accentColor, fontFamily: 'Space Mono, monospace', fontSize: 9, letterSpacing: '0.16em', cursor: 'pointer' }}>↺ TENTAR NOVAMENTE</button>
              </div>
            )}

            {!loading && !error && !script && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 200, gap: 14, textAlign: 'center' }}>
                <div style={{ width: 60, height: 60, borderRadius: 16, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, opacity: 0.4 }}>⚡</div>
                <div>
                  <p style={{ fontFamily: 'Syne, sans-serif', fontSize: 16, fontWeight: 700, color: '#fff', margin: '0 0 5px' }}>Pronto para gerar</p>
                  <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: 'rgba(255,255,255,0.3)', margin: 0, fontWeight: 300 }}>
                    Escolha a plataforma e o estilo, depois clique em <span style={{ color: accentColor }}>Gerar Roteiro</span>
                  </p>
                </div>
              </div>
            )}

            {script && (
              <div>
                {/* ── HOOKS ── */}
                {hooks.length > 0 && (
                  <Section title="HOOKS — ESCOLHA SEU GANCHO" icon="🎣" accent={accentColor} glow={glowColor}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {hooks.map(h => (
                        <div
                          key={h.id}
                          className="hook-btn"
                          onClick={() => setActiveHook(activeHook?.id === h.id ? null : h)}
                          style={{
                            padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                            border: activeHook?.id === h.id ? `1px solid rgba(${glowColor},0.6)` : '1px solid rgba(255,255,255,0.06)',
                            background: activeHook?.id === h.id ? `rgba(${glowColor},0.1)` : 'rgba(255,255,255,0.02)',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, letterSpacing: '0.12em', color: activeHook?.id === h.id ? accentColor : 'rgba(255,255,255,0.55)' }}>{h.label}</span>
                            {activeHook?.id === h.id && <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: accentColor, background: `rgba(${glowColor},0.15)`, padding: '1px 7px', borderRadius: 20 }}>ATIVO</span>}
                            <CopyButton text={h.text} label="Copiar" accent={accentColor} glow={glowColor} />
                          </div>
                          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 15, fontWeight: 400, color: 'rgba(255,255,255,0.92)', margin: '0 0 6px', lineHeight: 1.6 }}>"{h.text}"</p>
                          {h.why_it_works && (
                            <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, fontWeight: 300, color: 'rgba(255,255,255,0.5)', margin: 0, fontStyle: 'italic' }}>{h.why_it_works}</p>
                          )}
                        </div>
                      ))}
                    </div>
                    {activeHook && (
                      <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: `rgba(${glowColor},0.06)`, border: `1px solid rgba(${glowColor},0.15)` }}>
                        <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: `rgba(${glowColor},0.75)`, margin: '0 0 5px' }}>HOOK SELECIONADO — será incluído ao copiar tudo</p>
                        <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'rgba(255,255,255,0.75)', margin: 0, fontWeight: 300 }}>"{activeHook.text}"</p>
                      </div>
                    )}
                  </Section>
                )}

                {/* ── ROTEIRO ── */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, paddingBottom: 10, borderBottom: `1px solid rgba(${glowColor},0.08)` }}>
                    <span style={{ fontSize: 14 }}>📝</span>
                    <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, letterSpacing: '0.18em', color: `rgba(${glowColor},0.85)`, fontWeight: 700 }}>ROTEIRO</span>
                    {!loading && (
                      <CopyButton text={script} label="Copiar roteiro" accent={accentColor} glow={glowColor} />
                    )}
                  </div>
                  <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 15, fontWeight: 300, color: 'rgba(255,255,255,0.9)', lineHeight: 2.0, whiteSpace: 'pre-wrap' }}>
                    {script}
                    {loading && <span style={{ display: 'inline-block', width: 2, height: 14, background: accentColor, marginLeft: 3, animation: 'smCursor 0.7s ease infinite', verticalAlign: 'text-bottom' }} />}
                  </div>
                </div>


{/* DISCLAIMER LEGAL */}
{!loading && (() => {
const isBooks   = article?.author && !article?.doi && !article?.journal && !article?.subreddit;
const isScience = !!(article?.doi || article?.journal || article?.pmid);
const isNiche   = !!(article?.subreddit || article?.section);
const msg = isBooks ? "Roteiro original criado por IA com inspiração temática nesta obra. Não reproduz nem representa o conteúdo oficial do livro." : isScience ? "Conteúdo de divulgação científica gerado por IA. Não representa recomendação médica ou profissional. Sempre cite as fontes originais." : isNiche ? "Roteiro criado por IA com base em tendências públicas. Verifique as informações antes de publicar." : "Roteiro criado por IA com base no título e resumo desta notícia. Os fatos são da fonte original — a narrativa e formato são gerados por IA. Verifique antes de publicar.";
return (<div style={{margin:"4px 0 16px",padding:"9px 13px",borderRadius:8,background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.06)",display:"flex",alignItems:"flex-start",gap:8}}><span style={{fontSize:11,flexShrink:0,marginTop:1}}>ℹ️</span><p style={{fontFamily:"DM Sans, sans-serif",fontSize:11,fontWeight:300,color:"rgba(255,255,255,0.38)",margin:0,lineHeight:1.55}}>{msg}</p></div>);
})()}
                {hasExtras && !loading && (
                  <>
                    {/* ── TÍTULOS ── */}
                    {titles.length > 0 && (
                      <Section title="TÍTULOS SUGERIDOS" icon="🏷️" accent={accentColor} glow={glowColor}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                          {titles.map((t, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 12, color: `rgba(${glowColor},0.7)`, flexShrink: 0 }}>{i+1}</span>
                              <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 14, color: 'rgba(255,255,255,0.9)', margin: 0, flex: 1, lineHeight: 1.5 }}>{t}</p>
                              <CopyButton text={t} accent={accentColor} glow={glowColor} />
                            </div>
                          ))}
                        </div>
                      </Section>
                    )}

                    {/* ── LEGENDAS DE TELA ── */}
                    {screenCaptions.length > 0 && (
                      <Section title="LEGENDAS DE TELA" icon="💬" accent={accentColor} glow={glowColor}>
                        <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: '0 0 10px' }}>Frases curtas para aparecer sobrepostas no vídeo nos primeiros segundos</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                          {screenCaptions.map((c, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                              <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: `rgba(${glowColor},0.7)`, flexShrink: 0 }}>{i+1}</span>
                              <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.9)', margin: 0, flex: 1 }}>{c}</p>
                              <CopyButton text={c} accent={accentColor} glow={glowColor} />
                            </div>
                          ))}
                        </div>
                        <div style={{ marginTop: 8 }}>
                          <CopyButton text={screenCaptions.join('\n')} label="Copiar todas" accent={accentColor} glow={glowColor} />
                        </div>
                      </Section>
                    )}

                    {/* ── PROMPTS DE IMAGEM ── */}
                    {imagePrompts.length > 0 && (
                      <Section title="PROMPTS DE IMAGEM — IA" icon="🎨" accent={accentColor} glow={glowColor}>
                        <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: '0 0 10px' }}>Use no Midjourney, DALL-E ou Stable Diffusion. Uma imagem a cada 4s no vídeo.</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                          {imagePrompts.map((p, i) => (
                            <div key={i} style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                                <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: `rgba(${glowColor},0.6)` }}>IMG {i+1} · {i*4}s · {platform === 'youtube_long' ? '16:9' : '9:16'}</span>
                                <CopyButton text={p} accent={accentColor} glow={glowColor} />
                              </div>
                              <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, fontWeight: 300, color: 'rgba(255,255,255,0.75)', margin: 0, lineHeight: 1.55, fontStyle: 'italic' }}>{p}</p>
                            </div>
                          ))}
                        </div>
                        <div style={{ marginTop: 8 }}>
                          <CopyButton text={imagePrompts.join('\n\n')} label="Copiar todos" accent={accentColor} glow={glowColor} />
                        </div>
                      </Section>
                    )}

                    {/* ── HASHTAGS ── */}
                    {hashtags.length > 0 && (
                      <Section title="HASHTAGS" icon="#️⃣" accent={accentColor} glow={glowColor}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 10 }}>
                          {hashtags.map((h, i) => (
                            <span key={i} style={{ fontFamily: 'Space Mono, monospace', fontSize: 12, color: accentColor, background: `rgba(${glowColor},0.1)`, border: `1px solid rgba(${glowColor},0.2)`, padding: '4px 10px', borderRadius: 20, cursor: 'pointer' }}
                              onClick={() => navigator.clipboard?.writeText(h)}
                            >{h}</span>
                          ))}
                        </div>
                        <CopyButton text={hashtags.join(' ')} label="Copiar todas" accent={accentColor} glow={glowColor} />
                      </Section>
                    )}

                    {/* ── LEGENDAS ── */}
                    {captions.length > 0 && (
                      <Section title="LEGENDAS / DESCRIÇÕES" icon="💬" accent={accentColor} glow={glowColor}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {captions.map((c, i) => (
                            <div key={i} style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                                <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: `rgba(${glowColor},0.7)` }}>OPÇÃO {i+1}</span>
                                <CopyButton text={c} accent={accentColor} glow={glowColor} />
                              </div>
                              <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 14, color: 'rgba(255,255,255,0.85)', margin: 0, lineHeight: 1.6, fontWeight: 300 }}>{c}</p>
                            </div>
                          ))}
                        </div>
                      </Section>
                    )}

                    {/* ── THUMBNAIL ── */}
                    {thumbnailPrompt && (
                      <Section title="PROMPT PARA THUMBNAIL" icon="🖼️" accent={accentColor} glow={glowColor} defaultOpen={false}>
                        <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', marginBottom: 10 }}>
                          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 14, color: 'rgba(255,255,255,0.85)', margin: 0, lineHeight: 1.7, fontWeight: 300, fontStyle: 'italic' }}>{thumbnailPrompt}</p>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <CopyButton text={thumbnailPrompt} label="Copiar prompt" accent={accentColor} glow={glowColor} />
                          <a
                            href={`https://chatgpt.com/?q=${encodeURIComponent('Thumbnail YouTube: ' + thumbnailPrompt.slice(0,350))}`}
                            target="_blank" rel="noopener noreferrer"
                            style={{ padding: '4px 12px', borderRadius: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', fontFamily: 'DM Sans, sans-serif', fontSize: 11, textDecoration: 'none', transition: 'all 0.15s' }}
                            onMouseEnter={e => { e.currentTarget.style.color='rgba(255,255,255,0.8)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.2)'; }}
                            onMouseLeave={e => { e.currentTarget.style.color='rgba(255,255,255,0.5)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.1)'; }}
                          >Gerar no ChatGPT ↗</a>
                          <a
                            href={`https://gemini.google.com/app?q=${encodeURIComponent('Thumbnail YouTube: ' + thumbnailPrompt.slice(0,350))}`}
                            target="_blank" rel="noopener noreferrer"
                            style={{ padding: '4px 12px', borderRadius: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', fontFamily: 'DM Sans, sans-serif', fontSize: 11, textDecoration: 'none' }}
                          >Gerar no Gemini ↗</a>
                        </div>
                        <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: '8px 0 0', fontWeight: 300 }}>
                          Cole também no Midjourney, DALL-E 3 ou Leonardo.ai
                        </p>
                      </Section>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
