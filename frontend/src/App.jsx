import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from './contexts/LanguageContext';
import { WorldPortal } from './worlds/WorldPortal';
import { NewsWorld } from './worlds/news/NewsWorld';
import { ScienceWorld } from './worlds/science/ScienceWorld';
import { BooksWorld } from './worlds/books/BooksWorld';
import { NicheWorld } from './worlds/niche/NicheWorld';
import { VideoWorld } from './worlds/video/VideoWorld';
import { useState, useEffect } from 'react';
import { LoginScreen } from './components/LoginScreen';
import { Termos } from './pages/Termos';
import { Privacidade } from './pages/Privacidade';
import { Planos } from './pages/Planos';
const STATIC_ITEMS = [
  "0.3% dos vídeos passam de 1M de views",
  "73º vídeo — média do primeiro viral de um criador",
  "96.5% dos criadores desistem antes de 100 vídeos",
  "7x mais chances de viralizar postando 4x por semana",
  "8 segundos — é tudo que você tem antes do skip",
  "MrBeast levou 3 anos para decolar",
  "Khaby Lame foi demitido antes do primeiro viral",
  "90 dias de consistência mudam completamente um canal",
  "1 em 300 Shorts passa de 500K organicamente",
  "62% dos criadores virais quase desistiram antes do primeiro hit",
  "Nenhum canal grande começou grande",
  "Publique. O algoritmo aprende com volume",
  "O vídeo que você não publicou não pode viralizar",
  "Quantidade gera qualidade — não o contrário",
  "Títulos com número têm 36% mais CTR",
  "Vídeos de 7–15 min têm melhor retenção no YouTube",
  "Thumbnail + título respondem por 80% do clique",
  "Canal com nicho claro cresce 3x mais rápido",
  "Primeira semana define 60% do alcance total de um vídeo",
  "Comentários no próprio vídeo aumentam o alcance em 20%",
  "Responder comentários nas primeiras 2h dobra o engajamento",
  "Vídeos com CTA verbal têm 4x mais inscrições",
  "Postar nos primeiros 2 dias da semana favorece o algoritmo",
  "Séries de vídeos geram 70% mais retenção de audiência",
  "Miniaturas com rosto humano têm CTR 38% maior",
  "Vídeos com legenda atingem 80% a mais de pessoas",
  "Shorts que chegam a 60% de retenção são promovidos automaticamente",
  "Um canal com 500 inscritos pode bater 1M de views num único vídeo",
  "O algoritmo prioriza sessão — não o vídeo isolado",
  "Consistência por 6 meses bate talento sem disciplina",
  "Nichos de 100K buscas/mês são mais fáceis de dominar que nichos de 10M",
  "PewDiePie publicou por 2 anos antes do primeiro grande viral",
  "O segundo canal costuma crescer 5x mais rápido que o primeiro",
  "Vídeo ruim publicado supera vídeo perfeito não publicado",
];

