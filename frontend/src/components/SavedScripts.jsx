import { useState, useEffect } from 'react';

const ACCENT = '#a78bfa';

export default function SavedScripts({ onClose }) {
  const [scripts, setScripts] = useState([]);
  const [selected, setSelected] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('viralnews_saved_scripts') || '[]');
      setScripts(saved);
    } catch { setScripts([]); }
  }, []);

  const remove = (id) => {
    const updated = scripts.filter(s => s.id !== id);
    setScripts(updated);
    localStorage.setItem('viralnews_saved_scripts', JSON.stringify(updated));
    if (selected?.id === id) setSelected(null);
  };

  const copy = (text) => {
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const formatDate = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const getScriptText = (s) => s.script && typeof s.script === 'object' ? s.script.script : (s.script || '');

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#0d0d18', border: '1px solid rgba(167,139,250,0.25)', borderRadius: 16, width: '100%', maxWidth: 900, maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontFamily: 'Syne, sans-serif', fontSize: 18, fontWeight: 700, color: '#fff' }}>📋 Meus Roteiros</span>
            <span style={{ marginLeft: 10, fontFamily: 'Space Mono, monospace', fontSize: 11, color: 'rgba(167,139,250,0.7)', letterSpacing: '0.1em' }}>{scripts.length} salvos</span>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'rgba(255,255,255,0.6)', padding: '6px 14px', cursor: 'pointer', fontSize: 13 }}>Fechar</button>
        </div>

        {scripts.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', fontFamily: 'DM Sans, sans-serif', fontSize: 15 }}>
            Nenhum roteiro salvo ainda. Gere um e ele aparecerá aqui automaticamente.
          </div>
        ) : (
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            {/* Lista */}
            <div style={{ width: 280, borderRight: '1px solid rgba(255,255,255,0.07)', overflowY: 'auto', padding: '8px 0' }}>
              {scripts.map(s => (
                <div
                  key={s.id}
                  onClick={() => setSelected(s)}
                  style={{
                    padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)',
                    background: selected?.id === s.id ? 'rgba(167,139,250,0.1)' : 'transparent',
                    borderLeft: selected?.id === s.id ? `3px solid ${ACCENT}` : '3px solid transparent',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: '#fff', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>
                    {s.article_title || 'Roteiro'}
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: 'rgba(167,139,250,0.6)', letterSpacing: '0.08em' }}>{s.platform || ''}</span>
                    <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10 }}>·</span>
                    <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{formatDate(s.savedAt)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Detalhe */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
              {!selected ? (
                <div style={{ color: 'rgba(255,255,255,0.25)', fontFamily: 'DM Sans, sans-serif', fontSize: 14, marginTop: 40, textAlign: 'center' }}>
                  ← Selecione um roteiro para ver
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 12 }}>
                    <div>
                      <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{selected.article_title}</div>
                      <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{formatDate(selected.savedAt)} · {selected.platform} · {selected.style}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => copy(getScriptText(selected))} style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, letterSpacing: '0.1em', color: ACCENT, background: 'rgba(167,139,250,0.08)', border: `1px solid rgba(167,139,250,0.2)`, borderRadius: 6, padding: '6px 12px', cursor: 'pointer' }}>
                        {copied ? '✓ COPIADO' : 'COPIAR'}
                      </button>
                      <button onClick={() => remove(selected.id)} style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, letterSpacing: '0.1em', color: 'rgba(255,80,80,0.7)', background: 'transparent', border: '1px solid rgba(255,80,80,0.2)', borderRadius: 6, padding: '6px 12px', cursor: 'pointer' }}>
                        EXCLUIR
                      </button>
                    </div>
                  </div>

                  {/* Hooks */}
                  {selected.hooks && selected.hooks.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, letterSpacing: '0.12em', color: 'rgba(167,139,250,0.6)', marginBottom: 8 }}>HOOKS</div>
                      {selected.hooks.map((h, i) => (
                        <div key={i} style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'rgba(255,255,255,0.8)', background: 'rgba(167,139,250,0.07)', borderRadius: 8, padding: '8px 12px', marginBottom: 6 }}>
                          {typeof h === 'object' ? h.hook || h.text || JSON.stringify(h) : h}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Roteiro */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, letterSpacing: '0.12em', color: 'rgba(167,139,250,0.6)', marginBottom: 8 }}>ROTEIRO</div>
                    <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 1.7, whiteSpace: 'pre-wrap', background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '14px 16px' }}>
                      {getScriptText(selected)}
                    </div>
                  </div>

                  {/* Títulos */}
                  {selected.titles && selected.titles.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, letterSpacing: '0.12em', color: 'rgba(167,139,250,0.6)', marginBottom: 8 }}>TÍTULOS</div>
                      {selected.titles.map((t, i) => (
                        <div key={i} style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'rgba(255,255,255,0.8)', background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: '7px 12px', marginBottom: 5 }}>{t}</div>
                      ))}
                    </div>
                  )}

                  {/* Hashtags */}
                  {selected.hashtags && selected.hashtags.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, letterSpacing: '0.12em', color: 'rgba(167,139,250,0.6)', marginBottom: 8 }}>HASHTAGS</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {selected.hashtags.map((h, i) => (
                          <span key={i} style={{ fontFamily: 'Space Mono, monospace', fontSize: 11, color: ACCENT, background: 'rgba(167,139,250,0.1)', borderRadius: 20, padding: '4px 10px' }}>{h}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Captions */}
                  {selected.captions && selected.captions.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, letterSpacing: '0.12em', color: 'rgba(167,139,250,0.6)', marginBottom: 8 }}>LEGENDAS</div>
                      {selected.captions.map((c, i) => (
                        <div key={i} style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'rgba(255,255,255,0.75)', background: 'rgba(255,255,255,0.04)', borderRadius: 6, padding: '7px 12px', marginBottom: 5 }}>{c}</div>
                      ))}
                    </div>
                  )}

                  {/* Thumbnail */}
                  {selected.thumbnail_prompt && (
                    <div>
                      <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, letterSpacing: '0.12em', color: 'rgba(167,139,250,0.6)', marginBottom: 8 }}>THUMBNAIL</div>
                      <div style={{ fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'rgba(255,255,255,0.7)', fontStyle: 'italic', background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '10px 14px' }}>{selected.thumbnail_prompt}</div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
