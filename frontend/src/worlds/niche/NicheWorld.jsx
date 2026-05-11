/**
 * NicheWorld.jsx — Meu Canal + Analytics YouTube integrado
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useScriptGenerator } from '../../hooks/useScriptGenerator';
import { ScriptModal } from '../../components/script/ScriptModal';

if (typeof document !== 'undefined' && !document.getElementById('niche-fonts')) {
  const l = document.createElement('link');
  l.id = 'niche-fonts'; l.rel = 'stylesheet';
  l.href = 'https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&family=Space+Mono:wght@400;700&display=swap';
  document.head.appendChild(l);
}

const PLATFORMS = [['tiktok','TikTok / Instagram'],['youtube_shorts','YT Shorts'],['youtube_long','YT Longo']];
const STYLES    = [['educational','Educacional'],['storytelling','Storytelling'],['dark_channel','Entretenimento'],['controversial','Debate']];
const NICHE_COLORS = [
  { accent:'#ff4444', glow:'255,68,68',   bg:'#1e0a0a', grad:'linear-gradient(160deg,#1e0a0a 0%,#2d0f0f 60%,#160707 100%)', border:'rgba(255,68,68,0.6)' },
  { accent:'#ff6666', glow:'255,102,102', bg:'#1f0b0b', grad:'linear-gradient(160deg,#1f0b0b 0%,#2e1010 60%,#170808 100%)', border:'rgba(255,102,102,0.6)' },
  { accent:'#ff3333', glow:'255,51,51',   bg:'#1d0909', grad:'linear-gradient(160deg,#1d0909 0%,#2c0e0e 60%,#150606 100%)', border:'rgba(255,51,51,0.6)' },
  { accent:'#ff5555', glow:'255,85,85',   bg:'#200a0a', grad:'linear-gradient(160deg,#200a0a 0%,#2f1010 60%,#180707 100%)', border:'rgba(255,85,85,0.6)' },
  { accent:'#ff2222', glow:'255,34,34',   bg:'#1c0808', grad:'linear-gradient(160deg,#1c0808 0%,#2b0d0d 60%,#140505 100%)', border:'rgba(255,34,34,0.6)' },
  { accent:'#ff7777', glow:'255,119,119', bg:'#210b0b', grad:'linear-gradient(160deg,#210b0b 0%,#301111 60%,#190808 100%)', border:'rgba(255,119,119,0.6)' },
];

const SECTIONS = [
  { id:'news',     label:'Notícias',   icon:'📡', desc:'Google News · RSS brasileiro' },
  { id:'reddit',   label:'Discussões', icon:'💬', desc:'Reddit · Comunidades do nicho' },
  { id:'articles', label:'Artigos',    icon:'📄', desc:'Semantic Scholar · Pesquisa científica' },
  { id:'books',    label:'Livros',     icon:'📚', desc:'Google Books · Comprar na Amazon' },
];
const MINING_SECTION = { id:'mining', label:'Mineração', icon:'🔍', desc:'Analisa canal concorrente e extrai padrões virais' };

function getColor(idx) { return NICHE_COLORS[idx % NICHE_COLORS.length]; }

function useIsMobile() {
  const [m, setM] = useState(typeof window !== 'undefined' && window.innerWidth < 640);
  useEffect(() => {
    const fn = () => setM(window.innerWidth < 640);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return m;
}

function loadNiches() {
  try { return JSON.parse(localStorage.getItem('vn_niches') || '[]'); }
  catch { return []; }
}
function saveNiches(n) { try { localStorage.setItem('vn_niches', JSON.stringify(n)); } catch {} }

function loadSocialData() {
  try { return JSON.parse(localStorage.getItem('vn_social_data') || '{}'); }
  catch { return {}; }
}
function saveSocialData(d) { try { localStorage.setItem('vn_social_data', JSON.stringify(d)); } catch {} }

function loadHistory() {
  try { return JSON.parse(localStorage.getItem('vn_script_history') || '[]'); }
  catch { return []; }
}
function saveHistory(h) { try { localStorage.setItem('vn_script_history', JSON.stringify(h)); } catch {} }

function loadReminderDismissed() {
  try {
    const d = localStorage.getItem('vn_reminder_dismissed');
    if (!d) return false;
    return Date.now() - parseInt(d) < 7 * 24 * 60 * 60 * 1000;
  } catch { return false; }
}

function fmt(n) {
  if (!n && n !== 0) return '—';
  if (n >= 1000000) return (n/1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n/1000).toFixed(1) + 'K';
  return String(n);
}

function parseDuration(iso) {
  if (!iso) return '—';
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return '—';
  const h = parseInt(m[1]||0), min = parseInt(m[2]||0), s = parseInt(m[3]||0);
  if (h > 0) return `${h}:${String(min).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${min}:${String(s).padStart(2,'0')}`;
}

function engagementRate(v) {
  if (!v.views || v.views === 0) return 0;
  return (((v.likes || 0) + (v.comments || 0)) / v.views * 100).toFixed(1);
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function SkeletonCard({ color }) {
  return (
    <div style={{ borderRadius:14, overflow:'hidden', border:'1px solid rgba(255,255,255,0.06)', background:'rgba(255,255,255,0.02)' }}>
      <div style={{ height:150, background:'linear-gradient(90deg,rgba(255,255,255,0.03) 25%,rgba(255,255,255,0.07) 50%,rgba(255,255,255,0.03) 75%)', backgroundSize:'200% 100%', animation:'nicheShimmer 1.5s ease infinite' }} />
      <div style={{ padding:'14px 16px', display:'flex', flexDirection:'column', gap:10 }}>
        <div style={{ height:8, borderRadius:4, background:'rgba(255,255,255,0.06)', width:'40%' }} />
        <div style={{ height:13, borderRadius:4, background:'rgba(255,255,255,0.06)', width:'92%' }} />
        <div style={{ height:13, borderRadius:4, background:'rgba(255,255,255,0.04)', width:'70%' }} />
        <div style={{ height:34, borderRadius:8, background:'rgba(255,255,255,0.04)', marginTop:4 }} />
      </div>
    </div>
  );
}

// ─── ContentCard ──────────────────────────────────────────────────────────────
function ContentCard({ item, index, color, onGenerate }) {
  const [hovered, setHovered] = useState(false);
  const [showOpts, setShowOpts] = useState(false);
  const [platform, setPlatform] = useState('youtube_shorts');
  const [style, setStyle] = useState('educational');
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold:0.05 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  const score = item.viral_score || 6;
  const scoreColor = score >= 8 ? '#00e5b0' : score >= 6 ? '#ffbe4d' : 'rgba(255,255,255,0.4)';
  const typeIcon = item.type === 'discussion' ? '💬' : item.type === 'article' ? '📄' : '📡';
  return (
    <div ref={ref} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ borderRadius:14, overflow:'hidden', border:`1px solid ${hovered?`rgba(${color.glow},0.25)`:'rgba(255,255,255,0.06)'}`, background:hovered?`rgba(${color.glow},0.04)`:'rgba(255,255,255,0.02)', transform:visible?(hovered?'translateY(-4px)':'none'):'translateY(18px)', opacity:visible?1:0, boxShadow:hovered?'0 16px 48px rgba(0,0,0,0.65)':'0 2px 12px rgba(0,0,0,0.3)', transition:`transform 0.28s ease,box-shadow 0.28s ease,border-color 0.2s,opacity 0.5s ease ${index*0.04}s`, display:'flex', flexDirection:'column' }}>
      <div style={{ position:'relative', height:150, overflow:'hidden', background:'#0a0a12', flexShrink:0 }}>
        {item.image ? <img src={item.image} alt={item.title} style={{ width:'100%', height:'100%', objectFit:'cover', transform:hovered?'scale(1.05)':'scale(1)', transition:'transform 0.4s ease' }} onError={e=>{e.target.style.display='none';}} />
          : <div style={{ position:'absolute', inset:0, background:`linear-gradient(135deg,rgba(${color.glow},0.12) 0%,transparent 100%)`, display:'flex', alignItems:'center', justifyContent:'center' }}><span style={{ fontSize:32, opacity:0.3 }}>{typeIcon}</span></div>}
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top,rgba(0,0,0,0.7) 0%,transparent 55%)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', top:10, right:10, display:'flex', alignItems:'center', gap:5, padding:'4px 9px', borderRadius:8, background:'rgba(0,0,0,0.78)', backdropFilter:'blur(12px)', border:`1px solid ${scoreColor}33` }}>
          <div style={{ width:5, height:5, borderRadius:'50%', background:scoreColor }} />
          <span style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:15, color:scoreColor, fontWeight:700 }}>{score}/10</span>
        </div>
        <div style={{ position:'absolute', bottom:10, left:10 }}>
          <span style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:15, color:'rgba(255,255,255,0.6)', background:'rgba(0,0,0,0.7)', backdropFilter:'blur(12px)', padding:'3px 8px', borderRadius:4 }}>{item.source}</span>
        </div>
      </div>
      <div style={{ padding:'14px 16px 16px', display:'flex', flexDirection:'column', gap:8, flex:1 }}>
        {(item.authors || item.upvotes || item.year) && (
          <p style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:15, color:`rgba(${color.glow},0.6)`, margin:0, fontWeight:300 }}>
            {item.authors || (item.upvotes ? `▲ ${item.upvotes?.toLocaleString()} · 💬 ${item.comments}` : '')}
            {item.year ? ` · ${item.year}` : ''}{item.citations ? ` · ${item.citations} citações` : ''}
          </p>
        )}
        <h3 style={{ fontFamily:'-apple-system,SF Pro Display,SF Pro Text,sans-serif', fontSize:15, fontWeight:600, color:hovered?'#fff':'rgba(255,255,255,0.88)', margin:0, lineHeight:1.45, display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical', overflow:'hidden', transition:'color 0.2s' }}>{item.title}</h3>
        {item.description && <p style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:14, fontWeight:300, color:'rgba(255,255,255,0.35)', margin:0, lineHeight:1.55, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{item.description?.slice(0,130)}{item.description?.length>130?'…':''}</p>}
        <div style={{ flex:1 }} />
        {showOpts && (
          <div style={{ padding:'10px 12px', borderRadius:10, background:`rgba(${color.glow},0.06)`, border:`1px solid rgba(${color.glow},0.18)`, display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
            <select value={platform} onChange={e=>setPlatform(e.target.value)} style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:6, padding:'5px 8px', color:'rgba(255,255,255,0.8)', fontSize:14, cursor:'pointer', fontFamily:'-apple-system,SF Pro Text,sans-serif' }}>
              {PLATFORMS.map(([v,l]) => <option key={v} value={v} style={{ background:'#0a0a12' }}>{l}</option>)}
            </select>
            <select value={style} onChange={e=>setStyle(e.target.value)} style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:6, padding:'5px 8px', color:'rgba(255,255,255,0.8)', fontSize:14, cursor:'pointer', fontFamily:'-apple-system,SF Pro Text,sans-serif' }}>
              {STYLES.map(([v,l]) => <option key={v} value={v} style={{ background:'#0a0a12' }}>{l}</option>)}
            </select>
            <button onClick={() => onGenerate(item,{platform,style})} style={{ marginLeft:'auto', padding:'6px 14px', borderRadius:6, background:`rgba(${color.glow},0.18)`, border:`1px solid rgba(${color.glow},0.45)`, color:color.accent, fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:15, letterSpacing:'0.16em', cursor:'pointer' }}>GERAR →</button>
          </div>
        )}
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => setShowOpts(!showOpts)} style={{ flex:1, padding:'9px 14px', borderRadius:8, border:'none', cursor:'pointer', fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:15, fontWeight:600, color:showOpts?color.accent:'#07070f', background:showOpts?`rgba(${color.glow},0.15)`:`linear-gradient(135deg,${color.accent} 0%,rgba(${color.glow},0.7) 100%)`, boxShadow:showOpts?'none':`0 2px 14px rgba(${color.glow},0.35)`, transition:'all 0.2s', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
            <span>⚡</span>{showOpts?'Fechar':'Gerar Roteiro'}
          </button>
          {item.url && <a href={item.url} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} style={{ width:36, height:36, borderRadius:8, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', border:'1px solid rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.7)', background:'rgba(255,255,255,0.03)', textDecoration:'none', fontSize:14, transition:'color 0.15s' }} onMouseEnter={e=>{e.currentTarget.style.color='rgba(255,255,255,0.7)';e.currentTarget.style.borderColor='rgba(255,255,255,0.18)';}} onMouseLeave={e=>{e.currentTarget.style.color='rgba(255,255,255,0.7)';e.currentTarget.style.borderColor='rgba(255,255,255,0.08)';}}>↗</a>}
        </div>
      </div>
    </div>
  );
}

// ─── BookCard ─────────────────────────────────────────────────────────────────
function BookCard({ item, index, color, onGenerate }) {
  const [hovered, setHovered] = useState(false);
  const [showOpts, setShowOpts] = useState(false);
  const [platform, setPlatform] = useState('youtube_shorts');
  const [style, setStyle] = useState('storytelling');
  const [visible, setVisible] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold:0.05 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  const score = item.viral_score || 6;
  const scoreColor = score >= 8 ? '#00e5b0' : score >= 6 ? '#ffbe4d' : 'rgba(255,255,255,0.4)';
  return (
    <div ref={ref} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ borderRadius:14, overflow:'hidden', border:`1px solid ${hovered?`rgba(${color.glow},0.25)`:'rgba(255,255,255,0.06)'}`, background:hovered?`rgba(${color.glow},0.04)`:'rgba(255,255,255,0.02)', transform:visible?(hovered?'translateY(-4px)':'none'):'translateY(18px)', opacity:visible?1:0, boxShadow:hovered?'0 16px 48px rgba(0,0,0,0.65)':'0 2px 12px rgba(0,0,0,0.3)', transition:`transform 0.28s ease,box-shadow 0.28s ease,border-color 0.2s,opacity 0.5s ease ${index*0.04}s`, display:'flex', flexDirection:'column' }}>
      <div style={{ position:'relative', height:180, overflow:'hidden', background:'#0a0a12', flexShrink:0 }}>
        {item.image ? <img src={item.image} alt={item.title} style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'center top', transform:hovered?'scale(1.04)':'scale(1)', transition:'transform 0.4s ease' }} onError={e=>{e.target.style.display='none';}} />
          : <div style={{ position:'absolute', inset:0, background:`linear-gradient(155deg,rgba(${color.glow},0.2) 0%,#000 100%)`, display:'flex', alignItems:'center', justifyContent:'center' }}><span style={{ fontSize:28, opacity:0.3 }}>📚</span></div>}
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top,rgba(0,0,0,0.8) 0%,transparent 55%)', pointerEvents:'none' }} />
        <div style={{ position:'absolute', top:10, right:10, display:'flex', alignItems:'center', gap:5, padding:'4px 9px', borderRadius:8, background:'rgba(0,0,0,0.78)', backdropFilter:'blur(12px)', border:`1px solid ${scoreColor}33` }}>
          <div style={{ width:5, height:5, borderRadius:'50%', background:scoreColor }} />
          <span style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:15, color:scoreColor, fontWeight:700 }}>{score}/10</span>
        </div>
        <div style={{ position:'absolute', bottom:10, left:10 }}>
          <span style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:15, color:'rgba(255,153,0,0.9)', background:'rgba(0,0,0,0.75)', padding:'3px 8px', borderRadius:4, letterSpacing:'0.1em' }}>AMAZON</span>
        </div>
      </div>
      <div style={{ padding:'14px 16px 16px', display:'flex', flexDirection:'column', gap:8, flex:1 }}>
        <p style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:15, color:`rgba(${color.glow},0.65)`, margin:0, fontWeight:300 }}>{item.authors}{item.rating?` · ★ ${item.rating}`:''}</p>
        <h3 style={{ fontFamily:'-apple-system,SF Pro Display,SF Pro Text,sans-serif', fontSize:14, fontWeight:700, color:hovered?'#fff':'rgba(255,255,255,0.9)', margin:0, lineHeight:1.4, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden', transition:'color 0.2s' }}>{item.title}</h3>
        {item.description && <p style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:14, fontWeight:300, color:'rgba(255,255,255,0.32)', margin:0, lineHeight:1.55, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{item.description?.slice(0,130)}{item.description?.length>130?'…':''}</p>}
        <div style={{ flex:1 }} />
        {showOpts && (
          <div style={{ padding:'10px 12px', borderRadius:10, background:`rgba(${color.glow},0.06)`, border:`1px solid rgba(${color.glow},0.18)`, display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
            <select value={platform} onChange={e=>setPlatform(e.target.value)} style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:6, padding:'5px 8px', color:'rgba(255,255,255,0.8)', fontSize:14, cursor:'pointer', fontFamily:'-apple-system,SF Pro Text,sans-serif' }}>
              {PLATFORMS.map(([v,l]) => <option key={v} value={v} style={{ background:'#0a0a12' }}>{l}</option>)}
            </select>
            <select value={style} onChange={e=>setStyle(e.target.value)} style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:6, padding:'5px 8px', color:'rgba(255,255,255,0.8)', fontSize:14, cursor:'pointer', fontFamily:'-apple-system,SF Pro Text,sans-serif' }}>
              {STYLES.map(([v,l]) => <option key={v} value={v} style={{ background:'#0a0a12' }}>{l}</option>)}
            </select>
            <button onClick={() => onGenerate(item,{platform,style})} style={{ marginLeft:'auto', padding:'6px 14px', borderRadius:6, background:`rgba(${color.glow},0.18)`, border:`1px solid rgba(${color.glow},0.45)`, color:color.accent, fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:15, letterSpacing:'0.16em', cursor:'pointer' }}>GERAR →</button>
          </div>
        )}
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => setShowOpts(!showOpts)} style={{ flex:1, padding:'9px 14px', borderRadius:8, border:'none', cursor:'pointer', fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:15, fontWeight:600, color:showOpts?color.accent:'#07070f', background:showOpts?`rgba(${color.glow},0.15)`:`linear-gradient(135deg,${color.accent} 0%,rgba(${color.glow},0.7) 100%)`, transition:'all 0.2s', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
            <span>⚡</span>{showOpts?'Fechar':'Gerar Roteiro'}
          </button>
          <a href={item.amazonUrl} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} style={{ padding:'0 14px', height:36, borderRadius:8, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(255,153,0,0.12)', border:'1px solid rgba(255,153,0,0.3)', color:'rgba(255,153,0,0.85)', fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:15, letterSpacing:'0.14em', textDecoration:'none', transition:'all 0.15s', whiteSpace:'nowrap' }} onMouseEnter={e=>{e.currentTarget.style.background='rgba(255,153,0,0.22)';}} onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,153,0,0.12)';}}>🛒 VER</a>
        </div>
      </div>
    </div>
  );
}

// ─── ContentSection ───────────────────────────────────────────────────────────
function ContentSection({ section, items, loading, color, onGenerate, isMobile }) {
  const isBooks = section.id === 'books';
  const [expanded, setExpanded] = useState(false);
  const LIMIT = isMobile ? 3 : 6;
  const visible = expanded ? items : items.slice(0, LIMIT);
  const hasMore = items.length > LIMIT;

  return (
    <div style={{ marginBottom:56 }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20, paddingBottom:14, borderBottom:`1px solid rgba(${color.glow},0.12)` }}>
        <span style={{ fontSize:22 }}>{section.icon}</span>
        <div>
          <h2 style={{ fontFamily:'-apple-system,SF Pro Display,SF Pro Text,sans-serif', fontSize:20, fontWeight:700, color:'#fff', margin:0, letterSpacing:'-0.3px' }}>{section.label}</h2>
          <p style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:12, color:`rgba(${color.glow},0.5)`, margin:'3px 0 0', fontWeight:400 }}>{section.desc}</p>
        </div>
        {!loading && items.length > 0 && (
          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ padding:'4px 12px', borderRadius:20, background:`rgba(${color.glow},0.1)`, border:`1px solid rgba(${color.glow},0.2)` }}>
              <span style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:13, color:`rgba(${color.glow},0.8)`, fontWeight:600 }}>{items.length}</span>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:16 }}>
          {Array.from({length:4}).map((_,i) => <SkeletonCard key={i} color={color} />)}
        </div>
      ) : items.length === 0 ? (
        <div style={{ padding:'32px 24px', textAlign:'center', border:'1px dashed rgba(255,255,255,0.06)', borderRadius:14 }}>
          <span style={{ fontSize:28, opacity:0.2 }}>{section.icon}</span>
          <p style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:14, color:'rgba(255,255,255,0.4)', margin:'8px 0 0', fontWeight:400 }}>Nenhum resultado nesta seção</p>
        </div>
      ) : (
        <div style={{ position:'relative' }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:16 }}>
            {visible.map((item,i) => isBooks
              ? <BookCard key={item.id||i} item={item} index={i} color={color} onGenerate={onGenerate} />
              : <ContentCard key={item.id||i} item={item} index={i} color={color} onGenerate={onGenerate} />
            )}
          </div>

          {hasMore && !expanded && (
            <div style={{ position:'relative', marginTop:-80, paddingTop:80, background:'linear-gradient(to bottom, transparent 0%, #07070f 70%)', textAlign:'center', paddingBottom:8 }}>
              <button onClick={() => setExpanded(true)}
                style={{ padding:'10px 28px', borderRadius:10, border:`1px solid rgba(${color.glow},0.3)`, background:`rgba(${color.glow},0.08)`, color:color.accent, fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:14, fontWeight:600, cursor:'pointer', transition:'all 0.2s' }}>
                Ver mais {items.length - LIMIT} resultados ↓
              </button>
            </div>
          )}

          {hasMore && expanded && (
            <div style={{ textAlign:'center', marginTop:20 }}>
              <button onClick={() => setExpanded(false)}
                style={{ padding:'10px 28px', borderRadius:10, border:'1px solid rgba(255,255,255,0.1)', background:'rgba(255,255,255,0.04)', color:'rgba(255,255,255,0.5)', fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:14, fontWeight:500, cursor:'pointer', transition:'all 0.2s' }}>
                ↑ Recolher
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── ViewsBar ─────────────────────────────────────────────────────────────────
function ViewsBar({ value, max, color }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ height:4, borderRadius:2, background:'rgba(255,255,255,0.06)', overflow:'hidden', marginTop:4 }}>
      <div style={{ height:'100%', width:`${pct}%`, borderRadius:2, background:`linear-gradient(90deg,rgba(${color},0.4),rgba(${color},0.9))`, transition:'width 0.8s ease' }} />
    </div>
  );
}

// ─── VideoBarChart ─────────────────────────────────────────────
function VideoBarChart({ videos, color }) {
  if (!videos || videos.length === 0) return null;
  const top = [...videos].sort((a,b)=>(b.views||0)-(a.views||0)).slice(0,8);
  const maxV = Math.max(...top.map(v=>v.views||0), 1);
  return (
    <div style={{ padding:'14px 16px', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
      <p style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:11, letterSpacing:'0.2em', color:'rgba(255,255,255,0.4)', margin:'0 0 10px' }}>VIEWS POR VIDEO</p>
      <div style={{ display:'flex', gap:6, alignItems:'flex-end', height:90 }}>
        {top.map((v,i) => {
          const pct = (v.views||0) / maxV;
          const h = Math.max(4, Math.round(pct * 80));
          const sc = v.viral_score>=8?'#00e5b0':v.viral_score>=5?'#ffbe4d':`rgba(${color.glow},0.6)`;
          return (
            <div key={v.id} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }} title={v.title + ' — ' + (v.views||0).toLocaleString() + ' views'}>
              <span style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:9, color:'rgba(255,255,255,0.4)' }}>{v.views>=1000000?(v.views/1000000).toFixed(1)+'M':(v.views/1000).toFixed(0)+'K'}</span>
              <div style={{ width:'100%', height:h, borderRadius:'3px 3px 0 0', background:`linear-gradient(180deg,${sc},rgba(${color.glow},0.2))`, transition:'height 0.6s ease' }} />
              <span style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:9, color:'rgba(255,255,255,0.25)' }}>#{i+1}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Lembrete Semanal ─────────────────────────────────────────────────────────
function WeeklyReminder({ onDismiss }) {
  return (
    <div style={{ margin:'16px 20px 0', background:'linear-gradient(135deg,rgba(255,190,77,0.08) 0%,rgba(255,150,0,0.04) 100%)', border:'1px solid rgba(255,190,77,0.25)', borderRadius:12, padding:'12px 16px', display:'flex', alignItems:'center', gap:12 }}>
      <span style={{ fontSize:20, flexShrink:0 }}>🔔</span>
      <div style={{ flex:1 }}>
        <p style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:9, letterSpacing:'0.1em', color:'#ffbe4d', margin:'0 0 2px' }}>LEMBRETE SEMANAL</p>
        <p style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:15, color:'rgba(255,255,255,0.7)', margin:0, fontWeight:300 }}>Atualize os prints do TikTok e Instagram para manter seu painel de métricas atualizado.</p>
      </div>
      <button onClick={onDismiss} style={{ flexShrink:0, background:'rgba(255,190,77,0.12)', border:'1px solid rgba(255,190,77,0.25)', borderRadius:8, padding:'5px 12px', color:'#ffbe4d', fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:15, letterSpacing:'0.1em', cursor:'pointer', whiteSpace:'nowrap' }}>OK, JÁ FIZ</button>
    </div>
  );
}

// ─── Modal Upload Social ──────────────────────────────────────────────────────
function SocialUploadModal({ onClose, onUpload, socialData }) {
  const [dragging, setDragging] = useState(false);
  const [activePlatform, setActivePlatform] = useState('tiktok');
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleFile(file) {
    setUploading(true);
    await onUpload(activePlatform, file);
    setUploading(false);
    setDone(true);
    setTimeout(() => setDone(false), 2000);
  }

  const platforms = [
    { id:'tiktok', label:'TikTok / Instagram', color:'#ff2d55', icon:'🎵' },
    { id:'tiktok', label:'Instagram', color:'#e1306c', icon:'📸' },
  ];

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position:'fixed', inset:0, zIndex:300, background:'rgba(0,0,0,0.88)', backdropFilter:'blur(24px)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <div style={{ width:'100%', maxWidth:480, background:'#0a0a12', border:'1px solid rgba(255,255,255,0.08)', borderRadius:16, overflow:'hidden' }}>
        <div style={{ height:3, background:'linear-gradient(90deg,#ff2d55,#e1306c,#833ab4)' }} />
        <div style={{ padding:'24px 28px 28px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
            <div>
              <p style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:15, letterSpacing:'0.25em', color:'rgba(255,255,255,0.7)', margin:'0 0 4px' }}>ATUALIZAR MÉTRICAS</p>
              <h2 style={{ fontFamily:'-apple-system,SF Pro Display,SF Pro Text,sans-serif', fontSize:20, fontWeight:800, color:'#fff', margin:0 }}>Upload de Print</h2>
            </div>
            <button onClick={onClose} style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.4)', borderRadius:8, width:32, height:32, cursor:'pointer', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
          </div>

          <div style={{ display:'flex', gap:8, marginBottom:20 }}>
            {platforms.map(p => (
              <button key={p.id} onClick={() => setActivePlatform(p.id)} style={{ flex:1, padding:'10px', borderRadius:10, border:`1px solid ${activePlatform===p.id ? p.color+'66' : 'rgba(255,255,255,0.08)'}`, background:activePlatform===p.id ? p.color+'15' : 'rgba(255,255,255,0.03)', color:activePlatform===p.id ? p.color : 'rgba(255,255,255,0.4)', fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:15, fontWeight:500, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6, transition:'all 0.15s' }}>
                <span>{p.icon}</span><span>{p.label}</span>
              </button>
            ))}
          </div>

          {socialData[activePlatform] && (
            <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:10, padding:'10px 14px', marginBottom:16 }}>
              <p style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:15, letterSpacing:'0.15em', color:'rgba(255,255,255,0.65)', margin:'0 0 8px' }}>ÚLTIMO UPDATE · {new Date(socialData[activePlatform].updatedAt).toLocaleDateString('pt-BR')}</p>
              <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
                {Object.entries(socialData[activePlatform]).filter(([k]) => k !== 'updatedAt' && socialData[activePlatform][k] !== null).map(([k,v]) => (
                  <div key={k}>
                    <p style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:15, color:'rgba(255,255,255,0.6)', margin:'0 0 2px', textTransform:'uppercase' }}>{k.replace(/_/g,' ')}</p>
                    <p style={{ fontFamily:'-apple-system,SF Pro Display,SF Pro Text,sans-serif', fontSize:14, fontWeight:700, color:'rgba(255,255,255,0.7)', margin:0 }}>{typeof v === 'number' ? fmt(v) : v}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <label onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);const f=e.dataTransfer.files[0];if(f)handleFile(f);}}
            style={{ display:'block', border:`2px dashed ${dragging?'rgba(255,255,255,0.4)':'rgba(255,255,255,0.1)'}`, borderRadius:12, padding:'32px 20px', textAlign:'center', cursor:'pointer', transition:'all 0.2s', background:dragging?'rgba(255,255,255,0.04)':'transparent' }}>
            <input type="file" accept="image/*" style={{ display:'none' }} onChange={e=>{const f=e.target.files[0];if(f)handleFile(f);}} />
            {uploading ? (
              <div>
                <p style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:15, letterSpacing:'0.2em', color:'rgba(255,255,255,0.5)', margin:0 }}>ANALISANDO PRINT...</p>
                <p style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:15, color:'rgba(255,255,255,0.65)', margin:'6px 0 0', fontWeight:300 }}>A IA está extraindo as métricas</p>
              </div>
            ) : done ? (
              <p style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:15, letterSpacing:'0.2em', color:'#00e5b0', margin:0 }}>✓ MÉTRICAS SALVAS</p>
            ) : (
              <div>
                <p style={{ fontSize:28, margin:'0 0 8px' }}>📸</p>
                <p style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:15, color:'rgba(255,255,255,0.5)', margin:'0 0 4px' }}>Arraste o print ou clique para selecionar</p>
                <p style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:15, color:'rgba(255,255,255,0.6)', margin:0, letterSpacing:'0.1em' }}>A IA vai extrair os números automaticamente</p>
              </div>
            )}
          </label>

          <p style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:14, color:'rgba(255,255,255,0.6)', margin:'12px 0 0', textAlign:'center', fontWeight:300 }}>
            Tire print da tela de analytics do {activePlatform === 'tiktok' ? 'TikTok Studio' : 'Instagram Insights'} e envie aqui
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── YoutubeAnalytics ─────────────────────────────────────────────────────────
function YoutubeAnalytics({ ytData, color, onGenerate }) {
  const [sort, setSort] = useState('views');
  const [aiDiag, setAiDiag] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [showData, setShowData] = useState(null);
  const [socialData, setSocialData] = useState(() => loadSocialData());
  const [showSocialModal, setShowSocialModal] = useState(false);
  const [reminderDismissed, setReminderDismissed] = useState(() => loadReminderDismissed());
  const [generateOpts, setGenerateOpts] = useState({ platform:'youtube_shorts', style:'educational' });
  const [showGenOpts, setShowGenOpts] = useState(null);
  const [history, setHistory] = useState(() => loadHistory());
  const [showHistory, setShowHistory] = useState(false);
  const [scriptLoading, setScriptLoading] = useState(null);
  const [scriptResult, setScriptResult] = useState(null);

  const videos = ytData?.videos || [];
  const channel = ytData?.channel || {};
  const totalViews = videos.reduce((s,v) => s+(v.views||0), 0);
  const maxViews = Math.max(...videos.map(v=>v.views||0), 1);
  const bestVideo = [...videos].sort((a,b)=>(b.views||0)-(a.views||0))[0];
  const worstVideo = [...videos].sort((a,b)=>(a.views||0)-(b.views||0))[0];
  const avgEngagement = videos.length > 0
    ? (videos.reduce((s,v)=>s+parseFloat(engagementRate(v)),0)/videos.length).toFixed(2)
    : 0;
  const avgDurSec = videos.length > 0
    ? Math.round(videos.reduce((s,v)=>{
        const m=(v.duration||'').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        if(!m) return s;
        return s+parseInt(m[1]||0)*3600+parseInt(m[2]||0)*60+parseInt(m[3]||0);
      },0)/videos.length)
    : 0;

  const sorted = [...videos].sort((a,b) => {
    if(sort==='views') return (b.views||0)-(a.views||0);
    if(sort==='likes') return (b.likes||0)-(a.likes||0);
    if(sort==='engagement') return parseFloat(engagementRate(b))-parseFloat(engagementRate(a));
    if(sort==='date') return new Date(b.publishedAt)-new Date(a.publishedAt);
    return 0;
  });
  const displayed = showAll ? sorted : sorted.slice(0,5);

  async function runAiDiagnosis() {
    setAiLoading(true); setAiDiag('');
    try {
      const summary = {
        canal: channel?.title,
        inscritos: channel?.subscribers,
        totalViews: channel?.totalViews,
        videos: videos.length,
        mediaViews: Math.round(totalViews/(videos.length||1)),
        engajamentoMedio: avgEngagement+'%',
        melhorVideo: bestVideo ? `"${bestVideo.title}" (${bestVideo.views} views, ${bestVideo.likes} likes)` : '—',
        piorVideo: worstVideo ? `"${worstVideo.title}" (${worstVideo.views} views)` : '—',
        topTitulos: (sorted||[]).slice(0,3).map(v=>v.title),
        duracaoMedia: `${Math.floor(avgDurSec/60)}m${String(avgDurSec%60).padStart(2,'0')}s`,
      };
      const prompt = `Voce e um especialista em crescimento de canais no YouTube. Seja direto e critico, sem enrolacao.

Analise os dados abaixo e responda EXATAMENTE neste formato:

Diagnostico:
- [analise direta do que esta acontecendo com o canal]
- [segundo ponto critico]

Erros:
- [erro claro que esta prejudicando o crescimento]
- [segundo erro]

Oportunidades:
- [oportunidade concreta baseada nos dados]
- [segunda oportunidade]

Ideias de videos virais (baseadas no que JA funcionou no canal, sem repetir titulos existentes):
1. [titulo + angulo especifico]
2. [titulo + angulo especifico]
3. [titulo + angulo especifico]

Dica de formato:
- [uma dica pratica e especifica para o proximo video]

Dados do canal:
${JSON.stringify(summary, null, 2)}

Titulos ja publicados (NAO repita esses temas):
${(sorted||[]).map(v=>v.title).join(', ')}`;

      const resp = await fetch('/api/ai-diagnosis', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ prompt })
      });
      if (!resp.ok) throw new Error(`Erro na API: ${resp.status}`);
      const data = await resp.json();
      setAiDiag(data?.text || 'Erro ao gerar diagnostico.');
    } catch(e) { console.error('[ai-diagnosis error]', e); setAiDiag('Erro: ' + e.message); }
    finally { setAiLoading(false); }
  }

  async function handleSocialUpload(platform, file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target.result.split(',')[1];
      const mediaType = file.type;
      try {
        const resp = await fetch('/api/niche/social-upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ platform, base64, mediaType })
        });
        const data = await resp.json();
        setSocialData(prev => ({ ...prev, [platform]: data }));
      } catch(e) { console.error('upload error', e); }
    };
    reader.readAsDataURL(file);
  }

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:6, padding:'10px 12px', borderBottom:'1px solid rgba(255,255,255,0.04)', overflow:'hidden' }}>
        {channel.thumbnail && <img src={channel.thumbnail} alt="" style={{ width:32, height:32, borderRadius:'50%' }} />}
        <span style={{ fontFamily:'-apple-system,sans-serif', fontSize:12, fontWeight:600, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>{channel.title}</span>
        <div style={{ flex:1 }} />
        <a href={`https://youtube.com/channel/${channel.id}`} target="_blank" rel="noopener noreferrer"
          style={{ padding:'6px 12px', borderRadius:8, background:'rgba(255,50,50,0.12)', border:'1px solid rgba(255,50,50,0.25)', color:'rgba(255,100,100,0.8)', fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:11, letterSpacing:'0.05em', textDecoration:'none', whiteSpace:'nowrap' }}>
          VER CANAL ↗
        </a>
      </div>

      {/* Stats principais 4 colunas */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:1, background:'rgba(255,255,255,0.04)' }}>
        {[
          { label:'INSCRITOS',    value:fmt(channel.subscribers),  color:'#ff5555' },
          { label:'VIEWS TOTAIS', value:fmt(channel.totalViews),   color:'#ffbe4d' },
          { label:'VÍDEOS',       value:channel.videoCount,        color:'#00e5b0' },
          { label:'MÉDIA/VÍDEO',  value:fmt(Math.round(totalViews/(videos.length||1))), color:'#ff4444' },
        ].map((s,i) => (
          <div key={i} style={{ background:'rgba(7,7,15,0.9)', padding:'14px 16px' }}>
            <p style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:9, letterSpacing:'0.12em', color:'rgba(255,255,255,0.7)', margin:'0 0 4px' }}>{s.label}</p>
            <p style={{ fontFamily:'-apple-system,SF Pro Display,SF Pro Text,sans-serif', fontSize:18, fontWeight:700, color:s.color, margin:0, lineHeight:1 }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Stats secundárias 3 colunas */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:1, background:'rgba(255,255,255,0.04)' }}>
        {[
          { label:'ENGAJAMENTO MÉDIO', value:avgEngagement+'%', sub:'likes+comentários/views' },
          { label:'DURAÇÃO MÉDIA',     value:`${Math.floor(avgDurSec/60)}m${String(avgDurSec%60).padStart(2,'0')}s`, sub:'dos seus vídeos' },
          { label:'PIOR DESEMPENHO',   value:fmt(worstVideo?.views||0), sub:worstVideo?.title?.slice(0,30)+'…'||'—', dimColor:true },
        ].map((s,i) => (
          <div key={i} style={{ background:'rgba(7,7,15,0.85)', padding:'8px 12px' }}>
            <p style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:9, letterSpacing:'0.1em', color:'rgba(255,255,255,0.65)', margin:'0 0 2px' }}>{s.label}</p>
            <p style={{ fontFamily:'-apple-system,SF Pro Display,SF Pro Text,sans-serif', fontSize:14, fontWeight:700, color:s.dimColor?'rgba(255,100,100,0.6)':'rgba(255,255,255,0.7)', margin:0, lineHeight:1.1 }}>{s.value}</p>
            {s.sub && <p style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:10, color:'rgba(255,255,255,0.6)', margin:'2px 0 0', fontWeight:300 }}>{s.sub}</p>}
          </div>
        ))}
      </div>

      {/* Melhor vídeo destaque */}
      {bestVideo && (
        <div style={{ margin:'12px 16px 0', background:'rgba(255,190,77,0.05)', border:'1px solid rgba(255,190,77,0.15)', borderRadius:12, padding:'10px 12px', display:'flex', alignItems:'flex-start', gap:8, flexWrap:'wrap' }}>
          <span style={{ fontSize:18, flexShrink:0 }}>🏆</span>
          <img src={bestVideo.thumbnail} alt="" style={{ width:60, height:34, borderRadius:6, objectFit:'cover', flexShrink:0 }} />
          <div style={{ flex:1, minWidth:0 }}>
            <p style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:15, letterSpacing:'0.15em', color:'#ffbe4d', margin:'0 0 3px' }}>MELHOR VÍDEO</p>
            <p style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:12, fontWeight:500, color:'#fff', margin:'0 0 3px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{bestVideo.title}</p>
            <div style={{ display:'flex', gap:12 }}>
              <span style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:11, color:'rgba(255,255,255,0.4)' }}>👁 {fmt(bestVideo.views)}</span>
              <span style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:15, color:'rgba(255,255,255,0.4)' }}>👍 {fmt(bestVideo.likes)}</span>
              <span style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:15, color:'rgba(255,255,255,0.4)' }}>💬 {fmt(bestVideo.comments)}</span>
              <span style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:11, color:'#00e5b0' }}>⚡ {engagementRate(bestVideo)}% eng.</span>
            </div>
          </div>
          <a href={`https://youtube.com/watch?v=${bestVideo.id}`} target="_blank" rel="noopener noreferrer"
            style={{ padding:'6px 12px', borderRadius:8, background:'rgba(255,190,77,0.12)', border:'1px solid rgba(255,190,77,0.25)', color:'#ffbe4d', fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:11, textDecoration:'none', flexShrink:0 }}>VER ↗</a>
        </div>
      )}

      {/* Social data cards */}
      {(socialData.tiktok || socialData.instagram) && (
        <div style={{ margin:'12px 16px 0', display:'flex', gap:10 }}>
          {['tiktok','tiktok'].map(p => socialData[p] ? (
            <div key={p} style={{ flex:1, background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:10, padding:'10px 14px' }}>
              <p style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:10, letterSpacing:'0.1em', color:'rgba(255,255,255,0.7)', margin:'0 0 6px' }}>{p === 'tiktok' ? '🎵 TIKTOK' : '📸 INSTAGRAM'} · {new Date(socialData[p].updatedAt).toLocaleDateString('pt-BR')}</p>
              <div style={{ display:'flex', gap:14, flexWrap:'wrap' }}>
                {Object.entries(socialData[p]).filter(([k])=>k!=='updatedAt'&&socialData[p][k]!==null).slice(0,4).map(([k,v])=>(
                  <div key={k}>
                    <p style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:15, color:'rgba(255,255,255,0.6)', margin:'0 0 2px', textTransform:'uppercase' }}>{k.replace(/_/g,' ')}</p>
                    <p style={{ fontFamily:'-apple-system,SF Pro Display,SF Pro Text,sans-serif', fontSize:14, fontWeight:700, color:'rgba(255,255,255,0.65)', margin:0 }}>{typeof v==='number'?fmt(v):v}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null)}
        </div>
      )}

      {/* Grafico de barras */}
      <VideoBarChart videos={videos} color={color} />

      {/* Lista de vídeos */}
      <div style={{ padding:'16px 16px 0' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
          <p style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:11, letterSpacing:'0.1em', color:'rgba(255,255,255,0.7)', margin:0, flex:1 }}>SEUS VÍDEOS</p>
          {[['views','👁'],['likes','👍'],['engagement','⚡'],['date','📅']].map(([k,l])=>(
            <button key={k} onClick={()=>setSort(k)} style={{ padding:'3px 7px', borderRadius:6, border:`1px solid ${sort===k?'rgba(255,50,50,0.4)':'rgba(255,255,255,0.08)'}`, background:sort===k?'rgba(255,50,50,0.1)':'rgba(255,255,255,0.03)', color:sort===k?'#ff5555':'rgba(255,255,255,0.35)', fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:11, cursor:'pointer', transition:'all 0.15s' }}>{l} {k.charAt(0).toUpperCase()+k.slice(1)}</button>
          ))}
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {displayed.map((v,i) => {
            const scoreColor = v.viral_score>=8?'#00e5b0':v.viral_score>=5?'#ffbe4d':'rgba(255,255,255,0.7)';
            const scoreLabel = v.viral_score>=8?'VIRAL':v.viral_score>=5?'BOM':'NORMAL';
            return (
              <div key={v.id} style={{ borderRadius:10, overflow:'hidden', border:'1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', background:'rgba(255,255,255,0.02)' }}>
                <span style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:12, color:'rgba(255,255,255,0.6)', minWidth:18 }}>#{i+1}</span>
                <img src={v.thumbnail} alt="" style={{ width:80, height:45, borderRadius:6, objectFit:'cover', flexShrink:0 }} />
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:12, color:'#fff', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{v.title}</p>
                </div>
                <div style={{ textAlign:'center', flexShrink:0, minWidth:36 }}>
                  <p style={{ fontFamily:'-apple-system,SF Pro Display,SF Pro Text,sans-serif', fontSize:15, fontWeight:700, color:scoreColor, margin:0, lineHeight:1 }}>{v.viral_score}</p>
                  <p style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:10, color:scoreColor, margin:'2px 0 0' }}>{scoreLabel}</p>
                </div>
                <div style={{ display:'flex', gap:5, flexShrink:0, alignItems:'center' }}>
                  <button onClick={()=>setShowData(showData===v.id?null:v.id)} style={{ padding:'5px 8px', borderRadius:6, background:showData===v.id?'rgba(255,255,255,0.1)':'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.6)', fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:11, cursor:'pointer', whiteSpace:'nowrap' }}>📊</button>
                  <button onClick={()=>setShowGenOpts(showGenOpts===v.id?null:v.id)} style={{ padding:'5px 8px', borderRadius:6, background:'rgba(255,68,68,0.12)', border:'1px solid rgba(255,68,68,0.3)', color:'#ff4444', fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:11, cursor:'pointer', whiteSpace:'nowrap' }}>⚡</button>
                  <a href={`https://youtube.com/watch?v=${v.id}`} target="_blank" rel="noopener noreferrer" style={{ padding:'5px 8px', borderRadius:6, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.7)', textDecoration:'none', fontSize:12 }}>↗</a>
                </div>
              </div>
              {showData === v.id && (
                <div style={{ padding:'10px 12px', borderTop:'1px solid rgba(255,255,255,0.05)', background:'rgba(255,255,255,0.02)', display:'flex', gap:16, alignItems:'center', flexWrap:'wrap' }}>
                  <span style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:11, color:'rgba(255,255,255,0.45)' }}>👁 {fmt(v.views)}</span>
                  <span style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:11, color:'rgba(255,255,255,0.45)' }}>👍 {fmt(v.likes)}</span>
                  <span style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:11, color:'rgba(255,255,255,0.45)' }}>⚡ {engagementRate(v)}%</span>
                  <span style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:11, color:'rgba(255,255,255,0.45)' }}>⏱ {parseDuration(v.duration)}</span>
                  <ViewsBar value={v.views||0} max={maxViews} color={color.glow} />
                </div>
              )}
              {showGenOpts === v.id && (
                <div style={{ padding:'10px 12px 12px', borderTop:'1px solid rgba(255,68,68,0.1)', background:'rgba(255,68,68,0.04)', display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', borderRadius:'0 0 10px 10px' }}>
                  <select value={generateOpts.platform} onChange={e=>setGenerateOpts(o=>({...o,platform:e.target.value}))} style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:6, padding:'5px 8px', color:'rgba(255,255,255,0.8)', fontSize:12, cursor:'pointer', fontFamily:'-apple-system,SF Pro Text,sans-serif' }}>
                    <option value="tiktok" style={{background:'#0a0a12'}}>TikTok / Instagram</option>
                    <option value="youtube_shorts" style={{background:'#0a0a12'}}>YT Shorts</option>
                    <option value="youtube_long" style={{background:'#0a0a12'}}>YouTube Longo</option>
                  </select>
                  <select value={generateOpts.style} onChange={e=>setGenerateOpts(o=>({...o,style:e.target.value}))} style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:6, padding:'5px 8px', color:'rgba(255,255,255,0.8)', fontSize:12, cursor:'pointer', fontFamily:'-apple-system,SF Pro Text,sans-serif' }}>
                    <option value="educational" style={{background:'#0a0a12'}}>Educacional</option>
                    <option value="storytelling" style={{background:'#0a0a12'}}>Storytelling</option>
                    <option value="dark_channel" style={{background:'#0a0a12'}}>Entretenimento</option>
                    <option value="controversial" style={{background:'#0a0a12'}}>Debate</option>
                  </select>
                  <button
                    onClick={() => { onGenerate({ title: v.title, description: `Roteiro inspirado no vídeo '${v.title}' do canal ${channel.title}. Formato e narrativa criados por IA — não reproduz o conteúdo original do vídeo.`, viral_score: v.viral_score, url: `https://youtube.com/watch?v=${v.id}`, image: v.thumbnail, source: channel.title }, generateOpts); setShowGenOpts(null); }}
                    style={{ marginLeft:'auto', padding:'6px 16px', borderRadius:6, background:'rgba(255,68,68,0.2)', border:'1px solid rgba(255,68,68,0.45)', color:'#ff4444', fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:12, fontWeight:600, cursor:'pointer', letterSpacing:'0.1em' }}>
                    GERAR →
                  </button>
                </div>
              )}
              </div>
            );
          })}
        </div>

        {sorted.length > 5 && (
          <button onClick={()=>setShowAll(!showAll)} style={{ width:'100%', marginTop:10, padding:'9px', borderRadius:8, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.03)', color:'rgba(255,255,255,0.4)', fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:15, cursor:'pointer' }}>
            {showAll ? '▲ Mostrar menos' : `▼ Ver todos os ${sorted.length} vídeos`}
          </button>
        )}
      </div>

      {/* Diagnóstico IA */}
      <div style={{ margin:'16px 16px 16px', background:'rgba(255,68,68,0.04)', border:'1px solid rgba(255,68,68,0.15)', borderRadius:12, padding:'14px 16px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom: aiDiag ? 12 : 0 }}>
          <span style={{ fontSize:16 }}>🤖</span>
          <p style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:15, letterSpacing:'0.15em', color:'rgba(255,68,68,0.8)', margin:0, flex:1 }}>DIAGNÓSTICO IA DO CANAL</p>
          <button onClick={runAiDiagnosis} disabled={aiLoading} style={{ padding:'6px 14px', borderRadius:8, background:aiLoading?'rgba(255,255,255,0.05)':'rgba(255,68,68,0.15)', border:'1px solid rgba(255,68,68,0.3)', color:'#ffffff', fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:15, letterSpacing:'0.1em', cursor:aiLoading?'not-allowed':'pointer', transition:'all 0.15s' }}>
            {aiLoading ? 'ANALISANDO...' : aiDiag ? 'REANALISAR' : 'ANALISAR CANAL'}
          </button>
        </div>
        {aiDiag && (
          <div style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:15, color:'rgba(255,255,255,0.75)', lineHeight:1.7, fontWeight:300, whiteSpace:'pre-wrap' }}>{aiDiag}</div>
        )}
        {aiDiag && sorted.length > 0 && (
          <div style={{ marginTop:16 }}>
            <p style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:11, letterSpacing:'0.2em', color:'rgba(255,68,68,0.6)', margin:'0 0 10px' }}>GERAR ROTEIRO DAS SUGESTOES</p>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {sorted.slice(0,3).map((v,i) => (
                <button key={v.id}
                  onClick={() => onGenerate({
                    title: v.title,
                    description: `Vídeo do seu canal com ${v.views?.toLocaleString()} views e ${engagementRate(v)}% de engajamento.`,
                    viral_score: v.viral_score,
                    url: `https://youtube.com/watch?v=${v.id}`,
                    image: v.thumbnail,
                    source: channel.title,
                  }, { platform: generateOpts.platform, style: generateOpts.style })}
                  style={{ padding:'9px 14px', borderRadius:8, border:'1px solid rgba(255,68,68,0.25)', background:'rgba(255,68,68,0.08)', color:'#ff4444', fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:13, cursor:'pointer', textAlign:'left', transition:'all 0.2s' }}>
                  {`⚡ #${i+1} ${v.title.slice(0,55)}${v.title.length>55?'…':''}`}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {history.length > 0 && (
        <div style={{ margin:'0 16px 16px', background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:12, overflow:'hidden' }}>
          <button onClick={()=>setShowHistory(!showHistory)} style={{ width:'100%', padding:'12px 16px', display:'flex', alignItems:'center', gap:8, background:'none', border:'none', cursor:'pointer' }}>
            <span style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:11, letterSpacing:'0.2em', color:'rgba(255,255,255,0.5)' }}>HISTORICO DE ROTEIROS</span>
            <span style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:11, color:'rgba(255,255,255,0.3)', marginLeft:'auto' }}>{history.length} salvos {showHistory?'▲':'▼'}</span>
          </button>
          {showHistory && (
            <div style={{ borderTop:'1px solid rgba(255,255,255,0.05)', maxHeight:400, overflowY:'auto' }}>
              {history.map((entry,i) => (
                <div key={entry.id} style={{ padding:'12px 16px', borderBottom: i<history.length-1?'1px solid rgba(255,255,255,0.04)':'none' }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
                    <p style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:12, fontWeight:600, color:'rgba(255,255,255,0.7)', margin:0, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{entry.title}</p>
                    <div style={{ display:'flex', gap:6, marginLeft:8 }}>
                      <button onClick={()=>navigator.clipboard.writeText(entry.content)} style={{ padding:'3px 8px', borderRadius:5, border:'1px solid rgba(255,255,255,0.08)', background:'transparent', color:'rgba(255,255,255,0.35)', fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:10, cursor:'pointer' }}>COPIAR</button>
                      <button onClick={()=>{const u=[...history];u.splice(i,1);setHistory(u);saveHistory(u);}} style={{ padding:'3px 8px', borderRadius:5, border:'1px solid rgba(255,80,80,0.15)', background:'transparent', color:'rgba(255,80,80,0.4)', fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:10, cursor:'pointer' }}>✕</button>
                    </div>
                  </div>
                  <p style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:10, color:'rgba(255,255,255,0.25)', margin:'0 0 6px' }}>{new Date(entry.createdAt).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'})}</p>
                  <p style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:12, color:'rgba(255,255,255,0.45)', margin:0, lineHeight:1.5, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{entry.content.slice(0,150)}…</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showSocialModal && <SocialUploadModal onClose={()=>setShowSocialModal(false)} onUpload={handleSocialUpload} socialData={socialData} />}
    </div>
  );
}


// ─── ChannelMiner ─────────────────────────────────────────────────────────────
function ChannelMiner({ color, onGenerate }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [savedChannels, setSavedChannels] = useState(() => {
    try { return JSON.parse(localStorage.getItem('vn_mined_channels') || '[]'); } catch { return []; }
  });
  const [showGenOpts, setShowGenOpts] = useState(null);
  const [platform, setPlatform] = useState('youtube_shorts');
  const [style, setStyle] = useState('educational');

  function saveChannel(data) {
    const entry = { url, channel: data.channel, minedAt: data.minedAt, topVideos: data.videos.slice(0,3) };
    const updated = [entry, ...savedChannels.filter(c => c.channel.id !== data.channel.id)].slice(0, 10);
    setSavedChannels(updated);
    try { localStorage.setItem('vn_mined_channels', JSON.stringify(updated)); } catch {}
  }

  async function mine() {
    if (!url.trim()) return;
    setLoading(true); setError(''); setResult(null); setAiAnalysis('');
    try {
      const res = await fetch(`/api/youtube/mine?url=${encodeURIComponent(url.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao minerar canal');
      setResult(data);
      saveChannel(data);
    } catch(e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function analyzeWithAI() {
    if (!result) return;
    setAiLoading(true); setAiAnalysis('');
    const videos = result.videos || [];
    const avgDur = videos.length > 0 ? Math.round(videos.reduce((s,v) => {
      const m = (v.duration||'').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      if (!m) return s;
      return s + parseInt(m[1]||0)*3600 + parseInt(m[2]||0)*60 + parseInt(m[3]||0);
    }, 0) / videos.length) : 0;

    const prompt = `Você é um especialista em crescimento de canais no YouTube. Analise o canal concorrente abaixo e extraia padrões replicáveis. Seja direto, específico e acionável.

Canal: ${result.channel.title}
Inscritos: ${result.channel.subscribers?.toLocaleString()}
Views totais: ${result.channel.totalViews?.toLocaleString()}
Duração média dos top vídeos: ${Math.floor(avgDur/60)}m${String(avgDur%60).padStart(2,'0')}s

Top 10 vídeos mais vistos:
${videos.slice(0,10).map((v,i) => (i+1)+'. '+v.title+' '+v.views?.toLocaleString()+' views '+v.engagement_rate+'% eng '+v.duration).join('\n')}

Responda EXATAMENTE neste formato:

Padrão de títulos:
- [o que esses títulos têm em comum — estrutura, palavras, emoção]
- [segundo padrão identificado]

Temas que funcionam:
- [tema recorrente 1 com exemplo de título]
- [tema recorrente 2 com exemplo de título]
- [tema recorrente 3]

Formato de vídeo:
- [duração, ritmo, estilo de abertura que aparece nos mais virais]

3 ideias para replicar HOJE (títulos originais, não copie os existentes):
1. [título específico + por que vai funcionar]
2. [título específico + por que vai funcionar]
3. [título específico + por que vai funcionar]

Gancho de abertura sugerido:
- [frase de abertura específica baseada nos padrões deste canal]`;

    try {
      const resp = await fetch('/api/ai-diagnosis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      const data = await resp.json();
      setAiAnalysis(data?.text || 'Erro ao analisar.');
    } catch { setAiAnalysis('Erro ao conectar com a IA.'); }
    finally { setAiLoading(false); }
  }

  const videos = result?.videos || [];
  const maxViews = Math.max(...videos.map(v => v.views||0), 1);

  return (
    <div style={{ marginBottom: 56 }}>
      {/* Header da seção */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20, paddingBottom:14, borderBottom:`1px solid rgba(${color.glow},0.12)` }}>
        <span style={{ fontSize:22 }}>🔍</span>
        <div>
          <h2 style={{ fontFamily:'-apple-system,SF Pro Display,SF Pro Text,sans-serif', fontSize:20, fontWeight:700, color:'#fff', margin:0 }}>Mineração de Canal</h2>
          <p style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:12, color:`rgba(${color.glow},0.5)`, margin:'3px 0 0' }}>Cole a URL de um canal concorrente · A IA extrai os padrões vencedores</p>
        </div>
      </div>

      {/* Input URL */}
      <div style={{ display:'flex', gap:8, marginBottom:20 }}>
        <div style={{ flex:1, position:'relative' }}>
          <span style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', fontSize:16, pointerEvents:'none' }}>▶</span>
          <input
            type="text"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && mine()}
            placeholder="youtube.com/@canalconcorrente ou youtube.com/channel/UC..."
            style={{ width:'100%', background:'rgba(255,255,255,0.04)', border:`1px solid rgba(${color.glow},0.2)`, borderRadius:12, padding:'12px 16px 12px 42px', fontSize:14, color:'#fff', fontFamily:'-apple-system,SF Pro Text,sans-serif', outline:'none', transition:'border-color 0.2s' }}
            onFocus={e => { e.target.style.borderColor = `rgba(${color.glow},0.5)`; }}
            onBlur={e => { e.target.style.borderColor = `rgba(${color.glow},0.2)`; }}
          />
        </div>
        <button
          onClick={mine}
          disabled={loading || !url.trim()}
          style={{ padding:'12px 24px', borderRadius:12, border:'none', background:loading?'rgba(255,255,255,0.06)':`linear-gradient(135deg,${color.accent},rgba(${color.glow},0.7))`, color:loading?'rgba(255,255,255,0.3)':'#07070f', fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:14, fontWeight:700, cursor:loading?'not-allowed':'pointer', whiteSpace:'nowrap', transition:'all 0.2s', boxShadow:loading?'none':`0 4px 20px rgba(${color.glow},0.3)` }}
        >
          {loading ? 'Minerando...' : '⛏ Minerar'}
        </button>
      </div>

      {/* Canais salvos */}
      {savedChannels.length > 0 && !result && (
        <div style={{ marginBottom:20 }}>
          <p style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:11, letterSpacing:'0.2em', color:'rgba(255,255,255,0.35)', margin:'0 0 10px' }}>CANAIS MINERADOS ANTERIORMENTE</p>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {savedChannels.map((s,i) => (
              <button key={i} onClick={() => { setUrl(s.url); setResult({ channel: s.channel, videos: s.topVideos, minedAt: s.minedAt }); }}
                style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 12px', borderRadius:20, border:`1px solid rgba(${color.glow},0.2)`, background:`rgba(${color.glow},0.06)`, color:`rgba(${color.glow},0.8)`, fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:12, cursor:'pointer', transition:'all 0.15s' }}>
                <img src={s.channel.thumbnail} alt="" style={{ width:18, height:18, borderRadius:'50%' }} onError={e=>{e.target.style.display='none';}} />
                {s.channel.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Erro */}
      {error && (
        <div style={{ padding:'12px 16px', borderRadius:10, background:'rgba(255,80,80,0.08)', border:'1px solid rgba(255,80,80,0.2)', marginBottom:16 }}>
          <p style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:14, color:'rgba(255,100,100,0.9)', margin:0 }}>⚠ {error}</p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{ height:80, borderRadius:12, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.05)', overflow:'hidden' }}>
            <div style={{ height:'100%', background:'linear-gradient(90deg,rgba(255,255,255,0.02) 25%,rgba(255,255,255,0.06) 50%,rgba(255,255,255,0.02) 75%)', backgroundSize:'200% 100%', animation:'nicheShimmer 1.5s ease infinite' }} />
          </div>
          {[1,2,3].map(i => (
            <div key={i} style={{ height:56, borderRadius:10, background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.04)', overflow:'hidden' }}>
              <div style={{ height:'100%', background:'linear-gradient(90deg,rgba(255,255,255,0.01) 25%,rgba(255,255,255,0.04) 50%,rgba(255,255,255,0.01) 75%)', backgroundSize:'200% 100%', animation:`nicheShimmer 1.5s ease ${i*0.15}s infinite` }} />
            </div>
          ))}
        </div>
      )}

      {/* Resultado */}
      {result && !loading && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

          {/* Card do canal */}
          <div style={{ padding:'16px 20px', borderRadius:14, background:`rgba(${color.glow},0.04)`, border:`1px solid rgba(${color.glow},0.15)`, display:'flex', alignItems:'center', gap:14 }}>
            <img src={result.channel.thumbnail} alt="" style={{ width:52, height:52, borderRadius:'50%', border:`2px solid rgba(${color.glow},0.4)`, flexShrink:0 }} onError={e=>{e.target.style.display='none';}} />
            <div style={{ flex:1 }}>
              <p style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:11, letterSpacing:'0.2em', color:`rgba(${color.glow},0.6)`, margin:'0 0 3px' }}>CANAL MINERADO</p>
              <p style={{ fontFamily:'-apple-system,SF Pro Display,SF Pro Text,sans-serif', fontSize:18, fontWeight:800, color:'#fff', margin:'0 0 8px' }}>{result.channel.title}</p>
              <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
                {[
                  { label:'Inscritos', value: result.channel.subscribers >= 1000000 ? (result.channel.subscribers/1000000).toFixed(1)+'M' : result.channel.subscribers >= 1000 ? (result.channel.subscribers/1000).toFixed(0)+'K' : result.channel.subscribers },
                  { label:'Views totais', value: result.channel.totalViews >= 1000000 ? (result.channel.totalViews/1000000).toFixed(1)+'M' : result.channel.totalViews >= 1000 ? (result.channel.totalViews/1000).toFixed(0)+'K' : result.channel.totalViews },
                  { label:'Vídeos', value: result.channel.videoCount },
                ].map((s,i) => (
                  <div key={i}>
                    <p style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:10, color:'rgba(255,255,255,0.4)', margin:'0 0 1px', letterSpacing:'0.1em' }}>{s.label.toUpperCase()}</p>
                    <p style={{ fontFamily:'-apple-system,SF Pro Display,SF Pro Text,sans-serif', fontSize:16, fontWeight:700, color:color.accent, margin:0 }}>{s.value}</p>
                  </div>
                ))}
              </div>
            </div>
            <a href={`https://youtube.com/channel/${result.channel.id}`} target="_blank" rel="noopener noreferrer"
              style={{ padding:'7px 14px', borderRadius:8, background:`rgba(${color.glow},0.12)`, border:`1px solid rgba(${color.glow},0.3)`, color:color.accent, fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:12, textDecoration:'none', flexShrink:0, letterSpacing:'0.1em' }}>
              VER ↗
            </a>
          </div>

          {/* Top vídeos */}
          <div>
            <p style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:11, letterSpacing:'0.2em', color:'rgba(255,255,255,0.4)', margin:'0 0 10px' }}>TOP VÍDEOS — MAIS VISTOS DO CANAL</p>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {videos.slice(0,10).map((v,i) => {
                const pct = (v.views||0) / maxViews;
                const scoreColor = v.viral_score >= 8 ? '#00e5b0' : v.viral_score >= 5 ? '#ffbe4d' : 'rgba(255,255,255,0.4)';
                return (
                  <div key={v.id} style={{ borderRadius:10, border:`1px solid rgba(255,255,255,0.05)`, background:'rgba(255,255,255,0.02)', overflow:'hidden' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px' }}>
                      <span style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:12, color:'rgba(255,255,255,0.3)', minWidth:18, textAlign:'right' }}>#{i+1}</span>
                      <img src={v.thumbnail} alt="" style={{ width:72, height:40, borderRadius:5, objectFit:'cover', flexShrink:0 }} onError={e=>{e.target.style.display='none';}} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:13, color:'rgba(255,255,255,0.88)', margin:'0 0 3px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{v.title}</p>
                        <div style={{ display:'flex', gap:10 }}>
                          <span style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:11, color:'rgba(255,255,255,0.35)' }}>👁 {v.views >= 1000000 ? (v.views/1000000).toFixed(1)+'M' : v.views >= 1000 ? (v.views/1000).toFixed(0)+'K' : v.views}</span>
                          <span style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:11, color:'rgba(255,255,255,0.35)' }}>⚡ {v.engagement_rate}%</span>
                          <span style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:11, color:scoreColor, fontWeight:600 }}>{v.viral_score}/10</span>
                        </div>
                        <div style={{ height:3, borderRadius:2, background:'rgba(255,255,255,0.05)', marginTop:5, overflow:'hidden' }}>
                          <div style={{ height:'100%', width:`${pct*100}%`, borderRadius:2, background:`linear-gradient(90deg,rgba(${color.glow},0.4),rgba(${color.glow},0.9))`, transition:'width 0.6s ease' }} />
                        </div>
                      </div>
                      <div style={{ display:'flex', gap:5, flexShrink:0 }}>
                        <button
                          onClick={() => setShowGenOpts(showGenOpts === v.id ? null : v.id)}
                          style={{ padding:'5px 10px', borderRadius:6, background:`rgba(${color.glow},0.1)`, border:`1px solid rgba(${color.glow},0.25)`, color:color.accent, fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:11, cursor:'pointer', letterSpacing:'0.1em' }}>
                          ⚡ ROTEIRO
                        </button>
                        <a href={`https://youtube.com/watch?v=${v.id}`} target="_blank" rel="noopener noreferrer"
                          style={{ padding:'5px 7px', borderRadius:6, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', color:'rgba(255,255,255,0.5)', textDecoration:'none', fontSize:11 }}>↗</a>
                      </div>
                    </div>
                    {showGenOpts === v.id && (
                      <div style={{ padding:'10px 12px 12px 42px', borderTop:`1px solid rgba(${color.glow},0.08)`, background:`rgba(${color.glow},0.03)`, display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                        <select value={platform} onChange={e=>setPlatform(e.target.value)} style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:6, padding:'5px 8px', color:'rgba(255,255,255,0.8)', fontSize:12, cursor:'pointer', fontFamily:'-apple-system,SF Pro Text,sans-serif' }}>
                          {PLATFORMS.map(([val,lbl]) => <option key={val} value={val} style={{ background:'#0a0a12' }}>{lbl}</option>)}
                        </select>
                        <select value={style} onChange={e=>setStyle(e.target.value)} style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:6, padding:'5px 8px', color:'rgba(255,255,255,0.8)', fontSize:12, cursor:'pointer', fontFamily:'-apple-system,SF Pro Text,sans-serif' }}>
                          {STYLES.map(([val,lbl]) => <option key={val} value={val} style={{ background:'#0a0a12' }}>{lbl}</option>)}
                        </select>
                        <button
                          onClick={() => {
                            onGenerate({
                              title: v.title,
                              description: `Vídeo do canal concorrente "${result.channel.title}" com ${v.views?.toLocaleString()} views e ${v.engagement_rate}% de engajamento. Inspire-se neste conteúdo para criar algo original.`,
                              viral_score: v.viral_score,
                              source: result.channel.title,
                              url: `https://youtube.com/watch?v=${v.id}`,
                              image: v.thumbnail,
                            }, { platform, style });
                            setShowGenOpts(null);
                          }}
                          style={{ marginLeft:'auto', padding:'6px 14px', borderRadius:6, background:`rgba(${color.glow},0.18)`, border:`1px solid rgba(${color.glow},0.45)`, color:color.accent, fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:12, fontWeight:600, cursor:'pointer', letterSpacing:'0.15em' }}>
                          GERAR →
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Análise IA */}
          <div style={{ padding:'16px 18px', borderRadius:12, background:'rgba(255,68,68,0.04)', border:'1px solid rgba(255,68,68,0.15)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom: aiAnalysis ? 14 : 0 }}>
              <span>🤖</span>
              <p style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:11, letterSpacing:'0.2em', color:'rgba(255,68,68,0.8)', margin:0, flex:1 }}>ANÁLISE DE PADRÕES COM IA</p>
              <button
                onClick={analyzeWithAI}
                disabled={aiLoading}
                style={{ padding:'6px 14px', borderRadius:8, background:aiLoading?'rgba(255,255,255,0.05)':'rgba(255,68,68,0.15)', border:'1px solid rgba(255,68,68,0.3)', color:'#ff4444', fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:11, letterSpacing:'0.1em', cursor:aiLoading?'not-allowed':'pointer', transition:'all 0.15s', whiteSpace:'nowrap' }}>
                {aiLoading ? 'ANALISANDO...' : aiAnalysis ? 'REANALISAR' : 'ANALISAR PADRÕES'}
              </button>
            </div>
            {aiAnalysis && (
              <div style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:13, color:'rgba(255,255,255,0.75)', lineHeight:1.75, fontWeight:300, whiteSpace:'pre-wrap' }}>
                {aiAnalysis}
              </div>
            )}
          </div>

          {/* Botão nova mineração */}
          <button
            onClick={() => { setResult(null); setUrl(''); setAiAnalysis(''); setError(''); }}
            style={{ padding:'10px', borderRadius:10, border:'1px solid rgba(255,255,255,0.08)', background:'rgba(255,255,255,0.03)', color:'rgba(255,255,255,0.4)', fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:13, cursor:'pointer', transition:'all 0.2s' }}>
            ← Minerar outro canal
          </button>
        </div>
      )}
    </div>
  );
}

