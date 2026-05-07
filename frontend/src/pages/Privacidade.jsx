import { useNavigate } from 'react-router-dom';

export function Privacidade() {
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
    table: { width:'100%', borderCollapse:'collapse', margin:'14px 0 18px', fontSize:13 },
    th: { background:'#111120', color:'#8888aa', textAlign:'left', padding:'9px 13px', border:'1px solid #222' },
    td: { padding:'9px 13px', border:'1px solid #1a1a1a', color:'#aaa', verticalAlign:'top' },
    footer: { marginTop:56, paddingTop:20, borderTop:'1px solid #1e1e1e', fontSize:12, color:'#444' },
  };
  return (
    <div style={s.wrap}>
      <div style={s.inner}>
        <button style={s.back} onClick={() => nav('/')}>← VOLTAR</button>
        <div style={s.logo}>Autor<span style={s.logoSpan}>.AI</span></div>
        <h1 style={s.h1}>Política de Privacidade</h1>
        <p style={s.sub}>Última atualização: maio de 2026 · Renan de Oliveira Filgueiras · Ponta Grossa, PR</p>
        <div style={s.box}>Em conformidade com a LGPD — Lei 13.709/2018.</div>
        <h2 style={s.h2}>1. Controlador dos Dados</h2>
        <p style={s.p}>Renan de Oliveira Filgueiras · Ponta Grossa, Paraná · autor.ai.app@gmail.com</p>
        <h2 style={s.h2}>2. Dados Coletados</h2>
        <table style={s.table}>
          <thead><tr><th style={s.th}>Dado</th><th style={s.th}>Finalidade</th><th style={s.th}>Base legal</th></tr></thead>
          <tbody>
            <tr><td style={s.td}>Nome e e-mail</td><td style={s.td}>Criar conta</td><td style={s.td}>Execução de contrato (Art. 7º, V)</td></tr>
            <tr><td style={s.td}>Dados de pagamento</td><td style={s.td}>Processar assinatura</td><td style={s.td}>Execução de contrato (Art. 7º, V)</td></tr>
            <tr><td style={s.td}>Histórico de roteiros</td><td style={s.td}>Exibir histórico</td><td style={s.td}>Legítimo interesse (Art. 7º, IX)</td></tr>
            <tr><td style={s.td}>Logs de acesso</td><td style={s.td}>Segurança</td><td style={s.td}>Legítimo interesse (Art. 7º, IX)</td></tr>
          </tbody>
        </table>
        <p style={s.p}>Não coletamos dados sensíveis. Não vendemos nem alugamos seus dados.</p>
        <h2 style={s.h2}>3. Compartilhamento</h2>
        <ul style={s.ul}>
          <li>Gateways de pagamento (Stripe, Hotmart) — somente para cobrança</li>
          <li>APIs de IA (Google Gemini, Anthropic) — sem dados pessoais identificáveis</li>
          <li>Autoridades — quando exigido por lei</li>
        </ul>
        <h2 style={s.h2}>4. Segurança e Retenção</h2>
        <p style={s.p}>Tráfego com HTTPS/TLS. Dados de pagamento ficam apenas no gateway. Após cancelamento, dados mantidos por até 5 anos por obrigação legal e então excluídos.</p>
        <h2 style={s.h2}>5. Seus Direitos</h2>
        <p style={s.p}>Acesso, correção, exclusão, portabilidade e revogação de consentimento. Envie para autor.ai.app@gmail.com — respondemos em até 15 dias úteis. Reclamações: <a href="https://www.gov.br/anpd" target="_blank" rel="noopener noreferrer" style={{color:'#7c5cfc'}}>gov.br/anpd</a></p>
        <h2 style={s.h2}>6. Cookies</h2>
        <p style={s.p}>Cookies essenciais de sessão e análise anonimizada. Você pode desabilitar no navegador.</p>
        <h2 style={s.h2}>7. Menores</h2>
        <p style={s.p}>Serviço não destinado a menores de 18 anos. Dados de menores identificados serão excluídos imediatamente.</p>
        <div style={s.footer}>Autor.AI · Renan de Oliveira Filgueiras · Ponta Grossa, PR · LGPD — Lei 13.709/2018.</div>
      </div>
    </div>
  );
}
