from dotenv import load_dotenv
load_dotenv()
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from dotenv import load_dotenv
load_dotenv()
from fastapi import Request, Body
from pydantic import BaseModel
from supabase import create_client
from dotenv import load_dotenv
from datetime import date
from typing import Optional
import os

load_dotenv()

app = FastAPI(title="Painel.IA API")
templates = Jinja2Templates(directory="templates")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

supabase = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_KEY"))

class Motorista(BaseModel):
    nome: str
    telefone: str

class Lancamento(BaseModel):
    motorista_id: str
    tipo: str
    descricao: Optional[str] = None
    valor: float
    plataforma: Optional[str] = None
    horas_rodadas: Optional[float] = None
    km_rodados: Optional[float] = None
    data: Optional[date] = None

class Meta(BaseModel):
    motorista_id: str
    valor_diario: Optional[float] = None
    valor_mensal: Optional[float] = None

@app.get("/", response_class=HTMLResponse)
def root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/status")
def status():
    return {"status": "Painel.IA rodando!"}

@app.post("/motoristas")
def criar_motorista(m: Motorista):
    res = supabase.table("motoristas").insert(m.dict()).execute()
    return res.data

@app.post("/upsert-motorista")
def upsert_motorista(dados: dict = Body(...)):
    uid = dados.get("id")
    nome = dados.get("nome", "Usuário")
    try:
        res = supabase.table("motoristas").select("id").eq("id", uid).execute()
        if not res.data:
            supabase.table("motoristas").insert({"id": uid, "nome": nome, "telefone": uid[:8]}).execute()
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "erro": str(e)}

@app.get("/motoristas/{telefone}")
def buscar_motorista(telefone: str):
    res = supabase.table("motoristas").select("*").eq("telefone", telefone).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Motorista não encontrado")
    return res.data[0]

@app.post("/lancamentos")
def criar_lancamento(l: Lancamento):
    dados = l.dict()
    dados["data"] = str(dados.get("data") or date.today())
    res = supabase.table("lancamentos").insert(dados).execute()
    return res.data

@app.get("/resumo/{motorista_id}")
def resumo(motorista_id: str, mes: Optional[int] = None, ano: Optional[int] = None):
    hoje = date.today()
    mes = mes or hoje.month
    ano = ano or hoje.year
    inicio = f"{ano}-{mes:02d}-01"
    if mes == 12:
        fim = f"{ano+1}-01-01"
    else:
        fim = f"{ano}-{mes+1:02d}-01"
    res = supabase.table("lancamentos").select("*").eq("motorista_id", motorista_id).gte("data", inicio).lt("data", fim).execute()
    lancamentos = res.data
    ganhos = sum(float(l["valor"]) for l in lancamentos if l["tipo"] == "ganho")
    despesas = sum(float(l["valor"]) for l in lancamentos if l["tipo"] == "despesa")
    lucro = ganhos - despesas
    horas = sum(float(l.get("horas_rodadas") or 0) for l in lancamentos)
    km = sum(float(l.get("km_rodados") or 0) for l in lancamentos)
    return {
        "ganhos": ganhos,
        "despesas": despesas,
        "lucro": lucro,
        "horas_rodadas": horas,
        "km_rodados": km,
        "ganho_por_hora": round(ganhos / horas, 2) if horas > 0 else 0,
        "custo_por_km": round(despesas / km, 2) if km > 0 else 0,
        "lancamentos": lancamentos
    }

@app.post("/metas")
def criar_meta(m: Meta):
    res = supabase.table("metas").insert(m.dict()).execute()
    return res.data

@app.get("/metas/{motorista_id}")
def buscar_meta(motorista_id: str):
    res = supabase.table("metas").select("*").eq("motorista_id", motorista_id).execute()
    return res.data


@app.delete("/lancamentos/{lancamento_id}")
async def deletar_lancamento(lancamento_id: str):
    supabase.table("lancamentos").delete().eq("id", lancamento_id).execute()
    return {"ok": True}

import httpx, os, re

ANTHROPIC_KEY = os.getenv("GEMINI_API_KEY", "")
EVOLUTION_URL = os.getenv("EVOLUTION_URL", "")
EVOLUTION_KEY = os.getenv("EVOLUTION_KEY", "")
EVOLUTION_INSTANCE = os.getenv("EVOLUTION_INSTANCE", "painel")