// ─── NicheCard ────────────────────────────────────────────────────────────────
function NicheCard({ niche, onSelect, onDelete, isActive, colorIdx }) {
  const [hovered, setHovered] = useState(false);
  const color = getColor(colorIdx);
  return (
    <div onMouseEnter={()=>setHovered(true)} onMouseLeave={()=>setHovered(false)}
      style={{ position:'relative', borderRadius:16, overflow:'hidden', background:isActive?color.grad:'rgba(255,255,255,0.03)', border:`1px solid ${isActive?color.border:hovered?'rgba(255,255,255,0.12)':'rgba(255,255,255,0.06)'}`, padding:'16px 18px', cursor:'pointer', transform:hovered?'translateY(-2px)':'none', boxShadow:isActive?`0 8px 32px rgba(${color.glow},0.2)`:'none', transition:'all 0.22s ease' }}
      onClick={()=>onSelect(niche)}>
      {isActive && <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:`linear-gradient(90deg,transparent,${color.accent},transparent)` }} />}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
          <span style={{ fontSize:20, flexShrink:0 }}>{niche.icon||'🎯'}</span>
          <div style={{ minWidth:0 }}>
            <p style={{ fontFamily:'-apple-system,SF Pro Display,SF Pro Text,sans-serif', fontSize:14, fontWeight:700, color:isActive?color.accent:'rgba(255,255,255,0.85)', margin:0, letterSpacing:'-0.3px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{niche.name}</p>
            {niche.keywords?.length > 0 && <p style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:15, fontWeight:300, color:'rgba(255,255,255,0.7)', margin:'2px 0 0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{niche.keywords.slice(0,3).join(' · ')}</p>}
          </div>
        </div>
        <button onClick={e=>{e.stopPropagation();onDelete(niche.id);}}
          style={{ flexShrink:0, width:24, height:24, borderRadius:6, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.65)', cursor:'pointer', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.15s' }}
          onMouseEnter={e=>{e.currentTarget.style.background='rgba(255,80,80,0.12)';e.currentTarget.style.color='rgba(255,100,100,0.7)';}}
          onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,0.05)';e.currentTarget.style.color='rgba(255,255,255,0.65)';}}>✕</button>
      </div>
    </div>
  );
}

