/**
 * VideoWorld.jsx — Novelinha Viral · Gerador de Novelinhas
 * Padrão visual idêntico ao WorldPortal (Syne · DM Sans · Space Mono · dark theme)
 */

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

if (typeof document !== 'undefined' && !document.getElementById('vw-fonts')) {
  const l = document.createElement('link');
  l.id = 'vw-fonts'; l.rel = 'stylesheet';
  l.href = 'https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&family=Space+Mono:wght@400;700&display=swap';
  document.head.appendChild(l);
}

const ACCENT = '#a78bfa';
const GLOW   = '167,139,250';

const NICHOS = [
  { id:'gut',       emoji:'🦠', label:'Saúde Intestinal', hint:'digestão, flora, inchaço' },
  { id:'immunity',  emoji:'🛡️', label:'Imunidade',        hint:'defesas, vírus, gripe' },
  { id:'brain',     emoji:'🧠', label:'Foco & Mente',     hint:'memória, concentração' },
  { id:'weight',    emoji:'🔥', label:'Emagrecimento',    hint:'gordura, metabolismo' },
  { id:'heart',     emoji:'❤️', label:'Coração',          hint:'circulação, colesterol' },
  { id:'energy',    emoji:'⚡', label:'Energia',          hint:'cansaço, disposição' },
  { id:'sleep',     emoji:'🌙', label:'Sono',             hint:'insônia, descanso' },
  { id:'skin',      emoji:'✨', label:'Pele & Beleza',    hint:'colágeno, antioxidantes' },
  { id:'muscle',    emoji:'💪', label:'Músculos',         hint:'recuperação, força' },
  { id:'stress',    emoji:'🧘', label:'Estresse',         hint:'ansiedade, cortisol' },
  { id:'kids',      emoji:'👦', label:'Saúde Infantil',   hint:'crescimento, vitaminas' },
  { id:'custom',    emoji:'🎯', label:'Outro tema...',    hint:'livre' },
];

const DURACOES = [
  { id:30, label:'30 seg', scenes:4 },
  { id:45, label:'45 seg', scenes:6 },
  { id:60, label:'1 minuto', scenes:8 },
];

const ESTILOS = [
  { id:'pixar_body', label:'Pixar no Corpo',  desc:'Personagens vivem dentro de um corpo humano transparente' },
  { id:'battle',     label:'Batalha Épica',   desc:'Heróis vs. vilões em uma guerra épica' },
  { id:'superhero',  label:'Super-Heróis',    desc:'Personagens com poderes e capas salvando o dia' },
  { id:'drama',      label:'Drama & Traição', desc:'Conflito emocional, amor, traição e descoberta' },
  { id:'adventure',  label:'Aventura Livre',  desc:'Qualquer cenário — banheiro, cozinha, espaço...' },
];

function useIsMobile() {
  const [m, setM] = useState(typeof window !== 'undefined' && window.innerWidth < 640);
  useEffect(() => {
    const fn = () => setM(window.innerWidth < 640);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return m;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }) {
  return (
    <p style={{ fontFamily:"'Space Mono',monospace", fontSize:9, letterSpacing:'.2em',
      color:'rgba(255,255,255,.3)', marginBottom:12, textTransform:'uppercase' }}>
      {children}
    </p>
  );
}

function Divider({ label }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, margin:'28px 0' }}>
      <div style={{ flex:1, height:1, background:'rgba(255,255,255,.06)' }} />
      <span style={{ fontFamily:"'Space Mono',monospace", fontSize:9,
        color:'rgba(255,255,255,.2)', letterSpacing:'.15em' }}>{label}</span>
      <div style={{ flex:1, height:1, background:'rgba(255,255,255,.06)' }} />
    </div>
  );
}

function CopyBtn({ text }) {
  const [done, setDone] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); });
  }
  return (
    <button onClick={copy} style={{
      position:'absolute', top:10, right:10,
      background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.1)',
      borderRadius:6, padding:'5px 9px', color: done ? ACCENT : 'rgba(255,255,255,.4)',
      fontSize:10, cursor:'pointer', fontFamily:"'Space Mono',monospace",
    }}>
      {done ? '✓' : 'copiar'}
    </button>
  );
}

