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

from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from starlette.middleware.base import BaseHTTPMiddleware
import json as _json_log, datetime as _dt_log

def log_info(evento: str, **kwargs):
    print(_json_log.dumps({"ts": _dt_log.datetime.utcnow().isoformat(), "level": "INFO", "evento": evento, **{k: str(v)[:200] for k,v in kwargs.items()}}))

def log_warn(evento: str, **kwargs):
    print(_json_log.dumps({"ts": _dt_log.datetime.utcnow().isoformat(), "level": "WARN", "evento": evento, **{k: str(v)[:200] for k,v in kwargs.items()}}))

def log_erro(evento: str, **kwargs):
    print(_json_log.dumps({"ts": _dt_log.datetime.utcnow().isoformat(), "level": "ERRO", "evento": evento, **{k: str(v)[:200] for k,v in kwargs.items()}}))

app = FastAPI(title="Painel.IA API", docs_url=None, redoc_url=None, openapi_url=None)

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        return response

app.add_middleware(SecurityHeadersMiddleware)
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")


def _match_conta(descricao_busca: str, contas: list) -> dict | None:
    """Encontra a melhor conta pelo nome — prefere match exato, depois prefixo mais longo."""
    import os.path
    descricao_busca = descricao_busca.lower().strip()
    melhor = None
    melhor_score = 0
    for c in contas:
        nome = c.get("descricao", "").lower().strip()
        if nome == descricao_busca:
            return c  # match exato
        score = len(os.path.commonprefix([descricao_busca, nome]))
        if score > melhor_score and score >= 4:
            melhor_score = score
            melhor = c
    return melhor

# ── Push Notifications ────────────────────────────────────────────────────────
from pywebpush import webpush, WebPushException
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
import json as _push_json

VAPID_PUBLIC_KEY  = os.getenv("VAPID_PUBLIC_KEY", "BCy8ETKpP9jIkSHcogzLDgCUlOq3ZuKQ84nnF9Td7Wya6K-q-TUH0NIloBgDPaArR6lhEVt-KhOevVWgG8PCg98")
VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY", "MHcCAQEEIJRY2GzyzckkCKFiuCqMNYnJ+yNeLnXMjcklMTydxMq6oAoGCCqGSM49\nAwEHoUQDQgAELLwRMqk/2MiRIdyiDMsOAJSU6rdm4pDziecX1N3tbJror6r5NQfQ\n0iWgGAM9oCtHqWERW34qE569VaAbw8KD3w==")
VAPID_EMAIL       = os.getenv("VAPID_EMAIL", "mailto:admin@painelia.app")

def _enviar_push(subscription_info: dict, titulo: str, corpo: str, url: str = "/", tag: str = "painel"):
    try:
        payload = _push_json.dumps({"title": titulo, "body": corpo, "url": url, "tag": tag, "icon": "/static/icon-192.png"})
        webpush(subscription_info=subscription_info, data=payload, vapid_private_key=VAPID_PRIVATE_KEY, vapid_claims={"sub": VAPID_EMAIL})
        return True
    except WebPushException as ex:
        status = ex.response.status_code if ex.response else 0
        if status in (404, 410): return "expired"
        log_warn("push_falhou", status=status, err=str(ex)[:100])
        return False
    except Exception as ex:
        log_warn("push_erro", err=str(ex)[:100])
        return False

async def _disparar_push_todos(titulo: str, corpo: str, url: str = "/", tag: str = "painel", apenas_motorista_id: str = None):
    try:
        q = supabase_admin.table("push_subscriptions").select("*")
        if apenas_motorista_id:
            q = q.eq("motorista_id", apenas_motorista_id)
        res = q.execute()
        subs = res.data or []
        expiradas = []
        for sub in subs:
            resultado = _enviar_push(sub["subscription"], titulo, corpo, url, tag)
            if resultado == "expired": expiradas.append(sub["id"])
        for sid in expiradas:
            supabase_admin.table("push_subscriptions").delete().eq("id", sid).execute()
        log_info("push_disparado", total=len(subs), expiradas=len(expiradas))
    except Exception as e:
        log_erro("push_dispatch_erro", err=str(e)[:200])

_scheduler = AsyncIOScheduler(timezone="America/Sao_Paulo")

async def _notif_teste_0010():
    await _disparar_push_todos("Painel.IA — Teste 🧪", "As notificacoes estao funcionando! Pode usar agora ✅", "/", "teste")

async def _notif_lembrete_noite():
    await _disparar_push_todos("Nao esquece! 📊", "Registre seus ganhos de hoje antes de dormir 💰", "/", "lembrete-noite")

async def _notif_meta_manha():
    await _disparar_push_todos("Bom dia, motorista! 🚀", "Hoje e um novo dia. Bora bater a meta! 💪", "/", "meta-manha")

async def _notif_contas_urgentes():
    try:
        from datetime import date as _dc2, timedelta as _td2
        hoje2 = _dc2.today().isoformat()
        amanha2 = (_dc2.today() + _td2(days=1)).isoformat()
        res2 = supabase_admin.table("contas").select("motorista_id,descricao,valor,vencimento").eq("pago", False).in_("vencimento", [hoje2, amanha2]).execute()
        por_mid = {}
        for c in (res2.data or []):
            por_mid.setdefault(c["motorista_id"], []).append(c)
        for mid, cs in por_mid.items():
            nomes = ", ".join(c["descricao"] for c in cs[:2])
            extra = f" +{len(cs)-2} mais" if len(cs) > 2 else ""
            total = sum(float(c.get("valor", 0)) for c in cs)
            await _disparar_push_todos(f"Conta(s) vencendo! ⚠️", f"{nomes}{extra} — R$ {total:.0f}", "/", "contas-urgentes", apenas_motorista_id=mid)
    except Exception as e:
        log_erro("notif_contas_urg", err=str(e)[:200])

async def _notif_relatorio_domingo():
    await _disparar_push_todos("Relatorio da semana 📈", "Veja como foi sua semana no Painel.IA 📊", "/", "relatorio-semana")

@app.on_event("startup")
async def startup_scheduler():
    _scheduler.add_job(_notif_teste_0010,        CronTrigger(hour=0,  minute=10), id="teste_0010",     replace_existing=True)
    _scheduler.add_job(_notif_meta_manha,         CronTrigger(hour=8,  minute=0),  id="meta_manha",     replace_existing=True)
    _scheduler.add_job(_notif_contas_urgentes,    CronTrigger(hour=9,  minute=0),  id="contas_urg",     replace_existing=True)
    _scheduler.add_job(_notif_lembrete_noite,     CronTrigger(hour=22, minute=0),  id="lembrete_noite", replace_existing=True)
    _scheduler.add_job(_notif_relatorio_domingo,  CronTrigger(day_of_week="sun", hour=20, minute=0), id="relatorio_dom", replace_existing=True)
    _scheduler.start()
    log_info("scheduler_iniciado", jobs=5)

@app.get("/vapid-public-key")
def get_vapid_key():
    return {"key": VAPID_PUBLIC_KEY}

@app.post("/push-subscribe")
async def push_subscribe(dados: dict = Body(...)):
    motorista_id = dados.get("motorista_id")
    subscription = dados.get("subscription")
    if not motorista_id or not subscription:
        return {"ok": False, "erro": "Dados incompletos"}
    try:
        endpoint = subscription.get("endpoint", "")[:500]
        ex = supabase_admin.table("push_subscriptions").select("id").eq("motorista_id", motorista_id).eq("endpoint", endpoint).execute()
        if ex.data:
            supabase_admin.table("push_subscriptions").update({"subscription": subscription}).eq("id", ex.data[0]["id"]).execute()
        else:
            supabase_admin.table("push_subscriptions").insert({"motorista_id": motorista_id, "endpoint": endpoint, "subscription": subscription}).execute()
        log_info("push_subscribe_ok", motorista_id=motorista_id)
        return {"ok": True}
    except Exception as e:
        log_erro("push_subscribe_erro", err=str(e))
        return {"ok": False, "erro": str(e)}

@app.delete("/push-unsubscribe")
async def push_unsubscribe(dados: dict = Body(...)):
    try:
        supabase_admin.table("push_subscriptions").delete().eq("motorista_id", dados.get("motorista_id")).eq("endpoint", dados.get("endpoint","")[:500]).execute()
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "erro": str(e)}

@app.post("/push-teste")
async def push_teste_manual(dados: dict = Body(...)):
    mid = dados.get("motorista_id")
    if not mid: return {"ok": False}
    await _disparar_push_todos("Painel.IA — Teste 🧪", "Funcionou! Notificacoes ativas ✅", "/", "teste-manual", apenas_motorista_id=mid)
    return {"ok": True}


@app.get("/favicon.ico", include_in_schema=False)
def favicon():
    return FileResponse("static/favicon.png")

# /setup-colunas removido — endpoint admin sem autenticação

_ALLOWED_ORIGINS = [
    "https://gestor-motorista-production.up.railway.app",
    "http://localhost:8080",
    "http://localhost:3000",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
    allow_credentials=False,
)

def hoje_brasil():
    import datetime as _dt
    return (_dt.datetime.utcnow() - _dt.timedelta(hours=3)).date()

import re as _re, time as _time, asyncio as _asyncio
_UUID_RE = _re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', _re.I)
def _valid_uuid(v: str) -> bool:
    return bool(v and _UUID_RE.match(str(v).strip()))

# Rate limiting por motorista_id (em memória por worker)
_chat_rate: dict = {}
def _check_rate(mid: str, max_per_min: int = 20) -> bool:
    """Limita a 20 mensagens/min por usuário (era 60 — muito permissivo)"""
    agora = _time.time()
    hist = [t for t in _chat_rate.get(mid, []) if agora - t < 60]
    if len(hist) >= max_per_min:
        return False
    hist.append(agora)
    _chat_rate[mid] = hist
    if len(_chat_rate) > 1000:
        _chat_rate.clear()
    return True

# Semáforo global: limita chamadas SIMULTÂNEAS ao Gemini
# 1 worker async pode lidar com muitos requests, mas a API Gemini tem limites
# 25 slots = até 25 chamadas Gemini ao mesmo tempo; o resto fica em fila assíncrona
_gemini_sem = _asyncio.Semaphore(25)

# Cache simples em memória com TTL (evita queries repetidas ao Supabase)
_cache: dict = {}
def _cache_get(key: str):
    entry = _cache.get(key)
    if entry and _time.time() - entry["ts"] < entry["ttl"]:
        return entry["val"]
    return None

def _cache_set(key: str, val, ttl: int = 30):
    _cache[key] = {"val": val, "ts": _time.time(), "ttl": ttl}
    # Limpa cache quando cresce demais
    if len(_cache) > 5000:
        cutoff = _time.time()
        for k in list(_cache.keys()):
            if cutoff - _cache[k]["ts"] > _cache[k]["ttl"] * 2:
                del _cache[k]

def _cache_del(prefix: str):
    """Invalida entradas de cache com esse prefixo."""
    for k in list(_cache.keys()):
        if k.startswith(prefix):
            del _cache[k]

supabase = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_KEY")  # service_role bypassa RLS
)
_supabase_url = os.getenv("SUPABASE_URL", "")
_supabase_service_key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_KEY", "")

from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import httpx as _httpx_auth
import base64 as _b64, json as _json2, time as _time2

# ── Cache de tokens: evita chamar Supabase a cada request ───────────────────
from collections import OrderedDict
class _TokenCache:
    def __init__(self, maxsize=2000):
        self._d: OrderedDict = OrderedDict()
        self._n = maxsize
    def get(self, tok):
        e = self._d.get(tok)
        if not e: return None
        uid, exp = e
        if exp < _time2.time(): self._d.pop(tok, None); return None
        self._d.move_to_end(tok); return uid
    def set(self, tok, uid, exp):
        if len(self._d) >= self._n: self._d.popitem(last=False)
        self._d[tok] = (uid, exp)

_tok_cache = _TokenCache()

def _jwt_exp(token):
    try:
        p = token.split(".")[1] + "=="
        return float(_json2.loads(_b64.urlsafe_b64decode(p)).get("exp", 0))
    except: return 0.0

_bearer_scheme = HTTPBearer(auto_error=False)

async def get_uid_from_token(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme)
) -> str:
    """Verifica JWT do Supabase. Cache local — chama HTTP só na 1ª vez por token."""
    if not credentials or not credentials.credentials:
        raise HTTPException(status_code=401, detail="Token não fornecido")
    token = credentials.credentials
    # Cache hit: sem chamada HTTP
    cached = _tok_cache.get(token)
    if cached: return cached
    # Cache miss: verifica com Supabase
    try:
        async with _httpx_auth.AsyncClient(timeout=5) as c:
            r = await c.get(
                f"{_supabase_url}/auth/v1/user",
                headers={"Authorization": f"Bearer {token}", "apikey": _supabase_service_key}
            )
        if r.status_code != 200:
            raise HTTPException(status_code=401, detail="Token inválido ou expirado")
        uid = r.json().get("id")
        if not uid:
            raise HTTPException(status_code=401, detail="Usuário não encontrado")
        exp = _jwt_exp(token)
        _tok_cache.set(token, uid, exp if exp > 0 else _time2.time() + 3600)
        return uid
    except HTTPException: raise
    except Exception as e:
        print(f"Erro verificação token: {e}")
        raise HTTPException(status_code=401, detail="Erro ao verificar token")

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

@app.get("/landing", response_class=HTMLResponse)
def landing(request: Request):
    return templates.TemplateResponse("landing.html", {"request": request})

@app.get("/status")
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

@app.post("/motoristas")
def criar_motorista(m: Motorista):
    res = supabase.table("motoristas").insert(m.dict()).execute()
    return res.data

@app.post("/upsert-motorista")
async def upsert_motorista(dados: dict = Body(...), uid: str = Depends(get_uid_from_token)):
    uid = uid  # usa uid do token, ignora body
    nome = dados.get("nome", "Usuário")
    if not _valid_uuid(uid):
        return {"ok": False, "erro": "ID inválido"}
    # Sanitiza nome — máximo 100 chars, sem HTML
    nome = str(nome)[:100].replace("<", "").replace(">", "").strip() or "Usuário"
    try:
        res = supabase.table("motoristas").select("id,meta_diaria,comb_diario,setup_completo,plataformas").eq("id", uid).execute()
        if not res.data:
            # Usuário novo — cria registro e sinaliza is_new
            try:
                supabase.table("motoristas").insert({"id": uid, "nome": nome, "telefone": uid[:8], "meta_diaria": 150, "comb_diario": None, "setup_completo": False}).execute()
            except:
                supabase.table("motoristas").insert({"id": uid, "nome": nome, "telefone": uid[:8]}).execute()
            return {"ok": True, "meta_diaria": 150, "comb_diario": None, "is_new": True, "setup_completo": False}
        meta = res.data[0].get("meta_diaria", 150) or 150
        comb = res.data[0].get("comb_diario")
        setup_completo = res.data[0].get("setup_completo", True)  # True = usuários antigos já passam direto
        if setup_completo is None: setup_completo = True  # usuário antigo sem a coluna
        # Se setup_completo ainda é False mas usuário tem meta configurada (meta != 150 padrão),
        # significa que já usou o app — marca como completo automaticamente
        if setup_completo is False and meta and meta != 150:
            setup_completo = True
            try:
                supabase.table("motoristas").update({"setup_completo": True}).eq("id", uid).execute()
            except:
                pass
        # Verifica se tem lançamentos (usuário ativo) — se sim, setup_completo sempre True
        if setup_completo is False:
            try:
                lanc = supabase.table("lancamentos").select("id").eq("motorista_id", uid).limit(1).execute()
                if lanc.data:
                    setup_completo = True
                    supabase.table("motoristas").update({"setup_completo": True}).eq("id", uid).execute()
            except:
                pass
        plataformas = res.data[0].get("plataformas")
        return {"ok": True, "meta_diaria": meta, "comb_diario": comb, "is_new": False, "setup_completo": setup_completo, "plataformas": plataformas}
    except Exception as e:
        print(f"ERRO upsert_motorista: {e}")
        return {"ok": True, "meta_diaria": 150, "comb_diario": None, "is_new": False, "setup_completo": True}

@app.post("/completar-setup")
async def completar_setup(dados: dict = Body(...)):
    """Marca setup como completo e salva dados coletados pelo Gestor."""
    uid = dados.get("id")
    if not _valid_uuid(uid):
        return {"ok": False, "erro": "ID inválido"}
    meta = dados.get("meta_diaria")
    comb = dados.get("comb_diario")
    plataformas = dados.get("plataformas")
    try:
        update = {"setup_completo": True}
        if meta: update["meta_diaria"] = float(meta)
        if comb: update["comb_diario"] = float(comb)
        if plataformas: update["plataformas"] = plataformas
        supabase.table("motoristas").update(update).eq("id", uid).execute()
        return {"ok": True}
    except Exception as e:
        log_erro("endpoint_erro", erro=e)
        return {"ok": False, "erro": "Erro interno"}

@app.post("/meta-diaria/{motorista_id}")
async def salvar_meta_diaria(motorista_id: str, body: dict = Body(...)):
    nova_meta = body.get("meta")
    novo_comb = body.get("comb_diario")  # opcional
    try:
        update = {"meta_diaria": nova_meta}
        if novo_comb is not None:
            update["comb_diario"] = novo_comb
        supabase.table("motoristas").update(update).eq("id", motorista_id).execute()
        return {"ok": True, "meta_diaria": nova_meta, "comb_diario": novo_comb}
    except Exception as e:
        print(f"ERRO meta: {e}")
        return {"ok": False, "erro": "Erro interno"}

@app.get("/meta-diaria/{motorista_id}")
async def buscar_meta_diaria(motorista_id: str):
    try:
        res = supabase.table("motoristas").select("meta_diaria,comb_diario").eq("id", motorista_id).execute()
        meta = res.data[0].get("meta_diaria", 150) if res.data else 150
        comb = res.data[0].get("comb_diario") if res.data else None
        return {"meta_diaria": meta or 150, "comb_diario": comb}
    except Exception as e:
        return {"meta_diaria": 150, "comb_diario": None}


@app.post("/meta-mensal/{motorista_id}")
def salvar_meta_mensal(motorista_id: str, body: dict = Body(...)):
    meta = body.get("meta_mensal")
    if not meta or float(meta) < 100:
        return {"ok": False, "erro": "Valor inválido"}
    try:
        supabase.table("motoristas").update({"meta_mensal": float(meta)}).eq("id", motorista_id).execute()
        return {"ok": True, "meta_mensal": float(meta)}
    except Exception as e:
        log_erro("endpoint_erro", erro=e)
        return {"ok": False, "erro": "Erro interno"}

@app.get("/meta-mensal/{motorista_id}")
def buscar_meta_mensal(motorista_id: str):
    try:
        res = supabase.table("motoristas").select("meta_mensal").eq("id", motorista_id).execute()
        meta = res.data[0].get("meta_mensal") if res.data else None
        return {"meta_mensal": meta}
    except Exception as e:
        return {"meta_mensal": None}

@app.get("/motoristas/{telefone}")
def buscar_motorista(telefone: str):
    res = supabase.table("motoristas").select("*").eq("telefone", telefone).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Motorista não encontrado")
    return res.data[0]

@app.post("/lancamentos")
async def criar_lancamento(l: Lancamento, uid: str = Depends(get_uid_from_token)):
    if l.motorista_id != uid: raise HTTPException(status_code=403, detail="Acesso negado")
    dados = l.dict()
    dados["data"] = str(dados.get("data") or hoje_brasil())
    res = supabase.table("lancamentos").insert(dados).execute()
    return res.data

@app.post("/turno")
async def salvar_turno(body: dict = Body(...), uid: str = Depends(get_uid_from_token)):
    motorista_id = uid  # sempre usa uid do token, nunca do body
    data = body.get("data", str(hoje_brasil()))
    inicio = body.get("inicio")
    fim = body.get("fim")
    horas = body.get("horas")

    if inicio and fim:
        from datetime import datetime
        fmt = "%H:%M"
        try:
            h = (datetime.strptime(fim, fmt) - datetime.strptime(inicio, fmt)).seconds / 3600
            horas = round(h, 2)
        except: pass

    try:
        existing = supabase.table("turnos").select("id").eq("motorista_id", motorista_id).eq("data", data).execute()
        if existing.data:
            supabase.table("turnos").update({"inicio": inicio, "fim": fim, "horas": horas}).eq("id", existing.data[0]["id"]).execute()
        else:
            supabase.table("turnos").insert({"motorista_id": motorista_id, "data": data, "inicio": inicio, "fim": fim, "horas": horas}).execute()
        return {"ok": True, "horas": horas}
    except Exception as e:
        log_erro("endpoint_erro", erro=e)
        return {"ok": False, "erro": "Erro interno"}

@app.get("/turnos/{motorista_id}")
async def get_turnos(motorista_id: str, uid: str = Depends(get_uid_from_token)):
    if motorista_id != uid: raise HTTPException(status_code=403, detail="Acesso negado")
    try:
        r = supabase.table("turnos").select("*").eq("motorista_id", motorista_id).order("data", desc=True).limit(60).execute()
        return r.data or []
    except:
        return []

@app.get("/resumo/{motorista_id}")
async def resumo(motorista_id: str, mes: Optional[int] = None, ano: Optional[int] = None, uid: str = Depends(get_uid_from_token)):
    if motorista_id.lower().strip() != uid.lower().strip():
        print(f"RESUMO 403: mid={motorista_id!r} uid={uid!r}")
        raise HTTPException(status_code=403, detail="Acesso negado")
    if not _valid_uuid(motorista_id): return {"erro": "ID inválido"}
    hoje = hoje_brasil()
    mes = mes or hoje.month
    ano = ano or hoje.year
    _cache_key = f"resumo:{motorista_id}:{mes}:{ano}"
    _cached = _cache_get(_cache_key)
    if _cached: return _cached
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
    # Horas vem da tabela turnos (não de lancamentos, pois seria somado errado)
    try:
        tr = supabase.table("turnos").select("horas").eq("motorista_id", motorista_id).gte("data", inicio).lt("data", fim).execute()
        horas = sum(float(t.get("horas") or 0) for t in (tr.data or []))
    except:
        horas = 0
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