// ─── CreateNicheModal ─────────────────────────────────────────────────────────
function CreateNicheModal({ onSave, onClose }) {
  const [name, setName] = useState('');
  const [keywords, setKeywords] = useState('');
  const [icon, setIcon] = useState('🎯');
  const isMobile = useIsMobile();
  const ICONS = ['🎯','📈','💡','🚀','💰','🏋️','🌿','🧠','🎮','🎨','📱','🔥','⚡','🌟','🎤','🍕'];
  const save = () => name.trim() && onSave({ id:Date.now().toString(), name:name.trim(), icon, keywords:keywords.split(',').map(k=>k.trim()).filter(Boolean), createdAt:new Date().toISOString() });
  return (
    <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,0.88)', backdropFilter:'blur(24px)', display:'flex', alignItems:isMobile?'flex-end':'center', justifyContent:'center', padding:isMobile?0:24, animation:'nicheFadeIn 0.2s ease' }}>
      <div style={{ width:'100%', maxWidth:isMobile?'100%':520, background:'#0a0a12', border:'1px solid rgba(255,68,68,0.2)', borderRadius:isMobile?'20px 20px 0 0':16, overflow:'hidden', animation:'nicheSlideUp 0.3s cubic-bezier(0.34,1.1,0.64,1)', boxShadow:'0 40px 100px rgba(0,0,0,0.8)' }}>
        <div style={{ height:3, background:'linear-gradient(90deg,#8b0000,#ff4444,#cc2222)' }} />
        <div style={{ padding:isMobile?'20px 20px 32px':'28px 32px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
            <div>
              <p style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:15, letterSpacing:'0.4em', color:'rgba(255,68,68,0.5)', margin:'0 0 4px' }}>NOVO CANAL</p>
              <h2 style={{ fontFamily:'-apple-system,SF Pro Display,SF Pro Text,sans-serif', fontSize:22, fontWeight:800, color:'#fff', margin:0 }}>Criar Nicho</h2>
            </div>
            <button onClick={onClose} style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.4)', borderRadius:8, width:32, height:32, cursor:'pointer', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
          </div>
          <div style={{ marginBottom:20 }}>
            <p style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:15, letterSpacing:'0.2em', color:'rgba(255,255,255,0.7)', marginBottom:10 }}>ÍCONE</p>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {ICONS.map(ic=><button key={ic} onClick={()=>setIcon(ic)} style={{ width:40, height:40, borderRadius:10, fontSize:18, border:`1px solid ${icon===ic?'rgba(255,68,68,0.6)':'rgba(255,255,255,0.08)'}`, background:icon===ic?'rgba(255,68,68,0.15)':'rgba(255,255,255,0.03)', cursor:'pointer', transition:'all 0.15s' }}>{ic}</button>)}
            </div>
          </div>
          <div style={{ marginBottom:16 }}>
            <p style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:15, letterSpacing:'0.2em', color:'rgba(255,255,255,0.7)', marginBottom:8 }}>NOME DO NICHO *</p>
            <input type="text" placeholder="ex: Marketing Digital, Finanças Pessoais..." value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&save()} autoFocus
              style={{ width:'100%', background:'rgba(255,255,255,0.04)', border:`1px solid ${name?'rgba(255,68,68,0.35)':'rgba(255,255,255,0.08)'}`, borderRadius:10, padding:'11px 14px', fontSize:14, color:'#fff', fontFamily:'-apple-system,SF Pro Text,sans-serif', outline:'none', transition:'border-color 0.2s' }} />
          </div>
          <div style={{ marginBottom:28 }}>
            <p style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:15, letterSpacing:'0.2em', color:'rgba(255,255,255,0.7)', marginBottom:8 }}>PALAVRAS-CHAVE (separadas por vírgula)</p>
            <input type="text" placeholder="ex: tráfego pago, funil de vendas, copywriting..." value={keywords} onChange={e=>setKeywords(e.target.value)}
              style={{ width:'100%', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:10, padding:'11px 14px', fontSize:15, color:'rgba(255,255,255,0.8)', fontFamily:'-apple-system,SF Pro Text,sans-serif', fontWeight:300, outline:'none' }} />
            <p style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:14, color:'rgba(255,255,255,0.6)', margin:'6px 0 0', fontWeight:300 }}>Usadas para buscar notícias, artigos e livros do seu nicho</p>
          </div>
          <button onClick={save} disabled={!name.trim()}
            style={{ width:'100%', padding:'13px', borderRadius:10, background:name.trim()?'linear-gradient(135deg,#cc2222 0%,#ff4444 100%)':'rgba(255,255,255,0.06)', border:'none', color:name.trim()?'#fff':'rgba(255,255,255,0.6)', fontFamily:'-apple-system,SF Pro Display,SF Pro Text,sans-serif', fontSize:14, fontWeight:700, letterSpacing:'0.03em', cursor:name.trim()?'pointer':'not-allowed', boxShadow:name.trim()?'0 4px 24px rgba(255,68,68,0.35)':'none', transition:'all 0.2s' }}>
            {icon} Criar Nicho
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── NicheWorld Principal ─────────────────────────────────────────────────────

