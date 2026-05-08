import { useState, useRef, useEffect } from 'react';

const PERSONAS = {
  lira: {
    name: 'Lira',
    emoji: '🎙️',
    role: 'Viral & Retenção',
    color: '#ff6b9d',
    glow: '255,107,157',
    intro: 'Oi! Sou a Lira 🎙️ Qual é o seu nicho? Me conta em uma frase o que você cria.',
  },
  atlas: {
    name: 'Atlas',
    emoji: '🌍',
    role: 'Profundidade & Contexto',
    color: '#00b8ff',
    glow: '0,184,255',
    intro: 'Olá. Sou o Atlas 🌍 Que tipo de transformação você quer provocar no seu espectador?',
  },
  faisca: {
    name: 'Faísca',
    emoji: '⚡',
    role: 'Polêmica & Cliques',
    color: '#ffbe4d',
    glow: '255,190,77',
    intro: 'Fala! ⚡ Sou Faísca. Me diz: você quer educar ou provocar? Porque os melhores vídeos fazem os dois 😈',
  },
};

export function BookChat({ books = [], onHighlight, onSelectBook }) {
  const [open, setOpen] = useState(false);
  const [activePersona, setActivePersona] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [recommended, setRecommended] = useState([]);
  const [justificativa, setJustificativa] = useState('');
  const [msgCount, setMsgCount] = useState(0);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  const persona = activePersona ? PERSONAS[activePersona] : null;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (open && inputRef.current) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open, activePersona]);

  function selectPersona(key) {
    setActivePersona(key);
    setMessages([{ role: 'assistant', content: PERSONAS[key].intro }]);
    setRecommended([]);
    setJustificativa('');
    setMsgCount(0);
    setInput('');
    onHighlight([]);
  }

  async function sendMessage() {
    if (!input.trim() || loading) return;
    const userMsg = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    const newCount = msgCount + 1;
    setMsgCount(newCount);

    try {
      // Após 3 mensagens do usuário, pede recomendação
      if (newCount >= 3) {
        const [chatRes, recRes] = await Promise.all([
          fetch('/api/books/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ persona: activePersona, messages: newMessages }),
          }),
          fetch('/api/books/recommend', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ persona: activePersona, messages: newMessages, books }),
          }),
        ]);

        const chatData = await chatRes.json();
        const recData = await recRes.json();

        setMessages(prev => [...prev, { role: 'assistant', content: chatData.message }]);

        if (recData.indices?.length) {
          setRecommended(recData.indices);
          setJustificativa(recData.justificativa || '');
          onHighlight(recData.indices);
        }
      } else {
        const res = await fetch('/api/books/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ persona: activePersona, messages: newMessages }),
        });
        const data = await res.json();
        setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Erro de conexão. Tenta de novo!' }]);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setActivePersona(null);
    setMessages([]);
    setRecommended([]);
    setJustificativa('');
    setMsgCount(0);
    onHighlight([]);
  }

  return (
    <>
      {/* Botão flutuante */}
      <div style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 300,
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10,
      }}>
        {!open && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
            <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 8, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.3)', margin: 0 }}>CONSULTORES</p>
            <div style={{ display: 'flex', gap: 10 }}>
              {Object.entries(PERSONAS).map(([key, p]) => (
                <button key={key} onClick={() => { setOpen(true); selectPersona(key); }}
                  title={`${p.name} — ${p.role}`}
                  style={{
                    width: 52, height: 52, borderRadius: '50%',
                    background: `radial-gradient(circle at 35% 35%, ${p.color}33, #0a0700)`,
                    border: `2px solid ${p.color}55`,
                    fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', boxShadow: `0 0 20px ${p.color}33`,
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.15)'; e.currentTarget.style.boxShadow = `0 0 30px ${p.color}66`; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = `0 0 20px ${p.color}33`; }}
                >
                  {p.emoji}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {Object.entries(PERSONAS).map(([key, p]) => (
                <span key={key} style={{ width: 52, textAlign: 'center', fontFamily: 'DM Sans, sans-serif', fontSize: 9, color: `${p.color}99` }}>{p.name}</span>
              ))}
            </div>
          </div>
        )}

        {open && (
          <button onClick={() => setOpen(false)} style={{
            width: 44, height: 44, borderRadius: '50%',
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.5)', fontSize: 16, cursor: 'pointer',
          }}>✕</button>
        )}
      </div>

      {/* Painel do chat */}
      {open && persona && (
        <div style={{
          position: 'fixed', bottom: 90, right: 24, zIndex: 299,
          width: 360, maxHeight: '70vh',
          background: '#0a0700', border: `1px solid ${persona.color}33`,
          borderRadius: 16, display: 'flex', flexDirection: 'column',
          boxShadow: `0 24px 80px rgba(0,0,0,0.8), 0 0 40px ${persona.color}11`,
          animation: 'bwSlideUp 0.3s cubic-bezier(0.34,1.1,0.64,1)',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{ height: 3, background: `linear-gradient(90deg, transparent, ${persona.color}, transparent)` }} />
          <div style={{ padding: '14px 16px', borderBottom: `1px solid ${persona.color}22`, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: '50%', background: `radial-gradient(circle, ${persona.color}33, #0a0700)`, border: `1.5px solid ${persona.color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{persona.emoji}</div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontFamily: 'Space Mono, monospace', fontSize: 11, fontWeight: 700, color: persona.color }}>{persona.name}</p>
              <p style={{ margin: 0, fontFamily: 'DM Sans, sans-serif', fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{persona.role}</p>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {Object.entries(PERSONAS).filter(([k]) => k !== activePersona).map(([key, p]) => (
                <button key={key} onClick={() => selectPersona(key)} title={p.name}
                  style={{ width: 28, height: 28, borderRadius: '50%', background: `${p.color}11`, border: `1px solid ${p.color}33`, fontSize: 13, cursor: 'pointer' }}>
                  {p.emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Mensagens */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10, scrollbarWidth: 'thin', scrollbarColor: `${persona.color}22 transparent` }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '85%', padding: '10px 14px', borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  background: m.role === 'user' ? `${persona.color}22` : 'rgba(255,255,255,0.04)',
                  border: m.role === 'user' ? `1px solid ${persona.color}44` : '1px solid rgba(255,255,255,0.06)',
                  fontFamily: 'DM Sans, sans-serif', fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6,
                }}>
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ padding: '10px 16px', borderRadius: '14px 14px 14px 4px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ display: 'inline-flex', gap: 4 }}>
                    {[0, 1, 2].map(i => <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: persona.color, opacity: 0.6, animation: `bwPulse 1.2s ease ${i * 0.2}s infinite` }} />)}
                  </span>
                </div>
              </div>
            )}

            {/* Cards dos livros recomendados */}
            {recommended.length > 0 && (
              <div style={{ marginTop: 8, padding: '12px', background: `${persona.color}08`, border: `1px solid ${persona.color}22`, borderRadius: 12 }}>
                <p style={{ margin: '0 0 8px', fontFamily: 'Space Mono, monospace', fontSize: 8, letterSpacing: '0.2em', color: persona.color }}>RECOMENDADOS PARA VOCÊ</p>
                {justificativa && <p style={{ margin: '0 0 10px', fontFamily: 'DM Sans, sans-serif', fontSize: 11, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>{justificativa}</p>}
                {recommended.map(idx => books[idx] && (
                  <button key={idx} onClick={() => onSelectBook(books[idx])}
                    style={{ width: '100%', textAlign: 'left', padding: '8px 10px', marginBottom: 6, borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: `1px solid ${persona.color}22`, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16 }}>📖</span>
                    <div>
                      <p style={{ margin: 0, fontFamily: 'DM Sans, sans-serif', fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>{books[idx].title}</p>
                      <p style={{ margin: 0, fontFamily: 'DM Sans, sans-serif', fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{books[idx].author}</p>
                    </div>
                    <span style={{ marginLeft: 'auto', fontFamily: 'Space Mono, monospace', fontSize: 8, color: persona.color }}>→</span>
                  </button>
                ))}
                <button onClick={reset} style={{ width: '100%', marginTop: 4, padding: '6px', background: 'none', border: `1px solid rgba(255,255,255,0.06)`, borderRadius: 8, color: 'rgba(255,255,255,0.25)', fontFamily: 'DM Sans, sans-serif', fontSize: 11, cursor: 'pointer' }}>
                  Recomeçar conversa
                </button>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '12px 14px', borderTop: `1px solid ${persona.color}22`, display: 'flex', gap: 8 }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder={`Fala com ${persona.name}...`}
              disabled={loading}
              style={{
                flex: 1, background: 'rgba(255,255,255,0.04)', border: `1px solid ${persona.color}33`,
                borderRadius: 10, padding: '9px 12px', color: '#fff',
                fontFamily: 'DM Sans, sans-serif', fontSize: 13, outline: 'none',
              }}
            />
            <button onClick={sendMessage} disabled={loading || !input.trim()}
              style={{
                width: 38, height: 38, borderRadius: 10, border: 'none',
                background: loading || !input.trim() ? 'rgba(255,255,255,0.05)' : `${persona.color}33`,
                color: persona.color, fontSize: 16, cursor: loading ? 'not-allowed' : 'pointer',
              }}>→</button>
          </div>
        </div>
      )}
    </>
  );
}