@app.get("/historico-semana/{motorista_id}")
async def historico_semana(motorista_id: str, uid: str = Depends(get_uid_from_token)):
    if motorista_id != uid: raise HTTPException(status_code=403, detail="Acesso negado")
    """Retorna média de faturamento por dia da semana (últimos 45 dias), excluindo outliers."""
    import datetime as _dt
    hoje = hoje_brasil()
    inicio = (hoje - _dt.timedelta(days=45)).isoformat()
    try:
        res = supabase.table("lancamentos").select("data,valor,tipo,plataforma").eq("motorista_id", motorista_id).gte("data", inicio).execute()
        lancamentos = res.data or []
    except:
        lancamentos = []

    # Busca meta_diaria configurada pelo motorista
    try:
        perf = supabase.table("motoristas").select("meta_diaria").eq("id", motorista_id).single().execute()
        meta_diaria = float((perf.data or {}).get("meta_diaria") or 0)
    except:
        meta_diaria = 0

    RENDA_EXTRA_KEYS = ["seguro_desemprego","freelance","aluguel_recebido","venda","emprestimo_recebido","bonus","renda_extra"]
    NOMES_DOW = ["Segunda","Terça","Quarta","Quinta","Sexta","Sábado","Domingo"]

    # Agrupa ganhos por data (exclui renda extra)
    ganhos_por_data = {}
    for l in lancamentos:
        if l["tipo"] == "ganho" and (l.get("plataforma") or "") not in RENDA_EXTRA_KEYS:
            d = l["data"]
            ganhos_por_data[d] = ganhos_por_data.get(d, 0) + float(l["valor"])

    # Remove outliers: dias com ganho > 2.5x a meta ou > 2000 (lançamento retroativo claramente)
    # Teto alto para não cortar dias normais de motorista que faz R$200-500/dia
    teto = 3000  # Só remove lançamentos retroativos óbvios (ex: R$3000 num dia só)
    ganhos_filtrados = {d: v for d, v in ganhos_por_data.items() if v <= teto and v > 1}

    # Calcula média por dia da semana
    soma_dow = {i: 0.0 for i in range(7)}
    cont_dow = {i: 0 for i in range(7)}
    for data_str, total in ganhos_filtrados.items():
        try:
            dow = _dt.date.fromisoformat(data_str).weekday()
            soma_dow[dow] += total
            cont_dow[dow] += 1
        except:
            pass

    dias_com_dado = sum(cont_dow.values())
    dias_semana_distintos = len([v for v in cont_dow.values() if v > 0])
    # Tem histórico se tem pelo menos 3 dias de dados (foi relaxado de 5 dias e 2 dias distintos)
    tem_historico = dias_com_dado >= 3  # 3 dias suficiente para ter padrão

    media_por_dia = {}
    for dow in range(7):
        if cont_dow[dow] > 0:
            media = round(soma_dow[dow] / cont_dow[dow], 0)
            if meta_diaria > 0:
                media = min(media, meta_diaria)
            media_por_dia[dow] = {
                "nome": NOMES_DOW[dow],
                "media": media,
                "amostras": cont_dow[dow]
            }

    media_geral = round(sum(v["media"] for v in media_por_dia.values()) / len(media_por_dia), 0) if media_por_dia else 0

    # Identifica dias fortes e fracos
    if len(media_por_dia) >= 3:
        ordenado = sorted(media_por_dia.items(), key=lambda x: x[1]["media"], reverse=True)
        dias_fortes = [media_por_dia[d]["nome"] for d, _ in ordenado[:2] if media_por_dia[d]["media"] >= media_geral * 0.9]
        dias_fracos = [media_por_dia[d]["nome"] for d, _ in ordenado[-2:] if media_por_dia[d]["media"] < media_geral * 0.75]
    else:
        dias_fortes = []
        dias_fracos = []

    import sys
    print(f"DEBUG historico-semana: dias_com_dado={dias_com_dado}, dias_distintos={dias_semana_distintos}, tem_historico={tem_historico}, ganhos_filtrados={len(ganhos_filtrados)}, total_lancamentos={len(lancamentos)}, teto={teto}", file=sys.stderr)

    return {
        "tem_historico": tem_historico,
        "dias_com_dado": dias_com_dado,
        "media_geral": media_geral,
        "media_por_dia": media_por_dia,
        "dias_fortes": dias_fortes,
        "dias_fracos": dias_fracos,
        "meta_diaria_configurada": meta_diaria
    }


@app.get("/lancamentos-futuros/{motorista_id}")
async def lancamentos_futuros(motorista_id: str, uid: str = Depends(get_uid_from_token)):
    if motorista_id != uid: raise HTTPException(status_code=403, detail="Acesso negado")
    """Retorna lançamentos do próximo mês (renda extra prevista)"""
    import datetime as _dt
    hoje = hoje_brasil()
    if hoje.month == 12:
        prox_mes = 1
        prox_ano = hoje.year + 1
    else:
        prox_mes = hoje.month + 1
        prox_ano = hoje.year
    inicio = f"{prox_ano}-{prox_mes:02d}-01"
    if prox_mes == 12:
        fim = f"{prox_ano+1}-01-01"
    else:
        fim = f"{prox_ano}-{prox_mes+1:02d}-01"
    res = supabase.table("lancamentos").select("*").eq("motorista_id", motorista_id).gte("data", inicio).lt("data", fim).execute()
    lancamentos = res.data or []
    RENDA_EXTRA_KEYS = ["seguro_desemprego","freelance","aluguel_recebido","venda","emprestimo_recebido","bonus","renda_extra"]
    total_renda_extra = sum(float(l["valor"]) for l in lancamentos if l.get("tipo") == "ganho" and l.get("plataforma") in RENDA_EXTRA_KEYS)
    return {"lancamentos": lancamentos, "total_renda_extra_prevista": total_renda_extra}

@app.post("/metas")
def criar_meta(m: Meta):
    res = supabase.table("metas").insert(m.dict()).execute()
    return res.data

@app.get("/metas/{motorista_id}")
def buscar_meta(motorista_id: str):
    res = supabase.table("metas").select("*").eq("motorista_id", motorista_id).execute()
    return res.data


@app.delete("/lancamentos/{lancamento_id}")
async def deletar_lancamento(lancamento_id: str, uid: str = Depends(get_uid_from_token)):
    # Verifica ownership antes de deletar
    check = supabase.table("lancamentos").select("motorista_id").eq("id", lancamento_id).execute()
    if not check.data or check.data[0]["motorista_id"] != uid:
        raise HTTPException(status_code=403, detail="Acesso negado")
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
  "plataforma": "uber" ou "99" ou "indrive" ou "outras" ou null (se não informada, pergunte),
  "descricao": categoria da despesa ou null,
  "resposta": mensagem amigável de confirmação em português
}}

Categorias válidas para despesa (use a chave exata):
combustivel(gasolina/posto/etanol), manutencao(pneu/óleo/mecânico/conserto/peça), aluguel_carro, financiamento(parcela do carro/banco), seguro(seguro auto), ipva(detran/licença), multa(infração), lavagem(lava-jato), mercado(supermercado/feira/compras de casa), restaurante(lanche/comida/delivery/ifood/almoço/janta), farmacia(remédio), saude(médico/dentista/plano/academia/hospital/exame/psicólogo), celular(plano/chip/recarga/tim/vivo/claro), internet(wi-fi/fibra/net), streaming(netflix/spotify/amazon), aluguel_casa, condominio, luz_agua(energia/água/gás/enel), roupa(calçado/tênis/camisa), lazer(bar/cinema/viagem/festa/passeio), educacao(escola/curso/faculdade/inglês), investimento, emprestimo(dívida/crédito pessoal/parcela pessoal), outros, desconhecido(não sei/não lembro)
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
        print(f"Erro webhook: {e}")
    return {"ok": True}


@app.get("/contas/{motorista_id}")
async def listar_contas(motorista_id: str, uid: str = Depends(get_uid_from_token)):
    if motorista_id != uid: raise HTTPException(status_code=403, detail="Acesso negado")
    if not _valid_uuid(motorista_id): return []
    _cached = _cache_get(f"contas:{motorista_id}")
    if _cached is not None: return _cached
    res = supabase.table("contas").select("*").eq("motorista_id", motorista_id).order("vencimento").execute()
    return res.data

@app.post("/contas")
async def criar_conta(c: dict = Body(...)):
    res = supabase.table("contas").insert(c).execute()
    _cache_del(f"contas:{c.get('motorista_id','')}")
    _cache_del(f"resumo:{c.get('motorista_id','')}")
    return res.data

@app.patch("/contas/{conta_id}")
async def atualizar_conta(conta_id: str, dados: dict = Body(...), uid: str = Depends(get_uid_from_token)):
    check = supabase.table("contas").select("motorista_id").eq("id", conta_id).execute()
    if not check.data or check.data[0]["motorista_id"] != uid:
        raise HTTPException(status_code=403, detail="Acesso negado")
    # Remove campos que não devem ser alterados diretamente
    dados.pop("motorista_id", None); dados.pop("id", None)
    res = supabase.table("contas").update(dados).eq("id", conta_id).execute()
    return res.data

@app.delete("/contas/{conta_id}")
async def deletar_conta(conta_id: str, uid: str = Depends(get_uid_from_token)):
    check = supabase.table("contas").select("motorista_id").eq("id", conta_id).execute()
    if not check.data or check.data[0]["motorista_id"] != uid:
        raise HTTPException(status_code=403, detail="Acesso negado")
    supabase.table("contas").delete().eq("id", conta_id).execute()
    return {"ok": True}

@app.post("/plano-financeiro")
async def plano_financeiro(dados: dict = Body(...), uid: str = Depends(get_uid_from_token)):
    if dados.get("motorista_id") != uid: raise HTTPException(status_code=403, detail="Acesso negado")
    """Plano financeiro: Python faz todos os calculos, IA só escreve com empatia."""
    try:
        return await _plano_financeiro_impl(dados)
    except Exception as e:
        import traceback
        traceback.print_exc()
        log_erro("plano_financeiro_erro", erro=e)
        return {"ok": False, "plano": "Erro ao gerar plano"}

