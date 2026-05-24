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

@app.post("/chat")
async def chat(dados: dict = Body(...)):
    import httpx, json
    motorista_id = dados.get("motorista_id") or dados.get("mid")
    mensagem = dados.get("mensagem", "")
    historico = dados.get("historico", [])

    # Busca contexto do motorista
    resumo = {}
    contas = []
    try:
        r = supabase.table("resumo_diario").select("*").eq("motorista_id", motorista_id).order("data", desc=True).limit(7).execute()
        resumo = r.data or []
    except: pass
    try:
        c = supabase.table("contas").select("*").eq("motorista_id", motorista_id).execute()
        contas = c.data or []
    except: pass

    contexto = f"""Você é o assistente financeiro do Painel.IA para motoristas de app. Hoje é {__import__('datetime').date.today().isoformat()}.

Dados do motorista:
- Histórico recente: {json.dumps(resumo, ensure_ascii=False, default=str)}
- Contas a pagar: {json.dumps(contas, ensure_ascii=False, default=str)}

Responda APENAS com um JSON válido neste formato exato:
{{
  "acoes": [
    {{"acao": "registrar_lancamento", "tipo": "ganho", "valor": 200.0, "plataforma": "uber"}}
  ],
  "resposta": "frase curta de confirmação em português"
}}

Regras para preencher "acoes":
- Ganho de app (uber/99/indrive): {{"acao":"registrar_lancamento","tipo":"ganho","valor":NUMERO,"plataforma":"uber"}}
- Despesa avulsa (combustivel, lavagem, mercado, farmácia, etc): {{"acao":"registrar_lancamento","tipo":"despesa","valor":NUMERO,"descricao":"categoria"}}
- Conta recorrente futura (aluguel, financiamento, parcela, boleto, fatura) que ainda NÃO foi paga: {{"acao":"registrar_conta","descricao":"nome","valor":NUMERO,"vencimento":"YYYY-MM-DD"}}. Se não informar vencimento, use dia 10 do próximo mês. NAO crie lancamento junto.
- Pagou conta que já existia: {{"acao":"marcar_pago","descricao":"nome da conta"}}
- Pagou conta recorrente diretamente (ex: "paguei 900 de aluguel", "paguei 4 parcelas de 160"): use DUAS ações — primeiro {{"acao":"registrar_conta","descricao":"nome","valor":NUMERO,"vencimento":"hoje","pago":true}} depois {{"acao":"registrar_lancamento","tipo":"despesa","valor":NUMERO,"descricao":"categoria"}}
- Abateu conta: {{"acao":"abater_conta","descricao":"nome","valor_pago":NUMERO}}
- Desfazer último: {{"acao":"deletar_ultimo_lancamento","tipo":"ganho ou despesa"}}
- Corrigir valor: {{"acao":"editar_ultimo_lancamento","tipo":"despesa","campo":"valor","novo_valor":NUMERO,"descricao":"categoria_ou_nome_da_conta"}}
- Apagar despesas hoje: {{"acao":"zerar_despesas_hoje"}}
- Apagar conta cadastrada: {{"acao":"deletar_conta","descricao":"nome da conta"}}
- Editar conta (valor ou vencimento): {{"acao":"editar_conta","descricao":"nome","campo":"valor ou vencimento","novo_valor":"NUMERO ou YYYY-MM-DD"}}

Se não há ação a registrar (ex: pergunta, conversa), retorne "acoes": [].
Categorias de despesa: combustivel, manutencao, aluguel_carro, financiamento, seguro, ipva, multa, lavagem, mercado, restaurante, farmacia, saude, celular, internet, streaming, aluguel_casa, condominio, luz_agua, roupa, lazer, educacao, investimento, emprestimo, outros"""

    # Contexto sempre na primeira mensagem
    msgs = [{"role": "user", "parts": [{"text": contexto}]},
            {"role": "model", "parts": [{"text": "Entendido. Estou pronto para registrar e responder de forma curta."}]}]
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
                    json={"contents": msgs, "generationConfig": {"responseMimeType": "application/json"}}
                )
                result = resp.json()
                err_msg = result.get("error",{}).get("message","")
                if "error" not in result:
                    break
                if any(x in err_msg for x in ["high demand","overloaded","quota","RESOURCE_EXHAUSTED","503","502"]):
                    wait = (tentativa+1)*5
                    print(f"Gemini ocupado (tentativa {tentativa+1}), aguardando {wait}s...")
                    await __import__("asyncio").sleep(wait)
                else:
                    break
            except Exception as e:
                print(f"Timeout/erro na tentativa {tentativa+1}: {e}")
                await __import__("asyncio").sleep(5)

    if "error" in result:
        return {"resposta": f"Erro da IA: {result['error'].get('message','sem detalhes')}", "acao": None}
    texto = result.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
    if not texto:
        return {"resposta": f"Sem resposta da IA. Chave configurada: {bool(GEMINI_KEY)}", "acao": None}
    print(f"GEMINI RETORNOU COMPLETO: {repr(texto)}")
    print(f"DEBUG result keys: {list(result.keys())}")
    print(f"DEBUG candidates: {repr(result.get('candidates','AUSENTE'))[:300]}")

    # Executa todas as ações retornadas pelo Gemini (JSON mode)
    acoes_executadas = []
    try:
        texto_parse = texto.strip()
        if texto_parse.startswith("```"):
            texto_parse = texto_parse.split("```")[1]
            if texto_parse.startswith("json"):
                texto_parse = texto_parse[4:]
            texto_parse = texto_parse.strip()
        parsed = json.loads(texto_parse)
        lista_acoes = parsed.get("acoes", [])
        texto = parsed.get("resposta", "OK")
        print(f"DEBUG parse OK: acoes={lista_acoes}")
    except Exception as e:
        print(f"ERRO parse JSON Gemini: {e} | texto_raw: {repr(texto[:300])}")
        lista_acoes = []
    print(f"DEBUG lista_acoes: {repr(lista_acoes)}")
    linhas_json = lista_acoes  # já são dicts, não precisa serializar
    for linha in linhas_json:
        try:
            acao = linha if isinstance(linha, dict) else json.loads(linha)
            print(f"DEBUG acao={acao} motorista_id={motorista_id}")
            if acao.get("acao") == "registrar_lancamento":
                hoje_str = __import__("datetime").date.today().isoformat()
                dados = {
                    "motorista_id": motorista_id,
                    "tipo": acao.get("tipo", "ganho"),
                    "valor": float(acao.get("valor", 0)),
                    "data": hoje_str
                }
                if acao.get("plataforma"): dados["plataforma"] = acao["plataforma"]
                if acao.get("descricao"): dados["descricao"] = acao["descricao"]
                supabase.table("lancamentos").insert(dados).execute()
                acoes_executadas.append("lancamento_registrado")

            elif acao.get("acao") == "deletar_conta":
                # Remove uma conta a pagar pelo nome
                descricao = acao.get("descricao", "").lower()
                contas_res = supabase.table("contas").select("id,descricao").eq("motorista_id", motorista_id).execute()
                for c in (contas_res.data or []):
                    if descricao and descricao[:6] in c["descricao"].lower():
                        supabase.table("contas").delete().eq("id", c["id"]).execute()
                        acoes_executadas.append("conta_deletada")
                        break
            elif acao.get("acao") == "editar_conta":
                # Edita valor ou vencimento de uma conta pelo nome
                descricao = acao.get("descricao", "").lower()
                campo = acao.get("campo")
                novo_valor = acao.get("novo_valor")
                contas_res = supabase.table("contas").select("id,descricao").eq("motorista_id", motorista_id).execute()
                for c in (contas_res.data or []):
                    if descricao and descricao[:6] in c["descricao"].lower():
                        if campo == "valor":
                            supabase.table("contas").update({"valor": float(novo_valor)}).eq("id", c["id"]).execute()
                        elif campo == "vencimento":
                            supabase.table("contas").update({"vencimento": str(novo_valor)}).eq("id", c["id"]).execute()
                        acoes_executadas.append("conta_editada")
                        break
            elif acao.get("acao") == "deletar_ultimo_lancamento":
                tipo = acao.get("tipo", "ganho")
                r = supabase.table("lancamentos").select("id").eq("motorista_id", motorista_id).eq("tipo", tipo).order("created_at", desc=True).limit(1).execute()
                if r.data:
                    supabase.table("lancamentos").delete().eq("id", r.data[0]["id"]).execute()
                    acoes_executadas.append("lancamento_deletado")
            elif acao.get("acao") == "editar_ultimo_lancamento":
                tipo = acao.get("tipo", "despesa")
                campo = acao.get("campo", "valor")
                novo_valor = acao.get("novo_valor")
                descricao = acao.get("descricao", "")
                # Edita lancamento
                q = supabase.table("lancamentos").select("id,descricao").eq("motorista_id", motorista_id).eq("tipo", tipo).order("created_at", desc=True).limit(5).execute()
                for item in (q.data or []):
                    if not descricao or descricao.lower()[:6] in (item.get("descricao") or "").lower():
                        if novo_valor is not None:
                            supabase.table("lancamentos").update({campo: float(novo_valor)}).eq("id", item["id"]).execute()
                        acoes_executadas.append("lancamento_editado")
                        break
                # Edita conta correspondente
                if descricao and novo_valor is not None:
                    contas_res = supabase.table("contas").select("id,descricao").eq("motorista_id", motorista_id).eq("pago", False).execute()
                    for c in (contas_res.data or []):
                        if descricao.lower()[:6] in c["descricao"].lower():
                            supabase.table("contas").update({"valor": float(novo_valor)}).eq("id", c["id"]).execute()
                            acoes_executadas.append("conta_editada")
                            break
            elif acao.get("acao") == "registrar_conta":
                pago_direto = bool(acao.get("pago", False))
                supabase.table("contas").insert({
                    "motorista_id": motorista_id,
                    "descricao": acao.get("descricao", ""),
                    "valor": float(acao.get("valor", 0)),
                    "vencimento": acao.get("vencimento", __import__("datetime").date.today().isoformat()),
                    "pago": pago_direto
                }).execute()
                acoes_executadas.append("conta_registrada")
            elif acao.get("acao") == "marcar_pago":
                # Marca a conta como paga e cria lancamento de despesa
                descricao = acao.get("descricao", "").lower()
                contas_res = supabase.table("contas").select("id,descricao,valor").eq("motorista_id", motorista_id).eq("pago", False).execute()
                for c in (contas_res.data or []):
                    if descricao and descricao[:6] in c["descricao"].lower():
                        supabase.table("contas").update({"pago": True}).eq("id", c["id"]).execute()
                        # Cria lancamento de despesa agora que foi pago
                        supabase.table("lancamentos").insert({
                            "motorista_id": motorista_id,
                            "tipo": "despesa",
                            "valor": float(c["valor"]),
                            "descricao": c["descricao"],
                            "data": __import__("datetime").date.today().isoformat()
                        }).execute()
                        acoes_executadas.append("conta_paga")
                        break
            elif acao.get("acao") == "abater_conta":
                # Abate valor parcial de uma conta (reduz o valor ou marca paga se zerou)
                descricao = acao.get("descricao", "").lower()
                valor_pago = float(acao.get("valor_pago", 0))
                contas_res = supabase.table("contas").select("id,descricao,valor").eq("motorista_id", motorista_id).eq("pago", False).execute()
                for c in (contas_res.data or []):
                    if descricao and descricao[:6] in c["descricao"].lower():
                        novo_valor = float(c["valor"]) - valor_pago
                        if novo_valor <= 0:
                            supabase.table("contas").update({"pago": True, "valor": 0}).eq("id", c["id"]).execute()
                        else:
                            supabase.table("contas").update({"valor": novo_valor}).eq("id", c["id"]).execute()
                        acoes_executadas.append("conta_abatida")
                        break

            elif acao.get("acao") == "deletar_conta":
                # Remove uma conta a pagar pelo nome
                descricao = acao.get("descricao", "").lower()
                contas_res = supabase.table("contas").select("id,descricao").eq("motorista_id", motorista_id).execute()
                for c in (contas_res.data or []):
                    if descricao and descricao[:6] in c["descricao"].lower():
                        supabase.table("contas").delete().eq("id", c["id"]).execute()
                        acoes_executadas.append("conta_deletada")
                        break
            elif acao.get("acao") == "editar_conta":
                # Edita valor ou vencimento de uma conta pelo nome
                descricao = acao.get("descricao", "").lower()
                campo = acao.get("campo")
                novo_valor = acao.get("novo_valor")
                contas_res = supabase.table("contas").select("id,descricao").eq("motorista_id", motorista_id).execute()
                for c in (contas_res.data or []):
                    if descricao and descricao[:6] in c["descricao"].lower():
                        if campo == "valor":
                            supabase.table("contas").update({"valor": float(novo_valor)}).eq("id", c["id"]).execute()
                        elif campo == "vencimento":
                            supabase.table("contas").update({"vencimento": str(novo_valor)}).eq("id", c["id"]).execute()
                        acoes_executadas.append("conta_editada")
                        break
            elif acao.get("acao") == "deletar_ultimo_lancamento":
                # Deleta o último lançamento registrado hoje para o motorista
                tipo = acao.get("tipo")
                descricao = acao.get("descricao")
                hoje_str = __import__("datetime").date.today().isoformat()
                q = supabase.table("lancamentos").select("id").eq("motorista_id", motorista_id).eq("data", hoje_str).order("created_at", desc=True).limit(10).execute()
                for item in (q.data or []):
                    # Busca o registro completo para verificar tipo/descricao
                    full = supabase.table("lancamentos").select("*").eq("id", item["id"]).execute()
                    if not full.data: continue
                    l = full.data[0]
                    if tipo and l.get("tipo") != tipo: continue
                    if descricao and descricao.lower() not in (l.get("descricao") or "").lower(): continue
                    supabase.table("lancamentos").delete().eq("id", item["id"]).execute()
                    acoes_executadas.append("lancamento_deletado")
                    break
            elif acao.get("acao") == "zerar_despesas_hoje":
                # Deleta TODAS as despesas de hoje do motorista
                hoje_str = __import__("datetime").date.today().isoformat()
                supabase.table("lancamentos").delete().eq("motorista_id", motorista_id).eq("data", hoje_str).eq("tipo", "despesa").execute()
                acoes_executadas.append("despesas_zeradas")
        except Exception as e:
            import traceback
            print(f"ERRO ACAO: {e} | linha: {linha}")
            traceback.print_exc()
    acao_executada = acoes_executadas[0] if acoes_executadas else None
    # texto já atualizado pelo JSON mode

    return {"resposta": texto, "acao": acao_executada}



