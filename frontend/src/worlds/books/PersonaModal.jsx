import { useState } from 'react';
import { useScriptGenerator } from '../../hooks/useScriptGenerator';

const PERSONAS = {
  lira: {
    name: 'Lira', emoji: '🎙️', color: '#ff6b9d', glow: '255,107,157',
    phrase: 'Vamos fazer esse livro bombar!',
    angles: [
      { label: 'Retenção máxima', bias: 'retention', desc: 'Hook agressivo, prender do segundo 1' },
      { label: 'Gatilho emocional', bias: 'emotional', desc: 'Conecta com dor ou desejo real' },
      { label: 'Identificação total', bias: 'relatable', desc: 'O espectador vai pensar "isso é comigo"' },
    ],
  },
  atlas: {
    name: 'Atlas', emoji: '🌍', color: '#00b8ff', glow: '0,184,255',
    phrase: 'Que transformação queremos provocar?',
    angles: [
      { label: 'Contexto histórico', bias: 'historical', desc: 'Conecta o livro com algo maior' },
      { label: 'Visão filosófica', bias: 'philosophical', desc: 'Provoca reflexão profunda' },
      { label: 'Contra-intuitivo', bias: 'contrarian', desc: 'Quebra o que todos acreditam' },
    ],
  },
  faisca: {
    name: 'Faísca', emoji: '⚡', color: '#ffbe4d', glow: '255,190,77',
    phrase: 'Qual nível de polêmica você aguenta?',
    angles: [
      { label: 'Provocação direta', bias: 'provocative', desc: 'Vai gerar reação imediata' },
      { label: 'Debate garantido', bias: 'debate', desc: 'Comentários divididos = mais alcance' },
      { label: 'Choque de realidade', bias: 'shocking', desc: 'Algo que ninguém quer ouvir mas precisa' },
    ],
  },
};

const PLATFORMS = [
  { id: 'youtube_shorts', label: 'YouTube Shorts', icon: '▶️', duration: '60s' },
  { id: 'tiktok', label: 'TikTok', icon: '🎵', duration: '60s' },
  { id: 'instagram_reels', label: 'Reels', icon: '📸', duration: '30s' },
  { id: 'youtube_long', label: 'YouTube Longo', icon: '🎬', duration: '8min' },
];