async def _plano_financeiro_impl(dados: dict):
    import httpx, datetime as _dt

    motorista_id = dados.get("motorista_id")
    # SEMPRE busca meta_diaria do perfil — ignora max_dia do frontend (pode ser valor antigo)
    comb_configurado = None
    capacidade_max_manual = 0
    try:
        perf = supabase.table("motoristas").select("meta_diaria,comb_diario").eq("id", motorista_id).single().execute()
        capacidade_max_manual = float((perf.data or {}).get("meta_diaria") or 0)
        comb_conf = (perf.data or {}).get("comb_diario")
        if comb_conf is not None:
            comb_configurado = float(comb_conf)
    except: pass

    # Fallback final: 300
    if capacidade_max_manual <= 0:
        capacidade_max_manual = 300

    hoje = hoje_brasil()
    inicio_mes = hoje.replace(day=1).isoformat()
    inicio_historico = (hoje - _dt.timedelta(days=45)).isoformat()

    # ── BUSCA DADOS ──────────────────────────────────────────────────────────
    try:
        contas_res = supabase.table("contas").select("*").eq("motorista_id", motorista_id).order("vencimento").execute()
        contas = contas_res.data or []
    except: contas = []

    try:
        lanc_res = supabase.table("lancamentos").select("tipo,valor,descricao,plataforma,data").eq("motorista_id", motorista_id).gte("data", inicio_historico).execute()
        lancamentos_hist = lanc_res.data or []
    except: lancamentos_hist = []

    lancamentos_mes = [l for l in lancamentos_hist if l["data"] >= inicio_mes]

    # ── COMPROMISSOS DE DIAS ESPECÍFICOS (ex: "sexta faço 600") ──────────────
    # Motorista pode informar valores diferentes por dia — o plano usa esses valores reais
    compromissos_dict = {}  # {data_str: meta_bruta}
    try:
        fim_busca_comp = (hoje_brasil() + _dt.timedelta(days=14)).isoformat()
        comp_res = supabase.table("plano_compromissos").select("data,meta_bruta").eq("motorista_id", motorista_id).gte("data", hoje_brasil().isoformat()).lte("data", fim_busca_comp).execute()
        for c in (comp_res.data or []):
            if c.get("data") and c.get("meta_bruta"):
                compromissos_dict[c["data"]] = float(c["meta_bruta"])
        if compromissos_dict:
            print(f"DEBUG compromissos carregados: {compromissos_dict}")
    except Exception as e:
        print(f"DEBUG erro buscando compromissos: {e}")

    # ── COMBUSTIVEL — hierarquia de prioridade ───────────────────────────────
    # 1. Valor configurado pelo motorista no perfil (mais confiável)
    # 2. Média real dos lançamentos do mês
    # 3. Taxa proporcional estimada (25% do faturamento)
    # 4. Nunca usa valor de conta "Combustível - Resto do Mês" como base de cálculo

    dias_rodados = max(1, hoje.day - 1)
    ganhos_total_mes = sum(float(l["valor"]) for l in lancamentos_mes if l["tipo"] == "ganho")
    COMB_KEYS = ["combustivel", "combustível", "gasolina", "etanol", "diesel", "abastec"]
    # Soma todos os lançamentos de despesa com categoria/descrição de combustível
    comb_total_mes_bruto = sum(
        float(l["valor"]) for l in lancamentos_mes
        if l["tipo"] == "despesa"
        and any(k in (l.get("descricao") or "").lower() for k in COMB_KEYS)
    )
    # Exclui lançamentos únicos muito grandes (acima de R$400 em um único dia = provavelmente conta a pagar)
    comb_total_mes = sum(
        float(l["valor"]) for l in lancamentos_mes
        if l["tipo"] == "despesa"
        and any(k in (l.get("descricao") or "").lower() for k in COMB_KEYS)
        and float(l["valor"]) <= 400
    )
    # Se filtrar tudo, usa o bruto (melhor do que zero)
    if comb_total_mes < 10 and comb_total_mes_bruto > 10:
        comb_total_mes = comb_total_mes_bruto
    taxa_comb_bruta = comb_total_mes / max(ganhos_total_mes, 1)
    comb_suspeito = taxa_comb_bruta > 0.50

    fonte_comb = ""
    if comb_configurado is not None and comb_configurado > 0:
        # PRIORIDADE 1: motorista informou manualmente
        comb_diario = comb_configurado
        taxa_comb = comb_diario / max(capacidade_max_manual, 1)
        taxa_comb = min(max(taxa_comb, 0.05), 0.60)
        fonte_comb = f"informado pelo motorista (R${comb_diario:.0f}/dia)"
        precisa_configurar_comb = False
    elif comb_total_mes > 10 and dias_rodados >= 3:
        # PRIORIDADE 2: histórico real dos lançamentos (pelo menos 3 dias de dados)
        comb_diario = round(comb_total_mes / dias_rodados, 0)
        taxa_comb = comb_total_mes / max(ganhos_total_mes, 1)
        if comb_suspeito:
            # Taxa acima de 50% → provavelmente tem lançamento errado no histórico
            # Usa cap de 35% e avisa no contexto
            taxa_comb = 0.35
            comb_diario = round(capacidade_max_manual * taxa_comb, 0)
            fonte_comb = f"estimativa corrigida (histórico mostra {taxa_comb_bruta*100:.0f}% mas pode ter lançamentos errados — usando 35%)"
            precisa_configurar_comb = True
        else:
            taxa_comb = min(max(taxa_comb, 0.10), 0.55)
            fonte_comb = f"média dos lançamentos ({dias_rodados} dias)"
            precisa_configurar_comb = False
    else:
        # PRIORIDADE 3: estimativa — pede para configurar
        taxa_comb = 0.25
        comb_diario = round(capacidade_max_manual * taxa_comb, 0)
        fonte_comb = "estimativa (25% do faturamento) — configure para maior precisão"
        precisa_configurar_comb = True

    # ── CAPACIDADE REAL POR DIA DA SEMANA ────────────────────────────────────
    ganhos_por_data = {}
    for l in lancamentos_hist:
        if l["tipo"] == "ganho":
            d = l["data"]
            ganhos_por_data[d] = ganhos_por_data.get(d, 0) + float(l["valor"])

    # Detecta outliers: dias com ganho acima de 1.5x o max_dia informado
    # Isso acontece quando o motorista lança histórico acumulado num único dia
    teto_outlier = max(capacidade_max_manual * 4, 2000)
    # Filtra outliers acima E dias com ganho mínimo (<R$30 = dia de teste/inativo)
    ganhos_filtrados = {d: v for d, v in ganhos_por_data.items() if v <= teto_outlier and v >= 30}

    # Só usa histórico por dia da semana se tem pelo menos 5 dias reais (não outliers)
    # e esses dias cobrem pelo menos 2 dias da semana diferentes
    soma_dow = {i: 0.0 for i in range(7)}
    cont_dow = {i: 0 for i in range(7)}
    for data_str, total in ganhos_filtrados.items():
        try:
            dow = _dt.date.fromisoformat(data_str).weekday()
            soma_dow[dow] += total
            cont_dow[dow] += 1
        except: pass

    dias_com_historico_real = sum(cont_dow.values())
    dias_semana_cobertos = len([v for v in cont_dow.values() if v > 0])

    media_dow = {dow: round(soma_dow[dow]/cont_dow[dow], 0) for dow in range(7) if cont_dow[dow] > 0}

    # Limita cada média ao máximo informado — segurança extra contra outliers
    if capacidade_max_manual > 0:
        media_dow = {dow: min(v, capacidade_max_manual) for dow, v in media_dow.items()}

    NOMES_DOW = ["Seg","Ter","Qua","Qui","Sex","Sab","Dom"]

    # Histórico confiável = pelo menos 5 dias reais cobrindo 2+ dias da semana distintos
    tem_historico = dias_com_historico_real >= 5 and dias_semana_cobertos >= 2

    # Capacidade padrão: usa histórico ou meta manual
    if tem_historico:
        cap_padrao = round(sum(media_dow.values()) / len(media_dow), 0)
        fonte = "historico real"
    else:
        cap_padrao = capacidade_max_manual if capacidade_max_manual > 0 else 350
        fonte = "meta informada"

    # ── DIA A DIA: PROJECAO REAL ─────────────────────────────────────────────
    if hoje.month == 12:
        fim_mes = _dt.date(hoje.year + 1, 1, 1) - _dt.timedelta(days=1)
    else:
        fim_mes = _dt.date(hoje.year, hoje.month + 1, 1) - _dt.timedelta(days=1)
    dias_restantes_mes = max(1, (fim_mes - hoje).days + 1)
    # Se faltam menos de 3 dias no mês mas há contas com vencimento em junho,
    # expande o horizonte para 7 dias para o plano não parecer impossível
    tem_contas_proximo_mes = any(
        c.get("vencimento","") > fim_mes.isoformat()
        for c in contas if not c.get("pago")
    )
    dias_restantes = dias_restantes_mes if dias_restantes_mes >= 5 else (
        max(7, dias_restantes_mes) if tem_contas_proximo_mes else dias_restantes_mes
    )

    # Para cada dia restante: qual a capacidade bruta realista
    dias_projecao = []
    for i in range(dias_restantes):
        dia = hoje + _dt.timedelta(days=i)
        dow = dia.weekday()
        # Compromisso específico tem prioridade sobre histórico/média
        data_str = dia.isoformat()
        if data_str in compromissos_dict:
            bruto = compromissos_dict[data_str]
            fonte_dia = "compromisso"
        elif tem_historico:
            bruto = media_dow.get(dow, cap_padrao)
            fonte_dia = "historico"
        else:
            bruto = cap_padrao
            fonte_dia = "padrao"
        liquido = max(0, bruto - comb_diario)
        dias_projecao.append({"data": dia, "nome": NOMES_DOW[dow], "bruto": bruto, "liquido": liquido, "fonte": fonte_dia, "compromisso": data_str in compromissos_dict})

    total_liquido_possivel = sum(d["liquido"] for d in dias_projecao)

    # ── SALDO ATUAL ──────────────────────────────────────────────────────────
    ganhos_mes = sum(float(l["valor"]) for l in lancamentos_mes if l["tipo"] == "ganho")
    despesas_mes = sum(float(l["valor"]) for l in lancamentos_mes if l["tipo"] == "despesa")
    caixa_atual = max(0, ganhos_mes - despesas_mes)
    poder_total = caixa_atual + total_liquido_possivel

    # ── CLASSIFICA E PRIORIZA CONTAS ─────────────────────────────────────────
    INTOCAVEIS_KEYS = ["carro", "aluguel car", "financiamento", "veiculo", "finan", "semanal do carro", "diaria carro", "locacao", "locação"]
    NEGOCIAVEIS_KEYS = ["emprestimo", "elaine", "amigo", "familiar", "devendo", "pessoal"]
    COMBUSTIVEL_KEYS = ["combustivel", "combustível", "gasolina", "etanol", "diesel", "abastec"]

    contas_pendentes = [c for c in contas if not c.get("pago")]

    # ── TRATA CONTAS DE COMBUSTÍVEL SEPARADO ─────────────────────────────────
    # Conta de combustível projetada = estimativa que o motorista cadastrou
    # O valor real já gasto no mês está nos lançamentos
    # Lógica: valor_restante_conta = max(0, valor_conta - combustivel_ja_gasto_no_mes)
    contas_comb = [c for c in contas_pendentes
                   if any(k in (c.get("descricao") or "").lower() for k in COMBUSTIVEL_KEYS)]
    contas_normais = [c for c in contas_pendentes
                      if not any(k in (c.get("descricao") or "").lower() for k in COMBUSTIVEL_KEYS)]

    # Para contas de combustível: desconta só o que foi gasto DEPOIS que a conta foi criada
    # (não o mês inteiro — a conta projetada já cobre só o restante do mês)
    comb_projetado_contas = sum(
        max(0, float(c["valor"]) - float(c.get("valor_pago") or 0)) for c in contas_comb
    )
    # Data de criação da conta de combustível mais recente
    if contas_comb:
        data_conta_comb = min(
            (c.get("criado_em") or c.get("created_at") or c.get("vencimento") or "2000-01-01")[:10]
            for c in contas_comb
        )
        # Soma só os gastos reais de combustível a partir dessa data
        comb_ja_gasto = sum(
            float(l["valor"]) for l in lancamentos_mes
            if (l.get("descricao") or "").lower() == "combustivel"
            and (l.get("data") or "")[:10] >= data_conta_comb
        )
    else:
        comb_ja_gasto = 0

    # O que ainda falta pagar = projeção - já gasto desde que a conta foi criada
    comb_restante_real = max(0, comb_projetado_contas - comb_ja_gasto)
    economia_comb = max(0, comb_projetado_contas - comb_restante_real)

    # Inclui contas de combustível como uma única entrada ajustada (se ainda houver saldo)
    contas_pendentes_ajustadas = contas_normais[:]
    if contas_comb and comb_restante_real > 0:
        # Usa a primeira conta de combustível como representante, com valor ajustado
        c_repr = contas_comb[0].copy()
        c_repr["_valor_ajustado"] = comb_restante_real
        c_repr["_economia"] = economia_comb
        contas_pendentes_ajustadas.append(c_repr)

    def valor_falta(c):
        if c.get("_valor_ajustado") is not None:
            return c["_valor_ajustado"]
        return max(0, float(c["valor"]) - float(c.get("valor_pago") or 0))

    def dias_venc(c):
        try:
            return (_dt.date.fromisoformat(c["vencimento"]) - hoje).days
        except: return 999

    def prioridade(c):
        nome = (c.get("descricao") or "").lower()
        if any(k in nome for k in INTOCAVEIS_KEYS): return 1  # intocavel
        if any(k in nome for k in NEGOCIAVEIS_KEYS): return 4  # claramente negociavel
        dv = dias_venc(c)
        if dv <= 3: return 2   # urgente por vencimento
        if dv <= 7: return 3   # esta semana
        return 4               # pode negociar

    contas_enriquecidas = []
    for c in contas_pendentes_ajustadas:
        falta = valor_falta(c)
        if falta <= 0: continue
        dv = dias_venc(c)
        p = prioridade(c)
        nome = (c.get("descricao") or "").lower()
        contas_enriquecidas.append({
            "nome": c.get("descricao", "?"),
            "falta": falta,
            "dias_ate": dv,
            "vencimento": c.get("vencimento", "?"),
            "prioridade": p,
            "intocavel": any(k in nome for k in INTOCAVEIS_KEYS),
            "negociavel": p == 4,
        })

    contas_enriquecidas.sort(key=lambda x: (x["prioridade"], x["dias_ate"]))

    # Distribui caixa atual nas mais urgentes primeiro
    caixa_disp = caixa_atual
    for c in contas_enriquecidas:
        abate = min(caixa_disp, c["falta"])
        caixa_disp -= abate
        c["coberto_caixa"] = round(abate, 0)
        c["ainda_falta"] = round(c["falta"] - abate, 0)

    # Separa grupos
    pagar_agora   = [c for c in contas_enriquecidas if c["ainda_falta"] <= 0]
    pagar_urgente = [c for c in contas_enriquecidas if c["ainda_falta"] > 0 and c["prioridade"] <= 2]
    pagar_semana  = [c for c in contas_enriquecidas if c["ainda_falta"] > 0 and c["prioridade"] == 3]
    negociar      = [c for c in contas_enriquecidas if c["ainda_falta"] > 0 and c["prioridade"] == 4]

    total_urgente = sum(c["ainda_falta"] for c in pagar_urgente)
    total_semana  = sum(c["ainda_falta"] for c in pagar_semana)
    total_negociar= sum(c["ainda_falta"] for c in negociar)
    total_falta   = total_urgente + total_semana + total_negociar

    # ── MONTA PLANO DIA A DIA ────────────────────────────────────────────────
    # Distribui as contas urgentes pelos próximos dias
    saldo_acumulado = 0.0
    plano_dias = []
    conta_idx = 0
    contas_a_distribuir = [c for c in contas_enriquecidas if c["ainda_falta"] > 0 and not c["negociavel"]]

    for d in dias_projecao[:7]:  # próximos 7 dias
        liquido_dia = d["liquido"]
        saldo_acumulado += liquido_dia
        plano_dias.append({
            "dia": d["nome"],
            "data": d["data"].strftime("%d/%m"),
            "bruto": d["bruto"],
            "liquido": liquido_dia,
            "acumulado": round(saldo_acumulado, 0)
        })

    # Verifica se cobre os urgentes
    cobre_urgentes = poder_total >= total_urgente
    cobre_tudo = poder_total >= total_falta

    # Meta de hoje específica
    hoje_dow = hoje.weekday()
    meta_hoje_bruto = media_dow.get(hoje_dow, cap_padrao) if tem_historico else cap_padrao
    meta_hoje_liquido = max(0, meta_hoje_bruto - comb_diario)

    # ── ALERTAS DE SAÚDE FINANCEIRA ──────────────────────────────────────────
    # Regra: cada alerta fala SÓ UMA coisa, sem contradição com outros alertas
    alertas = []

    # 1. Precisa configurar combustível
    if precisa_configurar_comb:
        alertas.append(f"⚙️ Usando estimativa de R${comb_diario:.0f}/dia de combustível (25% do faturamento). Configure o valor real nas configurações para o plano ficar mais preciso.")

    # 2. Taxa de combustível alta — SÓ mostra se NÃO tem conta de combustível cadastrada
    # (se tem conta, o plano já aborda isso; o alerta ficaria contraditório)
    if not contas_comb:
        if taxa_comb >= 0.45:
            alertas.append(f"🚨 Combustível consumindo {taxa_comb*100:.0f}% do que você fatura — acima do ideal (máx 30%). A cada R$100 faturados, sobram R${(1-taxa_comb)*100:.0f} no bolso. Vale revisar rotas e horários.")
        elif taxa_comb >= 0.35:
            alertas.append(f"⚠️ Combustível em {taxa_comb*100:.0f}% do faturamento — um pouco acima do ideal (20-30%). A cada R$100, sobram R${(1-taxa_comb)*100:.0f} líquido.")

    alertas_txt = "\n".join(alertas) if alertas else ""

    # ── MONTA TEXTO DO CONTEXTO COMPLETO PARA A IA ───────────────────────────
    def fmt_lista(lista, incluir_dias=True):
        linhas = []
        for c in lista:
            dv = c["dias_ate"]
            venc_label = f"vence em {dv}d" if dv >= 0 else f"VENCIDA há {abs(dv)}d"
            dias_necessarios = round(c["ainda_falta"] / max(meta_hoje_liquido, 1), 1)
            linha = f"• {c['nome']}: R${c['ainda_falta']:.0f}"
            if incluir_dias:
                linha += f" ({venc_label} — {dias_necessarios} dias de trabalho para cobrir)"
            linhas.append(linha)
        return "\n".join(linhas) if linhas else "Nenhuma"

    plano_7dias_txt = "".join(
        f"• {d['dia']} {d['data']}: fatura R${d['bruto']:.0f} → combustível R${comb_diario:.0f} → líquido R${d['liquido']:.0f} → acumulado R${d['acumulado']:.0f}"
        for d in plano_dias
    )

    if cobre_tudo:
        diagnostico = f"✅ DÁ para pagar tudo. Com R${meta_hoje_bruto:.0f}/dia você cobre os R${total_falta:.0f} restantes em {dias_restantes} dias."
    elif cobre_urgentes:
        deficit_negociar = total_falta - poder_total  # quanto falta no total
        diagnostico = f"⚠️ DÁ para cobrir o essencial (R${total_urgente:.0f}), MAS faltam R${deficit_negociar:.0f} no total — contas negociáveis precisam de prazo."
    else:
        deficit_total = total_falta - poder_total          # buraco total
        deficit_essencial = total_urgente - (poder_total - total_negociar)  # só do essencial
        diagnostico = (
            f"🔴 CRÍTICO: mesmo trabalhando todos os dias, poder total é R${poder_total:.0f} "
            f"(R${caixa_atual:.0f} caixa + R${total_liquido_possivel:.0f} projetado líquido) "
            f"mas contas somam R${total_falta:.0f}. Déficit total: R${deficit_total:.0f}. "
            f"Precisa negociar prazo em pelo menos R${deficit_total:.0f} em contas."
        )

    # ── CENÁRIO DE ESFORÇO EXTRA ────────────────────────────────────────────
    # Quanto precisaria fazer por dia para fechar o buraco?
    # Calcula o mínimo bruto necessário para cobrir o déficit nos dias restantes
    if not cobre_tudo and total_falta > 0 and dias_restantes > 0:
        deficit_normal = max(0, total_falta - (caixa_atual + total_liquido_possivel))
        # Bruto necessário = (líquido faltante / dias) / (1 - taxa_comb)
        # Só sugere se for acima do normal mas abaixo de 2x o cap_padrao (realista)
        liq_extra_por_dia_necessario = deficit_normal / dias_restantes
        bruto_necessario_dia = round(liq_extra_por_dia_necessario / max(1 - taxa_comb, 0.3), 0)
        # Arredonda para múltiplo de 50 acima
        cap_esforco = int((bruto_necessario_dia + cap_padrao + 49) / 50) * 50
        cap_esforco = max(cap_esforco, cap_padrao + 50)  # pelo menos 50 a mais que o normal
        cap_esforco_max = cap_padrao * 2.5  # teto realista
        cap_esforco = min(cap_esforco, cap_esforco_max)
    else:
        cap_esforco = round(cap_padrao * 1.3 / 50) * 50  # 30% a mais como sugestão

    comb_esforco = round(cap_esforco * taxa_comb, 0)
    liq_esforco_dia = max(0, cap_esforco - comb_esforco)
    total_liq_esforco = liq_esforco_dia * dias_restantes
    poder_esforco = caixa_atual + total_liq_esforco

    if not cobre_tudo and liq_esforco_dia > meta_hoje_liquido:
        deficit_normal = max(0, total_falta - (caixa_atual + total_liquido_possivel))
        ganho_extra_por_dia = liq_esforco_dia - meta_hoje_liquido
        dias_esforco_necessarios = min(dias_restantes, max(1, round(deficit_normal / max(ganho_extra_por_dia, 1) + 0.5)))
        fecha_com_esforco = poder_esforco >= total_falta
        # Explica de onde veio o número (referência para a IA usar no texto)
        origem_numero = f"seu histórico mostra R${cap_padrao:.0f}/dia em média" if tem_historico else f"você informou R${cap_padrao:.0f}/dia como meta"
        cenario_esforco_txt = f"""
=== CENÁRIO DE ESFORÇO EXTRA ===
Referência: {origem_numero}.
Se fizer R${cap_esforco:.0f} brutos/dia (R${cap_esforco - cap_padrao:.0f} a mais que o normal):
- Combustível: R${comb_esforco:.0f} ({taxa_comb*100:.0f}% do faturamento — mesma taxa, só o valor muda)
- Líquido por dia: R${liq_esforco_dia:.0f} (R${ganho_extra_por_dia:.0f}/dia a mais)
- Total em {dias_restantes} dias: R${total_liq_esforco:.0f}
- {'✅ FECHA TUDO com R' + f'{poder_esforco - total_falta:.0f}' + ' de sobra' if fecha_com_esforco else f'❌ ainda falta R${abs(poder_esforco - total_falta):.0f} — mas reduz o buraco bastante'}
- Alternativa mínima: fazer R${cap_esforco:.0f}/dia por apenas {dias_esforco_necessarios} dia{'s' if dias_esforco_necessarios > 1 else ''} específico{'s' if dias_esforco_necessarios > 1 else ''} → cobre o déficit
INSTRUÇÃO: Na seção SITUAÇÃO, mostre o cenário de esforço (linha começando com 💡). Depois PERGUNTE: "Você consegue fazer R${cap_esforco:.0f} em algum dia?" — SOMENTE "consegue ou não". Não pergunte os dias ainda. Quando ele confirmar que consegue, aí você pergunta os dias."""
    else:
        cenario_esforco_txt = ""

    # ── COMPROMISSOS ESPECÍFICOS (para o prompt) ─────────────────────────────
    NOMES_DOW_COMPLETO = ["Segunda","Terça","Quarta","Quinta","Sexta","Sábado","Domingo"]
    if compromissos_dict:
        dias_comp_linhas = []
        for d in sorted(compromissos_dict.keys()):
            try:
                dt = _dt.date.fromisoformat(d)
                nome_dia = NOMES_DOW_COMPLETO[dt.weekday()]
                meta_b = compromissos_dict[d]
                meta_l = max(0, meta_b - comb_diario)
                dias_comp_linhas.append(f"  • {nome_dia} {dt.strftime('%d/%m')}: R${meta_b:.0f} bruto → ⛽R${comb_diario:.0f} → R${meta_l:.0f} líquido")
            except: pass
        compromissos_txt = "DIAS COM META ESPECÍFICA (informados pelo motorista — use ESTES valores, não a média):\n" + "\n".join(dias_comp_linhas)
    else:
        compromissos_txt = ""

    # ── PADRÃO POR DIA DA SEMANA (para a IA comentar) ───────────────────────
    if tem_historico and len(media_dow) >= 3:
        dias_ord = sorted(media_dow.items(), key=lambda x: x[1], reverse=True)
        melhores = [NOMES_DOW_COMPLETO[d] for d,_ in dias_ord[:2]]
        piores   = [NOMES_DOW_COMPLETO[d] for d,_ in dias_ord[-2:] if _ < cap_padrao * 0.85]
        dow_txt_linhas = [f"  {NOMES_DOW_COMPLETO[d]}: R${v:.0f}/dia (média histórica)" for d,v in sorted(media_dow.items())]
        padrao_semana_txt = (
            f"PADRÃO REAL POR DIA DA SEMANA (baseado no histórico do motorista):\n"
            + "\n".join(dow_txt_linhas)
            + f"\n→ Dias mais fortes: {', '.join(melhores)}"
            + (f"\n→ Dias mais fracos: {', '.join(piores)}" if piores else "")
            + "\nUse esse padrão para sugerir em quais dias vale a pena forçar mais. Comente isso naturalmente — mostra que o sistema conhece a rotina dele."
        )
    else:
        padrao_semana_txt = ""

    # Python já calculou tudo. A IA só escreve o texto — 3 mensagens separadas por |||
    # Cada mensagem = uma bolha separada no chat (como WhatsApp)
    prompt = f"""Você é um amigo próximo do motorista. Vai mandar 3 mensagens curtas no WhatsApp, separadas por |||.

NÚMEROS REAIS (use EXATAMENTE estes, não recalcule):
- Caixa agora: R${caixa_atual:.0f}
- Dias restantes no mês: {dias_restantes}
- Faturamento médio por dia (histórico real): R${meta_hoje_bruto:.0f} bruto → R${comb_diario:.0f} combustível → R${meta_hoje_liquido:.0f} líquido
- SE trabalhar normal {dias_restantes} dias: pode entrar mais R${total_liquido_possivel:.0f} (projeção — não é certeza)
- Total de contas pendentes: R${total_falta:.0f}
- Situação: {"NÃO FECHA — mesmo faturando normal, falta R$" + f"{max(0, total_falta - (caixa_atual + total_liquido_possivel)):.0f}" if not cobre_tudo else "FECHA — trabalhando normal dá pra cobrir tudo"}
{"- Para fechar precisaria de R$" + f"{cap_esforco:.0f}" + "/dia (R$" + f"{cap_esforco - cap_padrao:.0f}" + " a mais que o normal)" if not cobre_tudo and cap_esforco > cap_padrao else ""}
{"- Padrão: dias mais fortes = " + ", ".join([NOMES_DOW_COMPLETO[d] for d,_ in sorted(media_dow.items(), key=lambda x: x[1], reverse=True)[:2]]) if tem_historico and media_dow else ""}

CONTAS URGENTES (vence em até 3 dias):
{chr(10).join(f"  • {c['nome']}: R${c['falta']:.0f} ({'VENCIDA há ' + str(abs(c['dias_ate'])) + 'd' if c['dias_ate'] < 0 else 'vence HOJE' if c['dias_ate'] == 0 else 'vence em ' + str(c['dias_ate']) + 'd'})" for c in pagar_urgente) if pagar_urgente else "  Nenhuma"}

CONTAS DA SEMANA (vence em 4-7 dias):
{chr(10).join(f"  • {c['nome']}: R${c['falta']:.0f}" for c in pagar_semana) if pagar_semana else "  Nenhuma"}

PODE NEGOCIAR PRAZO:
{chr(10).join(f"  • {c['nome']}: R${c['falta']:.0f}" for c in negociar) if negociar else "  Nenhuma"}

---
ESCREVA EXATAMENTE 3 MENSAGENS SEPARADAS POR |||

MENSAGEM 1 — A situação real (máx 3 linhas):
Fale o que ele TEM agora (caixa), o que PODE entrar (projeção), e o total de contas.
IMPORTANTE: deixe claro que a projeção é SE ele trabalhar normal — não é certeza.
Ex: "Você tem R$X no bolso. Se trabalhar normal esses Y dias, pode entrar mais R$Z. Suas contas somam R$W."

MENSAGEM 2 — O que pagar primeiro (máx 4 linhas):
Liste SÓ as urgentes com prazo. Se não fecha, diga isso e quanto falta.
Uma conta por linha, simples: "• [nome]: R$X — vence em Yd"

MENSAGEM 3 — A pergunta do plano (1 linha só):
Se não fecha: pergunte se consegue fazer mais em algum dia específico. Mencione o valor necessário (R${cap_esforco:.0f}/dia).
Se fecha: pergunte se quer ver a ordem de pagamento.

REGRAS ABSOLUTAS:
- Os 3 blocos separados por ||| exatamente
- Combustível = R${comb_diario:.0f}/dia — nunca invente outro valor
- Sem markdown (sem **, sem #)
- Sem "E aí meu amigo" ou rodeios — vai direto
- Linguagem simples, como WhatsApp mesmo"""

    GEMINI_KEY = os.getenv("GEMINI_API_KEY", "")
    print(f"DEBUG plano v5: mid={motorista_id} max_manual={capacidade_max_manual:.0f} caixa={caixa_atual:.0f} tem_historico={tem_historico} cap_padrao={cap_padrao:.0f} dias_rest={dias_restantes} total_liq_possivel={total_liquido_possivel:.0f} poder={poder_total:.0f} urgente={total_urgente:.0f} semana={total_semana:.0f} negociar={total_negociar:.0f} media_dow={media_dow}")
    print(f"DEBUG plano v5: request_dados={dados}")

    import asyncio as _asyncio
    _ERROS_SOBRECARGA = ["high demand","overloaded","quota","RESOURCE_EXHAUSTED","503","502","529","UNAVAILABLE"]
    _seq_modelos = ["gemini-2.5-flash", "gemini-2.5-flash", "gemini-2.5-flash"]
    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"maxOutputTokens": 3000, "temperature": 0.1}
    }
    result = {}
    async with httpx.AsyncClient(timeout=60) as client:
        for tentativa in range(4):
            modelo_atual = _seq_modelos[min(tentativa // 2, 2)]
            try:
                resp = await client.post(
                    f"https://generativelanguage.googleapis.com/v1beta/models/{modelo_atual}:generateContent?key={GEMINI_KEY}",
                    json=payload
                )
                result = resp.json()
                if "error" not in result:
                    break
                err_msg = result["error"].get("message", "")
                if any(x in err_msg for x in _ERROS_SOBRECARGA):
                    wait = min(5 * (2 ** tentativa), 45)
                    await _asyncio.sleep(wait)
                else:
                    break
            except Exception as e:
                await _asyncio.sleep(min(5 * (2 ** tentativa), 30))

    if "error" in result:
        err_msg = result["error"].get("message", "")
        print(f"GEMINI ERROR: {err_msg}")
        if any(x in err_msg for x in _ERROS_SOBRECARGA):
            return {"ok": False, "plano": "Muita demanda agora 😅 Aguarda 1 minuto e tenta de novo!"}
        return {"ok": False, "plano": f"Não consegui gerar o plano: {err_msg[:100]}"}

    parts = result.get("candidates", [{}])[0].get("content", {}).get("parts", [])
    texto = "".join(p.get("text", "") for p in parts if p.get("text"))
    if not texto:
        return {"ok": False, "plano": "Não consegui gerar o plano agora. Tente em instantes."}

    # Divide o texto em 3 mensagens pelo separador |||
    partes = [p.strip() for p in texto.split("|||") if p.strip()]
    # Se a IA não usou |||, divide por linha em branco como fallback
    if len(partes) == 1 and len(partes[0]) > 200:
        blocos = [b.strip() for b in texto.split("\n\n") if b.strip()]
        if len(blocos) >= 2:
            partes = blocos[:3]
    # Garante no máximo 3 partes
    partes = partes[:3]
    if not partes:
        partes = [texto]

    return {
        "ok": True,
        "plano": texto,
        "partes": partes,
        "alertas": alertas,  # lista de alertas de saúde financeira
        "contexto": {
            "caixa_atual": round(caixa_atual, 2),
            "total_pendente": round(total_falta, 2),
            "total_urgente": round(total_urgente, 2),
            "comb_diario": round(comb_diario, 2),
            "taxa_comb_pct": round(taxa_comb * 100, 1),
            "comb_projetado": round(comb_projetado_contas, 2),
            "comb_ja_gasto": round(comb_ja_gasto, 2),
            "comb_restante": round(comb_restante_real, 2),
            "economia_comb": round(economia_comb, 2),
            "meta_hoje": round(meta_hoje_bruto, 2),
            "dias_restantes": dias_restantes,
            "fonte_capacidade": fonte
        }
    }
@app.post("/chat-setup")
async def chat_setup(dados: dict = Body(...), uid: str = Depends(get_uid_from_token)):
    # Força motorista_id = uid do token
    dados["motorista_id"] = uid
    dados["mid"] = uid
    """Chat do onboarding guiado — Gestor coleta dados do novo usuário."""
    import httpx, json as _json
    uid = dados.get("id") or dados.get("motorista_id")
    mensagem = str(dados.get("mensagem", ""))[:1000]  # limite 1000 chars
    historico = dados.get("historico", [])
    # Pré-normaliza valores monetários com vírgula: "156,28" não vire "156" e "28"
    # Substitui padrões como "R$156,28" ou "156,28" por "R$156.28" antes de mandar ao Gemini
    import re as _re_pre
    def _norm_valor(m):
        # só normaliza se parece número monetário (dígitos,dígitos onde parte após vírgula tem 1-2 dígitos)
        full = m.group(0)
        parts = full.replace("R$","").replace(" ","").split(",")
        if len(parts)==2 and parts[1].isdigit() and len(parts[1])<=2:
            return full.replace(",",".")
        return full
    mensagem = _re_pre.sub(r'R?\$?\s*\d+,\d{1,2}', _norm_valor, mensagem)
    nome = dados.get("nome", "motorista")

    GEMINI_KEY = os.getenv("GEMINI_API_KEY", "")

    contexto_setup = f"""Você é o GESTOR FINANCEIRO do Painel.IA, um app para motoristas de aplicativo.
O motorista {nome} acabou de criar a conta e você precisa configurar o perfil dele numa conversa amigável.

=== SUA MISSÃO NESSA CONVERSA ===
Coletar 4 informações, uma de cada vez, de forma natural:
1. Plataformas que trabalha (Uber, 99, InDrive, outras)
2. Meta de ganho diário (quanto quer ganhar por dia)
3. Gasto diário com combustível (ou "não sei" → você estima depois)
4. Contas fixas que tem (aluguel do carro, financiamento, etc.) — SE informar uma conta sem data de vencimento, PEÇA a data antes de confirmar

=== ESTILO ===
- Fale como um amigo, linguagem simples, frases curtas
- Um passo de cada vez — nunca faça duas perguntas na mesma mensagem
- Use emojis para deixar mais leve
- Quando o usuário não souber, dê exemplos concretos: "tipo, você gasta uns R$50 de gasolina por dia ou mais?"
- NUNCA use termos técnicos financeiros complexos

=== PRIMEIRA MENSAGEM (se histórico vazio) ===
"Oi, {nome}! 👋 Eu sou seu Gestor Financeiro. Fico dentro do app pra te ajudar a controlar o dinheiro e não deixar conta virar bola de neve.

Antes de começar, me conta: você trabalha na Uber, 99, InDrive... qual?"

=== REGRAS CRÍTICAS ===
- Se o usuário informar uma conta sem dizer quando vence, RESPONDA PEDINDO A DATA antes de qualquer outra coisa
  Exemplo: "Que bom que falou! Quando vence esse financiamento? (pode falar o dia do mês)"
- Quando tiver coletado plataformas + meta diária + combustível (mesmo estimado), marque como completo
- Contas são opcionais — se o usuário falar "não tenho" ou "por enquanto não", aceite e marque completo
- Ao final, SEMPRE responda com JSON contendo o campo "setup_dados" com o que coletou + "resposta" para o usuário + "setup_completo": true/false

=== FORMATO DE RESPOSTA — SEMPRE JSON ===
{{
  "resposta": "mensagem para o motorista",
  "setup_completo": false,
  "setup_dados": {{
    "plataformas": ["uber", "99"],
    "meta_diaria": 300,
    "comb_diario": 80,
    "contas": [
      {{"descricao": "financiamento do carro", "valor": 800, "vencimento": "2025-06-10"}}
    ]
  }}
}}

Quando setup_completo for true, a última "resposta" deve ser comemorativa e motivadora, explicando que o app está pronto para usar."""

    msgs = [
        {"role": "user", "parts": [{"text": contexto_setup}]},
        {"role": "model", "parts": [{"text": "Entendido. Vou conduzir o setup de forma amigável, um passo por vez, e retornar sempre em JSON."}]}
    ]
    for h in (historico or []):
        role = "model" if h["role"] == "assistant" else h["role"]
        msgs.append({"role": role, "parts": [{"text": h["content"]}]})
    msgs.append({"role": "user", "parts": [{"text": mensagem if mensagem else "oi"}]})

    result = {}
    async with httpx.AsyncClient(timeout=25) as client:
        for tentativa in range(3):
            try:
                resp = await client.post(
                    f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_KEY}",
                    json={"contents": msgs, "generationConfig": {"responseMimeType": "application/json"}}
                )
                result = resp.json()
                if "error" not in result:
                    break
                await __import__("asyncio").sleep((tentativa+1)*4)
            except:
                await __import__("asyncio").sleep(4)

    texto = result.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
    if not texto:
        return {"resposta": "Ops, tive um problema técnico. Tenta de novo!", "setup_completo": False}

    try:
        parsed = _json.loads(texto.strip())
        resposta = parsed.get("resposta", "")
        setup_completo = parsed.get("setup_completo", False)
        setup_dados = parsed.get("setup_dados", {})

        # Se setup completo, salva dados no banco
        if setup_completo and uid:
            update = {"setup_completo": True}
            if setup_dados.get("meta_diaria"): update["meta_diaria"] = float(setup_dados["meta_diaria"])
            if setup_dados.get("comb_diario"): update["comb_diario"] = float(setup_dados["comb_diario"])
            if setup_dados.get("plataformas"): update["plataformas"] = ",".join(setup_dados["plataformas"])
            try:
                supabase.table("motoristas").update(update).eq("id", uid).execute()
            except Exception as e:
                print(f"Erro ao salvar setup: {e}")

            # Registra contas coletadas
            contas_setup = setup_dados.get("contas", [])
            for conta in contas_setup:
                if conta.get("descricao") and conta.get("valor") and conta.get("vencimento"):
                    try:
                        supabase.table("contas").insert({
                            "motorista_id": uid,
                            "descricao": conta["descricao"],
                            "valor": float(conta["valor"]),
                            "vencimento": conta["vencimento"],
                            "pago": False
                        }).execute()
                    except: pass

        return {"resposta": resposta, "setup_completo": setup_completo, "setup_dados": setup_dados}
    except Exception as e:
        print(f"Erro parse setup: {e} | {repr(texto[:200])}")
        return {"resposta": "Não entendi bem. Me conta de novo?", "setup_completo": False}

@app.post("/chat")
async def chat(dados: dict = Body(...), uid: str = Depends(get_uid_from_token)):
    # uid vem do token JWT verificado — ignora qualquer motorista_id do body
    motorista_id = uid
    if not _check_rate(motorista_id):
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=429, content={"resposta": "Muitas mensagens. Aguarde um momento.", "acoes": []})
    # Limite de tamanho do histórico — evita payload gigante
    if dados.get("historico") and len(str(dados.get("historico", ""))) > 50000:
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=400, content={"resposta": "Payload muito grande.", "acoes": []})
    import httpx, json
    mensagem = str(dados.get("mensagem", ""))[:1000]  # limite 1000 chars

    # Proteção básica contra prompt injection
    _injection_patterns = [
        "ignore previous", "ignore as instruções", "esqueça tudo", "novo sistema",
        "system prompt", "você agora é", "aja como", "finja ser", "ignore all",
        "disregard", "forget everything", "jailbreak", "DAN mode"
    ]
    if any(p.lower() in mensagem.lower() for p in _injection_patterns):
        return {"resposta": "Não consigo processar essa mensagem.", "acoes": []}

    historico = dados.get("historico", [])
    semana_relatorio = dados.get("semana_relatorio")  # {ini, fim} ou None

    # Busca contexto completo do motorista
    import datetime
    contas = []
    lancamentos_mes = []
    hoje = hoje_brasil()
    inicio_mes = hoje.replace(day=1).isoformat()
    hoje_str = hoje.isoformat()
    import datetime as _dt2
    ontem_str = (hoje - _dt2.timedelta(days=1)).isoformat()
    amanha_str = (hoje + _dt2.timedelta(days=1)).isoformat()
    # Sábado passado
    dias_ate_sabado = (hoje.weekday() - 5) % 7  # 5 = sábado
    sabado_str = (hoje - _dt2.timedelta(days=dias_ate_sabado if dias_ate_sabado > 0 else 7)).isoformat()
    # Próximo sábado e sábado que vem (para edição de contas)
    dias_para_prox_sabado = (5 - hoje.weekday()) % 7 or 7  # 5 = sábado
    proximo_sabado_str = (hoje + _dt2.timedelta(days=dias_para_prox_sabado)).isoformat()
    sabado_que_vem_str = (hoje + _dt2.timedelta(days=dias_para_prox_sabado + 7)).isoformat()
    # Datas "daqui X dias" pré-calculadas
    daqui2_str = (hoje + _dt2.timedelta(days=2)).isoformat()
    daqui3_str = (hoje + _dt2.timedelta(days=3)).isoformat()
    daqui7_str = (hoje + _dt2.timedelta(days=7)).isoformat()
    try:
        c = supabase.table("contas").select("*").eq("motorista_id", motorista_id).execute()
        contas = c.data or []
    except: pass
    try:
        lr = supabase.table("lancamentos").select("id,tipo,valor,descricao,plataforma,data,horas_rodadas,km_rodados,created_at").eq("motorista_id", motorista_id).gte("data", inicio_mes).order("data", desc=True).execute()
        lancamentos_mes = lr.data or []
        print(f"DEBUG chat context: motorista_id={motorista_id} inicio_mes={inicio_mes} lancamentos={len(lancamentos_mes)}")
    except Exception as e:
        print(f"ERRO ao buscar lancamentos no chat: {e}")

    # Calcula totais para a IA responder perguntas diretamente
    ganhos_hoje = sum(float(l["valor"]) for l in lancamentos_mes if l["tipo"] == "ganho" and l["data"] == hoje_str)
    despesas_hoje = sum(float(l["valor"]) for l in lancamentos_mes if l["tipo"] == "despesa" and l["data"] == hoje_str)
    ganhos_mes = sum(float(l["valor"]) for l in lancamentos_mes if l["tipo"] == "ganho")
    despesas_mes = sum(float(l["valor"]) for l in lancamentos_mes if l["tipo"] == "despesa")
    lucro_mes = ganhos_mes - despesas_mes
    # Horas do mês via tabela turnos
    try:
        tr_mes = supabase.table("turnos").select("horas,data").eq("motorista_id", motorista_id).gte("data", inicio_mes).execute()
        horas_mes = sum(float(t.get("horas") or 0) for t in (tr_mes.data or []))
        turnos_mes = tr_mes.data or []
    except:
        horas_mes = 0
        turnos_mes = []
    km_mes = sum(float(l.get("km_rodados") or 0) for l in lancamentos_mes)
    contas_pendentes = [c for c in contas if not c.get("pago")]
    total_pendente = sum(float(c["valor"]) for c in contas_pendentes)

    # Calcula déficit real para o gestor poder ser proativo
    import datetime as _dt
    try:
        perf_chat = supabase.table("motoristas").select("meta_diaria,comb_diario").eq("id", motorista_id).execute()
        meta_dia_config = float((perf_chat.data or [{}])[0].get("meta_diaria") or 300)
        comb_dia_chat = float((perf_chat.data or [{}])[0].get("comb_diario") or 0)
    except:
        meta_dia_config = 300
        comb_dia_chat = 0
    # Usa média real do histórico quando disponível (mais preciso que a meta configurada)
    ganhos_dias_trabalhados = [l for l in lancamentos_mes if l["tipo"] == "ganho"]
    dias_com_ganho = len(set(l["data"] for l in ganhos_dias_trabalhados))
    if dias_com_ganho >= 3:
        media_bruta_real = ganhos_mes / dias_com_ganho
        # Limita a variação: no máximo 2x a meta configurada para evitar distorções por dias atípicos
        meta_dia_chat = min(media_bruta_real, meta_dia_config * 2)
    else:
        meta_dia_chat = meta_dia_config
    # Combustível: configurado > histórico > cap de 40%
    if comb_dia_chat <= 0:
        comb_total = sum(float(l["valor"]) for l in lancamentos_mes if l["tipo"] == "despesa" and "combustivel" in (l.get("descricao") or "").lower())
        dias_mes_ate_hoje = max(1, hoje.day)
        comb_diario_hist = round(comb_total / dias_mes_ate_hoje, 0) if comb_total > 10 else 0
        comb_pct_hist = comb_diario_hist / meta_dia_chat if meta_dia_chat > 0 else 0
        comb_dia_chat = round(comb_diario_hist if comb_pct_hist <= 0.40 else meta_dia_chat * 0.30, 0)
    liq_dia_chat = max(0, meta_dia_chat - comb_dia_chat)
    taxa_comb_pct = round((comb_dia_chat / meta_dia_chat * 100), 1) if meta_dia_chat > 0 else 25.0

    # Calcula janela de dias relevante:
    # Usa o vencimento mais próximo das contas pendentes como horizonte (máx 10 dias)
    # Isso evita que no último dia do mês o sistema projete só 1 dia
    import calendar as _cal
    fim_mes_chat = hoje.replace(day=_cal.monthrange(hoje.year, hoje.month)[1])
    
    # Busca vencimento mais próximo entre as contas pendentes
    contas_pend_chat = [c for c in contas if not c.get("pago") and not any(k in (c.get("descricao","") or "").lower() for k in ["combustivel","gasolina","etanol"])]
    vencimentos_pend = []
    for c in contas_pend_chat:
        try:
            import datetime as _dt3
            v = _dt3.date.fromisoformat(c["vencimento"])
            if v >= hoje:
                vencimentos_pend.append((v - hoje).days)
        except:
            pass
    
    # Horizonte: próximo vencimento ou 7 dias (o que for maior), máx 10 dias
    proximo_venc_dias = min(vencimentos_pend) if vencimentos_pend else 7
    horizonte_dias = max(7, min(proximo_venc_dias + 2, 10))
    
    # Para o cálculo do déficit, usa os dias restantes do mês OU horizonte (o maior)
    dias_rest_chat = max(horizonte_dias, (fim_mes_chat - hoje).days + 1)
    projecao_liq_chat = liq_dia_chat * dias_rest_chat
    poder_chat = lucro_mes + projecao_liq_chat  # caixa atual + projeção
    deficit_chat = max(0, total_pendente - poder_chat)
    # Cenário de esforço: quanto precisaria por dia para fechar
    if deficit_chat > 0 and dias_rest_chat > 0:
        liq_extra_necessario = deficit_chat / dias_rest_chat
        cap_esforco_chat = round((liq_dia_chat + liq_extra_necessario + comb_dia_chat + 49) / 50) * 50
        cap_esforco_chat = min(cap_esforco_chat, meta_dia_chat * 2)  # máx 2x a meta normal
    else:
        cap_esforco_chat = 0

    print(f"DEBUG totais: ganhos_hoje={ganhos_hoje} ganhos_mes={ganhos_mes} despesas_mes={despesas_mes}")
    # Monta resumo dos lançamentos de hoje para detecção de duplicatas
    import json as _json
    lancamentos_hoje_lista = [l for l in lancamentos_mes if l.get("data") == hoje_str]
    ganhos_hoje_detalhe = [(l.get("plataforma","?"), float(l.get("valor",0)), l.get("created_at","")) for l in lancamentos_hoje_lista if l["tipo"] == "ganho"]
    despesas_hoje_detalhe = [(l.get("descricao","?"), float(l.get("valor",0)), l.get("created_at","")) for l in lancamentos_hoje_lista if l["tipo"] == "despesa"]

    # Lançamentos de ontem (para detecção de duplicata e referências)
    ontem_str_ctx = ontem_str
    lanc_ontem = [l for l in lancamentos_mes if l.get("data","") == ontem_str_ctx]
    ganhos_ontem_detalhe = [(l.get("plataforma","?"), float(l.get("valor",0))) for l in lanc_ontem if l["tipo"] == "ganho"]

    # Pré-computa JSON de contas para evitar bug de f-string com dict
    contas_json = _json.dumps(
        [{"descricao": c.get("descricao"), "valor": c.get("valor"), "vencimento": c.get("vencimento"), "pago": c.get("pago"), "valor_pago": c.get("valor_pago")} for c in contas],
        ensure_ascii=False, default=str
    )

    # Renda extra da semana — precisa ser calculado ANTES do f-string que usa {renda_extra_ctx}
    import datetime as _dt_re
    semana_inicio_re = (hoje - _dt_re.timedelta(days=7)).isoformat()
    RENDA_EXTRA_PLATS = ['renda_extra','gorjeta','freelance','bico','bonus','seguro_desemprego','venda','aluguel_recebido']
    renda_extra_semana = [
        {"data": l["data"], "plataforma": l.get("plataforma",""), "valor": float(l["valor"])}
        for l in lancamentos_mes
        if l["tipo"] == "ganho"
        and l.get("data","") >= semana_inicio_re
        and (l.get("plataforma","") or "").lower().replace(" ","_") in RENDA_EXTRA_PLATS
    ]
    renda_extra_semana_total = sum(r["valor"] for r in renda_extra_semana)
    if renda_extra_semana:
        itens_re = ", ".join(f"R${r['valor']:.0f} ({r['plataforma']}) em {r['data']}" for r in renda_extra_semana)
        renda_extra_ctx = f"\nRENDA EXTRA ESSA SEMANA: {itens_re} — total R${renda_extra_semana_total:.2f}"
    else:
        renda_extra_ctx = "\nRENDA EXTRA ESSA SEMANA: nenhuma registrada."

    # Monta aviso de contexto semanal se necessário
    _semana_ctx_str = ""
    if semana_relatorio and semana_relatorio.get("ini") and semana_relatorio.get("fim"):
        _sem_ini = semana_relatorio["ini"]
        _sem_fim = semana_relatorio["fim"]
        _semana_ctx_str = f"\n\n⚠️ CONTEXTO ESPECIAL: Esta conversa é sobre o RELATÓRIO DA SEMANA {_sem_ini} a {_sem_fim}. Ao responder perguntas sobre ganhos, despesas, dias trabalhados ou qualquer dado dessa semana, use SOMENTE os lançamentos desse intervalo de datas — não da semana atual (que começa em {hoje_str})."

    contexto = f"""Você é o GESTOR FINANCEIRO do motorista no Painel.IA. Hoje: {hoje_str}.{_semana_ctx_str}

REGRA CRÍTICA — JSON SEMPRE OBRIGATÓRIO:
Você DEVE responder SEMPRE com JSON no formato {{"acoes":[...],"resposta":"..."}}.
Se o motorista pedir para mudar, editar, registrar ou apagar qualquer coisa — coloque a ação em "acoes". NUNCA responda só com texto sem incluir a ação correspondente. Se não tiver ação, use "acoes":[].
Confirmar sem incluir a ação no JSON = ERRO GRAVE. Ex errado: {{"acoes":[],"resposta":"Certo! Mudei o tênis para..."}} — isso não executa nada.

ESTILO — REGRAS RÍGIDAS:
- Máximo 2 frases por resposta. Se precisar de mais, mande em 2 mensagens separadas.
- Confirmação de registro: 1 linha só. Ex: "Anotei! R$350 na Uber hoje. ✅"
- Pergunta de plataforma: "Foi Uber, 99 ou inDrive?" — nada mais.
- Análise financeira: 2 frases + 1 pergunta. Sem listas, sem bullets.
- Nunca liste contas numa resposta de confirmação.
- Zero markdown (sem **, sem #). Emojis só no início ou fim da frase.

=== SITUAÇÃO FINANCEIRA ===
DATAS DE REFERÊNCIA (use para calcular vencimentos):
Hoje: {hoje_str} | Amanhã: {amanha_str} | Daqui 2 dias: {daqui2_str} | Daqui 3 dias: {daqui3_str} | Daqui 7 dias: {daqui7_str}
Próximo sábado: {proximo_sabado_str} | Sábado que vem (seguinte): {sabado_que_vem_str}

HOJE: Ganhos R${ganhos_hoje:.0f} | Despesas R${despesas_hoje:.0f} | Líquido R${(ganhos_hoje-despesas_hoje):.0f}
Lançamentos hoje: {_json.dumps(ganhos_hoje_detalhe + despesas_hoje_detalhe, ensure_ascii=False)}
Lançamentos ontem ({ontem_str_ctx}): {_json.dumps(ganhos_ontem_detalhe, ensure_ascii=False)}

MÊS (desde {inicio_mes}):
Ganhos R${ganhos_mes:.0f} | Despesas R${despesas_mes:.0f} | Lucro R${lucro_mes:.0f}
Horas: {horas_mes:.1f}h | Média/hora: R${(ganhos_mes/horas_mes if horas_mes>0 else 0):.0f}

TODOS OS GANHOS DO MÊS (para consulta e ajuste):
{chr(10).join(f"  {l['data']} | {l.get('plataforma','?')} | R${float(l['valor']):.2f} | id:{l.get('id','?')}" for l in sorted([l for l in lancamentos_mes if l['tipo']=='ganho'], key=lambda x: x['data'], reverse=True)[:30]) or "  Nenhum ganho registrado ainda."}

TOTAIS POR PLATAFORMA:
{chr(10).join(f"  {plat}: R${val:.2f}" for plat, val in sorted(((p, sum(float(l['valor']) for l in lancamentos_mes if l['tipo']=='ganho' and l.get('plataforma','')==p)) for p in set(l.get('plataforma','?') for l in lancamentos_mes if l['tipo']=='ganho')), key=lambda x: -x[1])) or "  Nenhuma plataforma ainda."}

PERFIL: Média diária real R${meta_dia_chat:.0f} líq | Combustível R${comb_dia_chat:.0f}/dia ({taxa_comb_pct:.0f}%) | Dias restantes: {dias_rest_chat}
CONTAS PENDENTES ({len(contas_pendentes)}): R${total_pendente:.0f} total
DÉFICIT: poder total R${poder_chat:.0f} vs contas R${total_pendente:.0f} → falta R${deficit_chat:.0f}
{f"Para fechar: precisa de R${cap_esforco_chat:.0f}/dia (hoje faz R${meta_dia_chat:.0f})." if cap_esforco_chat > meta_dia_chat else "Situação controlada."}

CONTAS:
{contas_json}

=== REGRAS CRÍTICAS ===
1. DADOS INCOMPLETOS: conta sem vencimento → PERGUNTE antes de registrar. Renda futura sem data → PERGUNTE a data.
2. DUPLICATA E REFERÊNCIAS — CRÍTICO:
- "E os 400?", "e aquele de 400?", "e ontem?", "e o outro?" → são REFERÊNCIAS a registros anteriores, NÃO novos ganhos. Responda confirmando o que já foi registrado, não registre de novo.
- Duplicata real: mesmo valor + mesma plataforma registrado nos ÚLTIMOS 30min no histórico → pergunte: "Já anotei R$X na [plataforma] às HH:MM. É outro ganho ou é o mesmo?"
- Mesmo valor em dia diferente → registre direto, sem perguntar.
- "Fiz 400 de novo" ou "mais 400" → aí SIM é novo registro, confirme e registre.
- Nunca pergunte 2x sobre o mesmo valor na mesma conversa.
3. RENDA EXTRA (seguro-desemprego, freela, bico, venda, bônus): registre como ganho plataforma="renda_extra". O plano financeiro inclui automaticamente.
3b. GASTO SEM IDENTIFICAÇÃO: "não sei onde foi", "custo desconhecido", "sumiram X reais", "não lembro" → registre como despesa descricao="desconhecido". Se o motorista EXPLICITAMENTE pedir "coloque em outros" ou "categoria outros" → use categoria="outros", obedeça o pedido. "é outra despesa", "exclui aquela, registra essa" → registre direto sem perguntar mais nada.
3c. AUTO-ABATE DE CONTAS: quando registrar despesa de mercado, combustível, aluguel, etc. — o sistema já abate automaticamente a conta pendente correspondente. Você NÃO precisa gerar ação abater_conta separada. Apenas confirme o registro normalmente.
4. PLATAFORMA: se sua última msg perguntou plataforma → próxima resposta É a plataforma. "99"=99, "uber"=uber. Registra direto, não pergunta de novo.
5. VALORES ALTOS (ganho>R$700 ou despesa>R$350): confirme levemente antes de registrar.
6. SIM/NÃO: "sim/pode/isso/confirma" → registre o pendente do histórico. "não/cancela" → pergunte o certo.
7. CRUZAMENTO: ganho muito acima da média (>2x) → registre e comente. Valor baixo declarado explicitamente → registre direto.
8. VÍRGULA = CENTAVOS — CRÍTICO:
   No Brasil, vírgula é separador decimal. "156,28" = CENTO E CINQUENTA E SEIS REAIS E VINTE E OITO CENTAVOS = 156.28 — UM único valor, NUNCA dois valores separados.
   - "fiz 156,28 na 99" → 1 ação com valor=156.28. JAMAIS crie duas ações com 156 e 28.
   - "fiz 300,50 e paguei 45,90" → 2 ações: valor=300.50 e valor=45.90
   - O separador de MÚLTIPLOS valores é "e", "mais", "também" — nunca a vírgula dentro de um número.

9. MÚLTIPLOS REGISTROS NUMA MENSAGEM — CRÍTICO:
   Se o motorista informa vários ganhos/despesas de uma vez (ex: "hoje fiz 336, ontem 400, sábado 500" ou "fiz 300 na uber e paguei 80 de combustível"), REGISTRE TODOS de uma vez com múltiplas ações no JSON.
   - "hoje fiz 336, ontem fiz 400" → duas ações registrar_lancamento com datas diferentes (hoje={hoje_str}, ontem={ontem_str})
   - "sábado 500" em contexto de relato = data do sábado passado ({sabado_str})
   - "fiz 300 na uber e paguei 80 de combustível" → 1 ganho + 1 despesa no mesmo JSON
   - NÃO processe só o primeiro valor e esqueça os outros. NÃO pergunte "qual plataforma foi cada um?" se não é crítico — assuma a plataforma padrão do motorista ou a mais recente.
   - "total na 99 hoje 326,17 e na uber 84,66" → 2 ações: ganho R$326,17 na 99 hoje + ganho R$84,66 na uber hoje. Registre AMBOS sem perguntar nada.
   - Confirmação para múltiplos: "Anotei! Ontem R$400 + hoje R$336 na 99, e sábado R$500. ✅" — tudo numa linha só.
10. EMPRÉSTIMOS — CRÍTICO:
   - "emprestei X da/do Y" ou "peguei X emprestado de Y" → significa que o motorista PEGOU dinheiro emprestado de alguém. Isso gera DUAS ações:
     1. registrar_lancamento tipo=ganho, plataforma="renda_extra", descricao="emprestimo_recebido", valor=X (o dinheiro entrou)
     2. registrar_conta descricao="Y" (quem emprestou), valor=X, vencimento=data acordada ou +30 dias (dívida a pagar)
   - "emprestei X para Y" → motorista DEU dinheiro, registrar apenas despesa categoria=emprestimo, valor=X
   - "paguei X do empréstimo da Y" → abater_conta descricao="Y", valor_pago=X
   - NUNCA juntar o empréstimo com outro pagamento num lançamento só
   Exemplo: "Emprestei 376 da mãe e paguei o semanal do carro 857 com juros" →
     - registrar_lancamento ganho renda_extra emprestimo_recebido R$376 hoje
     - registrar_conta "emprestimo da mae" R$376 vencimento +30 dias
     - registrar_lancamento despesa "emprestimo" R$857 hoje (pagamento do semanal com juros)
     NÃO criar conta "semanal do carro" nova se já existe — use abater_conta ou marcar_pago

11. EDIÇÃO DE CONTAS — CRÍTICO:
   - "coloque o vencimento do tênis para amanhã" → editar_conta com campo="vencimento" e novo_valor=amanha_str
   - "muda o valor do mercado para 150" → editar_conta com campo="valor" e novo_valor=150 (atualiza todas as parcelas pendentes)
   - "mercado semanal vou gastar menos, coloca 120" → editar_conta com campo="valor", descricao="mercado semanal", novo_valor=120
   - "divida a Elaine em parcelas de 160/dia" ou "quero pagar 160 por dia para Elaine" → significa que o motorista quer ABATER R$160 hoje: use abater_conta com descricao="Elaine", valor_pago=160. Responda: "Certo! Vou registrar R$160 abatidos da Elaine hoje. Me avisa quando pagar mais."
   - "divida X em N dias" → calcule valor/N e use abater_conta com o valor de hoje. Não crie múltiplas contas.
   - NUNCA pergunte mais detalhes quando o motorista diz "vencimento para amanhã/dia X" ou "parcelas de R$X" — execute direto.
   - RESOLUÇÃO DE "daqui X dias" — CRÍTICO: quando o motorista diz "o que vence daqui 2 dias" ou "o que vence daqui 3 dias", calcule a data exata (hoje={hoje_str}) e cruze com as CONTAS listadas acima para identificar qual conta vence nessa data. Então execute editar_conta direto, sem perguntar nada.
   - MÚLTIPLAS CONTAS DE MESMO NOME (ex: dois "tênis"): use o campo vencimento_alvo para identificar qual parcela específica alterar. Ex: "mude o tênis que vence daqui 2 dias para sábado" → editar_conta descricao="tênis" campo="vencimento" vencimento_alvo="{daqui2_str}" novo_valor="{proximo_sabado_str}".
   - IDENTIFICAÇÃO POR VALOR (ex: "o tênis de 500"): use o campo valor_filtro=500 para identificar qual parcela alterar pelo valor. Nunca use vencimento_alvo e valor_filtro juntos — escolha o mais específico. Ex: "mude o tênis de 500 para sábado" → editar_conta descricao="tênis" campo="vencimento" valor_filtro=500 novo_valor="{proximo_sabado_str}".
   - MÚLTIPLAS EDIÇÕES numa mensagem: execute TODAS como ações separadas no mesmo JSON. "mude X para sábado e Y para sábado que vem" → duas ações editar_conta.
9. AJUSTE DE TOTAL POR PLATAFORMA — CRÍTICO:
   Quando o motorista informa um valor de faturamento por plataforma (ex: "fiz 277 na 99 ontem", "hoje na uber foram 350"), SEMPRE verifique se já existe lançamento dessa plataforma naquele dia:
   - SE JÁ EXISTE lançamento da plataforma no dia mencionado (hoje ou ontem): use substituir:true para SUBSTITUIR o valor antigo, não criar novo. NÃO some os valores.
   - SE NÃO EXISTE lançamento naquele dia: registre como novo.
   - "fiz 277 na 99 ontem" + já existe ganho da 99 ontem → substituir:true com data=ontem. NÃO crie um segundo lançamento.
   - "fiz 277 na 99 ontem" + não existe ganho da 99 ontem → registre direto.
   - "total na 99 hoje 326,17 e na uber 84,66": atualize AMBOS nas respectivas plataformas.
   - Ajuste de total de MÊS (não de dia específico): use editar_lancamento_por_id com o id correto.
   - Se pedir para cancelar/desfazer um registro que acabou de fazer: use deletar_lancamento_por_id com o id mais recente da plataforma
   - Se pedir para cancelar/desfazer uma DISTRIBUIÇÃO (histórico tem [últimos_ids_distribuicao: [...]]):  use deletar_lancamentos_por_ids com todos os IDs listados
   REGRA DE OURO: motorista de app raramente faz dois faturamentos separados na mesma plataforma no mesmo dia. Se já existe um valor, ele está ATUALIZANDO, não adicionando. Duvide sempre de duplicata no mesmo dia/plataforma.

=== AÇÕES (responda SEMPRE em JSON puro) ===
Formato: {{"acoes":[...],"resposta":"texto para o usuário"}}
- Ganho app: {{"acao":"registrar_lancamento","tipo":"ganho","valor":N,"plataforma":"uber","data":"YYYY-MM-DD"}}
- Ganho substituindo total do dia: {{"acao":"registrar_lancamento","tipo":"ganho","valor":N,"plataforma":"uber","data":"YYYY-MM-DD","substituir":true}} — use quando motorista diz "total na X foi Y" ou "atualize para Y" (deleta lançamentos anteriores da plataforma nesse dia antes de inserir)
- Renda extra: {{"acao":"registrar_lancamento","tipo":"ganho","valor":N,"plataforma":"renda_extra","descricao":"seguro-desemprego","data":"YYYY-MM-DD"}}
- Despesa: {{"acao":"registrar_lancamento","tipo":"despesa","valor":N,"descricao":"categoria","data":"YYYY-MM-DD"}}
- Conta futura: {{"acao":"registrar_conta","descricao":"nome","valor":N,"vencimento":"YYYY-MM-DD"}}
- Pagar conta: {{"acao":"marcar_pago","descricao":"nome"}}
- Abater parcial: {{"acao":"abater_conta","descricao":"nome","valor_pago":N}}
- Editar conta (vencimento): {{"acao":"editar_conta","descricao":"nome","campo":"vencimento","novo_valor":"YYYY-MM-DD"}}
- Editar vencimento de parcela específica por valor: {{"acao":"editar_conta","descricao":"nome","campo":"vencimento","novo_valor":"YYYY-MM-DD","valor_filtro":N}} — usa quando motorista diz "o tênis de 500"
- Editar vencimento de parcela específica por data: {{"acao":"editar_conta","descricao":"nome","campo":"vencimento","novo_valor":"YYYY-MM-DD","vencimento_alvo":"YYYY-MM-DD"}} — usa quando motorista diz "o que vence daqui X dias"
- Editar valor de conta: {{"acao":"editar_conta","descricao":"nome","campo":"valor","novo_valor":N}} — atualiza TODAS as parcelas pendentes com esse nome
- Editar valor de parcela específica: {{"acao":"editar_conta","descricao":"nome","campo":"valor","novo_valor":N,"vencimento_alvo":"YYYY-MM-DD"}} — usa quando motorista menciona "a que vence dia X" ou "a parcela do dia X"
- Apagar conta: {{"acao":"deletar_conta","descricao":"nome"}}
- Desfazer último: {{"acao":"deletar_ultimo_lancamento","tipo":"ganho"}} — se mencionar plataforma específica, inclua {{"plataforma":"99"}} para apagar só aquela; sem plataforma = apaga o mais recente independente de plataforma
- Corrigir valor: {{"acao":"editar_ultimo_lancamento","tipo":"despesa","campo":"valor","novo_valor":N}}
- Deletar por ID específico: {{"acao":"deletar_lancamento_por_id","id":"uuid-do-lancamento"}} — use quando o motorista pedir para remover lançamento específico
- Cancelar distribuição (vários IDs): {{"acao":"deletar_lancamentos_por_ids","ids":["id1","id2","id3"]}} — use quando o motorista pedir para cancelar/desfazer uma distribuição de período que está nos últimos_ids_distribuicao do contexto
- Editar valor por ID: {{"acao":"editar_lancamento_por_id","id":"uuid-do-lancamento","valor":N}} — use para corrigir valor de lançamento específico pelo ID que aparece no histórico
- Turno: {{"acao":"registrar_turno","inicio":"HH:MM","fim":"HH:MM"}}
- Salvar perfil: {{"acao":"salvar_perfil","plataformas":["uber","99"],"cap_diaria":N,"setup_completo":true}}
- Compromissos: {{"acao":"salvar_compromissos","compromissos":[{{"data":"YYYY-MM-DD","meta_bruta":N,"nota":"sexta"}}]}}
- Zerar despesas: {{"acao":"zerar_despesas_hoje"}}

Categorias de despesa (use a chave exata — prefira sempre a específica antes de "outros"):
combustivel(gasolina/etanol/posto) | pedagio(pedágio/estacionamento/zona azul) | manutencao(pneu/óleo/mecânico/conserto/peça/revisão/freio/bateria) | lavagem(lava-jato/polimento) | acessorio_carro(suporte celular/carregador/tapete/câmera) | aluguel_carro | financiamento(parcela/prestação do carro) | seguro(seguro auto) | ipva(detran/licença/vistoria) | multa(multa trânsito/radar/infração) | multa_app(punição/desconto da plataforma/taxa uber/taxa 99) | mercado(supermercado/feira/rancho/compras de casa) | restaurante(almoço/janta/ifood/delivery/hamburguer/pizza) | lanche(café/cafezinho/lanchinho/suco/biscoito/coxinha) | farmacia(remédio/medicamento) | saude(médico/dentista/plano/academia/hospital/exame/psicólogo) | higiene(shampoo/sabonete/desodorante/higiene pessoal) | aluguel_casa | condominio | luz_agua(luz/água/gás/enel/copel/cemig) | presente_familia(presente/filho/esposa/mãe/pai/família) | roupa(calçado/tênis/camisa) | celular(plano/chip/tim/vivo/claro) | internet(wi-fi/fibra/net) | streaming(netflix/spotify/amazon/disney) | emprestimo(dívida/parcela pessoal/consignado) | investimento(poupança/previdência) | lazer(bar/cinema/festa/viagem/show) | educacao(escola/curso/faculdade/inglês) | outros | desconhecido(não sei/não lembro)
GORJETA: registrar como ganho plataforma="gorjeta". Exemplos rápidos: "café"→lanche | "academia"→saude | "estacionei"→pedagio | "multa da 99"→multa_app | "presente filha"→presente_familia

=== PLANO FINANCEIRO ===
DETECÇÃO DE COMPROMISSOS — CRÍTICO:
Se a mensagem contém dias/períodos COM valores numéricos, isso É um plano de trabalho. NUNCA peça mais detalhes. Responda calculando imediatamente.

Padrões que DEVEM ser reconhecidos como compromissos:
- "500 hoje 600 amanhã 600 sábado e 200 domingo" → hoje={hoje_str}, amanhã={amanha_str}, sábado e domingo = datas reais da semana
- "quinta 500 sexta 600 sabado 600 domingo 200" → datas da semana atual
- "hoje faço 500, amanhã 600" → datas reais
- "posso fazer 600 sexta e sábado" → sexta e sábado dessa semana
- Qualquer combinação de dia + valor numérico

QUANDO RECEBER COMPROMISSOS:
1. Mapeie cada dia para data real (hoje={hoje_str}, amanhã={amanha_str})
2. Calcule líquido: valor × {(1-taxa_comb_pct/100):.2f} (descontando {taxa_comb_pct:.0f}% de combustível)
3. Some os líquidos + caixa atual R${poder_chat:.0f}
4. Compare com déficit R${deficit_chat:.0f}
5. Responda em 3 linhas: total que vai entrar, se cobre as urgentes, e o que ainda precisa negociar
6. Salve via salvar_compromissos com as datas reais

Quando analisa situação geral:
- Use os dados reais acima. Nunca invente números.
- "Pelo seu histórico, você faz R${meta_dia_chat:.0f}/dia líquido. Em {dias_rest_chat} dias = R${projecao_liq_chat:.0f} total. Contas = R${total_pendente:.0f}. Déficit = R${deficit_chat:.0f}."
- Para fechar precisaria de R${cap_esforco_chat:.0f}/dia. Pergunte em quais dias consegue fazer mais.
- Nunca jogue tudo de uma vez — 1 pergunta por mensagem, construa o plano em conversa.
{renda_extra_ctx}
"""

    # Separa prompt em system_instruction (estático, cacheável) + contexto dinâmico
    # A seção AÇÕES nunca muda → vai para system_instruction → Gemini 2.5 Flash
    # aplica implicit caching automático em prefixos >1024 tokens, reduzindo custo ~75%
    _ACOES_MARKER = "=== AÇÕES (responda SEMPRE em JSON puro) ==="
    _PLANO_MARKER = "=== PLANO FINANCEIRO ==="
    _acoes_start = contexto.find(_ACOES_MARKER)
    _plano_start = contexto.find(_PLANO_MARKER)
    if _acoes_start != -1 and _plano_start != -1:
        _system_static = contexto[_acoes_start:_plano_start].strip()
        _contexto_dinamico = contexto[:_acoes_start] + contexto[_plano_start:]
    else:
        _system_static = None
        _contexto_dinamico = contexto

    if _system_static:
        msgs = [{"role": "user", "parts": [{"text": _contexto_dinamico}]},
                {"role": "model", "parts": [{"text": "Entendido. Pronto para registrar."}]}]
        _gemini_payload_extra = {"system_instruction": {"parts": [{"text": _system_static}]}}
    else:
        msgs = [{"role": "user", "parts": [{"text": contexto}]},
                {"role": "model", "parts": [{"text": "Entendido. Estou pronto para registrar e responder de forma curta."}]}]
        _gemini_payload_extra = {}
    # Limita histórico a 8 mensagens para evitar MAX_TOKENS no Gemini
    hist_curto = (historico or [])[-8:]
    for h in hist_curto:
        role = "model" if h["role"] == "assistant" else h["role"]
        txt = str(h.get("content",""))[:600]  # trunca msgs muito longas
        msgs.append({"role": role, "parts": [{"text": txt}]})
    msgs.append({"role": "user", "parts": [{"text": mensagem}]})

    GEMINI_KEY = os.getenv("GEMINI_API_KEY", "")
    result = {}
    # Rodízio de modelos: cada um tem cota independente na API Gemini
    # 2.5-flash: 1000 RPM | 2.0-flash: 2000 RPM | 2.0-flash-lite: 4000 RPM
    # Total teórico: 7000 RPM compartilhados entre todos os usuários
    modelos = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-2.0-flash-lite"]
    async with httpx.AsyncClient(timeout=35) as client:
        for tentativa, modelo_atual in enumerate(modelos):
            try:
                resp = await client.post(
                    f"https://generativelanguage.googleapis.com/v1beta/models/{modelo_atual}:generateContent?key={GEMINI_KEY}",
                    json={**_gemini_payload_extra, "contents": msgs, "generationConfig": {
                        "responseMimeType": "application/json",
                        "maxOutputTokens": 4096,
                        "temperature": 0.1
                    }}
                )
                result = resp.json()
                err_code = result.get("error",{}).get("code", 0)
                err_msg = result.get("error",{}).get("message","")
                if "error" not in result:
                    print(f"Gemini OK: {modelo_atual}")
                    break
                eh_cota = err_code in [429, 503, 502] or any(x in err_msg for x in ["quota","RESOURCE_EXHAUSTED","overloaded","high demand"])
                eh_nao_encontrado = err_code == 404 or "not found" in err_msg.lower()
                print(f"Gemini {modelo_atual} erro {err_code}: {err_msg[:80]}")
                if eh_cota or eh_nao_encontrado:
                    # Troca imediatamente para o próximo modelo — sem esperar
                    continue
                # Erro desconhecido — espera 1s e tenta próximo
                await __import__("asyncio").sleep(1)
            except Exception as e:
                print(f"Timeout {modelo_atual}: {e}")
                # Timeout — tenta próximo modelo imediatamente

    if "error" in result:
        err_detail = result['error'].get('message','sem detalhes')
        print(f"GEMINI API ERROR: {err_detail}")
        log_erro("gemini_falhou", erro=err_detail)
        return {"resposta": "Estou com dificuldade para processar agora. Tenta de novo em alguns segundos! 🙏", "acao": None}

    candidates = result.get("candidates", [])
    print(f"DEBUG candidates count: {len(candidates)}")
    if candidates:
        finish = candidates[0].get("finishReason","")
        print(f"DEBUG finishReason: {finish}")
        if finish in ("MAX_TOKENS", "RECITATION", "SAFETY"):
            print(f"GEMINI finish={finish} — retrying sem histórico longo")
            # Tenta de novo com histórico reduzido (só última mensagem)
            msgs_curto = [msgs[0], msgs[-1]]  # só system + mensagem atual
            try:
                async with httpx.AsyncClient(timeout=30) as c2:
                    r2 = await c2.post(
                        f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={GEMINI_KEY}",
                        json={**_gemini_payload_extra, "contents": msgs_curto, "generationConfig": {"responseMimeType":"application/json","maxOutputTokens":1024,"temperature":0.1}}
                    )
                    result2 = r2.json()
                    if "candidates" in result2:
                        result = result2
                        candidates = result2.get("candidates",[])
            except Exception as e2:
                print(f"Retry falhou: {e2}")

    texto = ""
    if candidates:
        parts = candidates[0].get("content", {}).get("parts", [])
        texto = parts[0].get("text","") if parts else ""
    
    print(f"DEBUG texto len: {len(texto)} | FULL_RESPONSE: {repr(texto[:1000])}")
    if not texto:
        print(f"DEBUG result completo: {repr(str(result)[:500])}")
        return {"resposta": "Não entendi. Pode repetir de outro jeito?", "acao": None}

    # Executa todas as ações retornadas pelo Gemini (JSON mode)
    acoes_executadas = []
    try:
        texto_parse = texto.strip()
        if texto_parse.startswith("```"):
            texto_parse = texto_parse.split("```")[1]
            if texto_parse.startswith("json"):
                texto_parse = texto_parse[4:]
            texto_parse = texto_parse.strip()
        # Tenta localizar JSON pelo índice (funciona mesmo com texto antes do {)
        start = texto_parse.find("{")
        end = texto_parse.rfind("}") + 1
        if start >= 0 and end > start:
            texto_parse = texto_parse[start:end]
        parsed = json.loads(texto_parse)
        lista_acoes = parsed.get("acoes", [])
        texto = parsed.get("resposta", "")
        if not texto or texto.strip() in ("OK", "ok", "", "Entendido.", "Entendido"):
            # Se há ações, gera confirmação automática descrevendo o que foi feito
            if lista_acoes:
                partes = []
                for _a in lista_acoes:
                    if isinstance(_a, dict):
                        _ac = _a.get("acao","")
                        if _ac == "editar_conta":
                            _desc = _a.get("descricao","conta")
                            _campo = _a.get("campo","")
                            _val = _a.get("novo_valor","")
                            if _campo == "vencimento":
                                partes.append(f"{_desc} → {_val}")
                            else:
                                partes.append(f"{_desc} {_campo} → {_val}")
                        elif _ac == "registrar_lancamento":
                            partes.append(f"R${_a.get('valor',0)} registrado")
                if partes:
                    texto = "✅ " + " | ".join(partes)
                else:
                    texto = "✅ Feito!"
            else:
                texto = "Pode repetir? Não entendi bem o que você quis dizer."
        print(f"DEBUG parse OK: acoes={lista_acoes}")
    except Exception as e:
        print(f"ERRO parse JSON Gemini: {e} | texto_raw_FULL: {repr(texto[:2000])}")
        lista_acoes = []
        # Tenta extrair só o campo "resposta" com regex como fallback
        import re as _re
        m = _re.search(r'"resposta"\s*:\s*"((?:[^"\\]|\\.)*)"', texto)
        if m:
            texto = m.group(1).replace("\\n", "\n").replace('\\"', '"')
        elif not texto.startswith("{") and not texto.startswith("["):
            pass  # texto já é texto puro, mantém
        else:
            texto = "Pode repetir? Não entendi bem."
    print(f"DEBUG lista_acoes: {repr(lista_acoes)}")
    linhas_json = lista_acoes  # já são dicts, não precisa serializar
    acoes_executadas_count = 0

    # === DETECÇÃO DE VALOR ALTO: ganho muito acima da média = pode ser acumulado de vários dias ===
    # Calcula média diária real do motorista (últimos 30 dias, excluindo outliers)
    _media_diaria_real = meta_dia_chat  # já calculada acima
    _LIMIAR_PERIODO = max(700, _media_diaria_real * 2.5)  # mínimo R$700 ou 2.5x a média

    # Verifica se há algum ganho alto suspeito na lista de ações
    _ganho_alto_pendente = None
    for _linha_check in linhas_json:
        _a = _linha_check if isinstance(_linha_check, dict) else json.loads(_linha_check)
        if (_a.get("acao") == "registrar_lancamento"
                and _a.get("tipo", "ganho") == "ganho"
                and float(_a.get("valor", 0)) >= _LIMIAR_PERIODO
                and not _a.get("periodo_ja_confirmado")):  # flag para não perguntar de novo
            _ganho_alto_pendente = _a
            break

    if _ganho_alto_pendente:
        _valor_alto = float(_ganho_alto_pendente.get("valor", 0))
        _plat_alta = _ganho_alto_pendente.get("plataforma", "app")
        print(f"DEBUG valor_alto detectado: R${_valor_alto} plataforma={_plat_alta} limiar={_LIMIAR_PERIODO}")
        # Separa ações: executa tudo EXCETO o ganho alto suspeito
        _acoes_nao_ganho_alto = [_a for _a in linhas_json if not (
            isinstance(_a, dict)
            and _a.get("acao") == "registrar_lancamento"
            and _a.get("tipo", "ganho") == "ganho"
            and float(_a.get("valor", 0)) >= _LIMIAR_PERIODO
            and not _a.get("periodo_ja_confirmado")
        )]
        # Executa ações não-ganho (editar_conta, despesas normais, etc.)
        for _linha_ng in _acoes_nao_ganho_alto:
            try:
                _a_ng = _linha_ng if isinstance(_linha_ng, dict) else json.loads(_linha_ng)
                if _a_ng.get("acao") == "editar_conta":
                    import unicodedata as _ud2
                    def _norm2(s): s=(s or '').lower().strip(); s=_ud2.normalize('NFD',s); return ''.join(c for c in s if _ud2.category(c)!='Mn')
                    _desc_ng = _norm2(_a_ng.get("descricao",""))
                    _campo_ng = _a_ng.get("campo")
                    _novo_ng = _a_ng.get("novo_valor")
                    _contas_ng = supabase.table("contas").select("id,descricao,pago,vencimento,valor").eq("motorista_id", motorista_id).execute()
                    _matches_ng = [c for c in (_contas_ng.data or []) if _desc_ng and (_desc_ng in _norm2(c["descricao"]) or _norm2(c["descricao"]) in _desc_ng or (len(_desc_ng)>=4 and _norm2(c["descricao"]).startswith(_desc_ng[:5])))]
                    if not _matches_ng:
                        for c in (_contas_ng.data or []):
                            _pfx = ''.join(a for a,b in zip(_desc_ng, _norm2(c["descricao"])) if a==b)
                            if len(_pfx) >= 4: _matches_ng.append(c)
                    if _matches_ng and _campo_ng == "valor":
                        _venc_ng = _a_ng.get("vencimento_alvo")
                        _pend_ng = [c for c in _matches_ng if not c.get("pago")]
                        if _venc_ng and _pend_ng:
                            try:
                                from datetime import date as _dn; _vd=_dn.fromisoformat(str(_venc_ng))
                                _pend_ng.sort(key=lambda c: abs((_dn.fromisoformat(c["vencimento"])-_vd).days))
                            except: pass
                            supabase.table("contas").update({"valor": float(_novo_ng)}).eq("id", _pend_ng[0]["id"]).execute()
                        elif _pend_ng:
                            for _c_ng in _pend_ng:
                                supabase.table("contas").update({"valor": float(_novo_ng)}).eq("id", _c_ng["id"]).execute()
                        acoes_executadas.append("conta_editada")
                    elif _matches_ng and _campo_ng == "vencimento":
                        _venc_ng2 = _a_ng.get("vencimento_alvo")
                        _vfiltro_ng = _a_ng.get("valor_filtro")
                        _pend_ng2 = [c for c in _matches_ng if not c.get("pago")]
                        _alvo_ng2 = None
                        print(f"DEBUG editar_vencimento: desc={_a_ng.get('descricao')} valor_filtro={_vfiltro_ng} venc_alvo={_venc_ng2} novo={_novo_ng} pendentes={[(c['descricao'],c.get('valor'),c['vencimento']) for c in _pend_ng2]}")
                        if _vfiltro_ng and _pend_ng2:
                            try:
                                _vf = float(_vfiltro_ng)
                                _por_valor = [c for c in _pend_ng2 if abs(float(c.get("valor",0) or 0) - _vf) < 1]
                                _alvo_ng2 = _por_valor[0] if _por_valor else None
                                print(f"DEBUG valor_filtro={_vf} achou={_alvo_ng2['id'] if _alvo_ng2 else 'NENHUM'}")
                            except Exception as _ef: print(f"DEBUG vf erro: {_ef}")
                        if not _alvo_ng2 and _venc_ng2 and _pend_ng2:
                            try:
                                from datetime import date as _dn2; _vd2=_dn2.fromisoformat(str(_venc_ng2))
                                _pend_ng2.sort(key=lambda c: abs((_dn2.fromisoformat(c["vencimento"])-_vd2).days))
                                _alvo_ng2 = _pend_ng2[0]
                                print(f"DEBUG venc_alvo fallback={_alvo_ng2['id']}")
                            except: pass
                        if not _alvo_ng2 and _pend_ng2:
                            _pend_ng2.sort(key=lambda c: c.get("vencimento",""))
                            _alvo_ng2 = _pend_ng2[0]
                            print(f"DEBUG fallback final={_alvo_ng2['id']} venc={_alvo_ng2['vencimento']}")
                        if _alvo_ng2:
                            print(f"DEBUG SALVANDO id={_alvo_ng2['id']} desc={_alvo_ng2['descricao']} val={_alvo_ng2.get('valor')} novo_venc={_novo_ng}")
                            supabase.table("contas").update({"vencimento": str(_novo_ng)}).eq("id", _alvo_ng2["id"]).execute()
                            acoes_executadas.append("conta_editada")
            except Exception as _eng_e:
                print(f"ERRO ao executar ação não-ganho: {_eng_e}")
        return {
            "resposta": texto,
            "acao": "conta_editada" if "conta_editada" in acoes_executadas else None,
            "acoes_count": len(acoes_executadas),
            "acoes_esperadas": len(linhas_json),
            "aguarda_periodo": True,
            "ganho_pendente": {
                "valor": _valor_alto,
                "plataforma": _plat_alta,
                "descricao": _ganho_alto_pendente.get("descricao", ""),
                "lista_acoes_original": linhas_json
            }
        }

    for linha in linhas_json:
        try:
            acao = linha if isinstance(linha, dict) else json.loads(linha)
            print(f"DEBUG acao={acao} motorista_id={motorista_id}")
            if acao.get("acao") == "registrar_lancamento":
                import datetime as _dt
                hoje = hoje_brasil()
                ontem = (hoje - _dt.timedelta(days=1)).isoformat()
                data_ia = acao.get("data", "")
                # Resolve "ontem" literal ou usa a data fornecida pela IA, senão hoje
                if data_ia == "ontem":
                    data_final = ontem
                elif data_ia and data_ia != "hoje" and len(data_ia) == 10:
                    data_final = data_ia
                else:
                    data_final = hoje.isoformat()
                dados = {
                    "motorista_id": motorista_id,
                    "tipo": acao.get("tipo", "ganho"),
                    "valor": float(acao.get("valor", 0)),
                    "data": data_final
                }
                if acao.get("plataforma"): dados["plataforma"] = acao["plataforma"]
                if acao.get("descricao"): dados["descricao"] = acao["descricao"]
                # Se substituir=true ou tipo=ganho com plataforma+data=hoje, deleta antes de inserir (evita duplicata)
                if acao.get("substituir") and dados.get("plataforma") and dados["tipo"] == "ganho":
                    try:
                        supabase.table("lancamentos").delete().eq("motorista_id", motorista_id).eq("tipo", "ganho").eq("plataforma", dados["plataforma"]).eq("data", data_final).execute()
                    except: pass
                supabase.table("lancamentos").insert(dados).execute()
                acoes_executadas.append("lancamento_registrado")
                # AUTO-ABATE: se for despesa, verifica se existe conta pendente com nome similar e abate
                if dados["tipo"] == "despesa" and dados.get("descricao"):
                    try:
                        desc_desp = dados["descricao"].lower().strip()
                        contas_pend = supabase.table("contas").select("id,descricao,valor,valor_pago").eq("motorista_id", motorista_id).eq("pago", False).execute()
                        for cp in (contas_pend.data or []):
                            nome_conta = cp["descricao"].lower()
                            # Verifica se a descrição da despesa está contida no nome da conta ou vice-versa
                            if desc_desp in nome_conta or nome_conta.split()[0] in desc_desp:
                                valor_despesa = float(dados["valor"])
                                ja_pago = float(cp.get("valor_pago") or 0)
                                valor_total_conta = float(cp["valor"])
                                novo_pago = ja_pago + valor_despesa
                                if novo_pago >= valor_total_conta - 0.01:
                                    supabase.table("contas").update({"pago": True, "valor_pago": valor_total_conta}).eq("id", cp["id"]).execute()
                                else:
                                    supabase.table("contas").update({"valor_pago": novo_pago}).eq("id", cp["id"]).execute()
                                acoes_executadas.append("conta_abatida_auto")
                                break
                    except: pass

            elif acao.get("acao") == "deletar_conta":
                # Remove uma conta a pagar pelo nome
                descricao = acao.get("descricao", "").lower()
                contas_res = supabase.table("contas").select("id,descricao").eq("motorista_id", motorista_id).execute()
                for c in (contas_res.data or []):
                    if descricao and (descricao.lower() in c["descricao"].lower() or c["descricao"].lower() in descricao.lower() or len(__import__("os.path", fromlist=["commonprefix"]).commonprefix([descricao.lower(), c["descricao"].lower()])) >= 5):
                        supabase.table("contas").delete().eq("id", c["id"]).execute()
                        acoes_executadas.append("conta_deletada")
                        break
            elif acao.get("acao") == "editar_conta":
                # Edita valor ou vencimento — atualiza TODAS as parcelas pendentes com nome similar
                descricao = acao.get("descricao", "").lower()
                campo = acao.get("campo")
                novo_valor = acao.get("novo_valor")
                apenas_proxima = acao.get("apenas_proxima", False)  # default: atualiza todas pendentes
                contas_res = supabase.table("contas").select("id,descricao,pago,vencimento,valor").eq("motorista_id", motorista_id).execute()
                import unicodedata as _ud
                def _norm_desc(s):
                    s = (s or '').lower().strip()
                    s = _ud.normalize('NFD', s)
                    s = ''.join(c for c in s if _ud.category(c) != 'Mn')
                    return s
                desc_norm = _norm_desc(descricao)
                matches = []
                for c in (contas_res.data or []):
                    c_norm = _norm_desc(c["descricao"])
                    if desc_norm and (desc_norm in c_norm or c_norm in desc_norm or len(_ud.normalize('NFC', desc_norm[:5])) >= 4 and c_norm.startswith(desc_norm[:5])):
                        matches.append(c)
                # Se não achou, tenta prefixo comum de 4+ chars
                if not matches:
                    for c in (contas_res.data or []):
                        c_norm = _norm_desc(c["descricao"])
                        prefix = ''
                        for a, b in zip(desc_norm, c_norm):
                            if a == b: prefix += a
                            else: break
                        if len(prefix) >= 4:
                            matches.append(c)
                # Filtra só pendentes (a não ser que seja campo=valor, aí edita todas)
                if campo == "vencimento":
                    pendentes_match = [c for c in matches if not c.get("pago")]
                    venc_alvo = acao.get("vencimento_alvo")
                    valor_filtro = acao.get("valor_filtro")
                    alvo = None
                    if valor_filtro and pendentes_match:
                        # Filtra por valor exato (ex: "o tênis de 500")
                        try:
                            vf = float(valor_filtro)
                            por_valor = [c for c in pendentes_match if abs(float(c.get("valor", 0)) - vf) < 1]
                            alvo = por_valor[0] if por_valor else pendentes_match[0]
                        except:
                            alvo = pendentes_match[0]
                    elif venc_alvo and pendentes_match:
                        # Filtra por vencimento mais próximo do alvo
                        try:
                            from datetime import date as _date
                            alvo_dt = _date.fromisoformat(str(venc_alvo))
                            pendentes_match.sort(key=lambda c: abs((_date.fromisoformat(c["vencimento"]) - alvo_dt).days))
                            alvo = pendentes_match[0]
                        except:
                            pendentes_match.sort(key=lambda c: c.get("vencimento",""))
                            alvo = pendentes_match[0]
                    elif pendentes_match:
                        pendentes_match.sort(key=lambda c: c.get("vencimento",""))
                        alvo = pendentes_match[0]
                    if alvo:
                        supabase.table("contas").update({"vencimento": str(novo_valor)}).eq("id", alvo["id"]).execute()
                        acoes_executadas.append("conta_editada")
                elif campo == "valor":
                    venc_alvo = acao.get("vencimento_alvo")
                    if venc_alvo:
                        # Edita só a parcela com vencimento mais próximo do alvo
                        pendentes_match = [c for c in matches if not c.get("pago")]
                        alvo = None
                        if pendentes_match:
                            # Pega a que tem vencimento mais próximo do alvo informado
                            try:
                                from datetime import date as _date
                                alvo_dt = _date.fromisoformat(str(venc_alvo))
                                pendentes_match.sort(key=lambda c: abs((_date.fromisoformat(c["vencimento"]) - alvo_dt).days))
                                alvo = pendentes_match[0]
                            except:
                                alvo = pendentes_match[0]
                        if alvo:
                            supabase.table("contas").update({"valor": float(novo_valor)}).eq("id", alvo["id"]).execute()
                            acoes_executadas.append("conta_editada")
                    else:
                        # Sem vencimento específico: atualiza todas as pendentes
                        pendentes_match = [c for c in matches if not c.get("pago")]
                        for c in pendentes_match:
                            supabase.table("contas").update({"valor": float(novo_valor)}).eq("id", c["id"]).execute()
                        if pendentes_match:
                            acoes_executadas.append("conta_editada")
            elif acao.get("acao") == "deletar_ultimo_lancamento":
                tipo = acao.get("tipo", "ganho")
                plataforma_filtro = acao.get("plataforma")  # None = qualquer plataforma
                # Pega os últimos 15 lançamentos para detectar distribuição em lote
                q_del = supabase.table("lancamentos").select("id,created_at,plataforma").eq("motorista_id", motorista_id).eq("tipo", tipo).order("created_at", desc=True).limit(15).execute()
                cands_del = q_del.data or []
                # Filtra por plataforma se informada pelo usuário
                if plataforma_filtro:
                    cands_del = [x for x in cands_del if (x.get("plataforma") or "").lower() == plataforma_filtro.lower()]
                if cands_del:
                    from datetime import datetime as _dtt2
                    ultimo_ts = None
                    try:
                        ultimo_ts = _dtt2.fromisoformat(cands_del[0]["created_at"].replace("Z","+00:00"))
                    except: pass
                    # Verifica se múltiplos lançamentos foram criados quase ao mesmo tempo (±5s = distribuição em lote)
                    ids_lote = [cands_del[0]["id"]]
                    if ultimo_ts:
                        plat_ref = cands_del[0].get("plataforma")
                        for item in cands_del[1:]:
                            try:
                                ts2 = _dtt2.fromisoformat(item["created_at"].replace("Z","+00:00"))
                                diff = abs((ultimo_ts - ts2).total_seconds())
                                if diff <= 5 and item.get("plataforma") == plat_ref:
                                    ids_lote.append(item["id"])
                                else:
                                    break
                            except: break
                    for lid in ids_lote:
                        supabase.table("lancamentos").delete().eq("id", lid).eq("motorista_id", motorista_id).execute()
                    acoes_executadas.append("lancamento_deletado" if len(ids_lote)==1 else "lancamentos_deletados")

            elif acao.get("acao") == "deletar_lancamento_por_id":
                lid = acao.get("id")
                if lid:
                    supabase.table("lancamentos").delete().eq("id", lid).eq("motorista_id", motorista_id).execute()
                    acoes_executadas.append("lancamento_deletado")

            elif acao.get("acao") == "deletar_lancamentos_por_ids":
                ids = acao.get("ids", [])
                for lid in ids:
                    supabase.table("lancamentos").delete().eq("id", lid).eq("motorista_id", motorista_id).execute()
                if ids:
                    acoes_executadas.append("lancamentos_deletados")

            elif acao.get("acao") == "editar_lancamento_por_id":
                lid = acao.get("id")
                novo_valor = acao.get("valor")
                if lid and novo_valor is not None:
                    supabase.table("lancamentos").update({"valor": float(novo_valor)}).eq("id", lid).eq("motorista_id", motorista_id).execute()
                    acoes_executadas.append("lancamento_editado")
            elif acao.get("acao") == "registrar_turno":
                turno_data = {
                    "motorista_id": motorista_id,
                    "data": str(hoje_brasil()),
                    "inicio": acao.get("inicio"),
                    "fim": acao.get("fim"),
                    "horas": acao.get("horas")
                }
                if turno_data["inicio"] and turno_data["fim"]:
                    from datetime import datetime as _dtt
                    try:
                        h = (_dtt.strptime(turno_data["fim"], "%H:%M") - _dtt.strptime(turno_data["inicio"], "%H:%M")).seconds / 3600
                        turno_data["horas"] = round(h, 2)
                    except: pass
                try:
                    existing = supabase.table("turnos").select("id").eq("motorista_id", motorista_id).eq("data", str(hoje_brasil())).execute()
                    if existing.data:
                        supabase.table("turnos").update({"inicio": turno_data["inicio"], "fim": turno_data["fim"], "horas": turno_data["horas"]}).eq("id", existing.data[0]["id"]).execute()
                    else:
                        supabase.table("turnos").insert(turno_data).execute()
                    acoes_executadas.append("turno_registrado")
                    horas_turno = turno_data.get("horas") or 0
                    ganhos_dia = sum(float(l["valor"]) for l in lancamentos_mes if l["tipo"] == "ganho" and l["data"] == str(hoje_brasil()))
                    if horas_turno > 0 and ganhos_dia > 0:
                        texto = f"✅ Turno registrado! {horas_turno:.1f}h de trabalho. Você fez R$ {ganhos_dia:.2f} hoje = R$ {ganhos_dia/horas_turno:.2f}/hora 💰"
                except Exception as e:
                    print(f"Erro ao salvar turno: {e}")

            elif acao.get("acao") == "editar_ultimo_lancamento":
                tipo = acao.get("tipo", "despesa")
                campo = acao.get("campo", "valor")
                novo_valor = acao.get("novo_valor")
                descricao = acao.get("descricao", "")
                # Para horas_rodadas e km_rodados, pega simplesmente o último ganho sem filtrar por descrição
                if campo in ("horas_rodadas", "km_rodados"):
                    q = supabase.table("lancamentos").select("id,valor,plataforma").eq("motorista_id", motorista_id).eq("tipo", tipo).order("created_at", desc=True).limit(1).execute()
                    if q.data and novo_valor is not None:
                        supabase.table("lancamentos").update({campo: float(novo_valor)}).eq("id", q.data[0]["id"]).execute()
                        acoes_executadas.append("lancamento_editado")
                        # Calcula e exibe ganho por hora na resposta
                        if campo == "horas_rodadas" and float(novo_valor) > 0:
                            valor_ganho = float(q.data[0].get("valor") or 0)
                            plat = q.data[0].get("plataforma") or "app"
                            ganho_hora = valor_ganho / float(novo_valor)
                            texto = f"✅ Registrado! Você fez R$ {valor_ganho:.2f} em {float(novo_valor):.1f}h na {plat}. Isso dá R$ {ganho_hora:.2f}/hora 💰"
                else:
                    # Edita lancamento por descrição
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
                    "vencimento": acao.get("vencimento", hoje_brasil().isoformat()),
                    "pago": pago_direto
                }).execute()
                acoes_executadas.append("conta_registrada")
            elif acao.get("acao") == "marcar_pago":
                # Marca a conta como paga — NÃO cria lançamento automático
                # O motorista já registrou o gasto separadamente no chat
                descricao = acao.get("descricao", "").lower()
                contas_res = supabase.table("contas").select("id,descricao,valor,valor_pago").eq("motorista_id", motorista_id).eq("pago", False).execute()
                for c in (contas_res.data or []):
                    nome_c = c["descricao"].lower()
                    if descricao and (descricao in nome_c or nome_c in descricao or
                        len(__import__("os.path", fromlist=["commonprefix"]).commonprefix([descricao, nome_c])) >= 4):
                        valor_total = float(c["valor"])
                        supabase.table("contas").update({"pago": True, "valor_pago": valor_total}).eq("id", c["id"]).execute()
                        acoes_executadas.append("conta_paga")
                        break
            elif acao.get("acao") == "abater_conta":
                # Abate valor parcial de uma conta E registra como despesa real
                descricao = acao.get("descricao", "").lower()
                valor_pago = float(acao.get("valor_pago", 0))
                contas_res = supabase.table("contas").select("id,descricao,valor,valor_pago").eq("motorista_id", motorista_id).eq("pago", False).execute()
                for c in (contas_res.data or []):
                    if descricao and (descricao.lower() in c["descricao"].lower() or c["descricao"].lower() in descricao.lower() or len(__import__("os.path", fromlist=["commonprefix"]).commonprefix([descricao.lower(), c["descricao"].lower()])) >= 5):
                        valor_original = float(c["valor"])
                        ja_pago = float(c.get("valor_pago") or 0)
                        total_pago = ja_pago + valor_pago
                        saldo_restante = valor_original - total_pago
                        if saldo_restante <= 0.01:
                            # Quitou tudo — marca como pago
                            supabase.table("contas").update({
                                "pago": True,
                                "valor_pago": valor_original
                            }).eq("id", c["id"]).execute()
                        else:
                            # Abatimento parcial — acumula valor_pago, mantém valor original
                            supabase.table("contas").update({
                                "valor_pago": total_pago
                            }).eq("id", c["id"]).execute()
                        # REGISTRA DESPESA REAL no historico de lancamentos
                        supabase.table("lancamentos").insert({
                            "motorista_id": motorista_id,
                            "tipo": "despesa",
                            "valor": valor_pago,
                            "descricao": c["descricao"],
                            "plataforma": "conta",
                            "data": str(hoje_brasil())
                        }).execute()
                        acoes_executadas.append("conta_abatida")
                        break

            elif acao.get("acao") == "deletar_conta":
                # Remove uma conta a pagar pelo nome
                descricao = acao.get("descricao", "").lower()
                contas_res = supabase.table("contas").select("id,descricao").eq("motorista_id", motorista_id).execute()
                for c in (contas_res.data or []):
                    if descricao and (descricao.lower() in c["descricao"].lower() or c["descricao"].lower() in descricao.lower() or len(__import__("os.path", fromlist=["commonprefix"]).commonprefix([descricao.lower(), c["descricao"].lower()])) >= 5):
                        supabase.table("contas").delete().eq("id", c["id"]).execute()
                        acoes_executadas.append("conta_deletada")
                        break
            elif acao.get("acao") == "editar_conta":
                # Edita valor ou vencimento de uma conta pelo nome
                descricao = acao.get("descricao", "").lower()
                campo = acao.get("campo")
                novo_valor = acao.get("novo_valor")
                venc_alvo = acao.get("vencimento_alvo")
                contas_res = supabase.table("contas").select("id,descricao,pago,vencimento,valor").eq("motorista_id", motorista_id).execute()
                matches2 = []
                for c in (contas_res.data or []):
                    if descricao and (descricao.lower() in c["descricao"].lower() or c["descricao"].lower() in descricao.lower() or len(__import__("os.path", fromlist=["commonprefix"]).commonprefix([descricao.lower(), c["descricao"].lower()])) >= 5):
                        matches2.append(c)
                if campo == "valor" and venc_alvo:
                    # Edita só a parcela mais próxima do vencimento informado
                    pendentes2 = [c for c in matches2 if not c.get("pago")]
                    if pendentes2:
                        try:
                            from datetime import date as _date2
                            alvo_dt2 = _date2.fromisoformat(str(venc_alvo))
                            pendentes2.sort(key=lambda c: abs((_date2.fromisoformat(c["vencimento"]) - alvo_dt2).days))
                            supabase.table("contas").update({"valor": float(novo_valor)}).eq("id", pendentes2[0]["id"]).execute()
                        except:
                            supabase.table("contas").update({"valor": float(novo_valor)}).eq("id", pendentes2[0]["id"]).execute()
                        acoes_executadas.append("conta_editada")
                elif matches2:
                    pendentes2b = [c for c in matches2 if not c.get("pago")]
                    lista2b = pendentes2b if pendentes2b else matches2
                    alvo2 = None
                    valor_filtro2 = acao.get("valor_filtro")
                    venc_alvo2 = acao.get("vencimento_alvo")
                    if valor_filtro2:
                        try:
                            vf2 = float(valor_filtro2)
                            por_valor2 = [c for c in lista2b if abs(float(c.get("valor",0) or 0) - vf2) < 1]
                            alvo2 = por_valor2[0] if por_valor2 else None
                        except: pass
                    if not alvo2 and venc_alvo2:
                        try:
                            from datetime import date as _dv2
                            alvo_dt2b = _dv2.fromisoformat(str(venc_alvo2))
                            lista2b_s = sorted(lista2b, key=lambda c: abs((_dv2.fromisoformat(c["vencimento"]) - alvo_dt2b).days))
                            alvo2 = lista2b_s[0]
                        except: pass
                    if not alvo2:
                        lista2b.sort(key=lambda c: c.get("vencimento",""))
                        alvo2 = lista2b[0]
                    if campo == "valor":
                        supabase.table("contas").update({"valor": float(novo_valor)}).eq("id", alvo2["id"]).execute()
                    elif campo == "vencimento":
                        supabase.table("contas").update({"vencimento": str(novo_valor)}).eq("id", alvo2["id"]).execute()
                    acoes_executadas.append("conta_editada")
            elif acao.get("acao") == "deletar_ultimo_lancamento":
                # Deleta o último lançamento (ou lote de distribuição) para o motorista
                tipo = acao.get("tipo")
                descricao = acao.get("descricao")
                plataforma_filtro2 = acao.get("plataforma")
                from datetime import datetime as _dtt3
                q2 = supabase.table("lancamentos").select("id,created_at,plataforma,tipo,descricao").eq("motorista_id", motorista_id).order("created_at", desc=True).limit(15).execute()
                cands = q2.data or []
                if tipo:
                    cands = [x for x in cands if x.get("tipo") == tipo]
                if descricao:
                    cands = [x for x in cands if descricao.lower() in (x.get("descricao") or "").lower()]
                # Filtra por plataforma se o usuário especificou (ex: "cancele o da 99")
                if plataforma_filtro2:
                    cands = [x for x in cands if (x.get("plataforma") or "").lower() == plataforma_filtro2.lower()]
                if cands:
                    ref2 = cands[0]
                    ref_ts2 = None
                    try:
                        ref_ts2 = _dtt3.fromisoformat(ref2["created_at"].replace("Z","+00:00"))
                    except: pass
                    ids_lote2 = [ref2["id"]]
                    if ref_ts2:
                        plat_ref2 = ref2.get("plataforma")
                        for it2 in cands[1:]:
                            try:
                                ts3 = _dtt3.fromisoformat(it2["created_at"].replace("Z","+00:00"))
                                diff2 = abs((ref_ts2 - ts3).total_seconds())
                                if diff2 <= 5 and it2.get("plataforma") == plat_ref2:
                                    ids_lote2.append(it2["id"])
                                else:
                                    break
                            except: break
                    for lid2 in ids_lote2:
                        supabase.table("lancamentos").delete().eq("id", lid2).eq("motorista_id", motorista_id).execute()
                    acoes_executadas.append("lancamento_deletado" if len(ids_lote2)==1 else "lancamentos_deletados")
            elif acao.get("acao") == "zerar_despesas_hoje":
                # Deleta TODAS as despesas de hoje do motorista
                hoje_str = hoje_brasil().isoformat()
                supabase.table("lancamentos").delete().eq("motorista_id", motorista_id).eq("data", hoje_str).eq("tipo", "despesa").execute()
                acoes_executadas.append("despesas_zeradas")
            elif acao.get("acao") == "salvar_compromissos":
                # Salva metas diárias que o motorista se comprometeu a cumprir
                compromissos = acao.get("compromissos", [])
                for c in compromissos:
                    data = c.get("data")
                    meta_bruta = float(c.get("meta_bruta", 0))
                    nota = c.get("nota", "")
                    if not data or meta_bruta <= 0:
                        continue
                    try:
                        existente = supabase.table("plano_compromissos").select("id").eq("motorista_id", motorista_id).eq("data", data).execute()
                        if existente.data:
                            supabase.table("plano_compromissos").update({"meta_bruta": meta_bruta, "nota": nota, "status": "pendente"}).eq("id", existente.data[0]["id"]).execute()
                        else:
                            supabase.table("plano_compromissos").insert({"motorista_id": motorista_id, "data": data, "meta_bruta": meta_bruta, "nota": nota, "status": "pendente"}).execute()
                    except Exception as ce:
                        print(f"ERRO salvar compromisso {data}: {ce}")
                acoes_executadas.append("compromissos_salvos")
        except Exception as e:
            import traceback
            print(f"ERRO ACAO: {e} | linha: {linha}")
            traceback.print_exc()
    acao_executada = acoes_executadas[0] if acoes_executadas else None
    # texto já atualizado pelo JSON mode
    # Se a IA disse que registrou mas nenhuma ação foi executada, avisa
    if lista_acoes and not acoes_executadas:
        print(f"AVISO: IA gerou {len(lista_acoes)} ações mas nenhuma foi executada. acoes={lista_acoes}")

    return {"resposta": texto, "acao": acao_executada, "acoes_count": len(acoes_executadas), "acoes_esperadas": len(lista_acoes)}

