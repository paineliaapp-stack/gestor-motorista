import SavedScripts from '../components/SavedScripts';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

if (typeof document !== 'undefined' && !document.getElementById('vn-fonts')) {
  const l = document.createElement('link');
  l.id = 'vn-fonts'; l.rel = 'stylesheet';
  l.href = 'https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&family=Space+Mono:wght@400;700&display=swap';
  document.head.appendChild(l);
}

function ParticleBackground() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let W = window.innerWidth, H = window.innerHeight;
    canvas.width = W; canvas.height = H;
    const particles = Array.from({ length: 55 }, () => ({
      x: Math.random()*W, y: Math.random()*H,
      vx: (Math.random()-0.5)*0.25, vy: (Math.random()-0.5)*0.25,
      r: Math.random()*1.4+0.3,
      alpha: Math.random()*0.35+0.05,
      color: Math.random()>0.7?'0,229,176':Math.random()>0.5?'91,155,255':Math.random()>0.5?'167,139,250':'255,190,77',
    }));
    let animId;
    const draw = () => {
      animId = requestAnimationFrame(draw);
      ctx.clearRect(0,0,W,H);
      particles.forEach(p => {
        p.x+=p.vx; p.y+=p.vy;
        if(p.x<0)p.x=W; if(p.x>W)p.x=0;
        if(p.y<0)p.y=H; if(p.y>H)p.y=0;
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
        ctx.fillStyle=`rgba(${p.color},${p.alpha})`; ctx.fill();
      });
      for(let i=0;i<particles.length;i++){
        for(let j=i+1;j<particles.length;j++){
          const dx=particles[i].x-particles[j].x, dy=particles[i].y-particles[j].y;
          const dist=Math.sqrt(dx*dx+dy*dy);
          if(dist<110){
            ctx.beginPath(); ctx.moveTo(particles[i].x,particles[i].y); ctx.lineTo(particles[j].x,particles[j].y);
            ctx.strokeStyle=`rgba(255,255,255,${0.03*(1-dist/110)})`; ctx.lineWidth=0.5; ctx.stroke();
          }
        }
      }
    };
    draw();
    const onResize=()=>{W=window.innerWidth;H=window.innerHeight;canvas.width=W;canvas.height=H;};
    window.addEventListener('resize',onResize);
    return()=>{cancelAnimationFrame(animId);window.removeEventListener('resize',onResize);};
  },[]);
  return <canvas ref={canvasRef} style={{position:'fixed',inset:0,zIndex:0,pointerEvents:'none'}}/>;
}

const WORLDS = [
  {
    id:'news', path:'/news', label:'Notícias', tag:'AO VIVO', accent:'#5b9bff', glow:'91,155,255',
    description:'Notícias virais de G1, Folha, CNN Brasil, R7 e mais — transformadas em roteiros para TikTok e YouTube.',
    stat1:'30+', stat1l:'Notícias', stat2:'Real-time', stat2l:'Atualização', icon:'📡',
    gradient:'linear-gradient(160deg, #080e1e 0%, #0d1f3c 60%, #060c18 100%)',
    glowBg:'radial-gradient(ellipse at 50% 110%, rgba(91,155,255,0.28) 0%, transparent 60%)',
    borderGlow:'rgba(91,155,255,0.55)',
  },
  {
    id:'science', path:'/science', label:'Ciência', tag:'3 FONTES', accent:'#00e5b0', glow:'0,229,176',
    description:'PubMed, Europe PMC e Semantic Scholar. Artigos científicos transformados em roteiros didáticos.',
    stat1:'33M+', stat1l:'Artigos', stat2:'3', stat2l:'Bases de dados', icon:'🔬',
    gradient:'linear-gradient(160deg, #020f0c 0%, #041a14 60%, #020c0a 100%)',
    glowBg:'radial-gradient(ellipse at 50% 110%, rgba(0,229,176,0.24) 0%, transparent 60%)',
    borderGlow:'rgba(0,229,176,0.55)',
  },
  {
    id:'books', path:'/books', label:'Livros', tag:'BIBLIOTECA', accent:'#ffbe4d', glow:'255,190,77',
    description:'Os maiores bestsellers de todos os tempos transformados em roteiros virais com IA.',
    stat1:'20+', stat1l:'Títulos', stat2:'9.4', stat2l:'Score médio', icon:'📚',
    gradient:'linear-gradient(160deg, #0f0800 0%, #1c1000 60%, #0a0600 100%)',
    glowBg:'radial-gradient(ellipse at 50% 110%, rgba(255,190,77,0.22) 0%, transparent 60%)',
    borderGlow:'rgba(255,190,77,0.55)',
  },
  {
    id:'video', path:'/video', label:'Novelinha Viral', tag:'NOVELINHA', accent:'#a78bfa', glow:'167,139,250',
    description:'Crie roteiros de novelinhas 3D Pixar com personagens animados — prompts prontos para qualquer gerador de vídeo IA.',
    stat1:'8s', stat1l:'Por cena', stat2:'Autor.ai', stat2l:'Gerado por IA', icon:'🎬',
    gradient:'linear-gradient(160deg, #0d0a1a 0%, #150f2a 60%, #080613 100%)',
    glowBg:'radial-gradient(ellipse at 50% 110%, rgba(167,139,250,0.26) 0%, transparent 60%)',
    borderGlow:'rgba(167,139,250,0.55)',
  },
  {
    id:'niche', path:'/niche', label:'Meu Canal', tag:'PERSONALIZADO', accent:'#ef4444', glow:'239,68,68',
    description:'Crie seu nicho, salve múltiplos canais e receba conteúdo personalizado para gerar roteiros todos os dias.',
    stat1:'∞', stat1l:'Nichos', stat2:'Diário', stat2l:'Atualizado', icon:'🎯',
    gradient:'linear-gradient(160deg, #0d0a1a 0%, #150f2a 60%, #080613 100%)',
    glowBg:'radial-gradient(ellipse at 50% 110%, rgba(239,68,68,0.26) 0%, transparent 60%)',
    borderGlow:'rgba(239,68,68,0.55)',
  },
];



