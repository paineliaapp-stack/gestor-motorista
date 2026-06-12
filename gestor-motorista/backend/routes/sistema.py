"""Rotas de sistema: páginas, status, favicon e endpoints de diagnóstico."""
from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.templating import Jinja2Templates
from core.supabase_client import supabase
from core.config import hoje_brasil

router = APIRouter()
templates = Jinja2Templates(directory="templates")

@router.get("/", response_class=HTMLResponse)
def root(request: Request):
    from fastapi.responses import Response
    content = templates.get_template("index.html").render({"request": request})
    return Response(
        content=content,
        media_type="text/html",
        headers={
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0",
        }
    )

@router.get("/landing", response_class=HTMLResponse)
def landing(request: Request):
    return templates.TemplateResponse("landing.html", {"request": request})

@router.get("/status")
async def status():
    import datetime
    try:
        # Testa conexão com Supabase
        supabase.table("motoristas").select("id").limit(1).execute()
        db_ok = True
    except Exception:
        db_ok = False
    return {
        "status": "ok",
        "app": "Painel.IA",
        "db": "ok" if db_ok else "erro",
        "ts": datetime.datetime.utcnow().isoformat()
    }

@router.get("/favicon.ico", include_in_schema=False)
def favicon():
    return FileResponse("static/favicon.png")

@router.get("/diagnostico/{mid}")
def diagnostico(mid: str):
    return {"erro": "Endpoint desativado"}
async def _diagnostico_impl(mid: str):
    """Mostra TODOS os lancamentos do motorista sem filtro de data."""
    try:
        todos = supabase.table("lancamentos").select("id,data,tipo,valor,plataforma,descricao").eq("motorista_id", mid).order("data", desc=True).execute()
        lancs = todos.data or []
        total_ganhos = sum(float(l["valor"]) for l in lancs if l["tipo"] == "ganho")
        total_desp = sum(float(l["valor"]) for l in lancs if l["tipo"] == "despesa")
        meses = {}
        for l in lancs:
            chave = l["data"][:7]
            if chave not in meses:
                meses[chave] = {"ganhos": 0, "despesas": 0, "qtd": 0}
            if l["tipo"] == "ganho":
                meses[chave]["ganhos"] += float(l["valor"])
            else:
                meses[chave]["despesas"] += float(l["valor"])
            meses[chave]["qtd"] += 1
        return {"total_lancamentos": len(lancs), "total_ganhos_historico": total_ganhos, "por_mes": dict(sorted(meses.items())), "ultimos_5": lancs[:5]}
    except Exception as e:
        return {"erro": str(e)}

@router.get("/debug-chat/{mid}")
async def debug_chat(mid: str):
    return {"erro": "Endpoint desativado em producao"}
async def _debug_chat_impl(mid: str):
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
                dados = {"motorista_id":motorista_id,"tipo":acao.get("tipo","ganho"),"valor":float(acao.get("valor",0)),"data":hoje_brasil().isoformat()}
                r = supabase.table("lancamentos").insert(dados).execute()
                logs.append(f"insert_ok={r.data}")
            except Exception as e:
                logs.append(f"insert_erro={e}")
    except Exception as e:
        logs.append(f"parse_erro={e}")
    return {"logs": logs}

@router.get("/admin-dashboard", response_class=HTMLResponse)
def admin_dashboard(request: Request):
    return templates.TemplateResponse("admin.html", {"request": request})
