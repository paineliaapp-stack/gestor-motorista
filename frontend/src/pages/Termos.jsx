import { useNavigate } from 'react-router-dom';

export function Termos() {
  const nav = useNavigate();
  const s = {
    wrap: { minHeight:'100vh', background:'#0a0a12', color:'#e2e2e2', fontFamily:'DM Sans, sans-serif', padding:'0 0 80px' },
    inner: { maxWidth:760, margin:'0 auto', padding:'48px 24px 0' },
    back: { background:'none', border:'none', color:'rgba(255,255,255,0.35)', fontFamily:'Space Mono, monospace', fontSize:11, letterSpacing:'0.12em', cursor:'pointer', marginBottom:40, display:'flex', alignItems:'center', gap:6, padding:0 },
    logo: { fontFamily:'Syne, sans-serif', fontSize:22, fontWeight:700, color:'#fff', marginBottom:6 },
    logoSpan: { color:'#7c5cfc' },
    h1: { fontSize:28, fontWeight:700, color:'#fff', margin:'0 0 6px', fontFamily:'Syne, sans-serif' },
    sub: { color:'#666', fontSize:13, marginBottom:48 },
    h2: { fontSize:14, fontWeight:600, color:'#fff', margin:'32px 0 10px', paddingLeft:12, borderLeft:'3px solid #7c5cfc', fontFamily:'Syne, sans-serif' },
    p: { color:'#aaa', fontSize:14, lineHeight:1.75, marginBottom:12 },
    ul: { color:'#aaa', fontSize:14, lineHeight:1.75, marginBottom:12, paddingLeft:20 },
    box: { background:'#111120', border:'1px solid #222240', borderRadius:8, padding:'14px 18px', margin:'16px 0', fontSize:13, color:'#8888aa', lineHeight:1.6 },
    footer: { marginTop:56, paddingTop:20, borderTop:'1px solid #1e1e1e', fontSize:12, color:'#444' },
  };
  return (
    <div style={s.wrap}>
      <div style={s.inner}>
        <button style={s.back} onClick={() => nav('/')}>← VOLTAR</button>
        <div style={s.logo}>Autor<span style={s.logoSpan}>.AI</span></div>
        <h1 style={s.h1}>Termos de Uso</h1>
        <p style={s.sub}>Última atualização: maio de 2026 · Renan de Oliveira Filgueiras · Ponta Grossa, PR</p>
        <h2 style={s.h2}>1. Aceitação dos Termos</h2>
        <p style={s.p}>Ao acessar ou utilizar a plataforma Autor.AI, você concorda integralmente com estes Termos de Uso.</p>
        <h2 style={s.h2}>2. O Serviço</h2>
        <p style={s.p}>O Autor.AI gera roteiros originais por IA com base em notícias públicas, conteúdo científico de acesso aberto e inspiração temática em obras literárias. Os roteiros não reproduzem, resumem nem representam oficialmente nenhuma obra, publicação ou artigo.</p>
        <h2 style={s.h2}>3. Conteúdo Gerado por IA</h2>
        <div style={s.box}>No Mundo Notícias, a narrativa e o formato são gerados por IA com base no título e resumo da notícia — os fatos são de responsabilidade da fonte original. Nos demais mundos, o conteúdo é inspirado em temas públicos. Sempre revise antes de publicar.</div>
        <h2 style={s.h2}>4. Responsabilidade pelo Uso</h2>
        <p style={s.p}>Você é responsável pelo conteúdo que publicar. É proibido usar a plataforma para desinformação, plágio, discurso de ódio, ou qualquer violação da legislação brasileira.</p>
        <h2 style={s.h2}>5. Propriedade Intelectual</h2>
        <p style={s.p}>Os roteiros gerados pertencem ao usuário que os solicitou. O código e design do Autor.AI são propriedade de Renan de Oliveira Filgueiras. Capas de livros são exibidas via Google Books.</p>
        <h2 style={s.h2}>6. Planos e Pagamentos</h2>
        <p style={s.p}>Planos cobrados mensalmente. Alterações com aviso prévio de 30 dias. Sem reembolso de mensalidades em curso, salvo previsão do CDC. Cancelamento mantém acesso até o fim do período pago.</p>
        <h2 style={s.h2}>7. Limitação de Responsabilidade</h2>
        <p style={s.p}>Renan de Oliveira Filgueiras não se responsabiliza por danos indiretos ou consequentes decorrentes do uso do serviço ou dos roteiros publicados pelo usuário.</p>
        <h2 style={s.h2}>8. Lei Aplicável</h2>
        <p style={s.p}>Regido pelas leis do Brasil. Foro: comarca de Ponta Grossa, Paraná.</p>
        <h2 style={s.h2}>9. Contato</h2>
        <p style={s.p}>autor.ai.app@gmail.com</p>
        <div style={s.footer}>Autor.AI · Renan de Oliveira Filgueiras · Ponta Grossa, PR · Em conformidade com CDC (Lei 8.078/90) e LGPD (Lei 13.709/18).</div>
      </div>
    </div>
  );
}