function SceneCard({ scene }) {
  return (
    <div style={{ background:'rgba(255,255,255,.025)', border:'1px solid rgba(255,255,255,.07)',
      borderRadius:16, padding:20, marginBottom:12, position:'relative' }}>

      <div style={{ position:'absolute', top:16, right:16,
        fontFamily:"'Space Mono',monospace", fontSize:9,
        color:'rgba(255,255,255,.2)', letterSpacing:'.1em' }}>
        CENA {scene.scene_number}
      </div>

      <p style={{ fontFamily:"'Space Mono',monospace", fontSize:10,
        color:ACCENT, marginBottom:5, letterSpacing:'.05em' }}>
        {scene.timestamp}
      </p>

      <p style={{ fontFamily:"'Syne',sans-serif", fontSize:14,
        fontWeight:600, marginBottom:14 }}>
        {scene.scene_title}
      </p>

      {scene.dialogue_pt && (
        <div style={{ display:'inline-block',
          background:'rgba(167,139,250,.12)', border:'1px solid rgba(167,139,250,.28)',
          borderRadius:8, padding:'8px 12px', fontSize:12, color:ACCENT, marginBottom:12 }}>
          💬 "{scene.dialogue_pt}"
        </div>
      )}

      <div style={{ background:'#000', border:'1px solid rgba(255,255,255,.08)',
        borderRadius:10, padding:'14px 16px', fontSize:12, lineHeight:1.75,
        color:'rgba(255,255,255,.75)', position:'relative', marginBottom:10,
        fontFamily:"'DM Sans',sans-serif" }}>
        <p style={{ fontFamily:"'Space Mono',monospace", fontSize:8,
          color:'rgba(255,255,255,.22)', marginBottom:8, letterSpacing:'.15em' }}>
          PROMPT DE VÍDEO — COLAR DIRETO
        </p>
        {scene.veo3_prompt}
        <CopyBtn text={scene.veo3_prompt} />
      </div>

      {scene.visual_note && (
        <p style={{ fontSize:11, color:'rgba(255,255,255,.28)', fontStyle:'italic' }}>
          👁 {scene.visual_note}
        </p>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function VideoWorld() {
  const navigate   = useNavigate();
  const isMobile   = useIsMobile();
  const resultRef  = useRef(null);

  const [nicho,    setNicho]    = useState(null);
  const [tema,     setTema]     = useState('');
  const [duracao,  setDuracao]  = useState(60);
  const [estilo,   setEstilo]   = useState('pixar_body');
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState(null);
  const [error,    setError]    = useState(null);

  const nichoObj  = NICHOS.find(n => n.id === nicho);
  const temaFinal = tema.trim() || nichoObj?.label || '';

  async function gerar() {
    if (!temaFinal) { setError('Escolha um nicho ou descreva o tema.'); return; }
    setError(null); setLoading(true); setResult(null);
    try {
      const data = await api.post('/video', {
        topic:       temaFinal,
        style:       estilo,
        durationSec: duracao,
        hint:        nichoObj?.hint || temaFinal,
      });
      setResult(data.script);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior:'smooth' }), 200);
    } catch (e) {
      setError(e.message || 'Erro ao gerar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  // ── estilos inline reutilizáveis ──
  const inputBase = {
    width:'100%', background:'rgba(255,255,255,.04)',
    border:'1px solid rgba(255,255,255,.08)', borderRadius:12,
    padding:'13px 16px', color:'#fff',
    fontFamily:"'DM Sans',sans-serif", fontSize:14, outline:'none',
  };

  const pill = (active) => ({
    padding:'9px 18px', borderRadius:100, cursor:'pointer',
    border:`1px solid ${active ? ACCENT : 'rgba(255,255,255,.1)'}`,
    background: active ? `rgba(${GLOW},.15)` : 'rgba(255,255,255,.03)',
    color: active ? '#fff' : 'rgba(255,255,255,.55)',
    fontSize:13, transition:'all .2s',
  });

  return (
    <div style={{ minHeight:'100vh',
      background:'linear-gradient(160deg,#0d0a1a 0%,#150f2a 60%,#080613 100%)',
      color:'#fff', fontFamily:"'DM Sans',sans-serif", position:'relative' }}>

      {/* Glow de fundo */}
      <div style={{ position:'fixed', top:-200, left:'50%', transform:'translateX(-50%)',
        width:800, height:500, pointerEvents:'none',
        background:`radial-gradient(ellipse,rgba(${GLOW},.18) 0%,transparent 70%)` }} />

      {/* ── Header ── */}
      <div style={{ padding: isMobile ? '24px 20px 16px' : '36px 40px 20px',
        display:'flex', alignItems:'center', gap:16,
        borderBottom:'1px solid rgba(255,255,255,.06)' }}>
        <button onClick={() => navigate('/')}
          style={{ background:'none', border:'none', cursor:'pointer',
            color:'rgba(255,255,255,.4)', fontSize:20, lineHeight:1, padding:4 }}>
          ←
        </button>
        <div>
          <p style={{ fontFamily:"'Space Mono',monospace", fontSize:9,
            letterSpacing:'.2em', color:ACCENT, marginBottom:3 }}>
            🎬 NOVELINHA VIRAL
          </p>
          <h1 style={{ fontFamily:"'Syne',sans-serif", fontSize: isMobile ? 20 : 26,
            fontWeight:800, lineHeight:1.1, margin:0 }}>
            Gerador de Novelinhas
          </h1>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ maxWidth:780, margin:'0 auto',
        padding: isMobile ? '28px 16px 80px' : '36px 24px 100px' }}>

        {/* NICHOS */}
        <div style={{ marginBottom:28 }}>
          <SectionLabel>🎯 Nicho</SectionLabel>
          <div style={{ display:'grid',
            gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))', gap:8 }}>
            {NICHOS.map(n => (
              <div key={n.id}
                onClick={() => { setNicho(nicho === n.id ? null : n.id); if (n.id !== 'custom') setTema(''); }}
                style={{
                  background: nicho === n.id ? `rgba(${GLOW},.12)` : 'rgba(255,255,255,.03)',
                  border:`1px solid ${nicho === n.id ? ACCENT : 'rgba(255,255,255,.07)'}`,
                  borderRadius:12, padding:'13px 10px', cursor:'pointer',
                  textAlign:'center', transition:'all .2s',
                }}>
                <div style={{ fontSize:20, marginBottom:5 }}>{n.emoji}</div>
                <div style={{ fontSize:12, fontWeight:500,
                  color:'rgba(255,255,255,.85)' }}>{n.label}</div>
                {n.hint !== 'livre' && (
                  <div style={{ fontSize:10, color:'rgba(255,255,255,.28)',
                    marginTop:2 }}>{n.hint}</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* TEMA LIVRE */}
        <div style={{ marginBottom:28 }}>
          <SectionLabel>✏️ Descreva o tema ou ângulo específico</SectionLabel>
          <textarea rows={3} value={tema} onChange={e => setTema(e.target.value)}
            placeholder={nichoObj && nicho !== 'custom'
              ? `Ex: ${nichoObj.hint} — ou deixe em branco para usar "${nichoObj.label}"`
              : 'Ex: como o ômega-3 combate inflamação no cérebro de forma épica...'}
            style={{ ...inputBase, resize:'none' }} />
        </div>

        {/* DURAÇÃO */}
        <div style={{ marginBottom:28 }}>
          <SectionLabel>⏱️ Duração do vídeo</SectionLabel>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {DURACOES.map(d => (
              <div key={d.id} onClick={() => setDuracao(d.id)} style={pill(duracao === d.id)}>
                {d.label} · {d.scenes} cenas
              </div>
            ))}
          </div>
        </div>

        {/* ESTILO */}
        <div style={{ marginBottom:32 }}>
          <SectionLabel>🎬 Estilo visual</SectionLabel>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {ESTILOS.map(e => (
              <div key={e.id} onClick={() => setEstilo(e.id)} style={{
                flex:'1 1 180px',
                background: estilo === e.id ? `rgba(${GLOW},.1)` : 'rgba(255,255,255,.03)',
                border:`1px solid ${estilo === e.id ? ACCENT : 'rgba(255,255,255,.07)'}`,
                borderRadius:12, padding:16, cursor:'pointer', transition:'all .2s',
              }}>
                <p style={{ fontSize:13, fontWeight:600, marginBottom:4 }}>{e.label}</p>
                <p style={{ fontSize:11, color:'rgba(255,255,255,.32)' }}>{e.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* BOTÃO GERAR */}
        <button onClick={gerar} disabled={!temaFinal || loading}
          style={{
            width:'100%', padding:18, borderRadius:14, border:'none',
            background: temaFinal && !loading
              ? `linear-gradient(135deg,${ACCENT},#9333ea)`
              : 'rgba(255,255,255,.06)',
            color:'#fff', fontFamily:"'Syne',sans-serif",
            fontWeight:700, fontSize:16, cursor: temaFinal && !loading ? 'pointer' : 'not-allowed',
            letterSpacing:'.02em', transition:'opacity .2s',
          }}>
          {loading ? 'Gerando roteiro...' : '✦ Gerar Novelinha Viral'}
        </button>

        {error && (
          <div style={{ background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.3)',
            borderRadius:12, padding:16, color:'#fca5a5', fontSize:13, marginTop:16 }}>
            ⚠️ {error}
          </div>
        )}

        {/* LOADING */}
        {loading && (
          <div style={{ textAlign:'center', padding:'60px 20px' }}>
            <div style={{ width:56, height:56, margin:'0 auto 18px', borderRadius:'50%',
              background:`radial-gradient(circle,${ACCENT},transparent)`,
              animation:'vwPulse 1.5s ease infinite' }} />
            <p style={{ fontFamily:"'Space Mono',monospace", fontSize:11,
              color:ACCENT, letterSpacing:'.15em' }}>AUTOR.AI ESTÁ CRIANDO</p>
            <p style={{ fontSize:13, color:'rgba(255,255,255,.3)', marginTop:8 }}>
              Roteiro + prompts de vídeo + thumbnails...
            </p>
          </div>
        )}

        {/* ── RESULTADO ── */}
        {result && (
          <div ref={resultRef} style={{ marginTop:48 }}>

            {/* Cabeçalho do resultado */}
            <div style={{ marginBottom:32 }}>
              <p style={{ fontFamily:"'Space Mono',monospace", fontSize:10,
                color:ACCENT, letterSpacing:'.15em', marginBottom:10 }}>✦ ROTEIRO GERADO</p>
              <h2 style={{ fontFamily:"'Syne',sans-serif", fontSize:22,
                fontWeight:800, marginBottom:8 }}>{result.title}</h2>
              <p style={{ fontSize:14, color:ACCENT, fontStyle:'italic',
                marginBottom:8 }}>"{result.hook}"</p>
              <p style={{ fontSize:13, color:'rgba(255,255,255,.5)',
                lineHeight:1.7 }}>{result.story_summary}</p>
            </div>

            {/* Personagens e âncora global — ocultos, usados internamente nos prompts */}

            {/* Cenas */}
            <SectionLabel>🎬 Sequência de cenas — cole uma por vez</SectionLabel>
            {result.scenes?.map((scene, i) => (
              <SceneCard key={i} scene={scene} />
            ))}

            {/* Thumbnails */}
            {result.thumbnail_prompts?.length > 0 && (
              <>
                <Divider label="THUMBNAILS" />
                <SectionLabel>🖼️ Prompts de imagem</SectionLabel>
                {result.thumbnail_prompts.map((tp, i) => (
                  <div key={i} style={{
                    background:'rgba(255,255,255,.025)',
                    border:'1px solid rgba(255,255,255,.07)',
                    borderRadius:14, padding:18, marginBottom:10,
                  }}>
                    <span style={{
                      display:'inline-block', padding:'4px 10px', borderRadius:100,
                      background:`rgba(${GLOW},.18)`,
                      border:`1px solid rgba(${GLOW},.28)`,
                      fontSize:10, color:ACCENT,
                      fontFamily:"'Space Mono',monospace", marginBottom:10,
                    }}>{tp.style}</span>
                    <div style={{
                      background:'#000', border:'1px solid rgba(255,255,255,.08)',
                      borderRadius:10, padding:'14px 16px', fontSize:12,
                      lineHeight:1.75, color:'rgba(255,255,255,.75)',
                      position:'relative', fontFamily:"'DM Sans',sans-serif",
                    }}>
                      {tp.prompt}
                      <CopyBtn text={tp.prompt} />
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* Dicas */}
            {result.posting_tips?.length > 0 && (
              <>
                <Divider label="DICAS DE POST" />
                {result.posting_tips.map((tip, i) => (
                  <div key={i} style={{
                    display:'flex', gap:12, alignItems:'flex-start',
                    padding:'10px 0',
                    borderBottom:'1px solid rgba(255,255,255,.05)',
                  }}>
                    <span style={{ fontFamily:"'Space Mono',monospace",
                      fontSize:9, color:ACCENT, marginTop:3, minWidth:22 }}>
                      0{i+1}
                    </span>
                    <p style={{ fontSize:13, color:'rgba(255,255,255,.58)',
                      lineHeight:1.6 }}>{tip}</p>
                  </div>
                ))}
              </>
            )}

            {/* Gerar outra versão */}
            <button onClick={gerar} disabled={loading}
              style={{
                width:'100%', marginTop:32, padding:16, borderRadius:14,
                background:`rgba(${GLOW},.1)`,
                border:`1px solid rgba(${GLOW},.35)`,
                color:ACCENT, fontFamily:"'Syne',sans-serif",
                fontWeight:600, fontSize:14, cursor:'pointer',
              }}>
              ↺ Gerar Outra Versão
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes vwPulse{0%,100%{transform:scale(1);opacity:.8}50%{transform:scale(1.15);opacity:1}}
        textarea,input{outline:none;}
        textarea:focus,input:focus{border-color:rgba(167,139,250,.5)!important;}
        *{box-sizing:border-box;margin:0;padding:0;}
      `}</style>
    </div>
  );
}
