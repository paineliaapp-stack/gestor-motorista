f = open('templates/index.html', 'w', encoding='utf-8')
f.write('''<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Painel.IA</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<style>
:root{--bg:#0e0e0e;--surface:#1a1a1a;--surface2:#242424;--surface3:#2e2e2e;--gold:#c9a84c;--gold2:#e8c97a;--green:#4caf78;--red:#e05c5c;--blue:#5b9cf6;--text:#f0ede6;--muted:#888;--border:#2e2e2e}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:var(--bg);color:var(--text);min-height:100vh}
/* HEADER */
.header{padding:20px 28px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border)}
.logo{display:flex;align-items:center;gap:10px}
.logo-icon{width:36px;height:36px;background:linear-gradient(135deg,#c9a84c,#8b6914);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px}
.logo-text{font-size:18px;font-weight:700;letter-spacing:-0.3px}
.logo-text span{color:var(--gold)}
.user-pill{display:flex;align-items:center;gap:8px;background:var(--surface);padding:8px 14px;border-radius:999px;border:1px solid var(--border)}
.user-dot{width:8px;height:8px;background:var(--green);border-radius:50%}
.user-name{font-size:13px;font-weight:500}
/* LAYOUT */
.layout{display:grid;grid-template-columns:220px 1fr;min-height:calc(100vh - 65px)}
/* SIDEBAR */
.sidebar{background:var(--surface);border-right:1px solid var(--border);padding:24px 0}
.nav-item{display:flex;align-items:center;gap:12px;padding:12px 24px;cursor:pointer;font-size:14px;color:var(--muted);transition:all .2s;border-left:3px solid transparent}
.nav-item:hover{color:var(--text);background:var(--surface2)}
.nav-item.ativo{color:var(--gold);background:rgba(201,168,76,.08);border-left-color:var(--gold)}
.nav-icon{font-size:18px;width:24px;text-align:center}
.nav-section{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;padding:20px 24px 8px}
/* MAIN */
.main{padding:28px;overflow-y:auto}
.page{display:none}.page.ativo{display:block}
/* CARDS TOPO */
.top-cards{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px}
.card{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:20px;position:relative;overflow:hidden}
.card::before{content:"";position:absolute;top:-30px;right:-30px;width:80px;height:80px;border-radius:50%;opacity:.06}
.card-ganho::before{background:var(--green)}
.card-despesa::before{background:var(--red)}
.card-lucro::before{background:var(--gold)}
.card-hora::before{background:var(--blue)}
.card-label{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;margin-bottom:12px;display:flex;align-items:center;gap:6px}
.card-valor{font-size:26px;font-weight:700;letter-spacing:-1px;margin-bottom:4px}
.card-sub{font-size:11px;color:var(--muted)}
.c-verde{color:var(--green)}.c-vermelho{color:var(--red)}.c-ouro{color:var(--gold)}.c-azul{color:var(--blue)}
/* SECAO DE GRAFICOS */
.charts-row{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px}
.chart-card{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:24px}
.chart-card h3{font-size:13px;color:var(--muted);margin-bottom:20px;text-transform:uppercase;letter-spacing:.5px}
/* CALENDARIO */
.cal-card{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:24px;margin-bottom:24px}
.cal-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}
.cal-title{font-size:16px;font-weight:600}
.cal-legend{display:flex;gap:16px}
.leg-item{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--muted)}
.leg-dot{width:8px;height:8px;border-radius:50%}
.cal-weekdays{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:8px}
.cal-wd{text-align:center;font-size:11px;color:var(--muted);padding:4px}
.cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}
.cal-day{aspect-ratio:1;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:500;cursor:pointer;transition:transform .1s;position:relative}
.cal-day:hover{transform:scale(1.1)}
.cal-vazio{background:transparent;color:transparent}
.cal-sem-trabalho{background:var(--surface2);color:var(--muted)}
.cal-trabalhado{background:rgba(91,156,246,.15);color:var(--blue);border:1px solid rgba(91,156,246,.3)}
.cal-meta-ok{background:rgba(76,175,120,.18);color:var(--green);border:1px solid rgba(76,175,120,.4)}
.cal-meta-nao{background:rgba(224,92,92,.15);color:var(--red);border:1px solid rgba(224,92,92,.3)}
.cal-hoje{box-shadow:0 0 0 2px var(--gold)}
/* FORM */
.form-card{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:28px;margin-bottom:20px}
.form-title{font-size:16px;font-weight:600;margin-bottom:6px}
.form-sub{font-size:13px;color:var(--muted);margin-bottom:24px}
.tipo-selector{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px}
.tipo-btn{padding:14px;border:2px solid var(--border);border-radius:12px;background:transparent;color:var(--muted);font-size:14px;font-weight:600;cursor:pointer;transition:all .2s;text-align:center}
.tipo-btn.sel-ganho{border-color:var(--green);color:var(--green);background:rgba(76,175,120,.1)}
.tipo-btn.sel-despesa{border-color:var(--red);color:var(--red);background:rgba(224,92,92,.1)}
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}
.form-group{display:flex;flex-direction:column;gap:6px}
.form-group label{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px}
input,select{background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px 14px;color:var(--text);font-size:14px;width:100%;transition:border .2s}
input:focus,select:focus{outline:none;border-color:var(--gold)}
select option{background:var(--surface2)}
.cat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:20px}
.cat-btn{padding:10px 8px;border:1px solid var(--border);border-radius:10px;background:var(--surface2);color:var(--muted);font-size:11px;cursor:pointer;text-align:center;transition:all .2s;line-height:1.3}
.cat-btn:hover{border-color:var(--gold);color:var(--gold)}
.cat-btn.ativo{border-color:var(--gold);color:var(--gold);background:rgba(201,168,76,.1)}
.cat-emoji{display:block;font-size:18px;margin-bottom:3px}
.btn-salvar{width:100%;padding:16px;background:linear-gradient(135deg,#c9a84c,#8b6914);border:none;border-radius:12px;color:#0e0e0e;font-size:15px;font-weight:700;cursor:pointer;transition:opacity .2s}
.btn-salvar:hover{opacity:.9}
/* HISTORICO */
.hist-filtros{display:flex;gap:10px;margin-bottom:20px}
.filtro-btn{padding:8px 16px;border:1px solid var(--border);border-radius:999px;background:transparent;color:var(--muted);font-size:12px;cursor:pointer}
.filtro-btn.ativo{background:var(--gold);color:#0e0e0e;border-color:var(--gold);font-weight:600}
.lancamento-item{display:flex;align-items:center;gap:14px;padding:14px 0;border-bottom:1px solid var(--border)}
.lanc-icon{width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}
.lanc-info{flex:1}
.lanc-cat{font-size:14px;font-weight:500}
.lanc-data{font-size:12px;color:var(--muted)}
.lanc-val{font-size:15px;font-weight:700}
/* TOAST */
.toast{position:fixed;bottom:24px;right:24px;padding:14px 20px;border-radius:12px;font-size:14px;font-weight:500;z-index:999;transform:translateY(100px);opacity:0;transition:all .3s}
.toast.show{transform:translateY(0);opacity:1}
.toast-ok{background:#1a3d2b;color:var(--green);border:1px solid rgba(76,175,120,.4)}
.toast-erro{background:#3d1a1a;color:var(--red);border:1px solid rgba(224,92,92,.4)}
/* RESUMO CATEGORIAS */
.cat-resumo{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:24px;margin-bottom:24px}
.cat-resumo h3{font-size:13px;color:var(--muted);margin-bottom:16px;text-transform:uppercase;letter-spacing:.5px}
.cat-barra-item{margin-bottom:14px}
.cat-barra-topo{display:flex;justify-content:space-between;margin-bottom:5px;font-size:12px}
.cat-barra-bg{background:var(--surface2);border-radius:999px;height:6px}
.cat-barra-fill{height:6px;border-radius:999px;background:linear-gradient(90deg,var(--gold),var(--gold2));transition:width .5s}
</style>
</head>
<body>
<div class="header">
  <div class="logo">
    <div class="logo-icon">🚗</div>
    <div class="logo-text">Painel<span>.IA</span></div>
  </div>
  <div class="user-pill">
    <div class="user-dot"></div>
    <span class="user-name" id="user-nome">Carregando...</span>
  </div>
</div>

<div class="layout">
  <nav class="sidebar">
    <div class="nav-section">Principal</div>
    <div class="nav-item ativo" onclick="nav(this,\'dashboard\')"><span class="nav-icon">📊</span> Dashboard</div>
    <div class="nav-item" onclick="nav(this,\'registrar\')"><span class="nav-icon">➕</span> Registrar</div>
    <div class="nav-item" onclick="nav(this,\'historico\')"><span class="nav-icon">📋</span> Histórico</div>
    <div class="nav-section">Análise</div>
    <div class="nav-item" onclick="nav(this,\'calendario\')"><span class="nav-icon">📅</span> Calendário</div>
    <div class="nav-item" onclick="nav(this,\'categorias\')"><span class="nav-icon">🏷️</span> Categorias</div>
  </nav>

  <main class="main">
    <!-- DASHBOARD -->
    <div class="page ativo" id="page-dashboard">
      <div class="top-cards">
        <div class="card card-ganho"><div class="card-label">💰 Ganhos do mês</div><div class="card-valor c-verde" id="c-ganhos">R$ 0,00</div><div class="card-sub">bruto total</div></div>
        <div class="card card-despesa"><div class="card-label">💸 Despesas</div><div class="card-valor c-vermelho" id="c-despesas">R$ 0,00</div><div class="card-sub">todas as categorias</div></div>
        <div class="card card-lucro"><div class="card-label">✨ Lucro real</div><div class="card-valor c-ouro" id="c-lucro">R$ 0,00</div><div class="card-sub">o que sobrou</div></div>
        <div class="card card-hora"><div class="card-label">⏱️ Por hora</div><div class="card-valor c-azul" id="c-hora">R$ 0,00</div><div class="card-sub">ganho médio</div></div>
      </div>
      <div class="charts-row">
        <div class="chart-card"><h3>Ganhos vs Despesas</h3><canvas id="g-pizza" height="200"></canvas></div>
        <div class="chart-card"><h3>Evolução diária</h3><canvas id="g-linha" height="200"></canvas></div>
      </div>
      <div class="cat-resumo">
        <h3>Despesas por categoria</h3>
        <div id="barras-cat"></div>
      </div>
    </div>

    <!-- REGISTRAR -->
    <div class="page" id="page-registrar">
      <div class="form-card">
        <div class="form-title">Novo lançamento</div>
        <div class="form-sub">Registre ganhos ou despesas do seu dia</div>
        <div class="tipo-selector">
          <button class="tipo-btn sel-ganho" id="btn-ganho" onclick="selTipo(\'ganho\')">💰 Ganho</button>
          <button class="tipo-btn" id="btn-despesa" onclick="selTipo(\'despesa\')">💸 Despesa</button>
        </div>
        <div id="area-plataforma">
          <div class="form-grid">
            <div class="form-group"><label>Plataforma</label>
              <select id="f-plataforma"><option value="uber">Uber</option><option value="99">99</option><option value="indrive">InDrive</option><option value="outro">Outro</option></select></div>
            <div class="form-group"><label>Valor (R$)</label><input type="number" id="f-valor" placeholder="0,00" step="0.01"></div>
          </div>
          <div class="form-grid">
            <div class="form-group"><label>Horas rodadas</label><input type="number" id="f-horas" placeholder="0" step="0.5"></div>
            <div class="form-group"><label>Km rodados</label><input type="number" id="f-km" placeholder="0"></div>
          </div>
        </div>
        <div id="area-categoria" style="display:none">
          <div class="form-group" style="margin-bottom:16px"><label>Valor (R$)</label><input type="number" id="f-valor-desp" placeholder="0,00" step="0.01"></div>
          <div class="form-group" style="margin-bottom:12px"><label>Categoria</label></div>
          <div class="cat-grid" id="cat-grid"></div>
        </div>
        <div class="form-group" style="margin-bottom:20px"><label>Observação (opcional)</label><input type="text" id="f-obs" placeholder="ex: gasolina posto shell"></div>
        <button class="btn-salvar" onclick="salvar()">Salvar lançamento</button>
      </div>
    </div>

    <!-- HISTORICO -->
    <div class="page" id="page-historico">
      <div class="form-card">
        <div class="hist-filtros">
          <button class="filtro-btn ativo" onclick="filtrar(this,\'todos\')">Todos</button>
          <button class="filtro-btn" onclick="filtrar(this,\'ganho\')">Ganhos</button>
          <button class="filtro-btn" onclick="filtrar(this,\'despesa\')">Despesas</button>
        </div>
        <div id="lista-lancamentos"></div>
      </div>
    </div>

    <!-- CALENDARIO -->
    <div class="page" id="page-calendario">
      <div class="cal-card">
        <div class="cal-header">
          <div class="cal-title" id="cal-mes-titulo"></div>
          <div class="cal-legend">
            <div class="leg-item"><div class="leg-dot" style="background:var(--green)"></div>Meta batida</div>
            <div class="leg-item"><div class="leg-dot" style="background:var(--red)"></div>Sem meta</div>
            <div class="leg-item"><div class="leg-dot" style="background:var(--blue)"></div>Trabalhou</div>
            <div class="leg-item"><div class="leg-dot" style="background:var(--surface2)"></div>Folga</div>
          </div>
        </div>
        <div class="cal-weekdays">
          <div class="cal-wd">Dom</div><div class="cal-wd">Seg</div><div class="cal-wd">Ter</div>
          <div class="cal-wd">Qua</div><div class="cal-wd">Qui</div><div class="cal-wd">Sex</div><div class="cal-wd">Sáb</div>
        </div>
        <div class="cal-grid" id="cal-grid"></div>
      </div>
    </div>

    <!-- CATEGORIAS -->
    <div class="page" id="page-categorias">
      <div class="cat-resumo">
        <h3>Despesas por categoria este mês</h3>
        <div id="barras-cat2"></div>
      </div>
      <div class="chart-card"><h3>Distribuição de despesas</h3><canvas id="g-categorias" height="300"></canvas></div>
    </div>
  </main>
</div>

<div class="toast" id="toast"></div>

<script>
const API = "http://127.0.0.1:8002";
let MID = localStorage.getItem("mid");
let tipoAtual = "ganho";
let catAtual = "";
let todosLanc = [];
let grafPizza=null,grafLinha=null,grafCat=null;

const CATS = [
  {k:"combustivel",e:"⛽",n:"Combustível"},
  {k:"manutencao",e:"🔧",n:"Manutenção"},
  {k:"aluguel_carro",e:"🚗",n:"Aluguel Carro"},
  {k:"financiamento",e:"💳",n:"Financiamento"},
  {k:"seguro",e:"🛡️",n:"Seguro"},
  {k:"ipva",e:"📄",n:"IPVA/Licenc."},
  {k:"multa",e:"🚨",n:"Multa"},
  {k:"lavagem",e:"🧹",n:"Lavagem"},
  {k:"mercado",e:"🛒",n:"Mercado"},
  {k:"restaurante",e:"🍔",n:"Restaurante"},
  {k:"farmacia",e:"💊",n:"Farmácia"},
  {k:"saude",e:"🏥",n:"Plano Saúde"},
  {k:"celular",e:"📱",n:"Celular"},
  {k:"internet",e:"📶",n:"Internet"},
  {k:"streaming",e:"🎬",n:"Streaming"},
  {k:"aluguel_casa",e:"🏠",n:"Aluguel Casa"},
  {k:"condominio",e:"🏢",n:"Condomínio"},
  {k:"luz_agua",e:"💡",n:"Luz/Água/Gás"},
  {k:"roupa",e:"👕",n:"Roupas"},
  {k:"lazer",e:"🎮",n:"Lazer"},
  {k:"educacao",e:"📚",n:"Educação"},
  {k:"investimento",e:"📈",n:"Investimento"},
  {k:"emprestimo",e:"🏦",n:"Empréstimo"},
  {k:"outros",e:"📦",n:"Outros"},
];

function toast(msg,ok=true){const t=document.getElementById("toast");t.textContent=msg;t.className="toast "+(ok?"toast-ok":"toast-erro")+" show";setTimeout(()=>t.classList.remove("show"),3000)}
function fmt(v){return"R$ "+parseFloat(v||0).toFixed(2).replace(".",",")}

function nav(el,pg){
  document.querySelectorAll(".nav-item").forEach(x=>x.classList.remove("ativo"));
  document.querySelectorAll(".page").forEach(x=>x.classList.remove("ativo"));
  el.classList.add("ativo");
  document.getElementById("page-"+pg).classList.add("ativo");
  if(pg==="dashboard")carregarDash();
  if(pg==="historico")carregarHist("todos");
  if(pg==="calendario")renderCal();
  if(pg==="categorias")carregarCats();
}

function selTipo(t){
  tipoAtual=t;
  document.getElementById("btn-ganho").className="tipo-btn"+(t==="ganho"?" sel-ganho":"");
  document.getElementById("btn-despesa").className="tipo-btn"+(t==="despesa"?" sel-despesa":"");
  document.getElementById("area-plataforma").style.display=t==="ganho"?"block":"none";
  document.getElementById("area-categoria").style.display=t==="despesa"?"block":"none";
}

function buildCatGrid(){
  const g=document.getElementById("cat-grid");g.innerHTML="";
  CATS.forEach(c=>{
    const b=document.createElement("button");
    b.className="cat-btn";b.dataset.k=c.k;
    b.innerHTML=`<span class="cat-emoji">${c.e}</span>${c.n}`;
    b.onclick=()=>{document.querySelectorAll(".cat-btn").forEach(x=>x.classList.remove("ativo"));b.classList.add("ativo");catAtual=c.k};
    g.appendChild(b);
  });
}

async function salvar(){
  if(!MID){toast("Motorista não encontrado",false);return}
  let body={motorista_id:MID,tipo:tipoAtual};
  if(tipoAtual==="ganho"){
    body.valor=parseFloat(document.getElementById("f-valor").value)||0;
    body.plataforma=document.getElementById("f-plataforma").value;
    body.horas_rodadas=parseFloat(document.getElementById("f-horas").value)||null;
    body.km_rodados=parseFloat(document.getElementById("f-km").value)||null;
  }else{
    body.valor=parseFloat(document.getElementById("f-valor-desp").value)||0;
    body.descricao=catAtual||"outros";
  }
  body.observacao=document.getElementById("f-obs").value||null;
  if(!body.valor||body.valor<=0){toast("Informe um valor válido",false);return}
  const r=await fetch(API+"/lancamentos",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  if(r.ok){toast("Lançamento salvo! ✓");document.getElementById("f-valor").value="";document.getElementById("f-valor-desp").value="";document.getElementById("f-obs").value=""}
  else toast("Erro ao salvar",false);
}

async function carregarDash(){
  if(!MID)return;
  const r=await fetch(API+"/resumo/"+MID);
  const d=await r.json();
  todosLanc=d.lancamentos||[];
  document.getElementById("c-ganhos").textContent=fmt(d.ganhos);
  document.getElementById("c-despesas").textContent=fmt(d.despesas);
  document.getElementById("c-lucro").textContent=fmt(d.lucro);
  document.getElementById("c-hora").textContent=fmt(d.ganho_por_hora);
  // pizza
  if(grafPizza)grafPizza.destroy();
  grafPizza=new Chart(document.getElementById("g-pizza"),{type:"doughnut",data:{labels:["Ganhos","Despesas"],datasets:[{data:[d.ganhos,d.despesas],backgroundColor:["#4caf78","#e05c5c"],borderWidth:0,hoverOffset:4}]},options:{cutout:"70%",plugins:{legend:{labels:{color:"#888",font:{size:12}}}}}});
  // linha
  const pd={};todosLanc.forEach(l=>{if(!pd[l.data])pd[l.data]=0;if(l.tipo==="ganho")pd[l.data]+=parseFloat(l.valor)});
  const dias=Object.keys(pd).sort();
  if(grafLinha)grafLinha.destroy();
  grafLinha=new Chart(document.getElementById("g-linha"),{type:"line",data:{labels:dias.map(x=>x.slice(5)),datasets:[{label:"Ganhos",data:dias.map(x=>pd[x]),borderColor:"#c9a84c",backgroundColor:"rgba(201,168,76,.1)",fill:true,tension:.4,pointBackgroundColor:"#c9a84c",pointRadius:4}]},options:{plugins:{legend:{labels:{color:"#888"}}},scales:{x:{ticks:{color:"#666"},grid:{color:"#1e1e1e"}},y:{ticks:{color:"#666"},grid:{color:"#1e1e1e"}}}}});
  // barras categorias
  const catTotais={};todosLanc.filter(l=>l.tipo==="despesa").forEach(l=>{const k=l.descricao||"outros";catTotais[k]=(catTotais[k]||0)+parseFloat(l.valor)});
  const max=Math.max(...Object.values(catTotais),1);
  const el=document.getElementById("barras-cat");el.innerHTML="";
  Object.entries(catTotais).sort((a,b)=>b[1]-a[1]).slice(0,6).forEach(([k,v])=>{
    const cat=CATS.find(c=>c.k===k)||{e:"📦",n:k};
    el.innerHTML+=`<div class="cat-barra-item"><div class="cat-barra-topo"><span>${cat.e} ${cat.n}</span><span style="color:var(--red)">${fmt(v)}</span></div><div class="cat-barra-bg"><div class="cat-barra-fill" style="width:${(v/max*100).toFixed(1)}%"></div></div></div>`;
  });
  if(!Object.keys(catTotais).length)el.innerHTML=`<p style="color:var(--muted);font-size:13px">Nenhuma despesa registrada ainda.</p>`;
}

function filtrar(el,tipo){
  document.querySelectorAll(".filtro-btn").forEach(x=>x.classList.remove("ativo"));el.classList.add("ativo");carregarHist(tipo);
}

async function carregarHist(tipo){
  if(!MID)return;
  const r=await fetch(API+"/resumo/"+MID);
  const d=await r.json();
  let lancs=(d.lancamentos||[]).filter(l=>tipo==="todos"||l.tipo===tipo).reverse();
  const el=document.getElementById("lista-lancamentos");el.innerHTML="";
  if(!lancs.length){el.innerHTML=`<p style="color:var(--muted);font-size:13px;padding:20px 0">Nenhum lançamento encontrado.</p>`;return}
  lancs.forEach(l=>{
    const cat=CATS.find(c=>c.k===l.descricao)||{e:l.tipo==="ganho"?"💰":"📦",n:l.plataforma||l.descricao||"-"};
    const cor=l.tipo==="ganho"?"var(--green)":"var(--red)";
    const bg=l.tipo==="ganho"?"rgba(76,175,120,.12)":"rgba(224,92,92,.12)";
    const sinal=l.tipo==="ganho"?"+":"-";
    el.innerHTML+=`<div class="lancamento-item"><div class="lanc-icon" style="background:${bg}">${cat.e}</div><div class="lanc-info"><div class="lanc-cat">${cat.n}</div><div class="lanc-data">${l.data}${l.plataforma?" · "+l.plataforma:""}</div></div><div class="lanc-val" style="color:${cor}">${sinal}${fmt(l.valor)}</div></div>`;
  });
}

async function renderCal(){
  if(!MID)return;
  const r=await fetch(API+"/resumo/"+MID);
  const d=await r.json();
  const lancs=d.lancamentos||[];
  const hoje=new Date();
  const ano=hoje.getFullYear(),mes=hoje.getMonth();
  document.getElementById("cal-mes-titulo").textContent=hoje.toLocaleString("pt-BR",{month:"long",year:"numeric"});
  const porDia={};
  lancs.forEach(l=>{
    const dt=l.data;if(!porDia[dt])porDia[dt]={ganho:0,despesa:0};
    if(l.tipo==="ganho")porDia[dt].ganho+=parseFloat(l.valor);
    else porDia[dt].despesa+=parseFloat(l.valor);
  });
  const META=100; // meta diária padrão - futuramente configurável
  const grid=document.getElementById("cal-grid");grid.innerHTML="";
  const primeiro=new Date(ano,mes,1).getDay();
  for(let i=0;i<primeiro;i++){const v=document.createElement("div");v.className="cal-day cal-vazio";v.textContent=".";grid.appendChild(v)}
  const dias=new Date(ano,mes+1,0).getDate();
  for(let i=1;i<=dias;i++){
    const el=document.createElement("div");
    const key=`${ano}-${String(mes+1).padStart(2,"0")}-${String(i).padStart(2,"0")}`;
    const info=porDia[key];
    if(i===hoje.getDate())el.style.boxShadow="0 0 0 2px var(--gold)";
    if(!info)el.className="cal-day cal-sem-trabalho";
    else if(info.ganho>=META)el.className="cal-day cal-meta-ok";
    else if(info.ganho>0)el.className="cal-day cal-meta-nao";
    else el.className="cal-day cal-trabalhado";
    el.textContent=i;
    el.title=info?`Ganho: ${fmt(info.ganho)} | Despesa: ${fmt(info.despesa)}`:"Sem registro";
    grid.appendChild(el);
  }
}

async function carregarCats(){
  if(!MID)return;
  const r=await fetch(API+"/resumo/"+MID);
  const d=await r.json();
  const catTotais={};(d.lancamentos||[]).filter(l=>l.tipo==="despesa").forEach(l=>{const k=l.descricao||"outros";catTotais[k]=(catTotais[k]||0)+parseFloat(l.valor)});
  const max=Math.max(...Object.values(catTotais),1);
  const el=document.getElementById("barras-cat2");el.innerHTML="";
  const sorted=Object.entries(catTotais).sort((a,b)=>b[1]-a[1]);
  sorted.forEach(([k,v])=>{
    const cat=CATS.find(c=>c.k===k)||{e:"📦",n:k};
    el.innerHTML+=`<div class="cat-barra-item"><div class="cat-barra-topo"><span>${cat.e} ${cat.n}</span><span style="color:var(--red)">${fmt(v)}</span></div><div class="cat-barra-bg"><div class="cat-barra-fill" style="width:${(v/max*100).toFixed(1)}%"></div></div></div>`;
  });
  if(!sorted.length){el.innerHTML=`<p style="color:var(--muted);font-size:13px">Nenhuma despesa registrada.</p>`;return}
  if(grafCat)grafCat.destroy();
  grafCat=new Chart(document.getElementById("g-categorias"),{type:"doughnut",data:{labels:sorted.map(([k])=>{const c=CATS.find(x=>x.k===k)||{n:k};return c.n}),datasets:[{data:sorted.map(([,v])=>v),backgroundColor:["#c9a84c","#e05c5c","#5b9cf6","#4caf78","#a855f7","#f97316","#ec4899","#06b6d4","#84cc16","#f59e0b"],borderWidth:0}]},options:{cutout:"60%",plugins:{legend:{position:"right",labels:{color:"#888",font:{size:11},padding:12}}}}});
}

async function init(){
  if(!MID){
    const nome=prompt("Bem-vindo ao Painel.IA!\\nQual seu nome?");
    const tel=prompt("Qual seu WhatsApp? (só números, ex: 41999999999)");
    if(nome&&tel){
      const r=await fetch(API+"/motoristas",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({nome,telefone:tel})});
      const data=await r.json();
      MID=data[0].id;localStorage.setItem("mid",MID);
      document.getElementById("user-nome").textContent=nome;
    }
  }else{
    document.getElementById("user-nome").textContent=localStorage.getItem("nome")||"Motorista";
  }
  buildCatGrid();
  carregarDash();
}
init();
</script>
</body>
</html>''')
f.close()
print("Dashboard premium gerado!")