async def interpretar_mensagem(texto: str, motorista_id: str) -> dict:
    import json
    prompt = f"""Você é um assistente financeiro inteligente para motoristas de app (Uber, 99, inDrive).
O motorista mandou: "{texto}"

Extraia as informações e responda APENAS com JSON válido, sem texto extra, sem markdown:
{{
  "tipo": "ganho" ou "despesa",
  "valor": numero float,
  "plataforma": "uber" ou "99" ou "indrive" ou null (se não informada, tente inferir pelo contexto ou use null),
  "descricao": categoria da despesa ou null,
  "resposta": mensagem amigável de confirmação em português
}}

Categorias válidas para despesa: combustivel, manutencao, aluguel_carro, financiamento, seguro, ipva, multa, lavagem, mercado, restaurante, farmacia, saude, celular, internet, streaming, aluguel_casa, condominio, luz_agua, roupa, lazer, educacao, investimento, emprestimo, outros

Se não entender, responda: {{"erro": true, "resposta": "mensagem pedindo para reformular"}}"""

    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_KEY}",
            json={"contents": [{"parts": [{"text": prompt}]}]},
            timeout=15
        )
        raw = r.json()["candidates"][0]["content"]["parts"][0]["text"]
        raw = raw.strip().replace("```json","").replace("```","").strip()
        return json.loads(raw)

async def enviar_whatsapp(numero: str, mensagem: str):
    if not EVOLUTION_URL:
        print(f"[WA] {numero}: {mensagem}")
        return
    async with httpx.AsyncClient() as client:
        await client.post(
            f"{EVOLUTION_URL}/message/sendText/{EVOLUTION_INSTANCE}",
            headers={"apikey": EVOLUTION_KEY},
            json={"number": numero, "text": mensagem},
            timeout=10
        )

@app.post("/webhook/whatsapp")
async def webhook_whatsapp(req: Request):
    body = await req.json()
    try:
        msg = body.get("data", {}).get("message", {})
        texto = msg.get("conversation") or msg.get("extendedTextMessage", {}).get("text", "")
        numero_raw = body.get("data", {}).get("key", {}).get("remoteJid", "").replace("@s.whatsapp.net", "")
        numero = numero_raw if len(numero_raw) == 11 else (numero_raw[2:] if numero_raw.startswith("55") else numero_raw[1:] if len(numero_raw) == 12 else numero_raw)
        print(f"WEBHOOK numero={numero} texto={texto}")
        if not texto or not numero:
            return {"ok": False}

        # Busca motorista pelo telefone
        res = supabase.table("motoristas").select("*").eq("telefone", numero).execute()
        if not res.data:
            numero9 = numero[:2] + "9" + numero[2:] if len(numero) == 10 else numero
            res = supabase.table("motoristas").select("*").eq("telefone", numero9).execute()
            await enviar_whatsapp(numero, "👋 Você ainda não tem cadastro. Acesse o app para se cadastrar: http://seu-link.com")
            return {"ok": True}

        motorista = res.data[0]
        mid = motorista["id"]

        result = await interpretar_mensagem(texto, mid)

        if result.get("erro"):
            await enviar_whatsapp(numero, result["resposta"])
            return {"ok": True}

        hoje = __import__('datetime').date.today().isoformat()
        lancamento = {
            "motorista_id": mid,
            "tipo": result["tipo"],
            "valor": result["valor"],
            "data": hoje,
        }
        if result.get("plataforma"):
            lancamento["plataforma"] = result["plataforma"]
        if result.get("descricao"):
            lancamento["descricao"] = result["descricao"]

        supabase.table("lancamentos").insert(lancamento).execute()
        await enviar_whatsapp(numero, result["resposta"])

    except Exception as e:
        print(f"Erro webhook: {e}")
    return {"ok": True}


@app.get("/contas/{motorista_id}")
def listar_contas(motorista_id: str):
    res = supabase.table("contas").select("*").eq("motorista_id", motorista_id).order("vencimento").execute()
    return res.data

@app.post("/contas")
def criar_conta(c: dict = Body(...)):
    res = supabase.table("contas").insert(c).execute()
    return res.data

@app.patch("/contas/{conta_id}")
def atualizar_conta(conta_id: str, dados: dict = Body(...)):
    res = supabase.table("contas").update(dados).eq("id", conta_id).execute()
    return res.data

@app.delete("/contas/{conta_id}")
def deletar_conta(conta_id: str):
    supabase.table("contas").delete().eq("id", conta_id).execute()
    return {"ok": True}

# SUBSTITUIR do @app.post("/chat") até o final do arquivo (manter /debug-chat)
# Cole este conteudo a partir da linha 249 do main.py