# wrapper global para capturar qualquer exceção não tratada no /chat
@app.exception_handler(Exception)
async def generic_exception_handler(request, exc):
    import traceback
    print(f"ERRO GLOBAL: {exc}")
    traceback.print_exc()
    from fastapi.responses import JSONResponse
    tb = traceback.format_exc()
    return JSONResponse(status_code=500, content={"resposta": f"Erro: {str(exc)[:200]}", "acao": None, "erro": str(exc), "trace": tb[-300:]})



@app.post("/distribuir-ganho")
async def distribuir_ganho(dados: dict = Body(...), uid: str = Depends(get_uid_from_token)):
    if dados.get("motorista_id") != uid: raise HTTPException(status_code=403, detail="Acesso negado")
    """
    Distribui um ganho acumulado de vários dias igualmente pelos dias do período.
    Body: { motorista_id, valor, plataforma, data_inicio, data_fim }
    data_inicio e data_fim: "YYYY-MM-DD"
    Se data_inicio == data_fim → registra tudo no único dia.
    """
    import datetime as _dt
    mid = dados.get("motorista_id")
    valor_total = float(dados.get("valor", 0))
    plataforma = dados.get("plataforma", "uber")
    descricao = dados.get("descricao", "")
    data_inicio_str = dados.get("data_inicio", "")
    data_fim_str = dados.get("data_fim", "")
    hoje = hoje_brasil()

    if not mid or valor_total <= 0 or not data_inicio_str or not data_fim_str:
        return {"ok": False, "erro": "Parâmetros incompletos"}

    try:
        data_inicio = _dt.date.fromisoformat(data_inicio_str)
        data_fim = _dt.date.fromisoformat(data_fim_str)
    except:
        return {"ok": False, "erro": "Data inválida"}

    # Gera lista de dias entre inicio e fim (inclusive)
    dias = []
    d = data_inicio
    while d <= data_fim:
        dias.append(d.isoformat())
        d += _dt.timedelta(days=1)

    if not dias:
        return {"ok": False, "erro": "Nenhum dia no período"}

    # Distribui igualmente
    n_dias = len(dias)
    valor_por_dia = round(valor_total / n_dias, 2)
    # Ajusta último dia para cobrir centavos
    valores = [valor_por_dia] * n_dias
    valores[-1] = round(valor_total - valor_por_dia * (n_dias - 1), 2)

    registrados = []
    erros = []
    for i, data_str in enumerate(dias):
        try:
            row = {
                "motorista_id": mid,
                "tipo": "ganho",
                "valor": valores[i],
                "data": data_str,
                "plataforma": plataforma,
            }
            if descricao:
                row["descricao"] = descricao
            res_insert = supabase.table("lancamentos").insert(row).execute()
            inserted_id = res_insert.data[0]["id"] if res_insert.data else None
            registrados.append({"data": data_str, "valor": valores[i], "id": inserted_id})
        except Exception as e:
            erros.append({"data": data_str, "erro": str(e)})

    if n_dias == 1:
        msg = f"✅ Anotei! R${valor_total:.0f} na {plataforma} em {data_inicio_str}."
    else:
        msg = f"✅ Distribuí R${valor_total:.0f} em {n_dias} dias ({data_inicio_str} a {data_fim_str}). R${valor_por_dia:.0f}/dia na {plataforma}."

    ids_criados = [r["id"] for r in registrados if r.get("id")]
    return {
        "ok": True,
        "registrados": registrados,
        "ids_criados": ids_criados,
        "erros": erros,
        "mensagem": msg,
        "n_dias": n_dias,
        "valor_por_dia": valor_por_dia
    }


