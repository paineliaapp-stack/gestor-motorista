# ── Painel.IA — app principal ────────────────────────────────────────────────
# Refatorado: este arquivo só cria o app, registra middlewares e inclui os
# routers. Toda a lógica vive em core/, services/, prompts/ e routes/.
from dotenv import load_dotenv
load_dotenv()
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
import time as _time_module

from core.logging import log_info, log_warn, log_erro
from core.config import _ALLOWED_ORIGINS
from services import push_service

app = FastAPI(title="Painel.IA API", docs_url=None, redoc_url=None, openapi_url=None)


# NOTA: o main.py original registrava DOIS SecurityHeadersMiddleware (a classe
# era redefinida e adicionada de novo). Ambos rodavam. Mantido idêntico para
# não alterar comportamento.
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


@app.on_event("startup")
async def startup_scheduler():
    await push_service.startup_scheduler()
    # Scheduler de assinaturas: verifica expiração a cada hora
    import asyncio
    asyncio.ensure_future(_scheduler_assinaturas())

async def _scheduler_assinaturas():
    import asyncio
    import datetime as _dt
    from core.supabase_client import supabase
    from core.logging import log_info, log_erro
    from services.email_service import email_trial_expirando, email_trial_expirado, email_pagamento_falhou
    import os, httpx

    await asyncio.sleep(30)  # aguarda app estabilizar

    while True:
        try:
            agora = _dt.datetime.now(_dt.timezone.utc)

            # 1. Bloquear assinaturas pagas vencidas (periodo_fim no passado)
            vencidas = supabase.table("assinaturas").select("id,motorista_id,plano_id,periodo_fim,email_pagamento").eq("status", "active").lt("periodo_fim", agora.isoformat()).execute()
            for ass in (vencidas.data or []):
                try:
                    supabase.table("assinaturas").update({"status": "expired", "atualizado_em": agora.isoformat()}).eq("id", ass["id"]).execute()
                    log_info("assinatura_expirada", motorista_id=ass["motorista_id"])
                    # Email avisando que expirou
                    email = ass.get("email_pagamento") or ""
                    if not email:
                        _url = os.getenv("SUPABASE_URL",""); _key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_KEY","")
                        async with httpx.AsyncClient(timeout=8) as c:
                            r = await c.get(f"{_url}/auth/v1/admin/users/{ass['motorista_id']}", headers={"apikey":_key,"Authorization":f"Bearer {_key}"})
                            if r.status_code == 200: email = r.json().get("email","")
                    if email:
                        await email_pagamento_falhou(email, "motorista")
                except Exception as e:
                    log_erro("scheduler_expirar_erro", erro=e)

            # 2. Trial expirando em 6h — mandar aviso
            em_6h = (agora + _dt.timedelta(hours=6)).isoformat()
            expirando = supabase.table("assinaturas").select("id,motorista_id,trial_fim,email_pagamento").eq("status","trial").lt("trial_fim", em_6h).gt("trial_fim", agora.isoformat()).eq("email_expirando_enviado", False).execute()
            for ass in (expirando.data or []):
                try:
                    email = ass.get("email_pagamento") or ""
                    if not email:
                        _url = os.getenv("SUPABASE_URL",""); _key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_KEY","")
                        async with httpx.AsyncClient(timeout=8) as c:
                            r = await c.get(f"{_url}/auth/v1/admin/users/{ass['motorista_id']}", headers={"apikey":_key,"Authorization":f"Bearer {_key}"})
                            if r.status_code == 200: email = r.json().get("email","")
                    if email:
                        tf = _dt.datetime.fromisoformat(str(ass["trial_fim"]).replace("Z","+00:00"))
                        horas = max(1, int((tf - agora).total_seconds() / 3600))
                        await email_trial_expirando(email, "motorista", horas)
                    supabase.table("assinaturas").update({"email_expirando_enviado": True}).eq("id", ass["id"]).execute()
                except Exception as e:
                    log_erro("scheduler_trial_expirando_erro", erro=e)

            # 3. Trial expirado — bloquear e mandar email
            expirados = supabase.table("assinaturas").select("id,motorista_id,trial_fim,email_pagamento").eq("status","trial").lt("trial_fim", agora.isoformat()).execute()
            for ass in (expirados.data or []):
                try:
                    supabase.table("assinaturas").update({"status":"expired","atualizado_em":agora.isoformat()}).eq("id",ass["id"]).execute()
                    email = ass.get("email_pagamento") or ""
                    if not email:
                        _url = os.getenv("SUPABASE_URL",""); _key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_KEY","")
                        async with httpx.AsyncClient(timeout=8) as c:
                            r = await c.get(f"{_url}/auth/v1/admin/users/{ass['motorista_id']}", headers={"apikey":_key,"Authorization":f"Bearer {_key}"})
                            if r.status_code == 200: email = r.json().get("email","")
                    if email:
                        await email_trial_expirado(email, "motorista")
                    log_info("trial_expirado", motorista_id=ass["motorista_id"])
                except Exception as e:
                    log_erro("scheduler_trial_expirado_erro", erro=e)

            log_info("scheduler_assinaturas_ok", vencidas=len(vencidas.data or []), expirando=len(expirando.data or []), expirados=len(expirados.data or []))
        except Exception as e:
            log_erro("scheduler_assinaturas_erro", erro=e)

        await asyncio.sleep(3600)  # roda a cada 1 hora


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        t0 = _time_module.time()
        try:
            response = await call_next(request)
        except Exception as e:
            log_erro("requisicao_erro", erro=e, path=request.url.path)
            raise
        ms = int((_time_module.time() - t0) * 1000)
        status = response.status_code
        path = request.url.path
        if ms > 3000:
            log_warn("requisicao_lenta", path=path, ms=ms, status=status)
        elif status >= 500:
            log_erro("requisicao_500", path=path, ms=ms)
        elif status >= 400 and path not in ("/favicon.ico", "/robots.txt"):
            log_warn("requisicao_4xx", path=path, ms=ms, status=status)
        else:
            log_info("req", path=path, ms=ms, status=status)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["X-Response-Time"] = f"{ms}ms"
        return response

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
    allow_credentials=False,
)


# wrapper global para capturar qualquer exceção não tratada no /chat
@app.exception_handler(Exception)
async def generic_exception_handler(request, exc):
    import traceback
    log_erro("erro_global", erro=exc)
    traceback.print_exc()
    from fastapi.responses import JSONResponse
    tb = traceback.format_exc()
    return JSONResponse(status_code=500, content={"resposta": f"Erro: {str(exc)[:200]}", "acao": None, "erro": str(exc), "trace": tb[-300:]})


# ── Routers por domínio ──────────────────────────────────────────────────────
from routes import (
    sistema, push, motoristas, metas, lancamentos, resumo,
    contas, plano, chat, webhook, relatorios, clima, integracoes, billing, admin, competicao, planejador,
)

app.include_router(push.router)
app.include_router(sistema.router)
app.include_router(motoristas.router)
app.include_router(metas.router)
app.include_router(lancamentos.router)
app.include_router(resumo.router)
app.include_router(contas.router)
app.include_router(plano.router)
app.include_router(chat.router)
app.include_router(webhook.router)
app.include_router(relatorios.router)
app.include_router(clima.router)
app.include_router(integracoes.router)  # desligado por flag INTEGRACOES_ATIVAS
app.include_router(billing.router)
app.include_router(admin.router)
app.include_router(competicao.router)
app.include_router(planejador.router)