@app.get("/debug-chat/{mid}")
async def debug_chat(mid: str):
    import json, os, httpx, datetime
    logs = []
    motorista_id = mid
    mensagem = "fiz 50 na uber"
    GEMINI_KEY = os.getenv("GEMINI_API_KEY", "")
    logs.append(f"motorista_id={motorista_id}")
    logs.append(f"GEMINI_KEY={'OK' if GEMINI_KEY else 'AUSENTE'}")
    contexto = '''Responda APENAS com JSON: {"acoes":[{"acao":"registrar_lancamento","tipo":"ganho","valor":50.0,"plataforma":"uber"}],"resposta":"ok"}'''
    msgs = [{"role":"user","parts":[{"text":contexto}]},{"role":"model","parts":[{"text":"ok"}]},{"role":"user","parts":[{"text":mensagem}]}]
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_KEY}", json={"contents":msgs,"generationConfig":{"responseMimeType":"application/json"}})
        result = resp.json()
    texto = result.get("candidates",[{}])[0].get("content",{}).get("parts",[{}])[0].get("text","")
    logs.append(f"gemini_texto={repr(texto[:200])}")
    try:
        parsed = json.loads(texto.strip())
        lista_acoes = parsed.get("acoes",[])
        logs.append(f"lista_acoes={lista_acoes}")
        for acao in lista_acoes:
            try:
                dados = {"motorista_id":motorista_id,"tipo":acao.get("tipo","ganho"),"valor":float(acao.get("valor",0)),"data":datetime.date.today().isoformat()}
                r = supabase.table("lancamentos").insert(dados).execute()
                logs.append(f"insert_ok={r.data}")
            except Exception as e:
                logs.append(f"insert_erro={e}")
    except Exception as e:
        logs.append(f"parse_erro={e}")
    return {"logs": logs}