function HistoriaNicheCard({ activeNiche, color, isMobile }) {
  const [historia, setHistoria] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [historico, setHistorico] = useState(() => {
    try { return JSON.parse(localStorage.getItem('vn_historico_' + activeNiche?.id) || '[]'); } catch { return []; }
  });

  const tema = activeNiche?.keywords?.slice(0,3).join(', ') || activeNiche?.name || 'história mundial';
  const accent = color?.accent || '#ff4444';
  const glow = color?.glow || '255,68,68';

  const buscar = async () => {
    setLoading(true); setError(null); setHistoria(null);
    try {
      const seed = Math.random().toString(36).slice(2,8);
      const res = await fetch('/api/historia-nicho', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tema, seed, historico: historico.slice(-20) })
      });
      const data = await res.json();
      if (data.success) {
        setHistoria(data.historia);
        const novo = [...historico, data.historia.titulo].slice(-30);
        setHistorico(novo);
        try { localStorage.setItem('vn_historico_' + activeNiche?.id, JSON.stringify(novo)); } catch {}
      }
      else setError(data.error || 'Erro ao buscar história');
    } catch(e) { setError('Erro de conexão'); }
    finally { setLoading(false); }
  };

  const copiar = () => {
    if (!historia) return;
    navigator.clipboard?.writeText(historia.narrativa);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ marginBottom: 28, borderRadius: 16, border: `1px solid rgba(${glow},0.18)`, background: `rgba(${glow},0.03)`, overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: `1px solid rgba(${glow},0.1)`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: accent, boxShadow: `0 0 8px ${accent}` }} />
          <span style={{ fontFamily: '-apple-system,SF Pro Display,sans-serif', fontSize: 15, fontWeight: 700, color: '#fff' }}>História Real do Nicho</span>
          <span style={{ fontFamily: 'Space Mono,monospace', fontSize: 8, letterSpacing: '0.2em', color: `rgba(${glow},0.5)`, background: `rgba(${glow},0.08)`, padding: '3px 8px', borderRadius: 4 }}>FATOS REAIS · COM FONTE</span>
        </div>
        <button onClick={buscar} disabled={loading} style={{ fontFamily: 'Space Mono,monospace', fontSize: 9, letterSpacing: '0.18em', color: loading ? `rgba(${glow},0.3)` : '#fff', background: loading ? `rgba(${glow},0.08)` : `linear-gradient(135deg,${accent} 0%,rgba(${glow},0.7) 100%)`, border: 'none', borderRadius: 8, padding: '8px 18px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 700 }}>
          {loading ? 'GERANDO...' : historia ? '↺ NOVA HISTÓRIA' : '▶ GERAR'}
        </button>
      </div>
      {!historia && !loading && !error && (
        <div style={{ padding: '28px 20px', textAlign: 'center' }}>
          <p style={{ fontFamily: '-apple-system,sans-serif', fontSize: 13, color: 'rgba(255,255,255,0.25)', margin: 0 }}>A IA busca um fato real sobre <strong style={{ color: `rgba(${glow},0.5)` }}>{tema}</strong> no estilo storytelling viral.</p>
        </div>
      )}
      {loading && (
        <div style={{ padding: '28px 20px', textAlign: 'center' }}>
          <p style={{ fontFamily: '-apple-system,sans-serif', fontSize: 13, color: 'rgba(255,255,255,0.3)', margin: 0 }}>Buscando fato real sobre {tema}...</p>
        </div>
      )}
      {error && <div style={{ padding: '16px 20px' }}><p style={{ color: 'rgba(255,100,100,0.8)', fontSize: 13, margin: 0 }}>{error}</p></div>}
      {historia && (
        <div style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: '-apple-system,SF Pro Display,sans-serif', fontSize: 15, fontWeight: 700, color: accent }}>{historia.titulo}</span>
            <span style={{ fontFamily: 'Space Mono,monospace', fontSize: 9, color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 4 }}>{historia.periodo}</span>
          </div>
          <p style={{ fontFamily: '-apple-system,sans-serif', fontSize: isMobile ? 13 : 14, color: 'rgba(255,255,255,0.82)', lineHeight: 1.85, fontWeight: 300, whiteSpace: 'pre-wrap', margin: '0 0 16px' }}>{historia.narrativa}</p>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {historia.wikipedia && <a href={historia.wikipedia} target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'Space Mono,monospace', fontSize: 10, color: `rgba(${glow},0.7)`, textDecoration: 'none' }}>🔗 Wikipedia</a>}
              {historia.fonte_adicional && <span style={{ fontFamily: '-apple-system,sans-serif', fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>+ {historia.fonte_adicional}</span>}
            </div>
            <button onClick={copiar} style={{ fontFamily: '-apple-system,sans-serif', fontSize: 12, color: copied ? '#00e5b0' : `rgba(${glow},0.75)`, background: 'transparent', border: `1px solid ${copied ? 'rgba(0,229,176,0.3)' : `rgba(${glow},0.15)`}`, borderRadius: 6, padding: '6px 16px', cursor: 'pointer' }}>
              {copied ? '✓ Copiado' : 'Copiar roteiro'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function NicheWorld() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const generator = useScriptGenerator();

  const [niches, setNiches] = useState(() => loadNiches());
  const [activeNiche, setActiveNiche] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [activeSection, setActiveSection] = useState('all');
  const [data, setData] = useState({ news:[], reddit:[], articles:[], books:[] });
  const [loading, setLoading] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [selected, setSelected] = useState(null);
  const [ytData, setYtData] = useState(null);
  const [showAnalytics, setShowAnalytics] = useState(true);
  const [showApiModal, setShowApiModal] = useState(false);
  const tickerH = 42; // ticker do App.jsx sempre visivel
  const [apiKey, setApiKey] = useState('');
  const [channelId, setChannelId] = useState('');
  const [showApiHelp, setShowApiHelp] = useState(false);
  const [helpMessages, setHelpMessages] = useState([]);
  const [helpInput, setHelpInput] = useState('');
  const [helpLoading, setHelpLoading] = useState(false);

  useEffect(() => {
    if (niches.length > 0 && !activeNiche) setActiveNiche(niches[0]);
    if (activeNiche && !niches.find(n=>n.id===activeNiche.id)) setActiveNiche(niches[0]||null);
  }, [niches]);

  const activeIdx = niches.findIndex(n=>n.id===activeNiche?.id);
  const color = { accent:'#ff4444', glow:'255,68,68', bg:'#1e0a0a', grad:'linear-gradient(160deg,#1e0a0a 0%,#2d0f0f 60%,#160707 100%)', border:'rgba(255,68,68,0.6)' };

  const fetchAll = useCallback(async (niche, customQuery) => {
    if (!niche) return;
    setLoading(true);
    setData({ news:[], reddit:[], articles:[], books:[] });
    try {
      const q = customQuery || niche.keywords?.slice(0,3).join(' ') || niche.name;
      const res = await fetch(`/api/niche?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error('niche api error');
      const json = await res.json();
      setData({ news:json.news||[], reddit:json.reddit||[], articles:json.articles||[], books:json.books||[] });
    } catch(e) {
      try {
        const q = customQuery || niche.keywords?.slice(0,3).join(' ') || niche.name;
        const r = await fetch(`/api/news?category=general&source=br&q=${encodeURIComponent(q)}`);
        const d = await r.json();
        setData({ news:(d.articles||d).slice(0,12), reddit:[], articles:[], books:[] });
      } catch {}
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!activeNiche) return;
    const _cached = (() => { try { return JSON.parse(localStorage.getItem('vn_yt_data_'+activeNiche.id)||'null'); } catch { return null; } })();
    setYtData(_cached);
    const _handle = localStorage.getItem('vn_yt_handle_' + activeNiche.id) || '';
    if (_handle) {
      const token = localStorage.getItem('autor_token');
      fetch('/api/youtube/canal?handle=' + encodeURIComponent(_handle), { headers:{ Authorization:'Bearer '+token } })
        .then(r=>r.json()).then(d=>{ setYtData(d); try { localStorage.setItem('vn_yt_data_'+activeNiche.id, JSON.stringify(d)); } catch {} }).catch(()=>{});
    }
  }, [activeNiche?.id]);

  useEffect(() => {
    if (activeNiche) fetchAll(activeNiche, '');
  }, [activeNiche?.id]);

  useEffect(() => {
    if (!activeNiche) return;
    setChannelId(localStorage.getItem('vn_yt_handle_' + activeNiche.id) || '');
  }, [activeNiche?.id]);

  const handleCreate = (niche) => {
    const updated = [...niches, niche];
    setNiches(updated); saveNiches(updated); setActiveNiche(niche); setShowCreate(false);
  };
  const handleDelete = (id) => {
    const updated = niches.filter(n=>n.id!==id);
    setNiches(updated); saveNiches(updated);
  };
  const handleGenerate = (item, opts) => {
    setSelected(item); generator.reset(); generator.generate(item, opts);
  };
  const handleSearch = (e) => {
    e.preventDefault();
    if (activeNiche) fetchAll(activeNiche, searchInput || activeNiche.keywords?.join(' ') || activeNiche.name);
  };

  const totalItems = data.news.length + data.reddit.length + data.articles.length + data.books.length;
  const sectionsToShow = activeSection === 'all' ? SECTIONS : SECTIONS.filter(s=>s.id===activeSection);

  const handleConectar = () => {
    const handle = channelId.replace(/^@/,'').trim();
    if (activeNiche && handle) {
      localStorage.setItem('vn_yt_handle_' + activeNiche.id, handle);
      setShowApiModal(false);
      const token = localStorage.getItem('autor_token');
      fetch('/api/youtube/canal?handle=' + encodeURIComponent(handle), { headers: { Authorization: 'Bearer ' + token } })
        .then(r => r.json()).then(d => { setYtData(d); try { localStorage.setItem('vn_yt_data_' + activeNiche.id, JSON.stringify(d)); } catch {} }).catch(() => {});
    } else {
      setShowApiModal(false);
    }
  };

  return (
    <div style={{ minHeight:'100vh', background:'#07070f', color:'#fff', fontFamily:'-apple-system,SF Pro Text,sans-serif' }}>
      <style dangerouslySetInnerHTML={{ __html:`
        *,*::before,*::after{box-sizing:border-box;}
        @keyframes nicheFadeIn{from{opacity:0;}to{opacity:1;}}
        @keyframes nicheSlideUp{from{opacity:0;transform:translateY(40px) scale(0.98);}to{opacity:1;transform:translateY(0) scale(1);}}
        @keyframes nichePulse{0%,100%{opacity:1;transform:scale(1);}50%{opacity:0.3;transform:scale(0.8);}}
        @keyframes nicheShimmer{0%{background-position:200% 0;}100%{background-position:-200% 0;}}
        @keyframes apiKeyPulse{0%,100%{box-shadow:0 0 0 0 rgba(255,50,50,0.5);}50%{box-shadow:0 0 0 8px rgba(255,50,50,0);}}
        input::placeholder{color:rgba(255,255,255,0.6);}
        input:focus{outline:none;}
        ::-webkit-scrollbar{width:3px;}
        ::-webkit-scrollbar-thumb{background:rgba(255,68,68,0.2);border-radius:2px;}
      `}} />

      <div style={{ position:'fixed', inset:0, zIndex:0, pointerEvents:'none', background:`radial-gradient(ellipse at 20% 0%,rgba(${color.glow},0.08) 0%,transparent 50%),radial-gradient(ellipse at 80% 100%,rgba(${color.glow},0.05) 0%,transparent 50%)`, transition:'background 0.6s ease' }} />
      <div style={{ position:'fixed', top:0, left:0, right:0, height:3, background:`linear-gradient(90deg,transparent,${color.accent},transparent)`, zIndex:200, opacity:0.7, transition:'background 0.4s' }} />

      <header style={{ position:'fixed', top:tickerH, left:0, right:0, zIndex:150, height:56, display:'flex', alignItems:'center', justifyContent:'space-between', padding:isMobile?'0 16px':'0 24px', background:'rgba(7,7,15,0.88)', backdropFilter:'blur(32px)', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <button onClick={()=>navigate('/')} style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:isMobile?11:15, letterSpacing:'0.15em', color:'rgba(255,255,255,0.38)', background:'none', border:'none', cursor:'pointer', padding:0 }}>← PORTAL</button>
          <span style={{ color:'rgba(255,255,255,0.1)' }}>|</span>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background:color.accent, boxShadow:`0 0 10px rgba(${color.glow},0.9)`, animation:'nichePulse 2.5s ease-in-out infinite', transition:'background 0.4s' }} />
            <span style={{ fontFamily:'-apple-system,SF Pro Display,SF Pro Text,sans-serif', fontSize:isMobile?13:18, fontWeight:800, color:'#fff', letterSpacing:'-0.5px' }}>Meu Canal</span>
          </div>
        </div>
        <button onClick={()=>setShowCreate(true)} style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 16px', borderRadius:10, background:`rgba(${color.glow},0.12)`, border:`1px solid rgba(${color.glow},0.3)`, color:color.accent, fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:isMobile?11:15, letterSpacing:'0.12em', cursor:'pointer', transition:'all 0.2s' }}
          onMouseEnter={e=>{e.currentTarget.style.background=`rgba(${color.glow},0.2)`;}}
          onMouseLeave={e=>{e.currentTarget.style.background=`rgba(${color.glow},0.12)`;}}>
          + NOVO NICHO
        </button>
      </header>

      <div style={{ display:'flex', minHeight:`calc(100vh - ${tickerH+56}px)`, position:'relative', zIndex:5, overflowX:'hidden', width:'100%', paddingTop:`${tickerH+56}px` }}>

        {!isMobile && (
          <aside style={{ width:260, flexShrink:0, borderRight:'1px solid rgba(255,255,255,0.05)', padding:'20px 16px', background:'rgba(7,7,15,0.6)', backdropFilter:'blur(20px)', position:'sticky', top:tickerH+56, height:`calc(100vh - ${tickerH+56}px)`, overflowY:'auto', display:'flex', flexDirection:'column' }}>
            {/* ── Meus Nichos ── */}
            <p style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:9, letterSpacing:'0.35em', color:'rgba(255,255,255,0.35)', marginBottom:10 }}>MEUS NICHOS ({niches.length})</p>
            {niches.length === 0 ? (
              <div style={{ textAlign:'center', padding:'24px 0' }}>
                <span style={{ fontSize:28, opacity:0.2 }}>🎯</span>
                <p style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:12, color:'rgba(255,255,255,0.4)', margin:'8px 0 0', fontWeight:300 }}>Nenhum nicho criado</p>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {niches.map((n,i)=><NicheCard key={n.id} niche={n} colorIdx={i} isActive={activeNiche?.id===n.id} onSelect={setActiveNiche} onDelete={handleDelete} />)}
              </div>
            )}
            <button onClick={()=>setShowCreate(true)} style={{ width:'100%', marginTop:12, padding:'8px', borderRadius:8, border:`1px dashed rgba(${color.glow},0.25)`, background:'transparent', color:`rgba(${color.glow},0.5)`, fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:12, cursor:'pointer', transition:'all 0.2s' }}
              onMouseEnter={e=>{e.currentTarget.style.background=`rgba(${color.glow},0.06)`;}}
              onMouseLeave={e=>{e.currentTarget.style.background='transparent';}}>
              + Criar novo nicho
            </button>


            {/* ── Canal de referência ── */}
            {(() => {
              try {
                const last = JSON.parse(localStorage.getItem('vn_my_channel') || 'null');
                if (!last) return null;
                return (
                  <div style={{ marginTop:20, borderTop:'1px solid rgba(255,255,255,0.05)', paddingTop:16 }}>
                    <p style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:9, letterSpacing:'0.35em', color:'rgba(255,255,255,0.35)', marginBottom:10 }}>REFERÊNCIA ATIVA</p>
                    <div style={{ padding:'10px 12px', borderRadius:10, background:`rgba(${color.glow},0.05)`, border:`1px solid rgba(${color.glow},0.12)` }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                        {last.thumbnail && <img src={last.thumbnail} alt="" style={{ width:28, height:28, borderRadius:'50%', objectFit:'cover' }} />}
                        <p style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:13, fontWeight:600, color:'#fff', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{last.title}</p>
                      </div>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4 }}>
                        <div style={{ padding:'5px 8px', borderRadius:6, background:'rgba(255,255,255,0.04)' }}>
                          <p style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:9, color:'rgba(255,255,255,0.35)', margin:'0 0 2px', letterSpacing:'0.1em' }}>INSCRITOS</p>
                          <p style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:13, fontWeight:700, color:color.accent, margin:0 }}>{fmt(last.subscribers)}</p>
                        </div>
                        <div style={{ padding:'5px 8px', borderRadius:6, background:'rgba(255,255,255,0.04)' }}>
                          <p style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:9, color:'rgba(255,255,255,0.35)', margin:'0 0 2px', letterSpacing:'0.1em' }}>VÍDEOS</p>
                          <p style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:13, fontWeight:700, color:color.accent, margin:0 }}>{fmt(last.videoCount)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              } catch { return null; }
            })()}

            {/* ── Último roteiro ── */}
            {(() => {
              try {
                const hist = JSON.parse(localStorage.getItem('vn_script_history') || '[]');
                const last = hist[0];
                if (!last) return null;
                return (
                  <div style={{ marginTop:16, borderTop:'1px solid rgba(255,255,255,0.05)', paddingTop:16 }}>
                    <p style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:9, letterSpacing:'0.35em', color:'rgba(255,255,255,0.35)', marginBottom:10 }}>ÚLTIMO ROTEIRO</p>
                    <div style={{ padding:'10px 12px', borderRadius:10, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)' }}>
                      <p style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:12, fontWeight:500, color:'rgba(255,255,255,0.75)', margin:'0 0 4px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{last.title}</p>
                      <p style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:10, color:'rgba(255,255,255,0.3)', margin:0, fontWeight:300 }}>{last.createdAt ? new Date(last.createdAt).toLocaleDateString('pt-BR') : ''}</p>
                    </div>
                  </div>
                );
              } catch { return null; }
            })()}

            {/* ── Atalhos ── */}
            <div style={{ marginTop:'auto', paddingTop:20, borderTop:'1px solid rgba(255,255,255,0.05)' }}>
              <p style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:9, letterSpacing:'0.35em', color:'rgba(255,255,255,0.35)', marginBottom:10 }}>MUNDOS</p>
              <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                {[['📡','Notícias','/news'],['🔬','Ciência','/science'],['📚','Livros','/books']].map(([icon,label,path])=>(
                  <button key={path} onClick={()=>navigate(path)} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.5)', fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:12, cursor:'pointer', textAlign:'left', transition:'all 0.15s' }}
                    onMouseEnter={e=>{e.currentTarget.style.background='rgba(255,255,255,0.06)'; e.currentTarget.style.color='rgba(255,255,255,0.8)';}}
                    onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,0.03)'; e.currentTarget.style.color='rgba(255,255,255,0.5)';}}>
                    <span style={{ fontSize:14 }}>{icon}</span> {label}
                  </button>
                ))}
              </div>
            </div>
          </aside>
        )}

        <main style={{ flex:1, minWidth:0, overflowX:'hidden', overflowY:'auto', paddingTop:0 }}>

          {isMobile && niches.length > 0 && (
            <div style={{ display:'flex', gap:10, overflowX:'auto', padding:'14px 16px', borderBottom:'1px solid rgba(255,255,255,0.05)', scrollbarWidth:'none' }}>
              {niches.map((n,i)=>(
                <button key={n.id} onClick={()=>setActiveNiche(n)} style={{ flexShrink:0, display:'flex', alignItems:'center', gap:7, padding:'7px 14px', borderRadius:20, border:`1px solid ${activeNiche?.id===n.id?getColor(i).border:'rgba(255,255,255,0.08)'}`, background:activeNiche?.id===n.id?`rgba(${getColor(i).glow},0.15)`:'rgba(255,255,255,0.04)', color:activeNiche?.id===n.id?getColor(i).accent:'rgba(255,255,255,0.5)', fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:15, fontWeight:500, cursor:'pointer', transition:'all 0.2s', whiteSpace:'nowrap' }}>
                  <span>{n.icon}</span><span>{n.name}</span>
                </button>
              ))}
            </div>
          )}

          {!activeNiche ? (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'70vh', padding:'40px 24px', textAlign:'center' }}>
              <div style={{ width:80, height:80, borderRadius:'50%', marginBottom:24, background:`rgba(${color.glow},0.1)`, border:`1px solid rgba(${color.glow},0.2)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:36 }}>🎯</div>
              <p style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:15, letterSpacing:'0.5em', color:`rgba(${color.glow},0.5)`, marginBottom:12 }}>MEU CANAL</p>
              <h1 style={{ fontFamily:'-apple-system,SF Pro Display,SF Pro Text,sans-serif', fontSize:'clamp(28px,5vw,44px)', fontWeight:800, margin:'0 0 12px', lineHeight:1, letterSpacing:'-1.5px', background:'linear-gradient(90deg,#fff 0%,rgba(255,255,255,0.5) 100%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>Crie seu nicho</h1>
              <p style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:14, color:'rgba(255,255,255,0.4)', margin:'0 0 32px', fontWeight:300, maxWidth:440 }}>Defina seu nicho e receba notícias, discussões, artigos e livros — tudo para gerar roteiros virais.</p>
              <button onClick={()=>setShowCreate(true)} style={{ padding:'14px 32px', borderRadius:12, background:'linear-gradient(135deg,#cc2222 0%,#ff4444 100%)', border:'none', color:'#fff', fontFamily:'-apple-system,SF Pro Display,SF Pro Text,sans-serif', fontSize:15, fontWeight:700, cursor:'pointer', boxShadow:'0 8px 32px rgba(255,68,68,0.35)', letterSpacing:'0.02em' }}>
                🎯 Criar Meu Primeiro Nicho
              </button>
            </div>
          ) : (
            <>
              <div style={{ padding:isMobile?'20px 16px 16px':'32px 28px 20px', paddingTop:isMobile?'20px':'24px', borderBottom:'1px solid rgba(255,255,255,0.05)', position:'relative', background:`linear-gradient(180deg,rgba(${color.glow},0.05) 0%,transparent 100%)`, transition:'background 0.5s ease' }}>
                <p style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:15, letterSpacing:'0.45em', color:`rgba(${color.glow},0.6)`, marginBottom:8 }}>MEU CANAL</p>
                <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:8 }}>
                  <span style={{ fontSize:28 }}>{activeNiche.icon||'🎯'}</span>
                  <h1 style={{ fontFamily:'-apple-system,SF Pro Display,SF Pro Text,sans-serif', fontSize:isMobile?18:'clamp(26px,3.5vw,40px)', fontWeight:800, margin:0, lineHeight:1.2, letterSpacing:'-0.5px', color:'#fff', wordBreak:'break-word' }}>{activeNiche.name}</h1>
                </div>
                {activeNiche.keywords?.length > 0 && (
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:16 }}>
                    {activeNiche.keywords.map((kw,i)=><span key={i} style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:14, color:`rgba(${color.glow},0.7)`, background:`rgba(${color.glow},0.1)`, border:`1px solid rgba(${color.glow},0.2)`, padding:'3px 10px', borderRadius:20 }}>{kw}</span>)}
                  </div>
                )}
                {/* Botão Chave API */}
                {(() => {
                  const hasKey = !!(activeNiche && localStorage.getItem('vn_yt_handle_' + activeNiche.id));
                  return (
                    <div style={{ position:'absolute', top:52, right:isMobile?16:28 }}>
                      <button onClick={()=>setShowApiModal(true)} style={{
                        display:'flex', alignItems:'center', gap:6,
                        padding:'6px 14px', borderRadius:20,
                        background: hasKey ? 'rgba(0,229,176,0.08)' : 'rgba(255,50,50,0.08)',
                        border: hasKey ? '1px solid rgba(0,229,176,0.3)' : '1px solid rgba(255,50,50,0.4)',
                        color: hasKey ? '#00e5b0' : '#ff5555',
                        fontFamily:'Space Mono,monospace', fontSize:10,
                        letterSpacing:'0.1em', cursor:'pointer',
                        animation: hasKey ? 'none' : 'apiKeyPulse 1.5s ease-in-out infinite',
                        boxShadow: hasKey ? 'none' : '0 0 0 0 rgba(255,50,50,0.4)',
                      }}>
                        {hasKey
                          ? <><span style={{ width:6, height:6, borderRadius:'50%', background:'#00e5b0', display:'inline-block', boxShadow:'0 0 6px #00e5b0' }} /> CANAL CONECTADO</>
                          : <><span style={{ width:6, height:6, borderRadius:'50%', background:'#ff5555', display:'inline-block' }} /> MEU CANAL</>
                        }
                      </button>
                    </div>
                  );
                })()}
                <form onSubmit={handleSearch} style={{ display:isMobile?'none':'flex', flexDirection:'row', gap:8, maxWidth:520 }}>
                  <div style={{ position:'relative', flex:1 }}>
                    <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', fontSize:14, color:'rgba(255,255,255,0.6)', pointerEvents:'none' }}>⌕</span>
                    <input type="text" placeholder={`Buscar em ${activeNiche.name}...`} value={searchInput} onChange={e=>setSearchInput(e.target.value)}
                      style={{ width:'100%', background:'rgba(255,255,255,0.04)', border:`1px solid rgba(${color.glow},0.15)`, borderRadius:10, padding:'9px 14px 9px 36px', fontSize:15, color:'#fff', fontFamily:'-apple-system,SF Pro Text,sans-serif', fontWeight:300, transition:'border-color 0.2s' }}
                      onFocus={e=>{e.target.style.borderColor=`rgba(${color.glow},0.4)`;}}
                      onBlur={e=>{e.target.style.borderColor=`rgba(${color.glow},0.15)`;}} />
                  </div>
                  <button type="submit" style={{ padding:'9px 18px', borderRadius:10, background:`rgba(${color.glow},0.15)`, border:`1px solid rgba(${color.glow},0.35)`, color:color.accent, fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:15, letterSpacing:'0.15em', cursor:'pointer', transition:'all 0.2s', flexShrink:0 }}>BUSCAR</button>
                  <button type="button" onClick={()=>fetchAll(activeNiche,'')} style={{ padding:'9px 14px', borderRadius:10, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.4)', fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:15, cursor:'pointer', flexShrink:0 }} title="Atualizar">↻</button>
                </form>
              </div>


              {/* Analytics YouTube */}
              {ytData?.channel && (
                <div>
                  <div onClick={()=>setShowAnalytics(o=>!o)} style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 20px', cursor:'pointer', borderBottom:'1px solid rgba(255,255,255,0.04)', background:'rgba(255,50,50,0.03)' }}>
                    <span style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:15, letterSpacing:'0.2em', color:'rgba(255,80,80,0.7)' }}>📊 ANALYTICS DO CANAL</span>
                    <div style={{ flex:1 }} />
                    <img src={ytData.channel.thumbnail} alt="" style={{ width:24, height:24, borderRadius:'50%', border:'1px solid rgba(255,50,50,0.3)' }} />
                    <span style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:15, color:'rgba(255,255,255,0.7)' }}>{showAnalytics?'▲ recolher':'▼ expandir'}</span>
                  </div>
                  {showAnalytics && <YoutubeAnalytics ytData={ytData} color={color} onGenerate={handleGenerate} />}
                </div>
              )}

              {/* Filtro de seções */}
              <div style={{ padding:'12px 28px', borderBottom:'1px solid rgba(255,255,255,0.04)', display:'flex', gap:8, overflowX:'auto', scrollbarWidth:'none', background:'rgba(7,7,15,0.5)', backdropFilter:'blur(16px)', position:'sticky', top:tickerH+56, zIndex:40 }}>
                <button onClick={()=>setActiveSection('all')} style={{ padding:'6px 16px', borderRadius:20, border:activeSection==='all'?`1px solid rgba(${color.glow},0.6)`:'1px solid rgba(255,255,255,0.08)', background:activeSection==='all'?`rgba(${color.glow},0.15)`:'rgba(255,255,255,0.04)', color:activeSection==='all'?color.accent:'rgba(255,255,255,0.45)', fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:15, fontWeight:500, cursor:'pointer', whiteSpace:'nowrap', transition:'all 0.18s', flexShrink:0 }}>
                  Tudo {!loading&&totalItems>0?`(${totalItems})`:''}
                </button>
                {SECTIONS.map(s=>(
                  <button key={s.id} onClick={()=>setActiveSection(s.id)} style={{ padding:'6px 16px', borderRadius:20, border:activeSection===s.id?`1px solid rgba(${color.glow},0.6)`:'1px solid rgba(255,255,255,0.08)', background:activeSection===s.id?`rgba(${color.glow},0.15)`:'rgba(255,255,255,0.04)', color:activeSection===s.id?color.accent:'rgba(255,255,255,0.45)', fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:15, fontWeight:500, cursor:'pointer', whiteSpace:'nowrap', transition:'all 0.18s', flexShrink:0, display:'flex', alignItems:'center', gap:6 }}>
                    <span>{s.icon}</span><span>{s.label}</span>
                    {!loading&&data[s.id]?.length>0&&<span style={{ fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:15, color:`rgba(${color.glow},0.55)` }}>({data[s.id].length})</span>}
                  </button>
                ))}
                <button onClick={()=>setActiveSection('mining')} style={{ padding:'6px 16px', borderRadius:20, border:activeSection==='mining'?`1px solid rgba(${color.glow},0.6)`:'1px solid rgba(255,255,255,0.08)', background:activeSection==='mining'?`rgba(${color.glow},0.15)`:'rgba(255,255,255,0.04)', color:activeSection==='mining'?color.accent:'rgba(255,255,255,0.45)', fontFamily:'-apple-system,SF Pro Text,sans-serif', fontSize:15, fontWeight:500, cursor:'pointer', whiteSpace:'nowrap', transition:'all 0.18s', flexShrink:0, display:'flex', alignItems:'center', gap:6 }}>
                  <span>🔍</span><span>Mineração</span>
                </button>
              </div>

              <div style={{ padding:isMobile?'24px 16px 80px':'28px 28px 100px' }}>
                {activeSection === 'mining'
                  ? <ChannelMiner color={color} onGenerate={handleGenerate} />
                  : (<>
                    <HistoriaNicheCard activeNiche={activeNiche} color={color} isMobile={isMobile} />
                    {sectionsToShow.map(section=>(
                    <ContentSection key={section.id} section={section} items={data[section.id]||[]} loading={loading} color={color} onGenerate={handleGenerate} isMobile={isMobile} />
                  ))}
                    </>
                  )
                }
              </div>
            </>
          )}
        </main>
      </div>

      {showCreate && <CreateNicheModal onSave={handleCreate} onClose={()=>setShowCreate(false)} />}
      {selected && <ScriptModal article={selected} generator={generator} onClose={()=>setSelected(null)} onGenerate={opts=>generator.generate(selected,opts)} />}
      {showApiModal && (
        <div style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,0.85)', backdropFilter:'blur(12px)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ width:'100%', maxWidth:440, background:'#120a0a', border:'1px solid rgba(255,50,50,0.25)', borderRadius:16, padding:28, display:'flex', flexDirection:'column', gap:20 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <p style={{ fontFamily:'Syne,sans-serif', fontSize:16, fontWeight:700, color:'#fff', margin:0 }}>📡 Conectar canal YouTube</p>
              <button onClick={()=>setShowApiModal(false)} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.4)', fontSize:22, cursor:'pointer', lineHeight:1 }}>×</button>
            </div>

            <div style={{ background:'rgba(255,50,50,0.05)', border:'1px solid rgba(255,50,50,0.15)', borderRadius:10, padding:'14px 16px' }}>
              <p style={{ fontFamily:'-apple-system,sans-serif', fontSize:12, color:'rgba(255,100,100,0.7)', margin:'0 0 4px', fontWeight:500 }}>Sem chaves. Sem complicação.</p>
              <p style={{ fontFamily:'-apple-system,sans-serif', fontSize:12, color:'rgba(255,255,255,0.35)', margin:0, lineHeight:1.5 }}>Digite o @ do seu canal e o Autor.ai busca os dados usando nossa integração. Seus dados ficam só no seu navegador.</p>
            </div>

            <div>
              <p style={{ fontFamily:'-apple-system,sans-serif', fontSize:11, color:'rgba(255,255,255,0.4)', margin:'0 0 8px', letterSpacing:'0.1em' }}>HANDLE DO CANAL</p>
              <div style={{ display:'flex', alignItems:'center', gap:0, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,50,50,0.25)', borderRadius:8, overflow:'hidden' }}>
                <span style={{ padding:'10px 12px', fontFamily:'Space Mono,monospace', fontSize:14, color:'rgba(255,80,80,0.6)', background:'rgba(255,50,50,0.08)', borderRight:'1px solid rgba(255,50,50,0.15)' }}>@</span>
                <input value={channelId.replace(/^@/,'')} onChange={e=>setChannelId(e.target.value)} placeholder="seucanal" style={{ flex:1, padding:'10px 14px', background:'transparent', border:'none', color:'#fff', fontFamily:'Space Mono,monospace', fontSize:13, outline:'none' }} />
              </div>
              <p style={{ fontFamily:'-apple-system,sans-serif', fontSize:11, color:'rgba(255,255,255,0.25)', margin:'6px 0 0' }}>Ex: @MrBeast, @nomedoseucanal</p>
            </div>

            <div style={{ display:'flex', gap:10 }}>
              <button onClick={()=>setShowApiModal(false)} style={{ flex:1, padding:'10px', borderRadius:8, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.5)', fontFamily:'-apple-system,sans-serif', fontSize:13, cursor:'pointer' }}>Cancelar</button>
              <button onClick={handleConectar} style={{ flex:2, padding:'10px', borderRadius:8, background:'rgba(255,50,50,0.15)', border:'1px solid rgba(255,50,50,0.4)', color:'#ff6b6b', fontFamily:'-apple-system,sans-serif', fontSize:13, fontWeight:600, cursor:'pointer' }}>Conectar canal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