export function PersonaModal({ book, personaKey, onClose, onSave }) {
  const p = PERSONAS[personaKey] || PERSONAS.lira;
  const generator = useScriptGenerator();
  const [step, setStep] = useState(1);
  const [platform, setPlatform] = useState(null);
  const [angle, setAngle] = useState(null);

  async function handleGenerate() {
    setStep(4);
    await generator.generate({
      article: {
        title: book.title,
        content: 'Livro: ' + book.title + '\nAutor: ' + book.author + '\nGere um roteiro inspirado nos conceitos e ideias desta obra. Não reproduza trechos — crie narrativa original baseada no universo temático do livro.',
        viral_score: book.score || 8,
      },
      platform: platform.id,
      style: angle.bias,
      lang: 'pt',
    });
  }

  const accent = p.color;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: 'rgba(0,0,0,0.92)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{
        width: '100%', maxWidth: 560, maxHeight: '90vh',
        background: '#080500', border: `1px solid ${accent}33`,
        borderRadius: 20, overflow: 'hidden',
        boxShadow: `0 40px 120px rgba(0,0,0,0.9), 0 0 60px ${accent}11`,
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ height: 3, background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${accent}22`, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: `radial-gradient(circle, ${accent}44, #050300)`, border: `2px solid ${accent}66`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{p.emoji}</div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontFamily: 'Space Mono, monospace', fontSize: 10, color: accent, fontWeight: 700 }}>{p.name} recomenda como inspiração</p>
            <p style={{ margin: '2px 0 0', fontFamily: 'Playfair Display, serif', fontSize: 16, color: '#fff', fontWeight: 700 }}>{book.title}</p>
            <p style={{ margin: '2px 0 0', fontFamily: 'DM Sans, sans-serif', fontSize: 10, color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' }}>Roteiro original inspirado no universo temático da obra · não reproduz conteúdo oficial</p>
            <p style={{ margin: 0, fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{book.author}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {/* Steps indicator */}
        {step < 4 && (
          <div style={{ padding: '12px 24px', display: 'flex', gap: 6, alignItems: 'center' }}>
            {[1,2,3].map(s => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: s <= step ? 24 : 20, height: s <= step ? 24 : 20, borderRadius: '50%', background: s < step ? accent : s === step ? `${accent}33` : 'rgba(255,255,255,0.05)', border: `1.5px solid ${s <= step ? accent : 'rgba(255,255,255,0.08)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Space Mono, monospace', fontSize: 9, color: s < step ? '#000' : s === step ? accent : 'rgba(255,255,255,0.2)', transition: 'all 0.3s', fontWeight: 700 }}>{s < step ? '✓' : s}</div>
                {s < 3 && <div style={{ width: 32, height: 1, background: s < step ? accent : 'rgba(255,255,255,0.06)' }} />}
              </div>
            ))}
            <span style={{ marginLeft: 8, fontFamily: 'DM Sans, sans-serif', fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
              {step === 1 ? 'Plataforma' : step === 2 ? 'Ângulo' : 'Gerar'}
            </span>
          </div>
        )}

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px 24px' }}>

          {/* Step 1 — Plataforma */}
          {step === 1 && (
            <div>
              <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 16 }}>Para qual plataforma vamos criar?</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {PLATFORMS.map(pl => (
                  <button key={pl.id} onClick={() => { setPlatform(pl); setStep(2); }}
                    style={{ padding: '18px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: `1.5px solid rgba(255,255,255,0.08)`, cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s' }}
                    onMouseEnter={e => { e.currentTarget.style.border = `1.5px solid ${accent}55`; e.currentTarget.style.background = `${accent}0a`; }}
                    onMouseLeave={e => { e.currentTarget.style.border = '1.5px solid rgba(255,255,255,0.08)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                  >
                    <div style={{ fontSize: 24, marginBottom: 8 }}>{pl.icon}</div>
                    <p style={{ margin: 0, fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: '#fff', fontWeight: 600 }}>{pl.label}</p>
                    <p style={{ margin: '2px 0 0', fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>{pl.duration}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2 — Ângulo */}
          {step === 2 && (
            <div>
              <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 14, color: `${accent}cc`, marginBottom: 4, fontStyle: 'italic' }}>"{p.phrase}"</p>
              <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 16 }}>Escolha o ângulo do roteiro</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {p.angles.map(a => (
                  <button key={a.bias} onClick={() => { setAngle(a); setStep(3); }}
                    style={{ padding: '16px 18px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: `1.5px solid rgba(255,255,255,0.08)`, cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s' }}
                    onMouseEnter={e => { e.currentTarget.style.border = `1.5px solid ${accent}55`; e.currentTarget.style.background = `${accent}0a`; }}
                    onMouseLeave={e => { e.currentTarget.style.border = '1.5px solid rgba(255,255,255,0.08)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                  >
                    <p style={{ margin: 0, fontFamily: 'DM Sans, sans-serif', fontSize: 14, color: '#fff', fontWeight: 600 }}>{a.label}</p>
                    <p style={{ margin: '4px 0 0', fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{a.desc}</p>
                  </button>
                ))}
              </div>
              <button onClick={() => setStep(1)} style={{ marginTop: 14, background: 'none', border: 'none', color: 'rgba(255,255,255,0.25)', fontFamily: 'DM Sans, sans-serif', fontSize: 12, cursor: 'pointer' }}>← Voltar</button>
            </div>
          )}

          {/* Step 3 — Confirmar e Gerar */}
          {step === 3 && (
            <div style={{ textAlign: 'center', paddingTop: 8 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>{p.emoji}</div>
              <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, letterSpacing: '0.2em', color: accent, marginBottom: 4 }}>PRONTO PARA GERAR</p>
              <p style={{ fontFamily: 'Playfair Display, serif', fontSize: 18, color: '#fff', fontWeight: 700, marginBottom: 4 }}>{book.title}</p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
                <span style={{ padding: '4px 10px', borderRadius: 20, background: `${accent}22`, border: `1px solid ${accent}44`, fontFamily: 'DM Sans, sans-serif', fontSize: 11, color: accent }}>{platform?.label}</span>
                <span style={{ padding: '4px 10px', borderRadius: 20, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'DM Sans, sans-serif', fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{angle?.label}</span>
              </div>
              <button onClick={handleGenerate}
                style={{ width: '100%', padding: '18px', borderRadius: 14, background: `linear-gradient(135deg, ${accent}33, ${accent}11)`, border: `1.5px solid ${accent}66`, color: accent, fontFamily: 'Space Mono, monospace', fontSize: 13, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.1em', boxShadow: `0 8px 32px ${accent}22` }}>
                {p.emoji} GERAR ROTEIRO INSPIRADO NA OBRA
              </button>
              <button onClick={() => setStep(2)} style={{ marginTop: 12, background: 'none', border: 'none', color: 'rgba(255,255,255,0.25)', fontFamily: 'DM Sans, sans-serif', fontSize: 12, cursor: 'pointer' }}>← Voltar</button>
            </div>
          )}

          {/* Step 4 — Resultado */}
          {step === 4 && (
            <div>
              {generator.loading && (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <div style={{ fontSize: 32, marginBottom: 16, animation: 'bwPulse 1.5s ease infinite' }}>{p.emoji}</div>
                  <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: accent, letterSpacing: '0.2em' }}>GERANDO ROTEIRO...</p>
                  <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 8 }}>{p.name} está trabalhando no seu roteiro</p>
                </div>
              )}
              {generator.script && !generator.loading && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <p style={{ margin: 0, fontFamily: 'Space Mono, monospace', fontSize: 9, color: accent, letterSpacing: '0.2em' }}>ROTEIRO GERADO</p>
                    <button onClick={() => { navigator.clipboard.writeText(generator.script); }} style={{ padding: '6px 12px', borderRadius: 8, background: `${accent}22`, border: `1px solid ${accent}44`, color: accent, fontFamily: 'DM Sans, sans-serif', fontSize: 11, cursor: 'pointer' }}>📋 Copiar</button>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '16px', fontFamily: 'DM Sans, sans-serif', fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 1.7, whiteSpace: 'pre-wrap', maxHeight: 320, overflowY: 'auto' }}>
                    {generator.script}
                  </div>
                  {generator.hooks?.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.2em', marginBottom: 8 }}>HOOKS</p>
                      {generator.hooks.map((h, i) => (
                        <div key={i} style={{ padding: '10px 12px', marginBottom: 6, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
                          {h.text}
                        </div>
                      ))}
                    </div>
                  )}
                  <button onClick={() => { if(onSave) onSave(); onClose(); }} style={{ width: '100%', marginTop: 14, padding: '14px', borderRadius: 12, background: `${accent}22`, border: `1.5px solid ${accent}44`, color: accent, fontFamily: 'Space Mono, monospace', fontSize: 11, cursor: 'pointer', letterSpacing: '0.1em' }}>
                    ✓ SALVAR E FECHAR
                  </button>
                </div>
              )}
              {generator.error && (
                <div style={{ textAlign: 'center', padding: 24 }}>
                  <p style={{ color: '#ff4444', fontFamily: 'DM Sans, sans-serif' }}>Erro ao gerar. Tente novamente.</p>
                  <button onClick={() => setStep(3)} style={{ marginTop: 8, background: 'none', border: `1px solid rgba(255,255,255,0.1)`, borderRadius: 8, padding: '8px 16px', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}>Voltar</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