@app.post("/chat")
async def chat(dados: dict = Body(...)):
    import httpx, json, datetime
    motorista_id = dados.get("motorista_id") or dados.get("mid")
    mensagem = dados.get("mensagem", "")
    historico = dados.get("historico", [])

    hoje = datetime.date.today()
    hoje_str = hoje.isoformat()
    ontem_str = (hoje - datetime.timedelta(days=1)).isoformat()

    # Busca dados completos do motorista
    resumo = []
    contas = []
    lancamentos_hoje = []
    try:
        r = supabase.table("resumo_diario").select("*").eq("motorista_id", motorista_id).order("data", desc=True).limit(7).execute()
        resumo = r.data or []
    except: pass
    try:
        c = supabase.table("contas").select("*").eq("motorista_id", motorista_id).eq("pago", False).order("vencimento").execute()
        contas = c.data or []
    except: pass
    try:
        lh = supabase.table("lancamentos").select("*").eq("motorista_id", motorista_id).eq("data", hoje_str).execute()
        lancamentos_hoje = lh.data or []
    except: pass

    # Monta resumo legível dos lançamentos de hoje para o prompt
    ganhos_hoje = [l for l in lancamentos_hoje if l.get("tipo") == "ganho"]
    despesas_hoje = [l for l in lancamentos_hoje if l.get("tipo") == "despesa"]
    total_ganho_hoje = sum(float(l.get("valor", 0)) for l in ganhos_hoje)
    total_despesa_hoje = sum(float(l.get("valor", 0)) for l in despesas_hoje)

    resumo_hoje_str = ""
    if ganhos_hoje:
        for g in ganhos_hoje:
            resumo_hoje_str += f"  - Ganho R${g.get('valor',0)} na {g.get('plataforma','app')} (registrado)\n"
    if despesas_hoje:
        for d in despesas_hoje:
            resumo_hoje_str += f"  - Despesa R${d.get('valor',0)} de {d.get('descricao','outros')} (registrada)\n"
    if not resumo_hoje_str:
        resumo_hoje_str = "  (nenhum registro hoje ainda)\n"

    contas_str = ""
    for ct in contas:
        venc = ct.get("vencimento", "?")
        contas_str += f"  - {ct.get('descricao','?')}: R${ct.get('valor',0)} vence {venc}\n"
    if not contas_str:
        contas_str = "  (sem contas pendentes)\n"

    from datetime import date as _date, timedelta as _td
    hoje_dt = _date.fromisoformat(hoje_str)
    dia_semana_map = {0:"segunda",1:"terca",2:"quarta",3:"quinta",4:"sexta",5:"sabado",6:"domingo"}
    dia_semana_hoje = dia_semana_map[hoje_dt.weekday()]
    if hoje_dt.month < 12:
        ultimo_dia_mes = _date(hoje_dt.year, hoje_dt.month + 1, 1) - _td(days=1)
    else:
        ultimo_dia_mes = _date(hoje_dt.year, 12, 31)
    dias_restantes = (ultimo_dia_mes - hoje_dt).days + 1
    total_contas = sum(float(ct.get("valor", 0)) for ct in contas)
    piso_diario = round(total_contas / dias_restantes, 2) if dias_restantes > 0 else 0

    contexto = (
        "Voce e o Gestor Financeiro do Painel.IA — consultor especializado para motoristas de app.\n"
        "Hoje: " + hoje_str + "\n\n"
        "=== LANCAMENTOS DE HOJE ===\n"
        + resumo_hoje_str +
        "Total ganho hoje: R$" + str(round(total_ganho_hoje, 2)) + "\n"
        "Total gasto hoje: R$" + str(round(total_despesa_hoje, 2)) + "\n\n"
        "=== CONTAS PENDENTES ===\n"
        + contas_str +
        "=== HISTORICO RECENTE (ultimos 7 dias) ===\n"
        + json.dumps(resumo, ensure_ascii=False, default=str) + "\n\n"
        "=== REGRA FUNDAMENTAL — COMBUSTIVEL ===\n"
        "Combustivel e custo operacional fixo — sem ele nao ha faturamento. SEMPRE reserve combustivel antes de qualquer conta.\n"
        "Estime ~R$70/dia de combustivel se nao houver registro especifico.\n\n"
        "=== SITUACAO ATUAL ===\n"
        "Total contas pendentes: R$" + str(round(total_contas, 2)) + "\n"
        "Dias restantes no mes: " + str(dias_restantes) + " (" + dia_semana_hoje + " hoje)\n"
        "Piso minimo diario para fechar o mes: R$" + str(piso_diario) + "/dia\n\n"
        "=== SUA PERSONALIDADE E RACIOCINIO ===\n"
        "Voce e um consultor financeiro que pensa junto com o motorista, nao so lista informacoes.\n"
        "Quando o usuario fizer perguntas de gestao (quais pagar, como estou, o que fazer hoje, analise, plano):\n"
        "1. CALCULE o que e possivel pagar com a capacidade real dos dias restantes.\n"
        "2. SEPARE contas em: (a) nao negociaveis — carro, combustivel, multa; (b) negociaveis — pessoais, familiares.\n"
        "3. SE o total superar a capacidade maxima realista, diga claramente e priorize.\n"
        "4. SUGIRA prazo para contas negociaveis e PERGUNTE se faz sentido: 'Posso deixar [X] para proxima semana?'\n"
        "5. MONTE um plano objetivo dia a dia: 'Hoje fatura R$X, reserva R$70 combustivel, paga Y. Amanha...'\n"
        "6. SEMPRE termine com o plano resumido por dia.\n"
        "7. Se o deficit for grande, oferea dois caminhos: forcar mais no dia seguinte OU pedir prazo extra.\n\n"
        "- Use linguagem de amigo, direta.\n"
        "- Responda curto para registros. Detalhado para perguntas de gestao.\n"
        "- Quando detectar duplicata, explique antes de registrar.\n"
        "- Quando confirmar valor acima de R$600, pergunte antes.\n\n"
        "=== FORMATO DA RESPOSTA ===\n"
        "Responda APENAS com JSON valido:\n"
        '{"acoes": [...], "resposta": "mensagem em portugues"}\n\n'
        "=== ACOES DISPONIVEIS ===\n"
        '- Ganho de app: {"acao":"registrar_lancamento","tipo":"ganho","valor":NUMERO,"plataforma":"uber","data":"YYYY-MM-DD"}\n'
        '- Despesa avulsa: {"acao":"registrar_lancamento","tipo":"despesa","valor":NUMERO,"descricao":"categoria","data":"YYYY-MM-DD"}\n'
        '- Conta futura: {"acao":"registrar_conta","descricao":"nome","valor":NUMERO,"vencimento":"YYYY-MM-DD"}\n'
        '- Marcar conta paga: {"acao":"marcar_pago","descricao":"nome da conta"}\n'
        '- Pagar conta direto (2 acoes): {"acao":"registrar_conta",...,"pago":true} + {"acao":"registrar_lancamento","tipo":"despesa",...}\n'
        '- Abater conta: {"acao":"abater_conta","descricao":"nome","valor_pago":NUMERO}\n'
        '- Editar conta (prazo negociado): {"acao":"editar_conta","descricao":"nome","campo":"vencimento","novo_valor":"YYYY-MM-DD"}\n'
        '- Deletar ultimo lancamento: {"acao":"deletar_ultimo_lancamento","tipo":"ganho ou despesa"}\n'
        '- Editar ultimo lancamento: {"acao":"editar_ultimo_lancamento","tipo":"despesa","campo":"valor","novo_valor":NUMERO,"descricao":"categoria"}\n'
        '- Zerar despesas hoje: {"acao":"zerar_despesas_hoje"}\n'
        '- Deletar conta: {"acao":"deletar_conta","descricao":"nome"}\n\n'
        "=== REGRAS CRITICAS ===\n"
        "1. Perguntas de gestao (como estou, quais pagar, analise, plano, conselho) → acoes:[] + analise completa com plano por dia.\n"
        "2. REGRA DE PLATAFORMA — MUITO IMPORTANTE: Se a SUA ultima mensagem foi perguntando sobre plataforma (ex: 'Foi Uber, 99 ou inDrive?'), entao a proxima mensagem do motorista E a resposta da plataforma, nao um valor. Exemplos: 'uber'→plataforma uber, '99'→plataforma 99, 'inDrive'→plataforma indrive, 'ja falei que foi na 99'→plataforma 99, 'foi uber'→plataforma uber. NUNCA interprete esses como valor em reais nesse contexto.\n"
        "3. REGRA DE CONTEXTO: Analise o historico da conversa antes de interpretar. Se o motorista ja informou a plataforma antes, use esse contexto. 'Ja falei que foi na 99' significa que a plataforma e 99 e voce deve registrar com a plataforma correta sem perguntar de novo.\n"
        "4. Se detectar provavel duplicata (mesmo valor e categoria ja registrados hoje), explique e pergunte antes de registrar — retorne acoes:[] ate confirmar.\n"
        "5. Se o usuario disser 'consegui prazo', 'negociei', 'aceitaram ate dia X', use editar_conta para atualizar o vencimento.\n"
        "6. Nunca mostre o JSON na resposta do usuario — o campo 'resposta' e so texto legivel.\n"
        "Categorias de despesa: combustivel, manutencao, aluguel_carro, financiamento, seguro, ipva, multa, lavagem, mercado, restaurante, farmacia, saude, celular, internet, streaming, aluguel_casa, condominio, luz_agua, roupa, lazer, educacao, investimento, emprestimo, outros"
    )

    msgs = [
        {"role": "user", "parts": [{"text": contexto}]},
        {"role": "model", "parts": [{"text": '{"acoes":[],"resposta":"Entendido. Estou com todos os seus dados. Pode falar."}'}]},
    ]
    for h in (historico or []):
        role = "model" if h["role"] == "assistant" else h["role"]
        msgs.append({"role": role, "parts": [{"text": h["content"]}]})
    msgs.append({"role": "user", "parts": [{"text": mensagem}]})

    GEMINI_KEY = os.getenv("GEMINI_API_KEY", "")
    result = {}
    async with httpx.AsyncClient(timeout=90) as client:
        for tentativa in range(5):
            try:
                resp = await client.post(
                    f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_KEY}",
                    json={"contents": msgs, "generationConfig": {"responseMimeType": "application/json", "maxOutputTokens": 2048}}
                )
                result = resp.json()
                err_msg = result.get("error", {}).get("message", "")
                if "error" not in result:
                    break
                if any(x in err_msg for x in ["high demand", "overloaded", "quota", "RESOURCE_EXHAUSTED", "503", "502"]):
                    wait = (tentativa + 1) * 5
                    await __import__("asyncio").sleep(wait)
                else:
                    break
            except Exception as e:
                print(f"Timeout/erro tentativa {tentativa+1}: {e}")
                await __import__("asyncio").sleep(5)

    if "error" in result:
        return {"resposta": "Tive um problema de conexao com a IA. Tenta de novo em alguns segundos.", "acao": None}

    texto_raw = result.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
    if not texto_raw:
        return {"resposta": "Nao recebi resposta da IA.", "acao": None}

    # Parse seguro do JSON
    texto_resposta = "OK"
    lista_acoes = []
    try:
        # Extrai JSON mesmo se vier com texto ao redor
        inicio = texto_raw.find("{")
        fim = texto_raw.rfind("}") + 1
        if inicio >= 0 and fim > inicio:
            parsed = json.loads(texto_raw[inicio:fim])
        else:
            parsed = json.loads(texto_raw.strip())
        lista_acoes = parsed.get("acoes", [])
        texto_resposta = parsed.get("resposta", "OK")
    except Exception as e:
        print(f"PARSE ERRO: {e} | raw: {repr(texto_raw[:300])}")
        # Se falhou o parse, retorna o texto bruto como resposta (sem JSON)
        texto_resposta = texto_raw.replace("{", "").replace("}", "").strip()[:500]
        lista_acoes = []

    # Executa acoes
    acoes_executadas = []
    for acao in lista_acoes:
        try:
            if acao.get("acao") == "registrar_lancamento":
                data_lancamento = acao.get("data", hoje_str)
                if data_lancamento in ("hoje", None, ""):
                    data_lancamento = hoje_str
                elif data_lancamento in ("ontem",):
                    data_lancamento = ontem_str
                dados_insert = {
                    "motorista_id": motorista_id,
                    "tipo": acao.get("tipo", "ganho"),
                    "valor": float(acao.get("valor", 0)),
                    "data": data_lancamento,
                }
                if acao.get("plataforma"):
                    dados_insert["plataforma"] = acao["plataforma"]
                if acao.get("descricao"):
                    dados_insert["descricao"] = acao["descricao"]
                supabase.table("lancamentos").insert(dados_insert).execute()
                acoes_executadas.append("lancamento_registrado")

            elif acao.get("acao") == "registrar_conta":
                venc = acao.get("vencimento", "")
                if not venc or venc == "hoje":
                    venc = hoje_str
                dados_conta = {
                    "motorista_id": motorista_id,
                    "descricao": acao.get("descricao", ""),
                    "valor": float(acao.get("valor", 0)),
                    "vencimento": venc,
                    "pago": acao.get("pago", False),
                }
                supabase.table("contas").insert(dados_conta).execute()
                acoes_executadas.append("conta_registrada")

            elif acao.get("acao") == "marcar_pago":
                descricao = acao.get("descricao", "").lower()
                contas_q = supabase.table("contas").select("*").eq("motorista_id", motorista_id).eq("pago", False).execute()
                for ct in (contas_q.data or []):
                    if descricao in (ct.get("descricao") or "").lower():
                        supabase.table("contas").update({"pago": True}).eq("id", ct["id"]).execute()
                        acoes_executadas.append("conta_paga")
                        break

            elif acao.get("acao") == "abater_conta":
                descricao = acao.get("descricao", "").lower()
                valor_pago = float(acao.get("valor_pago", 0))
                contas_q = supabase.table("contas").select("*").eq("motorista_id", motorista_id).eq("pago", False).execute()
                for ct in (contas_q.data or []):
                    if descricao in (ct.get("descricao") or "").lower():
                        novo_valor = max(0, float(ct.get("valor", 0)) - valor_pago)
                        if novo_valor == 0:
                            supabase.table("contas").update({"pago": True}).eq("id", ct["id"]).execute()
                        else:
                            supabase.table("contas").update({"valor": novo_valor}).eq("id", ct["id"]).execute()
                        acoes_executadas.append("conta_abatida")
                        break

            elif acao.get("acao") == "editar_conta":
                descricao = acao.get("descricao", "").lower()
                campo = acao.get("campo", "")
                novo_valor = acao.get("novo_valor")
                contas_q = supabase.table("contas").select("*").eq("motorista_id", motorista_id).execute()
                for ct in (contas_q.data or []):
                    if descricao in (ct.get("descricao") or "").lower():
                        update_data = {campo: float(novo_valor) if campo == "valor" else novo_valor}
                        supabase.table("contas").update(update_data).eq("id", ct["id"]).execute()
                        acoes_executadas.append("conta_editada")
                        break

            elif acao.get("acao") == "deletar_conta":
                descricao = acao.get("descricao", "").lower()
                contas_q = supabase.table("contas").select("*").eq("motorista_id", motorista_id).execute()
                for ct in (contas_q.data or []):
                    if descricao in (ct.get("descricao") or "").lower():
                        supabase.table("contas").delete().eq("id", ct["id"]).execute()
                        acoes_executadas.append("conta_deletada")
                        break

            elif acao.get("acao") == "deletar_ultimo_lancamento":
                tipo = acao.get("tipo")
                q = supabase.table("lancamentos").select("id").eq("motorista_id", motorista_id)
                if tipo:
                    q = q.eq("tipo", tipo)
                q = q.order("created_at", desc=True).limit(1).execute()
                if q.data:
                    supabase.table("lancamentos").delete().eq("id", q.data[0]["id"]).execute()
                    acoes_executadas.append("lancamento_deletado")

            elif acao.get("acao") == "editar_ultimo_lancamento":
                tipo = acao.get("tipo")
                descricao = acao.get("descricao", "")
                campo = acao.get("campo", "valor")
                novo_valor = acao.get("novo_valor")
                q = supabase.table("lancamentos").select("*").eq("motorista_id", motorista_id).eq("data", hoje_str)
                if tipo:
                    q = q.eq("tipo", tipo)
                q = q.order("created_at", desc=True).limit(10).execute()
                for item in (q.data or []):
                    if descricao and descricao.lower() not in (item.get("descricao") or "").lower():
                        continue
                    supabase.table("lancamentos").update({campo: float(novo_valor) if campo == "valor" else novo_valor}).eq("id", item["id"]).execute()
                    acoes_executadas.append("lancamento_editado")
                    break

            elif acao.get("acao") == "zerar_despesas_hoje":
                supabase.table("lancamentos").delete().eq("motorista_id", motorista_id).eq("data", hoje_str).eq("tipo", "despesa").execute()
                acoes_executadas.append("despesas_zeradas")

        except Exception as e:
            import traceback
            print(f"ERRO ACAO {acao}: {e}")
            traceback.print_exc()

    acao_executada = acoes_executadas[0] if acoes_executadas else None
    return {"resposta": texto_resposta, "acao": acao_executada}


