"""Webhook do WhatsApp (Evolution API) + interpretação de mensagens."""
import httpx, os, re
from fastapi import APIRouter, Request
from core.supabase_client import supabase
from core.config import EVOLUTION_URL, EVOLUTION_KEY, EVOLUTION_INSTANCE, hoje_brasil
from core.logging import log_info, log_erro

router = APIRouter()

# NOTA (bug pré-existente preservado): interpretar_mensagem referencia GEMINI_KEY,
# que nunca foi definido no escopo global do main.py original. A chamada gera
# NameError, capturado pelo try/except do webhook. Mantido idêntico para não
# alterar comportamento — corrigir em tarefa separada.

async def interpretar_mensagem(texto: str, motorista_id: str) -> dict:
    import json
    prompt = f"""Você é um assistente financeiro inteligente para motoristas de app (Uber, 99, inDrive).
O motorista mandou: "{texto}"

Extraia as informações e responda APENAS com JSON válido, sem texto extra, sem markdown:
{{
  "tipo": "ganho" ou "despesa",
  "valor": numero float,
  "plataforma": "uber" ou "99" ou "indrive" ou "outras" ou null (se não informada, pergunte),
  "descricao": categoria da despesa ou null,
  "resposta": mensagem amigável de confirmação em português
}}

Categorias válidas para despesa (use a chave exata):
combustivel(gasolina/posto/etanol/abastecimento), manutencao(pneu/óleo/mecânico/conserto/peça/revisão), aluguel_carro, financiamento(parcela/prestação do carro/banco), seguro(seguro auto), ipva(detran/licença/vistoria), multa(infração/radar), lavagem(lava-jato), taxa_app(comissão/desconto semanal uber/99/plataforma), cooperativa(cooperativa/mensalidade cooperativa/associação/sindicato/filiação), estoque_loja(estoque/produto pra revenda/mercadoria/loja), mercado(supermercado/feira/compras de casa), restaurante(almoço/janta/ifood/delivery), lanche(café/suco/biscoito), farmacia(remédio), saude(médico/dentista/plano/academia/hospital), celular(plano/chip/recarga/tim/vivo/claro), internet(wi-fi/fibra/net), streaming(netflix/spotify/amazon), aluguel_casa, condominio, luz_agua(energia/água/gás/enel), roupa(calçado/tênis/camisa), lazer(bar/cinema/viagem/festa), educacao(escola/curso/faculdade), investimento, emprestimo(dívida/parcela pessoal), outros, desconhecido(não sei/não lembro)
Priorize categoria específica — NUNCA use "outros" quando o contexto foi explicado.
Sempre prefira a categoria específica antes de usar "outros".

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
        log_info("wa_enviado")
        return
    async with httpx.AsyncClient() as client:
        await client.post(
            f"{EVOLUTION_URL}/message/sendText/{EVOLUTION_INSTANCE}",
            headers={"apikey": EVOLUTION_KEY},
            json={"number": numero, "text": mensagem},
            timeout=10
        )

@router.post("/webhook/whatsapp")
async def webhook_whatsapp(req: Request):
    # Verifica token de segurança do webhook (Evolution API envia no header)
    _wh_token = req.headers.get("apikey", "") or req.headers.get("Authorization", "")
    _expected_wh = os.getenv("EVOLUTION_KEY", "")
    if _expected_wh and _wh_token != _expected_wh:
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=403, content={"ok": False})
    body = await req.json()
    try:
        msg = body.get("data", {}).get("message", {})
        texto = msg.get("conversation") or msg.get("extendedTextMessage", {}).get("text", "")
        numero_raw = body.get("data", {}).get("key", {}).get("remoteJid", "").replace("@s.whatsapp.net", "")
        numero = numero_raw if len(numero_raw) == 11 else (numero_raw[2:] if numero_raw.startswith("55") else numero_raw[1:] if len(numero_raw) == 12 else numero_raw)
        log_info("webhook_recv", texto_len=len(texto))
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

        hoje = hoje_brasil().isoformat()
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
        log_erro("webhook_erro", erro=e)
    return {"ok": True}