@app.get("/diagnostico/{mid}")
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

@app.get("/debug-chat/{mid}")
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

# ── COMPROMISSOS DO PLANO ────────────────────────────────────────────────────
# Salva metas específicas por dia que o motorista se comprometeu a cumprir
@app.post("/plano-compromisso")
async def salvar_compromisso(dados: dict = Body(...), uid: str = Depends(get_uid_from_token)):
    """Salva meta diária comprometida pelo motorista."""
    mid = uid  # sempre do token
    compromissos = dados.get("compromissos", [])
    if not compromissos:
        return {"ok": False, "erro": "dados incompletos"}
    try:
        for c in compromissos:
            data = c.get("data")
            meta_bruta = float(c.get("meta_bruta", 0))
            nota = c.get("nota", "")
            if not data or meta_bruta <= 0:
                continue
            existente = supabase.table("plano_compromissos").select("id").eq("motorista_id", mid).eq("data", data).execute()
            if existente.data:
                supabase.table("plano_compromissos").update({"meta_bruta": meta_bruta, "nota": nota}).eq("id", existente.data[0]["id"]).execute()
            else:
                supabase.table("plano_compromissos").insert({"motorista_id": mid, "data": data, "meta_bruta": meta_bruta, "nota": nota, "status": "pendente"}).execute()
        return {"ok": True, "salvos": len(compromissos)}
    except Exception as e:
        log_erro("endpoint_erro", erro=e)
        return {"ok": False, "erro": "Erro interno"}