function NeonTrace({ color, index }) {
  return (
    <div style={{
      position:'absolute', inset:-2, borderRadius:22,
      overflow:'hidden', pointerEvents:'none', zIndex:0,
    }}>
      <div style={{
        position:'absolute',
        width:'200%', height:'200%',
        top:'-50%', left:'-50%',
        background:`conic-gradient(from 0deg, transparent 0%, transparent 65%, rgba(${color},0.15) 72%, rgba(${color},0.7) 78%, rgba(${color},0.15) 84%, transparent 90%, transparent 100%)`,
        animation:`neonSpin ${18 - index * 2}s linear infinite`,
        animationDelay:`${index * -3}s`,
      }}/>
    </div>
  );
}

function WorldCard({ world, index, isMobile }) {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);
  const [visible, setVisible] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  const cardRef = useRef(null);
  useEffect(()=>{const t=setTimeout(()=>setVisible(true),120+index*130);return()=>clearTimeout(t);},[index]);

  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setMousePos({ x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height });
  };

  const tiltX = hovered ? (mousePos.y - 0.5) * -6 : 0;
  const tiltY = hovered ? (mousePos.x - 0.5) * 6 : 0;

  return (
    <div
      ref={cardRef}
      onClick={()=>navigate(world.path)}
      onMouseEnter={()=>setHovered(true)}
      onMouseLeave={()=>{ setHovered(false); setMousePos({x:0.5,y:0.5}); }}
      onMouseMove={handleMouseMove}
      style={{
        position:'relative', flex:1, minWidth:0, cursor:'pointer',
        borderRadius:20, overflow:'hidden', background:world.gradient,
        border:`2px solid ${hovered ? world.borderGlow : `rgba(${world.glow},0.18)`}`, outline: `1px solid rgba(255,255,255,${hovered ? 0.12 : 0.04})`, outlineOffset: '-3px',
        boxShadow: hovered
          ? `0 0 60px rgba(${world.glow},0.25), 0 32px 64px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.14), inset 0 -1px 0 rgba(0,0,0,0.3), inset 1px 0 0 rgba(255,255,255,0.06)`
          : `0 6px 32px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(0,0,0,0.2)`,
        transform: visible
          ? hovered ? `translateY(-6px) scale(1.01) perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)` : 'translateY(0) scale(1)'
          : 'translateY(50px) scale(0.94)',
        opacity: visible ? 1 : 0,
        transition: hovered
          ? 'transform 0.1s ease, box-shadow 0.32s ease, border-color 0.22s'
          : `transform 0.5s cubic-bezier(0.34,1.2,0.64,1), box-shadow 0.32s ease, border-color 0.22s, opacity 0.55s ease ${index*0.12}s`,
        zIndex: hovered ? 10 : 1,
        display:'flex', flexDirection:'column',
      }}
    >


      {/* Glow fundo */}
      <div style={{position:'absolute',inset:0,background:world.glowBg,opacity:hovered?1:0.6,transition:'opacity 0.4s',pointerEvents:'none'}}/>
      {/* Linha topo */}
      <div style={{position:'absolute',top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,transparent,${world.accent},transparent)`,opacity:hovered?0.9:0.25,transition:'opacity 0.28s'}}/>
      {/* Brilho interno */}
      <div style={{position:'absolute',top:0,left:0,right:0,height:'40%',background:'linear-gradient(180deg,rgba(255,255,255,0.035) 0%,transparent 100%)',pointerEvents:'none'}}/>

      <div style={{position:'relative',zIndex:2,padding: isMobile ? '16px 16px 14px' : '28px 26px 24px',display:'flex',flexDirection:'column',flex:1}}>
        {/* Top row */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom: isMobile ? 8 : 24}}>
          <div style={{display:'flex',alignItems:'center',gap:7}}>
            <div style={{width:6,height:6,borderRadius:'50%',background:world.accent,boxShadow:`0 0 12px rgba(${world.glow},1)`,animation:'vpPulse 2.2s ease infinite'}}/>
            <span style={{fontFamily:'Space Mono,monospace',fontSize:8,letterSpacing:'0.22em',color:`rgba(${world.glow},1)`,fontWeight:700}}>{world.tag}</span>
          </div>
          <span style={{fontSize: isMobile ? 22 : 26}}>{world.icon}</span>
        </div>

        {/* Título */}
        <h2 style={{
          fontFamily:'Syne,sans-serif',
          fontSize: isMobile ? 'clamp(20px,5vw,26px)' : 'clamp(28px,2.8vw,44px)',
          fontWeight:800,
          color: hovered ? world.accent : '#fff',
          margin: isMobile ? '0 0 4px' : '0 0 12px', lineHeight:0.92, letterSpacing:'-2px',
          transition:'color 0.26s ease',
        }}>{world.label}</h2>

        {/* Descrição */}
        <p style={{
          fontFamily:'DM Sans,sans-serif',fontSize: isMobile ? 12 : 13,fontWeight:300,
          color:'rgba(255,255,255,0.6)',margin:'0 0 auto',lineHeight:1.65,
        }}>{world.description}</p>

        {/* Divider + Stats */}
        <div style={{marginTop: isMobile ? 8 : 24, paddingTop: isMobile ? 8 : 18, borderTop:`1px solid rgba(${world.glow},0.1)`}}>
          <div style={{display:'flex',gap:20,marginBottom: isMobile ? 8 : 16}}>
            {[{v:world.stat1,l:world.stat1l},{v:world.stat2,l:world.stat2l}].map((s,i)=>(
              <div key={i}>
                <p style={{fontFamily:'Syne,sans-serif',fontSize: isMobile ? 20 : 22,fontWeight:700,color:world.accent,margin:0,lineHeight:1}}>{s.v}</p>
                <p style={{fontFamily:'Space Mono,monospace',fontSize:7,letterSpacing:'0.15em',color:'rgba(255,255,255,0.38)',margin:'4px 0 0'}}>{s.l.toUpperCase()}</p>
              </div>
            ))}
          </div>

          {/* CTA */}
          <button style={{
            width:'100%',padding:'12px 0',borderRadius:10,
            border:`1px solid rgba(${world.glow},${hovered?0.6:0.16})`,
            background: hovered ? `rgba(${world.glow},0.14)` : 'rgba(255,255,255,0.025)',
            color: hovered ? world.accent : 'rgba(255,255,255,0.35)',
            fontFamily:'Space Mono,monospace',fontSize:9,letterSpacing:'0.26em',cursor:'pointer',
            transition:'all 0.22s ease',
            display:'flex',alignItems:'center',justifyContent:'center',gap:10,
          }}>
            ACESSAR
            <span style={{display:'inline-block',transform:hovered?'translateX(4px)':'none',transition:'transform 0.22s'}}>→</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export function WorldPortal({ user, onLogout }) {
  const [visible, setVisible] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isMobile, setIsMobile] = useState(typeof window!=='undefined'&&window.innerWidth<768);
  useEffect(()=>{
    const t=setTimeout(()=>setVisible(true),60);
    const fn=()=>setIsMobile(window.innerWidth<768);
    window.addEventListener('resize',fn);
    return()=>{clearTimeout(t);window.removeEventListener('resize',fn);};
  },[]);

  return (
    <>
    <div style={{
      minHeight:'100vh', height:'100vh',
      background:'#07080d', color:'#fff',
      position:'relative', overflow:'hidden',
      display:'flex', flexDirection:'column',
      paddingTop:42,
    }}>
      <style dangerouslySetInnerHTML={{__html:`
        *{box-sizing:border-box;}
        @keyframes vpPulse{0%,100%{opacity:1;transform:scale(1);}50%{opacity:0.2;transform:scale(0.75);}}
        @keyframes vpRotate{to{transform:rotate(360deg);}}
        @keyframes vpFadeDown{from{opacity:0;transform:translateY(-8px);}to{opacity:1;transform:translateY(0);}}
        @keyframes vpFadeUp{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);}}
        @keyframes neonSpin{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}
      `}}/>

      <ParticleBackground/>
      {/* Radial central */}
      <div style={{position:'fixed',inset:0,zIndex:0,pointerEvents:'none',background:'radial-gradient(ellipse at 50% 60%, rgba(12,22,60,0.6) 0%, transparent 68%)'}}/>

      {/* Header */}
      <header style={{
        position:'relative', zIndex:10, height:58, flexShrink:0,
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding: isMobile ? '0 20px' : '0 40px',
        borderBottom:'1px solid rgba(255,255,255,0.055)',
        background:'rgba(7,8,13,0.85)', backdropFilter:'blur(28px)',
        animation:'vpFadeDown 0.5s ease both',
      }}>
        {/* Logo */}
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{position:'relative',width:30,height:30}}>
            <div style={{position:'absolute',inset:0,borderRadius:'50%',border:'1.5px solid rgba(0,229,176,0.3)'}}/>
            <div style={{position:'absolute',inset:5,borderRadius:'50%',background:'rgba(0,229,176,0.1)',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <div style={{width:7,height:7,borderRadius:'50%',background:'#00e5b0',boxShadow:'0 0 10px rgba(0,229,176,0.9)'}}/>
            </div>
          </div>
          <div style={{display:'flex',alignItems:'baseline',gap:6}}>
            <span style={{fontFamily:'Syne,sans-serif',fontSize:15,fontWeight:800,letterSpacing:'-0.3px',color:'#fff'}}>AUTOR</span>
            <span style={{fontFamily:'Syne,sans-serif',fontSize:15,fontWeight:800,color:'rgba(0,229,176,0.9)',letterSpacing:'-0.3px'}}>.AI</span>
          </div>
        </div>

        {/* Right */}
        <div style={{display:'flex',alignItems:'center',gap:16}}>
          {!isMobile && (
            <span style={{fontFamily:'DM Sans,sans-serif',fontSize:13,color:'rgba(255,255,255,0.45)',fontWeight:400,letterSpacing:'0.01em'}}>
              Gerador de roteiros com Inteligência Artificial
            </span>
          )}
          {user && (
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              {user.picture && <img src={user.picture} alt="" style={{width:28,height:28,borderRadius:'50%',border:'1px solid rgba(255,255,255,0.15)'}}/>}
              {!isMobile && <span style={{fontFamily:'DM Sans,sans-serif',fontSize:13,color:'rgba(255,255,255,0.75)',fontWeight:500}}>{user.name?.split(' ')[0]}</span>}
              <button onClick={onLogout} style={{fontFamily:'Space Mono,monospace',fontSize:9,color:'rgba(255,255,255,0.6)',background:'none',border:'1px solid rgba(255,255,255,0.2)',borderRadius:8,padding:'4px 8px',cursor:'pointer',letterSpacing:'0.1em'}}>SAIR</button>
            </div>
          )}
          <div style={{display:'flex',alignItems:'center',gap:6,padding:'5px 12px',borderRadius:20,background:'rgba(0,229,176,0.07)',border:'1px solid rgba(0,229,176,0.18)'}}>
            <div style={{width:5,height:5,borderRadius:'50%',background:'#00e5b0',boxShadow:'0 0 6px #00e5b0',animation:'vpPulse 2s ease infinite'}}/>
            <span style={{fontFamily:'Space Mono,monospace',fontSize:7,color:'rgba(0,229,176,0.8)',letterSpacing:'0.2em'}}>ONLINE</span>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div style={{
        position:'relative', zIndex:5, flexShrink:0,
        padding: isMobile ? '16px 20px 8px' : '20px 40px 12px',
        opacity: visible ? 1 : 0,
        transform: visible ? 'none' : 'translateY(10px)',
        transition:'opacity 0.55s ease 0.08s, transform 0.55s ease 0.08s',
        display:'flex', alignItems: isMobile ? 'flex-start' : 'flex-end',
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent:'space-between', flexWrap:'wrap', gap: isMobile ? 8 : 10,
      }}>
        <div>
          <p style={{fontFamily:'Space Mono,monospace',fontSize:10,letterSpacing:'0.4em',color:'rgba(255,255,255,0.55)',fontWeight:600,margin:'0 0 7px'}}>
            SELECIONE SEU UNIVERSO
          </p>
          <h1 style={{
            fontFamily:'Syne,sans-serif',
            fontSize: isMobile ? 'clamp(24px,7vw,36px)' : 'clamp(28px,2.8vw,42px)',
            fontWeight:800, margin:0, lineHeight:1, letterSpacing:'-1.5px',
            background:'linear-gradient(90deg,#fff 0%,rgba(255,255,255,0.5) 100%)',
            WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent',
          }}>
            Crie roteiros virais com IA
          </h1>
        </div>
        {!isMobile && (
          <div style={{display:'flex',alignItems:'center',gap:32}}>
            <div style={{display:'flex',gap:24,opacity:0.55}}>
              {[{v:'4',l:'Mundos'},{v:'33M+',l:'Fontes'},{v:'∞',l:'Roteiros'}].map((s,i)=>(
                <div key={i} style={{textAlign:'center'}}>
                  <p style={{fontFamily:'-apple-system,sans-serif',fontSize:18,fontWeight:700,color:'#fff',margin:0,lineHeight:1}}>{s.v}</p>
                  <p style={{fontFamily:'-apple-system,sans-serif',fontSize:9,letterSpacing:'0.1em',color:'rgba(255,255,255,0.55)',margin:'3px 0 0'}}>{s.l}</p>
                </div>
              ))}
            </div>
            <button onClick={()=>setShowHistory(true)} style={{fontFamily:'Space Mono,monospace',fontSize:10,letterSpacing:'0.1em',color:'#a78bfa',background:'rgba(167,139,250,0.1)',border:'1px solid rgba(167,139,250,0.3)',borderRadius:10,padding:'8px 18px',cursor:'pointer',whiteSpace:'nowrap'}}>📋 MEUS ROTEIROS</button>
          </div>
        )}
      </div>

      {/* Cards */}
      <div style={{
        position:'relative', zIndex:5, flex:1, minHeight:0,
        padding: isMobile ? '8px 16px 24px' : '8px 40px 32px',
        display:'flex',
        flexDirection: isMobile ? 'column' : 'row',
        gap: isMobile ? 10 : 12,
        alignItems:'stretch',
        overflowY: isMobile ? 'auto' : 'hidden',
      }}>
        {WORLDS.map((w,i)=><WorldCard key={w.id} world={w} index={i} isMobile={isMobile}/>)}
      </div>

      {/* Footer */}
      <div style={{
        position:'relative', zIndex:5, flexShrink:0,
        padding: isMobile ? '6px 16px 8px' : '7px 40px 12px',
        display: isMobile ? 'none' : 'flex', justifyContent:'space-between', alignItems:'center',
        borderTop:'1px solid rgba(255,255,255,0.04)',
      }}>
        <span style={{fontFamily:"Space Mono,monospace",fontSize:9,letterSpacing:"0.15em",color:"rgba(255,255,255,0.35)"}}>AUTOR.AI © 2026</span>
        <div style={{display:'flex',gap:16,alignItems:'center'}}>
          {[['Termos de Uso','/termos'],['Privacidade','/privacidade']].map(([label,href],i)=>(
            <a key={i} href={href} style={{fontFamily:"Space Mono,monospace",fontSize:9,letterSpacing:"0.12em",color:"rgba(255,255,255,0.4)",textDecoration:"none"}}>{label}</a>
          ))}
        </div>
      </div>
    </div>
    {showHistory && <SavedScripts onClose={() => setShowHistory(false)} />}
    </>
  );
}
