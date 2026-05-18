# Cria o dashboard HTML
html = open('templates/index.html', 'w')
html.write("""<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Painel.IA</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0;min-height:100vh}
.header{background:linear-gradient(135deg,#1e40af,#7c3aed);padding:20px 30px;display:flex;justify-content:space-between;align-items:center}
.header h1{font-size:24px;font-weight:700;letter-spacing:-0.5px}
.header span{font-size:13px;opacity:0.8}
.container{padding:24px;max-width:1200px;margin:0 auto}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px}
.card{background:#1e293b;border-radius:12px;padding:20px;border:1px solid #334155}
.card label{font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px}
.card .valor{font-size:28px;font-weight:700;margin:8px 0 4px}
.card .sub{font-size:12px;color:#64748b}
.verde{color:#22c55e}.vermelho{color:#ef4444}.azul{color:#60a5fa}.amarelo{color:#f59e0b}
.charts{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px}
.chart-box{background:#1e293b;border-radius:12px;padding:20px;border:1px solid #334155}
.chart-box h3{font-size:14px;color:#94a3b8;margin-bottom:16px}
.form-box{background:#1e293b;border-radius:12px;padding:24px;border:1px solid #334155;margin-bottom:24px}
.form-box h2{font-size:16px;margin-bottom:16px;color:#e2e8f0}
.form-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:12px}
input,select{width:100%;padding:10px 12px;background:#0f172a;border:1px solid #334155;border-radius:8px;color:#e2e8f0;font-size:14px}
input:focus,select:focus{outline:none;border-color:#3b82f6}
.btn{padding:10px 24px;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;transition:all .2s}
.btn-primary{background:#3b82f6;color:white}.btn-primary:hover{background:#2563eb}
.btn-success{background:#22c55e;color:white}.btn-success:hover{background:#16a34a}
.tabela{width:100%;border-collapse:collapse;margin-top:12px}
.tabela th{text-align:left;padding:10px 12px;font-size:12px;color:#64748b;border-bottom:1px solid #334155;text-transform:uppercase}
.tabela td{padding:10px 12px;font-size:14px;border-bottom:1px solid #1e293b}
.tabela tr:hover td{background:#334155}
.badge{padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600}
.badge-ganho{background:#166534;color:#4ade80}
.badge-despesa{background:#7f1d1d;color:#f87171}
.msg{padding:12px;border-radius:8px;margin-bottom:12px;font-size:14px;display:none}
.msg-ok{background:#166534;color:#4ade80}.msg-erro{background:#7f1d1d;color:#f87171}
.nav{display:flex;gap:8px;margin-bottom:24px}
.nav button{padding:8px 16px;border:1px solid #334155;background:transparent;color:#94a3b8;border-radius:8px;cursor:pointer;font-size:13px}
.nav button.ativo{background:#3b82f6;color:white;border-color:#3b82f6}
.secao{display:none}.secao.ativo{display:block}
</style>
</head>
<body>
<div class="header">
  <h1>🚗 Painel.IA</h1>
  <span id="motor-nome">Carregando...</span>
</div>
<div class="container">
  <div id="msg-global" class="msg"></div>

  <div class="nav">
    <button class="ativo" onclick="mostrar('dashboard')">Dashboard</button>
    <button onclick="mostrar('registrar')">Registrar</button>
    <button onclick="mostrar('historico')">Histórico</button>
  </div>

  <!-- DASHBOARD -->
  <div id="secao-dashboard" class="secao ativo">
    <div class="cards">
      <div class="card"><label>Ganhos do mês</label><div class="valor verde" id="c-ganhos">R$ 0</div><div class="sub">bruto total</div></div>
      <div class="card"><label>Despesas</label><div class="valor vermelho" id="c-despesas">R$ 0</div><div class="sub">combustível e outros</div></div>
      <div class="card"><label>Lucro real</label><div class="valor azul" id="c-lucro">R$ 0</div><div class="sub">o que sobrou</div></div>
      <div class="card"><label>Por hora</label><div class="valor amarelo" id="c-hora">R$ 0</div><div class="sub">ganho médio/hora</div></div>
    </div>
    <div class="charts">
      <div class="chart-box"><h3>Ganhos vs Despesas</h3><canvas id="grafico-pizza"></canvas></div>
      <div class="chart-box"><h3>Evolução diária</h3><canvas id="grafico-linha"></canvas></div>
    </div>
  </div>

  <!-- REGISTRAR -->
  <div id="secao-registrar" class="secao">
    <div class="form-box">
      <h2>Registrar lançamento</h2>
      <div class="form-row">
        <div><label style="font-size:12px;color:#94a3b8">Tipo</label>
          <select id="f-tipo"><option value="ganho">💰 Ganho</option><option value="despesa">⛽ Despesa</option></select></div>
        <div><label style="font-size:12px;color:#94a3b8">Valor (R$)</label><input type="number" id="f-valor" placeholder="0.00" step="0.01"></div>
        <div><label style="font-size:12px;color:#94a3b8">Plataforma</label>
          <select id="f-plataforma"><option value="uber">Uber</option><option value="99">99</option><option value="indrive">InDrive</option><option value="outro">Outro</option></select></div>
      </div>
      <div class="form-row">
        <div><label style="font-size:12px;color:#94a3b8">Horas rodadas</label><input type="number" id="f-horas" placeholder="0" step="0.5"></div>
        <div><label style="font-size:12px;color:#94a3b8">Km rodados</label><input type="number" id="f-km" placeholder="0"></div>
        <div><label style="font-size:12px;color:#94a3b8">Descrição</label><input type="text" id="f-desc" placeholder="ex: combustível"></div>
      </div>
      <button class="btn btn-success" onclick="registrar()">Salvar lançamento</button>
    </div>
  </div>

  <!-- HISTÓRICO -->
  <div id="secao-historico" class="secao">
    <div class="form-box">
      <h2>Lançamentos do mês</h2>
      <table class="tabela">
        <thead><tr><th>Data</th><th>Tipo</th><th>Descrição</th><th>Plataforma</th><th>Valor</th></tr></thead>
        <tbody id="tabela-corpo"></tbody>
      </table>
    </div>
  </div>
</div>

<script>
const API = 'http://127.0.0.1:8002';
let motorista_id = localStorage.getItem('motorista_id');
let graficoPizza = null, graficoLinha = null;

function mostrar(secao) {
  document.querySelectorAll('.secao').forEach(s => s.classList.remove('ativo'));
  document.querySelectorAll('.nav button').forEach(b => b.classList.remove('ativo'));
  document.getElementById('secao-' + secao).classList.add('ativo');
  event.target.classList.add('ativo');
  if (secao === 'dashboard') carregarResumo();
  if (secao === 'historico') carregarHistorico();
}

function fmt(v) { return 'R$ ' + parseFloat(v||0).toFixed(2).replace('.',','); }

async function carregarResumo() {
  if (!motorista_id) return;
  try {
    const r = await fetch(API + '/resumo/' + motorista_id);
    const d = await r.json();
    document.getElementById('c-ganhos').textContent = fmt(d.ganhos);
    document.getElementById('c-despesas').textContent = fmt(d.despesas);
    document.getElementById('c-lucro').textContent = fmt(d.lucro);
    document.getElementById('c-hora').textContent = fmt(d.ganho_por_hora);
    
    if (graficoPizza) graficoPizza.destroy();
    graficoPizza = new Chart(document.getElementById('grafico-pizza'), {
      type: 'doughnut',
      data: { labels: ['Ganhos','Despesas'], datasets: [{ data: [d.ganhos, d.despesas], backgroundColor: ['#22c55e','#ef4444'], borderWidth: 0 }] },
      options: { plugins: { legend: { labels: { color: '#94a3b8' } } } }
    });

    const porDia = {};
    (d.lancamentos||[]).forEach(l => {
      const dia = l.data;
      if (!porDia[dia]) porDia[dia] = 0;
      if (l.tipo === 'ganho') porDia[dia] += parseFloat(l.valor);
    });
    const dias = Object.keys(porDia).sort();
    if (graficoLinha) graficoLinha.destroy();
    graficoLinha = new Chart(document.getElementById('grafico-linha'), {
      type: 'line',
      data: { labels: dias.map(d => d.slice(5)), datasets: [{ label: 'Ganhos', data: dias.map(d => porDia[d]), borderColor: '#60a5fa', backgroundColor: 'rgba(96,165,250,0.1)', fill: true, tension: 0.4 }] },
      options: { plugins: { legend: { labels: { color: '#94a3b8' } } }, scales: { x: { ticks: { color: '#64748b' } }, y: { ticks: { color: '#64748b' } } } }
    });
  } catch(e) { console.error(e); }
}

async function carregarHistorico() {
  if (!motorista_id) return;
  const r = await fetch(API + '/resumo/' + motorista_id);
  const d = await r.json();
  const tbody = document.getElementById('tabela-corpo');
  tbody.innerHTML = '';
  (d.lancamentos||[]).reverse().forEach(l => {
    tbody.innerHTML += '<tr><td>' + l.data + '</td><td><span class="badge badge-' + l.tipo + '">' + l.tipo + '</span></td><td>' + (l.descricao||'-') + '</td><td>' + (l.plataforma||'-') + '</td><td class="' + (l.tipo==='ganho'?'verde':'vermelho') + '">' + fmt(l.valor) + '</td></tr>';
  });
}

async function registrar() {
  if (!motorista_id) { alert('Motorista não encontrado'); return; }
  const body = { motorista_id, tipo: document.getElementById('f-tipo').value, valor: parseFloat(document.getElementById('f-valor').value), plataforma: document.getElementById('f-plataforma').value, descricao: document.getElementById('f-desc').value, horas_rodadas: parseFloat(document.getElementById('f-horas').value)||null, km_rodados: parseFloat(document.getElementById('f-km').value)||null };
  const r = await fetch(API + '/lancamentos', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
  if (r.ok) { mostrar('dashboard'); document.querySelectorAll('.nav button')[0].classList.add('ativo'); } 
  else alert('Erro ao salvar');
}

async function init() {
  if (!motorista_id) {
    const nome = prompt('Bem-vindo ao Painel.IA!\\nQual seu nome?');
    const tel = prompt('Qual seu WhatsApp? (só números)');
    if (nome && tel) {
      try {
        const r = await fetch(API + '/motoristas', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({nome, telefone: tel}) });
        const d = await r.json();
        motorista_id = d[0].id;
        localStorage.setItem('motorista_id', motorista_id);
        document.getElementById('motor-nome').textContent = nome;
      } catch(e) { alert('Erro ao cadastrar'); }
    }
  } else {
    document.getElementById('motor-nome').textContent = 'Motorista conectado';
  }
  carregarResumo();
}

init();
</script>
</body>
</html>""")
html.close()
print("dashboard criado!")