@app.get("/plano-compromisso/{mid}")
async def buscar_compromissos(mid: str, uid: str = Depends(get_uid_from_token)):
    if mid != uid: raise HTTPException(status_code=403, detail="Acesso negado")
    """Retorna compromissos dos próximos 14 dias + cruzado com o que foi feito."""
    import datetime as _dt
    hoje = hoje_brasil()
    inicio = (hoje - _dt.timedelta(days=1)).isoformat()
    fim = (hoje + _dt.timedelta(days=14)).isoformat()
    try:
        comp_res = supabase.table("plano_compromissos").select("*").eq("motorista_id", mid).gte("data", inicio).lte("data", fim).order("data").execute()
        compromissos = comp_res.data or []
        datas = [c["data"] for c in compromissos]
        if datas:
            lanc_res = supabase.table("lancamentos").select("data,tipo,valor").eq("motorista_id", mid).in_("data", datas).execute()
            lancamentos = lanc_res.data or []
        else:
            lancamentos = []
        ganho_por_data = {}
        for l in lancamentos:
            if l["tipo"] == "ganho":
                d = l["data"]
                ganho_por_data[d] = ganho_por_data.get(d, 0) + float(l["valor"])
        resultado = []
        for c in compromissos:
            data = c["data"]
            faturado = ganho_por_data.get(data, None)
            meta = float(c["meta_bruta"])
            if data < hoje.isoformat():
                status = "batido" if (faturado or 0) >= meta * 0.85 else "perdido"
            elif data == hoje.isoformat():
                status = "hoje"
            else:
                status = "pendente"
            resultado.append({"id": c["id"], "data": data, "meta_bruta": meta, "faturado": faturado, "nota": c.get("nota", ""), "status": status, "pct": round((faturado or 0) / meta * 100) if meta > 0 else 0})
        return {"compromissos": resultado}
    except Exception as e:
        return {"compromissos": [], "erro": str(e)}