function GlobalTicker() {
  const [visible, setVisible] = useState(false);
  const [trending, setTrending] = useState([]);

  useEffect(() => {
    setVisible(true);
  }, []);

  useEffect(() => {
    if (!visible) return;
    fetch("/api/news/headlines")
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) setTrending(data);
      })
      .catch(() => {});
  }, [visible]);

  if (!visible) return null;

  // Intercala: 2 dados de viralização · 1 notícia · 2 dados · 1 notícia...
  const interleaved = [];
  const newsItems = trending.length > 0 ? trending : [];
  let ni = 0;
  for (let i = 0; i < STATIC_ITEMS.length; i++) {
    interleaved.push(STATIC_ITEMS[i]);
    if ((i + 1) % 2 === 0 && ni < newsItems.length) {
      interleaved.push("📰 " + newsItems[ni]);
      ni++;
    }
  }
  const halfText = interleaved.join("          ");

  return (
    <>
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999,
        height: 42,
        background: "rgba(7,7,15,0.97)",
        borderBottom: "none",
        boxShadow: "0 1px 0 rgba(255,255,255,0.07), 0 4px 24px rgba(0,0,0,0.8)",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}>
        {/* Label */}
        <div style={{
          background: "rgba(255,255,255,0.05)",
          padding: "0 16px",
          height: "100%",
          display: "flex",
          alignItems: "center",
          flexShrink: 0,
          borderRight: "1px solid rgba(255,255,255,0.07)",
          gap: 8,
        }}>
          <div style={{
            width: 7, height: 7, borderRadius: "50%",
            background: "#ff453a",
            boxShadow: "0 0 6px #ff453a",
            flexShrink: 0,
            animation: "pulse 2s ease infinite",
          }} />
          <span style={{
            fontFamily: "-apple-system, SF Pro Text, sans-serif",
            fontSize: 11,
            letterSpacing: "0.08em",
            color: "rgba(255,255,255,0.45)",
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}>VIRAL DATA</span>
        </div>

        {/* Texto rolando */}
        <div style={{ overflow: "hidden", flex: 1 }}>
          <div style={{
            display: "flex",
            animation: "globalTicker 40s linear infinite",
          }}>
            {[0, 1].map(k => (
              <span key={k} style={{
                fontFamily: "-apple-system, SF Pro Text, sans-serif",
                fontSize: 13,
                color: "rgba(255,255,255,0.85)",
                fontWeight: 600,
                letterSpacing: "0.015em",
                whiteSpace: "nowrap",
                flexShrink: 0,
                paddingRight: "4em",
              }}>{halfText}</span>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes globalTicker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </>
    );
}

export default function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('autor_user')); } catch { return null; }
  });

  useEffect(() => {
    const token = localStorage.getItem('autor_token');
    if (!token) return;
    if (window._justLoggedIn) return;
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (data.user) {
          localStorage.setItem('autor_user', JSON.stringify(data.user));
          setUser(data.user);
        } else {
          localStorage.clear();
          setUser(null);
        }
      })
      .catch(() => {
        localStorage.clear();
        setUser(null);
      });
  }, []);

  function handleLogin(u) {
    setUser(u);
    // Marca que acabou de fazer login para o useEffect nao sobrescrever
    window._justLoggedIn = true;
    setTimeout(() => { window._justLoggedIn = false; }, 5000);
  }

  function handleLogout() {
    localStorage.removeItem('autor_token');
    localStorage.removeItem('autor_user');
    setUser(null);
  }

  if (!user) return <LoginScreen onLogin={handleLogin} />;

  if (!user.plan || user.plan === 'none') return (
    <div style={{
      minHeight:'100vh', background:'#07070f', display:'flex', alignItems:'center',
      justifyContent:'center', flexDirection:'column', gap:24, fontFamily:'-apple-system,sans-serif', padding:24,
    }}>
      <div style={{textAlign:'center'}}>
        <div style={{fontSize:48,fontWeight:800,color:'#fff',letterSpacing:'-2px'}}>
          Autor<span style={{color:'#7c5cfc'}}>.AI</span>
        </div>
      </div>
      <div style={{
        background:'#111120', border:'1px solid rgba(255,255,255,0.08)',
        borderRadius:16, padding:'40px 48px', maxWidth:400, width:'100%', textAlign:'center',
      }}>
        <div style={{fontSize:32,marginBottom:16}}>🔒</div>
        <p style={{color:'#fff',fontWeight:600,fontSize:18,margin:'0 0 8px'}}>Acesso restrito</p>
        <p style={{color:'rgba(255,255,255,0.4)',fontSize:14,margin:'0 0 24px',lineHeight:1.6}}>
          Você precisa de um plano ativo para acessar a plataforma.
        </p>
        <a href="https://autorai.com.br/#planos" style={{
          display:'block', background:'linear-gradient(135deg,#7c5cfc,#00e5b0)',
          color:'#fff', fontWeight:700, fontSize:15, padding:'14px 32px',
          borderRadius:12, textDecoration:'none', marginBottom:16,
        }}>Ver planos →</a>
        <button onClick={async () => {
          const token = localStorage.getItem('autor_token');
          if (!token) return;
          const r = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
          const data = await r.json();
          if (data.user && data.user.plan && data.user.plan !== 'none') {
            localStorage.setItem('autor_user', JSON.stringify(data.user));
            setUser(data.user);
          } else {
            alert('Pagamento ainda não confirmado. Aguarde alguns segundos e tente novamente.');
          }
        }} style={{
          display:'block', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)',
          color:'rgba(255,255,255,0.6)', fontWeight:600, fontSize:14, padding:'12px 32px',
          borderRadius:12, cursor:'pointer', marginBottom:12, width:'100%',
        }}>✓ Já paguei, verificar acesso</button>
        <button onClick={handleLogout} style={{
          background:'none', border:'none', color:'rgba(255,255,255,0.3)',
          fontSize:13, cursor:'pointer',
        }}>Sair</button>
      </div>
    </div>
  );

  return (
    <LanguageProvider>
      <BrowserRouter>
        <GlobalTicker />
        <Routes>
          <Route path="/" element={<WorldPortal user={user} onLogout={handleLogout} />} />
          <Route path="/news" element={<NewsWorld />} />
          <Route path="/science" element={<ScienceWorld />} />
          <Route path="/books" element={<BooksWorld />} />
          <Route path="/niche" element={<NicheWorld />} />
          <Route path="/video" element={<VideoWorld />} />
          <Route path="/termos" element={<Termos />} />
          <Route path="/privacidade" element={<Privacidade />} />
<Route path="/planos" element={<Planos />} />       
 </Routes>
      </BrowserRouter>
    </LanguageProvider>
  );
}
// Sáb  9 Mai 2026 10:32:14 -03
