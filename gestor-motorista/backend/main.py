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
