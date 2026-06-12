"""Billing: trial 24h, planos, checkout MercadoPago (preapproval) e webhook.

Tudo via httpx — sem SDK extra. Envs: MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET (opcional).
Endpoints degradam graciosamente: sem tabela/env, retornam estado seguro em vez de 500.
"""
import os
import asyncio
import datetime as _dt
import httpx
from fastapi import APIRouter, Body, Depends, Request, HTTPException
from core.supabase_client import supabase
from core.security import get_uid_from_token
from core.logging import log_info, log_warn, log_erro

router = APIRouter()

_MP_API = "https://api.mercadopago.com"
_APP_URL = "https://gestor-motorista-production.up.railway.app"
_PRECOS = {"fundador": 19.00, "pro": 29.00}
_NOMES = {"fundador": "Plano Fundador", "pro": "Plano Pro"}


def _agora():
    return _dt.datetime.now(_dt.timezone.utc)


def _vagas_fundador() -> int:
    try:
        r = supabase.table("planos").select("vagas_restantes").eq("id", "fundador").execute()
        return int((r.data or [{}])[0].get("vagas_restantes") or 0)
    except Exception as e:
        log_erro("vagas_erro", erro=e)
        return 0


async def _email_do_usuario(uid: str) -> str:
    """Busca o email no Supabase Auth via admin API."""
    try:
        url = os.getenv("SUPABASE_URL", "")
        key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_KEY", "")
        async with httpx.AsyncClient(timeout=8) as c:
            r = await c.get(f"{url}/auth/v1/admin/users/{uid}",
                            headers={"apikey": key, "Authorization": f"Bearer {key}"})
            return (r.json() or {}).get("email", "") if r.status_code == 200 else ""
    except Exception:
        return ""


def _nome_do_motorista(uid: str) -> str:
    try:
        r = supabase.table("motoristas").select("nome").eq("id", uid).execute()
        return (r.data or [{}])[0].get("nome") or "motorista"
    except Exception:
        return "motorista"


@router.get("/billing/vagas-fundador")
async def vagas_fundador():
    return {"vagas": _vagas_fundador()}


@router.get("/billing/status")
async def billing_status(uid: str = Depends(get_uid_from_token)):
    try:
        r = supabase.table("assinaturas").select("*").eq("motorista_id", uid).order("criado_em", desc=True).limit(1).execute()
        ass = (r.data or [None])[0]
    except Exception as e:
        # Tabela ainda não existe → não bloquear ninguém
        log_erro("billing_status_erro", erro=e)
        return {"status": "trial", "plano": None, "trial_restante_ms": 86400000,
                "trial_expira_em": None, "pode_usar": True, "vagas_fundador": 50}

    if ass is None:
        trial_fim = _agora() + _dt.timedelta(hours=24)
        try:
            supabase.table("assinaturas").insert({
                "motorista_id": uid, "plano_id": "fundador", "status": "trial",
                "trial_fim": trial_fim.isoformat(),
            }).execute()
        except Exception as e:
            log_erro("trial_criar_erro", erro=e)
        # Email de boas-vindas em background — nunca atrasa a resposta
        async def _bg():
            email = await _email_do_usuario(uid)
            if email:
                from services.email_service import email_boas_vindas
                await email_boas_vindas(email, _nome_do_motorista(uid))
        asyncio.ensure_future(_bg())
        return {"status": "trial", "plano": None, "trial_restante_ms": 86400000,
                "trial_expira_em": trial_fim.isoformat(), "pode_usar": True,
                "vagas_fundador": _vagas_fundador()}

    status = ass.get("status", "trial")
    trial_fim_raw = ass.get("trial_fim")
    restante_ms = 0
    if trial_fim_raw:
        try:
            tf = _dt.datetime.fromisoformat(str(trial_fim_raw).replace("Z", "+00:00"))
            restante_ms = max(0, int((tf - _agora()).total_seconds() * 1000))
        except Exception:
            pass

    if status == "trial" and restante_ms <= 0:
        status = "expired"
        try:
            supabase.table("assinaturas").update({"status": "expired", "atualizado_em": _agora().isoformat()}).eq("id", ass["id"]).execute()
        except Exception:
            pass

    return {
        "status": status,
        "plano": ass.get("plano_id") if status in ("active", "ativo") else None,
        "trial_restante_ms": restante_ms if status == "trial" else 0,
        "trial_expira_em": trial_fim_raw,
        "pode_usar": status in ("trial", "active", "ativo"),  # bloqueado/expired/cancelled = False
        "vagas_fundador": _vagas_fundador(),
    }


@router.post("/billing/criar-checkout")
async def criar_checkout(dados: dict = Body(...), uid: str = Depends(get_uid_from_token)):
    plano_id = dados.get("plano_id", "fundador")
    email = (dados.get("email") or "").strip().lower()
    if plano_id not in _PRECOS:
        raise HTTPException(status_code=400, detail="Plano inválido")
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Email inválido")
    if plano_id == "fundador" and _vagas_fundador() <= 0:
        return {"erro": "Vagas do Plano Fundador esgotadas"}

    token = os.getenv("MP_ACCESS_TOKEN", "")
    if not token:
        return {"erro": "Pagamento ainda não configurado — tente em instantes"}

    payload = {
        "reason": f"Painel.IA — {_NOMES[plano_id]}",
        "external_reference": f"{uid}|{plano_id}",
        "payer_email": email,
        "auto_recurring": {
            "frequency": 1, "frequency_type": "months",
            "transaction_amount": _PRECOS[plano_id], "currency_id": "BRL",
        },
        "back_url": f"{_APP_URL}/?pagamento=retorno",
        "status": "pending",
    }
    try:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.post(f"{_MP_API}/preapproval",
                             headers={"Authorization": f"Bearer {token}"}, json=payload)
            data = r.json()
        if r.status_code >= 400 or "init_point" not in data:
            log_warn("mp_checkout_falhou", status=r.status_code, body=str(data)[:300])
            return {"erro": "Não foi possível iniciar o pagamento — tente novamente"}
        # Guarda referência na assinatura mais recente do usuário
        try:
            supabase.table("assinaturas").update({
                "mp_subscription_id": data.get("id"), "email_pagamento": email,
                "plano_id": plano_id, "atualizado_em": _agora().isoformat(),
            }).eq("motorista_id", uid).execute()
        except Exception as e:
            log_erro("checkout_save_erro", erro=e)
        log_info("checkout_criado", uid=uid, plano=plano_id)
        return {"init_point": data["init_point"]}
    except Exception as e:
        log_erro("mp_checkout_erro", erro=e)
        return {"erro": "Falha de conexão com o pagamento"}