@app.post("/plano-financeiro")
async def plano_financeiro(dados: dict = Body(...)):
    import httpx, json, datetime
    motorista_id = dados.get("motorista_id") or dados.get("mid")
    # Busca meta_diaria do perfil — ignora min_dia/max_dia do frontend (podem estar desatualizados)
    max_dia = 300.0
    try:
        perf = supabase.table("motoristas").select("meta_diaria").eq("id", motorista_id).single().execute()
        max_dia = float((perf.data or {}).get("meta_diaria") or 300)
    except: pass
    min_dia = round(max_dia * 0.6, 0)

    hoje = datetime.date.today()
    hoje_str = hoje.isoformat()
    dia_semana_ptbr = ["segunda-feira","terca-feira","quarta-feira","quinta-feira","sexta-feira","sabado","domingo"][hoje.weekday()]
    ultimo_dia_mes = (hoje.replace(day=28) + datetime.timedelta(days=4)).replace(day=1) - datetime.timedelta(days=1)
    dias_restantes = max(1, (ultimo_dia_mes - hoje).days + 1)

    # Busca dados do banco
    contas = []
    lancamentos_mes = []
    try:
        c = supabase.table("contas").select("*").eq("motorista_id", motorista_id).eq("pago", False).order("vencimento").execute()
        contas = c.data or []
    except: pass
    try:
        inicio_mes = hoje.replace(day=1).isoformat()
        lm = supabase.table("lancamentos").select("*").eq("motorista_id", motorista_id).gte("data", inicio_mes).execute()
        lancamentos_mes = lm.data or []
    except: pass

    # Calcula caixa e combustivel medio real
    ganhos_mes = sum(float(l.get("valor", 0)) for l in lancamentos_mes if l.get("tipo") == "ganho")
    despesas_mes = sum(float(l.get("valor", 0)) for l in lancamentos_mes if l.get("tipo") == "despesa")
    caixa = round(ganhos_mes - despesas_mes, 2)

    dias_com_ganho = len(set(l.get("data") for l in lancamentos_mes if l.get("tipo") == "ganho")) or 1
    comb_total_mes = sum(float(l.get("valor", 0)) for l in lancamentos_mes
                         if l.get("tipo") == "despesa" and "combustivel" in (l.get("descricao") or "").lower())
    comb_por_dia = round(comb_total_mes / dias_com_ganho, 2) if comb_total_mes > 0 else 70.0

    # Monta lista de contas com dias para vencer
    contas_detalhadas = ""
    for ct in contas:
        venc = ct.get("vencimento", "")
        try:
            dias_p_vencer = (datetime.date.fromisoformat(venc) - hoje).days
            urgencia = "VENCIDA" if dias_p_vencer < 0 else f"vence em {dias_p_vencer} dias ({venc})"
        except:
            urgencia = f"vence {venc}"
        contas_detalhadas += f"  - {ct.get('descricao','?')}: R${float(ct.get('valor',0)):.2f} | {urgencia}\n"

    if not contas_detalhadas:
        contas_detalhadas = "  (nenhuma conta pendente)\n"

    total_pendente = sum(float(c.get("valor", 0)) for c in contas)

    # Teto real: máximo que pode entrar no caixa até fim do mês
    teto_liquido_real = round(caixa + (max_dia - comb_por_dia) * dias_restantes, 2)
    fecha_tudo = teto_liquido_real >= total_pendente
    situacao_resumo = f"FECHA TUDO (sobram R${teto_liquido_real - total_pendente:.2f})" if fecha_tudo else f"NAO FECHA — faltam R${total_pendente - teto_liquido_real:.2f} mesmo faturando o maximo todos os dias"

    # === PARTE 1: DIAGNÓSTICO (curto, direto) ===
    fecha_tudo_str = "SIM, fecha tudo" if fecha_tudo else f"NAO fecha — mesmo faturando o maximo, faltam R${total_pendente - teto_liquido_real:.0f}"

    prompt_p1 = f"""Você é um gestor financeiro que fala como um amigo próximo, de forma simples e direta.
Motoristas de app, muitos com pouca escolaridade, precisam entender rapidamente.

DADOS:
- Hoje: {dia_semana_ptbr}, {hoje_str}
- Dinheiro em caixa agora: R${caixa:.0f}
- Faturando normal ({dias_restantes} dias × R${(max_dia - comb_por_dia):.0f} líquido/dia): mais R${(max_dia - comb_por_dia) * dias_restantes:.0f}
- Total que pode ter no bolso até fim do mês: R${teto_liquido_real:.0f}
- Total de contas para pagar: R${total_pendente:.0f}
- Situação: {fecha_tudo_str}

ESCREVA APENAS O DIAGNÓSTICO — 3 a 4 linhas máximo.
Use linguagem bem simples. Seja um amigo honesto, não um relatório.
Não coloque títulos, não coloque listas.
Comece direto: "Olha, a situação é..."
Se não fecha, diga quanto falta de forma clara e humana.
Termine com UMA pergunta sobre qual dia da semana ele consegue trabalhar mais."""

    # === PARTE 2: O QUE PAGAR PRIMEIRO (lista simples) ===
    # Separa contas: urgentes (≤3 dias), essa semana (4-7 dias), pode esperar (>7 dias)
    urgentes, essa_semana, podem_esperar = [], [], []
    for ct in contas:
        try:
            dias_p_vencer = (datetime.date.fromisoformat(ct.get("vencimento", hoje_str)) - hoje).days
        except:
            dias_p_vencer = 30
        nome = ct.get("descricao", "?")
        valor = float(ct.get("valor", 0))
        venc_str = ct.get("vencimento", "")
        item = {"nome": nome, "valor": valor, "dias": dias_p_vencer, "venc": venc_str}
        if dias_p_vencer <= 0:
            urgentes.insert(0, item)
        elif dias_p_vencer <= 3:
            urgentes.append(item)
        elif dias_p_vencer <= 7:
            essa_semana.append(item)
        else:
            podem_esperar.append(item)

    lista_p2 = ""
    if urgentes:
        lista_p2 += "🔴 PAGAR JÁ:\n"
        for i in urgentes:
            dias_txt = "VENCIDA" if i["dias"] <= 0 else f"{i['dias']}d"
            lista_p2 += f"  • {i['nome']}: R${i['valor']:.0f} ({dias_txt})\n"
    if essa_semana:
        lista_p2 += "\n🟡 ESSA SEMANA:\n"
        for i in essa_semana:
            lista_p2 += f"  • {i['nome']}: R${i['valor']:.0f} ({i['dias']}d)\n"
    if podem_esperar:
        lista_p2 += "\n🟢 PODE AGUARDAR:\n"
        for i in podem_esperar:
            lista_p2 += f"  • {i['nome']}: R${i['valor']:.0f} ({i['dias']}d)\n"

    prompt_p2 = f"""Você é um gestor financeiro amigo de um motorista de app.

CONTAS DELE:
{lista_p2 or "(Nenhuma conta pendente)"}

Caixa atual: R${caixa:.0f}
Combustível médio por dia: R${comb_por_dia:.0f}

ESCREVA APENAS a parte "o que pagar primeiro".
Máximo 6 linhas. Linguagem simples.
Se caixa atual não paga nenhuma conta urgente, diga isso claramente em 1 frase.
Liste só as urgentes e da semana — não liste todas.
Se alguma conta de carro (aluguel, semanal, financiamento) aparecer, destaque ela como prioridade máxima.
Não repita o que já foi dito no diagnóstico."""

    # === PARTE 3: META DE HOJE (1 linha objetiva) ===
    # Calcula meta real: quanto precisa tirar hoje para cobrir o mais urgente
    meta_hoje = min(max_dia, max(min_dia, max_dia))  # começa com o máximo realista
    conta_urgente_nome = urgentes[0]["nome"] if urgentes else (essa_semana[0]["nome"] if essa_semana else None)
    conta_urgente_valor = urgentes[0]["valor"] if urgentes else (essa_semana[0]["valor"] if essa_semana else 0)

    prompt_p3 = f"""Você é um gestor financeiro amigo de um motorista de app.

SITUAÇÃO DELE HOJE ({dia_semana_ptbr}):
- Meta diária normal: R${min_dia:.0f} a R${max_dia:.0f} bruto
- Combustível por dia: R${comb_por_dia:.0f}
- Conta mais urgente: {conta_urgente_nome or "nenhuma"} — R${conta_urgente_valor:.0f}
- Dinheiro em caixa: R${caixa:.0f}

ESCREVA APENAS a meta de hoje — 2 a 3 linhas no máximo.
Formato simples:
"Hoje: tenta R$[valor] bruto → guarda R${comb_por_dia:.0f} de combustível → o resto vai para [conta]"
Depois uma dica rápida e prática de 1 linha (ex: qual horário costuma ter mais movimento).
Linguagem de amigo, sem título, sem lista."""

    GEMINI_KEY = os.getenv("GEMINI_API_KEY", "")

    async def chamar_gemini(prompt_txt: str) -> str:
        async with httpx.AsyncClient(timeout=60) as client:
            for tentativa in range(4):
                try:
                    resp = await client.post(
                        f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_KEY}",
                        json={
                            "contents": [{"parts": [{"text": prompt_txt}]}],
                            "generationConfig": {"maxOutputTokens": 512, "temperature": 0.2}
                        }
                    )
                    r = resp.json()
                    if "error" not in r:
                        return r.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                    if any(x in r.get("error", {}).get("message", "") for x in ["overloaded", "quota", "RESOURCE_EXHAUSTED"]):
                        await __import__("asyncio").sleep((tentativa + 1) * 5)
                    else:
                        break
                except:
                    await __import__("asyncio").sleep(4)
        return ""

    import asyncio
    parte1, parte2, parte3 = await asyncio.gather(
        chamar_gemini(prompt_p1),
        chamar_gemini(prompt_p2),
        chamar_gemini(prompt_p3),
    )

    if not parte1 and not parte2:
        return {"erro": True, "mensagem": "IA indisponível agora. Tenta em 1 minuto."}

    # Monta negociação de prazo para contas que podem esperar (gerado localmente, sem IA)
    negociacoes = []
    for ct in podem_esperar[:2]:
        negociacoes.append(f"• {ct['nome']} — R${ct['valor']:.0f}: \"Oi, tô apertado essa semana. Consigo pagar até dia {(hoje + datetime.timedelta(days=ct['dias']+3)).strftime('%d/%m')}. Pode ser?\"")

    parte_neg = ""
    if negociacoes:
        parte_neg = "⏳ PEDIR PRAZO:\n" + "\n".join(negociacoes)

    return {
        "partes": [
            parte1.strip() if parte1 else "Sem dados suficientes para o diagnóstico.",
            ("✅ O QUE PAGAR PRIMEIRO:\n\n" + parte2.strip()) if parte2 else "",
            (parte_neg + "\n\n" if parte_neg else "") + ("🎯 HOJE:\n\n" + parte3.strip() if parte3 else ""),
        ],
        "resumo": {
            "caixa": caixa,
            "total_pendente": round(total_pendente, 2),
            "dias_restantes": dias_restantes,
            "comb_por_dia": comb_por_dia,
        }
    }