@app.post("/plano-ativo")
async def salvar_plano_ativo(dados: dict = Body(...), uid: str = Depends(get_uid_from_token)):
    """Salva o plano completo."""
    mid = uid  # sempre do token
    try:
        plano = {
            "motorista_id": mid,
            "total_contas": dados.get("total_contas", 0),
            "caixa_inicial": dados.get("caixa_inicial", 0),
            "comb_ajustado": dados.get("comb_ajustado"),
            "criado_em": datetime.now(TZ_BR).isoformat(),
            "status": "ativo"
        }
        existente = supabase.table("plano_ativo").select("id").eq("motorista_id", mid).eq("status", "ativo").execute()
        if existente.data:
            supabase.table("plano_ativo").update(plano).eq("id", existente.data[0]["id"]).execute()
        else:
            supabase.table("plano_ativo").insert(plano).execute()
        return {"ok": True}
    except Exception as e:
        log_erro("endpoint_erro", erro=e)
        return {"ok": False, "erro": "Erro interno"}

@app.post("/admin/limpar-duplicatas")
async def limpar_duplicatas(dados: dict = Body(...), uid: str = Depends(get_uid_from_token)):
    """Limpeza de duplicatas — só opera nos dados do próprio usuário autenticado."""
    mid = uid  # sempre do token, nunca do body
    r = supabase.table("lancamentos").select("id,data,valor,created_at").eq("motorista_id", mid).eq("tipo", "ganho").eq("plataforma", "99").gte("data", "2026-05-01").order("data", desc=False).order("created_at", desc=False).execute()
    lancs = r.data or []
    removidos = []
    vistos = {}
    for l in sorted(lancs, key=lambda x: x.get("created_at","")):
        chave = f"{l['data']}_{float(l['valor']):.2f}"
        if chave in vistos:
            supabase.table("lancamentos").delete().eq("id", l["id"]).execute()
            removidos.append({"id": l["id"], "data": l["data"], "valor": float(l["valor"]), "motivo": "duplicata"})
        else:
            vistos[chave] = l["id"]
    r2 = supabase.table("lancamentos").select("valor").eq("motorista_id", mid).eq("tipo", "ganho").eq("plataforma", "99").gte("data", "2026-05-01").execute()
    novo_total = sum(float(l["valor"]) for l in (r2.data or []))
    return {"ok": True, "removidos": len(removidos), "detalhes": removidos, "novo_total_99": round(novo_total, 2)}