@router.post("/billing/webhook")
@router.get("/billing/webhook")
async def billing_webhook(request: Request):
    """Notificações do MercadoPago. Busca o recurso na API para confirmar o estado real."""
    token = os.getenv("MP_ACCESS_TOKEN", "")
    try:
        body = {}
        try:
            body = await request.json()
        except Exception:
            pass
        params = dict(request.query_params)
        topic = body.get("type") or body.get("topic") or params.get("type") or params.get("topic") or ""
        rid = (body.get("data") or {}).get("id") or params.get("data.id") or params.get("id") or ""
        log_info("mp_webhook", topic=topic, rid=str(rid)[:40])
        if not token or not rid:
            return {"ok": True}

        if "preapproval" in topic or "subscription" in topic:
            async with httpx.AsyncClient(timeout=12) as c:
                r = await c.get(f"{_MP_API}/preapproval/{rid}", headers={"Authorization": f"Bearer {token}"})
                pre = r.json() if r.status_code == 200 else {}
            ext = pre.get("external_reference", "")
            mp_status = pre.get("status", "")
            if "|" in ext:
                uid, plano_id = ext.split("|", 1)
                if mp_status == "authorized":
                    # Ativa — decrementa vaga só na transição
                    try:
                        atual = supabase.table("assinaturas").select("id,status").eq("motorista_id", uid).order("criado_em", desc=True).limit(1).execute()
                        ja_ativo = (atual.data or [{}])[0].get("status") == "active"
                        supabase.table("assinaturas").update({
                            "status": "active", "plano_id": plano_id,
                            "periodo_inicio": _agora().isoformat(),
                            "mp_subscription_id": str(rid),
                            "atualizado_em": _agora().isoformat(),
                        }).eq("motorista_id", uid).execute()
                        if plano_id == "fundador" and not ja_ativo:
                            v = _vagas_fundador()
                            supabase.table("planos").update({"vagas_restantes": max(0, v - 1)}).eq("id", "fundador").execute()
                    except Exception as e:
                        log_erro("webhook_ativar_erro", erro=e)
                    email = pre.get("payer_email") or await _email_do_usuario(uid)
                    if email:
                        from services.email_service import email_pagamento_confirmado
                        await email_pagamento_confirmado(email, _nome_do_motorista(uid), _NOMES.get(plano_id, plano_id), _PRECOS.get(plano_id, 0))
                elif mp_status in ("cancelled", "paused"):
                    try:
                        supabase.table("assinaturas").update({"status": "cancelled", "atualizado_em": _agora().isoformat()}).eq("motorista_id", uid).execute()
                    except Exception:
                        pass
                    email = pre.get("payer_email") or await _email_do_usuario(uid)
                    if email:
                        from services.email_service import email_pagamento_falhou
                        await email_pagamento_falhou(email, _nome_do_motorista(uid))

        elif topic == "payment":
            async with httpx.AsyncClient(timeout=12) as c:
                r = await c.get(f"{_MP_API}/v1/payments/{rid}", headers={"Authorization": f"Bearer {token}"})
                pg = r.json() if r.status_code == 200 else {}
            ext = pg.get("external_reference", "")
            if "|" in ext:
                uid, _ = ext.split("|", 1)
                try:
                    supabase.table("pagamentos").insert({
                        "motorista_id": uid, "mp_payment_id": str(rid),
                        "valor": pg.get("transaction_amount"), "status": pg.get("status"),
                    }).execute()
                except Exception:
                    pass
    except Exception as e:
        log_erro("webhook_erro", erro=e)
    return {"ok": True}


@router.post("/billing/cancelar")
async def cancelar(uid: str = Depends(get_uid_from_token)):
    token = os.getenv("MP_ACCESS_TOKEN", "")
    try:
        r = supabase.table("assinaturas").select("id,mp_subscription_id").eq("motorista_id", uid).order("criado_em", desc=True).limit(1).execute()
        ass = (r.data or [None])[0]
        if not ass:
            return {"ok": False, "erro": "Sem assinatura"}
        sid = ass.get("mp_subscription_id")
        if sid and token:
            async with httpx.AsyncClient(timeout=12) as c:
                await c.put(f"{_MP_API}/preapproval/{sid}",
                            headers={"Authorization": f"Bearer {token}"},
                            json={"status": "cancelled"})
        supabase.table("assinaturas").update({"status": "cancelled", "atualizado_em": _agora().isoformat()}).eq("id", ass["id"]).execute()
        return {"ok": True}
    except Exception as e:
        log_erro("cancelar_erro", erro=e)
        return {"ok": False, "erro": "Falha ao cancelar"}