@app.get("/debug-chat/{mid}")
async def debug_chat(mid: str):
    import json, os, httpx, datetime
    logs = []
    motorista_id = mid
    mensagem = "fiz 50 na uber"
    GEMINI_KEY = os.getenv("GEMINI_API_KEY", "")
    logs.append(f"motorista_id={motorista_id}")
    logs.append(f"GEMINI_KEY={'OK' if GEMINI_KEY else 'AUSENTE'}")
    contexto = '{"acoes":[{"acao":"registrar_lancamento","tipo":"ganho","valor":50.0,"plataforma":"uber"}],"resposta":"ok"}'
    msgs = [{"role": "user", "parts": [{"text": contexto}]}, {"role": "model", "parts": [{"text": "ok"}]}, {"role": "user", "parts": [{"text": mensagem}]}]
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_KEY}", json={"contents": msgs, "generationConfig": {"responseMimeType": "application/json"}})
        result = resp.json()
    texto = result.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
    logs.append(f"gemini_texto={repr(texto[:200])}")
    try:
        parsed = json.loads(texto.strip())
        lista_acoes = parsed.get("acoes", [])
        logs.append(f"lista_acoes={lista_acoes}")
        for acao in lista_acoes:
            try:
                d = {"motorista_id": motorista_id, "tipo": acao.get("tipo", "ganho"), "valor": float(acao.get("valor", 0)), "data": datetime.date.today().isoformat()}
                r = supabase.table("lancamentos").insert(d).execute()
                logs.append(f"insert_ok={r.data}")
            except Exception as e:
                logs.append(f"insert_erro={e}")
    except Exception as e:
        logs.append(f"parse_erro={e}")
    return {"logs": logs}