@app.get("/plano-ativo/{mid}")
async def buscar_plano_ativo(mid: str, uid: str = Depends(get_uid_from_token)):
    if mid != uid: raise HTTPException(status_code=403, detail="Acesso negado")
    """Retorna o plano ativo + progresso real dos compromissos."""
    import datetime as _dt
    try:
        plano_res = supabase.table("plano_ativo").select("*").eq("motorista_id", mid).eq("status", "ativo").execute()
        if not plano_res.data:
            return {"tem_plano": False}
        plano = plano_res.data[0]

        # Busca compromissos ativos
        comp_res = supabase.table("plano_compromissos").select("*").eq("motorista_id", mid).gte("data", plano["criado_em"][:10]).order("data").execute()
        compromissos = comp_res.data or []

        # Cruzar com lançamentos reais
        hoje = hoje_brasil()
        datas = [c["data"] for c in compromissos]
        faturado_por_dia = {}
        if datas:
            lancs = supabase.table("lancamentos").select("data,tipo,valor").eq("motorista_id", mid).in_("data", datas).execute()
            for l in (lancs.data or []):
                if l["tipo"] == "ganho":
                    faturado_por_dia[l["data"]] = faturado_por_dia.get(l["data"], 0) + float(l["valor"])

        total_meta = sum(float(c["meta_bruta"]) for c in compromissos)
        total_faturado = sum(faturado_por_dia.get(c["data"], 0) for c in compromissos)
        pct_geral = round(total_faturado / max(total_meta, 1) * 100)

        # Verifica se objetivo foi cumprido (faturado >= total contas pendentes)
        total_contas = float(plano.get("total_contas", 0))
        caixa_inicial = float(plano.get("caixa_inicial", 0))
        objetivo_cumprido = (total_faturado + caixa_inicial) >= total_contas * 0.95  # 95% = cumprido

        if objetivo_cumprido and compromissos:
            supabase.table("plano_ativo").update({"status": "concluido"}).eq("id", plano["id"]).execute()

        dias_detalhes = []
        for c in compromissos:
            fat = faturado_por_dia.get(c["data"], 0)
            meta = float(c["meta_bruta"])
            dt = _dt.date.fromisoformat(c["data"])
            NOMES = ["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"]
            dias_detalhes.append({
                "data": c["data"],
                "nome_dia": NOMES[dt.weekday()],
                "meta_bruta": meta,
                "faturado": fat,
                "pct": round(fat / max(meta, 1) * 100),
                "status": "batido" if fat >= meta*0.85 else ("hoje" if c["data"] == hoje.isoformat() else ("perdido" if c["data"] < hoje.isoformat() else "pendente"))
            })

        return {
            "tem_plano": True,
            "plano": plano,
            "compromissos": dias_detalhes,
            "resumo": {
                "total_meta_bruto": round(total_meta),
                "total_faturado": round(total_faturado),
                "pct_geral": pct_geral,
                "objetivo_cumprido": objetivo_cumprido,
                "dias_total": len(compromissos),
                "dias_batidos": sum(1 for d in dias_detalhes if d["status"] == "batido")
            }
        }
    except Exception as e:
        return {"tem_plano": False, "erro": str(e)}


# ─── GERADOR DE PDF MENSAL ─────────────────────────────────────────────────────
@app.post("/relatorio-pdf")
async def gerar_relatorio_pdf(dados: dict = Body(...), uid: str = Depends(get_uid_from_token)):
    if dados.get("motorista_id") != uid: raise HTTPException(status_code=403, detail="Acesso negado")
    try:
        import io, datetime as _dt
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.lib.styles import ParagraphStyle
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
        from reportlab.lib.units import mm
        from fastapi.responses import StreamingResponse

        import calendar as _cal
        mid = dados.get("motorista_id")
        tipo = dados.get("tipo", "mes")  # mes | semana | ano

        if not mid:
            return {"erro": "motorista_id obrigatório"}

        # Define período conforme tipo
        if tipo == "semana":
            inicio = dados.get("inicio")
            fim = dados.get("fim")
            if not inicio or not fim:
                return {"erro": "inicio e fim obrigatórios para semana"}
            ano = inicio[:4]
            label_periodo = f"Semana {inicio} a {fim}"
            # Para comparação: semana anterior
            dt_ini = _dt.date.fromisoformat(inicio)
            ini_ant = (dt_ini - _dt.timedelta(days=7)).isoformat()
            fim_ant = (dt_ini - _dt.timedelta(days=1)).isoformat()
        elif tipo == "ano":
            ano = str(dados.get("ano", _dt.date.today().year))
            inicio = f"{ano}-01-01"
            fim = f"{ano}-12-31"
            label_periodo = f"Ano {ano}"
            ini_ant = f"{int(ano)-1}-01-01"
            fim_ant = f"{int(ano)-1}-12-31"
        else:  # mes (padrão)
            mes = dados.get("mes")
            if not mes:
                return {"erro": "mes obrigatório"}
            ano, mes_num = mes.split("-")
            inicio = f"{mes}-01"
            ultimo_dia = _cal.monthrange(int(ano), int(mes_num))[1]
            fim = f"{mes}-{ultimo_dia:02d}"
            NOMES_MESES_B = ["","Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"]
            label_periodo = f"{NOMES_MESES_B[int(mes_num)]} {ano}"
            dt_mes = _dt.date(int(ano), int(mes_num), 1)
            dt_ant = (dt_mes - _dt.timedelta(days=1)).replace(day=1)
            mes_ant = dt_ant.strftime("%Y-%m")
            ultimo_ant = _cal.monthrange(dt_ant.year, dt_ant.month)[1]
            ini_ant = f"{mes_ant}-01"
            fim_ant = f"{mes_ant}-{ultimo_ant:02d}"

        # Busca lançamentos do período
        lanc_res = supabase.table("lancamentos").select("*").eq("motorista_id", mid).gte("data", inicio).lte("data", fim).order("data").execute()
        lancs = lanc_res.data or []

        # Busca período anterior para comparação
        lanc_ant = supabase.table("lancamentos").select("*").eq("motorista_id", mid).gte("data", ini_ant).lte("data", fim_ant).execute()
        lancs_ant = lanc_ant.data or []

        # Busca contas
        contas_res = supabase.table("contas").select("*").eq("motorista_id", mid).execute()
        contas = contas_res.data or []

        # Cálculos mês atual
        RENDA_EXTRA = ['seguro_desemprego','freelance','aluguel_recebido','venda','emprestimo_recebido','bonus','renda_extra']
        ganhos = sum(float(l["valor"]) for l in lancs if l["tipo"] == "ganho")
        ganhos_app = sum(float(l["valor"]) for l in lancs if l["tipo"] == "ganho" and (l.get("plataforma","") or "") not in RENDA_EXTRA)
        ganhos_extra = sum(float(l["valor"]) for l in lancs if l["tipo"] == "ganho" and (l.get("plataforma","") or "") in RENDA_EXTRA)
        despesas = sum(float(l["valor"]) for l in lancs if l["tipo"] == "despesa")
        lucro = ganhos - despesas
        dias_trab = len(set(l["data"] for l in lancs if l["tipo"] == "ganho"))
        media_dia = ganhos_app / max(dias_trab, 1)

        # Cálculos mês anterior
        ganhos_ant = sum(float(l["valor"]) for l in lancs_ant if l["tipo"] == "ganho")
        despesas_ant = sum(float(l["valor"]) for l in lancs_ant if l["tipo"] == "despesa")
        lucro_ant = ganhos_ant - despesas_ant

        # Por categoria
        cats = {}
        for l in lancs:
            if l["tipo"] == "despesa":
                k = l.get("descricao") or "outros"
                cats[k] = cats.get(k, 0) + float(l["valor"])

        # Contas
        contas_pagas = [c for c in contas if c.get("pago")]
        contas_pend = [c for c in contas if not c.get("pago")]

        def fmt(v): return f"R$ {float(v):,.2f}".replace(",","X").replace(".",",").replace("X",".")
        def delta(atual, ant):
            if ant == 0: return ""
            pct = (atual - ant) / ant * 100
            sinal = "▲" if pct >= 0 else "▼"
            return f"{sinal} {abs(pct):.0f}% vs mês anterior"

        nome_mes = label_periodo

        # ── Monta PDF ──
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4,
            leftMargin=18*mm, rightMargin=18*mm, topMargin=20*mm, bottomMargin=18*mm)

        AMARELO  = colors.HexColor("#F5A623")
        AMARELO2 = colors.HexColor("#FFF3D0")
        VERDE    = colors.HexColor("#16A34A")
        VERDE2   = colors.HexColor("#DCFCE7")
        VERMELHO = colors.HexColor("#DC2626")
        VERMELHO2= colors.HexColor("#FEE2E2")
        CINZA    = colors.HexColor("#6B7280")
        CINZA2   = colors.HexColor("#F3F4F6")
        CINZA3   = colors.HexColor("#E5E7EB")
        AZUL     = colors.HexColor("#6366F1")
        PRETO    = colors.HexColor("#111111")
        BRANCO   = colors.white

        def estilo(nome, **kw):
            base = {"fontName":"Helvetica","fontSize":10,"textColor":PRETO,"leading":14}
            base.update(kw)
            return ParagraphStyle(nome, **base)

        titulo_style = estilo("titulo", fontSize=22, fontName="Helvetica-Bold", textColor=AMARELO, spaceAfter=1, leading=26)
        app_name_style= estilo("appname", fontSize=22, fontName="Helvetica-Bold", textColor=PRETO, spaceAfter=1, leading=26)
        sub_style    = estilo("sub", fontSize=10, textColor=CINZA, spaceAfter=14, leading=14)
        secao_style  = estilo("secao", fontSize=12, fontName="Helvetica-Bold", textColor=PRETO, spaceBefore=16, spaceAfter=8, leading=16)
        normal_style = estilo("normal", fontSize=9, textColor=colors.HexColor("#333333"), leading=14)
        delta_style  = estilo("delta", fontSize=8, textColor=CINZA, leading=12)
        aviso_style  = estilo("aviso", fontSize=9, textColor=colors.HexColor("#D97706"), leading=13)
        rodape_style = estilo("rodape", fontSize=8, textColor=CINZA, alignment=1)

        story = []

        # ── Cabeçalho elegante ──
        from reportlab.platypus import Table as _T
        header_data = [[
            Paragraph("<font color='#F5A623'><b>Painel</b></font><b>.IA</b>", estilo("hdr_logo", fontSize=24, fontName="Helvetica-Bold", textColor=PRETO, leading=28)),
            Paragraph(
                f"<b>Relatório Financeiro</b><br/><font color='#6B7280'>{nome_mes}</font><br/><font color='#6B7280' size='8'>Gerado em {_dt.date.today().strftime('%d/%m/%Y')}</font>",
                estilo("hdr_info", fontSize=11, fontName="Helvetica-Bold", textColor=PRETO, alignment=2, leading=16)
            )
        ]]
        hdr_table = _T(header_data, colWidths=[90*mm, 90*mm])
        hdr_table.setStyle(TableStyle([
            ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
            ("PADDING", (0,0), (-1,-1), 0),
            ("LINEBELOW", (0,0), (-1,0), 2.5, AMARELO),
        ]))
        story.append(hdr_table)
        story.append(Spacer(1, 14))

        # ── Resumo mensal (cards em linha) ──
        story.append(Paragraph("Resumo do Mês", secao_style))

        def card_cor(v, positivo=True):
            if positivo: return VERDE2 if v >= 0 else VERMELHO2
            return VERMELHO2

        resumo_data = [
            ["", Paragraph("<b>Este mês</b>", normal_style),
                 Paragraph("<b>Mês anterior</b>", normal_style),
                 Paragraph("<b>Variação</b>", normal_style)],
            [Paragraph("■ Ganhos totais", normal_style),
             Paragraph(f"<font color='#16A34A'><b>{fmt(ganhos)}</b></font>", normal_style),
             Paragraph(f"{fmt(ganhos_ant)}", normal_style),
             Paragraph(delta(ganhos, ganhos_ant), delta_style)],
            [Paragraph("■ Despesas", normal_style),
             Paragraph(f"<font color='#DC2626'><b>{fmt(despesas)}</b></font>", normal_style),
             Paragraph(f"{fmt(despesas_ant)}", normal_style),
             Paragraph(delta(despesas, despesas_ant), delta_style)],
            [Paragraph("■ Lucro líquido", normal_style),
             Paragraph(f"<font color='{'#16A34A' if lucro>=0 else '#DC2626'}'><b>{fmt(lucro)}</b></font>", normal_style),
             Paragraph(f"{fmt(lucro_ant)}", normal_style),
             Paragraph(delta(lucro, lucro_ant), delta_style)],
            [Paragraph("■ Dias trabalhados", normal_style),
             Paragraph(f"<b>{dias_trab}</b>", normal_style), "", ""],
            [Paragraph("■ Média/dia (apps)", normal_style),
             Paragraph(f"<font color='#D97706'><b>{fmt(media_dia)}</b></font>", normal_style), "", ""],
        ]
        if ganhos_app > 0 and ganhos_extra > 0:
            resumo_data += [
                [Paragraph("  ↳ Apps (Uber/99/inDrive)", normal_style),
                 Paragraph(f"<font color='#16A34A'>{fmt(ganhos_app)}</font>", normal_style), "", ""],
                [Paragraph("  ↳ Renda extra", normal_style),
                 Paragraph(f"<font color='#6366F1'>{fmt(ganhos_extra)}</font>", normal_style), "", ""],
            ]
        t = Table(resumo_data, colWidths=[52*mm, 42*mm, 42*mm, 44*mm])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0,0), (-1,0), CINZA2),
            ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
            ("FONTSIZE", (0,0), (-1,-1), 9),
            ("ROWBACKGROUNDS", (0,1), (-1,-1), [BRANCO, CINZA2]),
            ("GRID", (0,0), (-1,-1), 0.4, CINZA3),
            ("PADDING", (0,0), (-1,-1), 7),
            ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
            ("ROUNDEDCORNERS", [4, 4, 4, 4]),
        ]))
        story.append(t)
        story.append(Spacer(1, 4))

        # Despesas por categoria
        if cats:
            story.append(Paragraph("Despesas por Categoria", secao_style))
            total_desp = sum(cats.values())
            cats_sorted = sorted(cats.items(), key=lambda x: x[1], reverse=True)
            NOMES_CAT = {
                'combustivel':'Combustível','pedagio':'Pedágio/Estac.','manutencao':'Manutenção',
                'lavagem':'Lavagem','acessorio_carro':'Acessório Carro','aluguel_carro':'Aluguel Carro',
                'financiamento':'Financiamento','seguro':'Seguro','ipva':'IPVA/Licenc.',
                'multa':'Multa Trânsito','multa_app':'Multa do App','mercado':'Mercado',
                'restaurante':'Restaurante','lanche':'Lanche/Café','farmacia':'Farmácia',
                'saude':'Saúde/Plano','higiene':'Higiene','aluguel_casa':'Aluguel Casa',
                'condominio':'Condomínio','luz_agua':'Luz/Água/Gás','presente_familia':'Presente/Família',
                'roupa':'Roupas','celular':'Celular','internet':'Internet','streaming':'Streaming',
                'emprestimo':'Empréstimo','investimento':'Investimento','lazer':'Lazer',
                'educacao':'Educação','outros':'Outros','desconhecido':'Não identificado',
            }
            cat_data = [["Categoria", "Valor", "% do total"]]
            for k, v in cats_sorted:
                nome_cat = NOMES_CAT.get(k, k.replace("_"," ").title())
                pct = v / total_desp * 100 if total_desp > 0 else 0
                cat_data.append([nome_cat, fmt(v), f"{pct:.1f}%"])
            cat_data.append(["TOTAL", fmt(total_desp), "100%"])
            tc = Table(cat_data, colWidths=[90*mm, 45*mm, 35*mm])
            tc.setStyle(TableStyle([
                ("BACKGROUND", (0,0), (-1,0), CINZA2),
                ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
                ("FONTNAME", (0,-1), (-1,-1), "Helvetica-Bold"),
                ("BACKGROUND", (0,-1), (-1,-1), AMARELO2),
                ("FONTSIZE", (0,0), (-1,-1), 9),
                ("ROWBACKGROUNDS", (0,1), (-1,-2), [BRANCO, CINZA2]),
                ("GRID", (0,0), (-1,-1), 0.4, CINZA3),
                ("PADDING", (0,0), (-1,-1), 7),
                ("TEXTCOLOR", (1,1), (1,-2), VERMELHO),
                ("ALIGN", (1,0), (-1,-1), "RIGHT"),
                ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
            ]))
            story.append(tc)
            story.append(Spacer(1, 8))

        # Lista de lançamentos
        story.append(Paragraph("Todos os Lançamentos", secao_style))
        lancs_ord = sorted(lancs, key=lambda x: x["data"])
        lanc_data = [["Data", "Tipo", "Descrição/Plataforma", "Valor"]]
        for l in lancs_ord:
            data_fmt = "/".join(reversed(l["data"].split("-")))
            tipo_str = "Ganho" if l["tipo"] == "ganho" else "Despesa"
            desc = (l.get("plataforma") or l.get("descricao") or "-").title()
            val = float(l["valor"])
            sinal = "+" if l["tipo"] == "ganho" else "-"
            lanc_data.append([data_fmt, tipo_str, desc, f"{sinal}{fmt(val)}"])
        tl = Table(lanc_data, colWidths=[22*mm, 22*mm, 90*mm, 36*mm])
        tl.setStyle(TableStyle([
            ("BACKGROUND", (0,0), (-1,0), CINZA2),
            ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
            ("FONTSIZE", (0,0), (-1,-1), 8),
            ("ROWBACKGROUNDS", (0,1), (-1,-1), [BRANCO, CINZA2]),
            ("GRID", (0,0), (-1,-1), 0.4, CINZA3),
            ("PADDING", (0,0), (-1,-1), 6),
            ("ALIGN", (3,0), (3,-1), "RIGHT"),
            ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ]))
        for i, l in enumerate(lancs_ord, 1):
            cor = VERDE if l["tipo"] == "ganho" else VERMELHO
            tl.setStyle(TableStyle([
                ("TEXTCOLOR", (3,i), (3,i), cor),
                ("FONTNAME", (3,i), (3,i), "Helvetica-Bold"),
            ]))
        story.append(tl)
        story.append(Spacer(1, 8))

        # Contas
        if contas:
            story.append(Paragraph("Contas do Mês", secao_style))
            contas_ord = sorted(contas, key=lambda x: x.get("vencimento","") or "")
            contas_data = [["Conta", "Vencimento", "Valor", "Status"]]
            for c in contas_ord:
                nome_c = c.get("descricao","") or c.get("nome","")
                venc = c.get("vencimento","") or ""
                if venc: venc = "/".join(reversed(venc.split("-")))
                val_c = fmt(float(c.get("valor",0)))
                status = "Pago" if c.get("pago") else "Pendente"
                contas_data.append([nome_c, venc, val_c, status])
            tc2 = Table(contas_data, colWidths=[72*mm, 28*mm, 40*mm, 30*mm])
            tc2.setStyle(TableStyle([
                ("BACKGROUND", (0,0), (-1,0), CINZA2),
                ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
                ("FONTSIZE", (0,0), (-1,-1), 9),
                ("ROWBACKGROUNDS", (0,1), (-1,-1), [BRANCO, CINZA2]),
                ("GRID", (0,0), (-1,-1), 0.4, CINZA3),
                ("PADDING", (0,0), (-1,-1), 7),
                ("ALIGN", (2,0), (2,-1), "RIGHT"),
                ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
            ]))
            for i, c in enumerate(contas_ord, 1):
                cor = VERDE if c.get("pago") else VERMELHO
                tc2.setStyle(TableStyle([("TEXTCOLOR",(3,i),(3,i),cor),("FONTNAME",(3,i),(3,i),"Helvetica-Bold")]))
            story.append(tc2)
            story.append(Spacer(1, 8))

        # Rodapé
        story.append(Spacer(1, 10))
        story.append(HRFlowable(width="100%", thickness=0.5, color=CINZA3))
        story.append(Spacer(1, 6))
        story.append(Paragraph(f"Painel.IA  ·  Relatório gerado em {_dt.date.today().strftime('%d/%m/%Y')}  ·  Valores em BRL", rodape_style))

        doc.build(story)
        buffer.seek(0)
        label_arquivo = label_periodo.replace(" ","_").replace("/","-")
        nome_arquivo = f"relatorio_{label_arquivo}.pdf"
        return StreamingResponse(buffer, media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{nome_arquivo}"',
                "Content-Type": "application/pdf",
                "X-Content-Type-Options": "nosniff"
            })
    except Exception as e:
        import traceback
        print(f"ERRO PDF: {traceback.format_exc()}")
        return {"erro": "Erro interno ao gerar relatório"}
