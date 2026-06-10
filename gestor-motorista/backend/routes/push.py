"""Rotas de push notifications."""
from fastapi import APIRouter, Body
from core.supabase_client import supabase
from core.config import VAPID_PUBLIC_KEY, VAPID_EMAIL
from fastapi import Depends, HTTPException
from core.security import _valid_uuid, get_uid_from_token
from core.logging import log_info, log_erro
from services.push_service import _disparar_push_todos, _scheduler

router = APIRouter()

@router.get("/push-diagnostico")
async def push_diagnostico(uid: str = Depends(get_uid_from_token)):
    """Verifica se tudo está ok para push."""
    resultado = {}
    # 1. Verifica tabela
    try:
        r = supabase.table("push_subscriptions").select("id").limit(1).execute()
        resultado["tabela_push_subscriptions"] = "OK"
        resultado["total_subscriptions"] = len(supabase.table("push_subscriptions").select("id").execute().data or [])
    except Exception as e:
        resultado["tabela_push_subscriptions"] = f"ERRO: {str(e)[:100]}"
    # 2. Verifica VAPID
    resultado["vapid_public"] = VAPID_PUBLIC_KEY[:20] + "..."
    resultado["vapid_email"] = VAPID_EMAIL
    # 3. Scheduler
    resultado["scheduler_rodando"] = _scheduler.running
    resultado["jobs"] = [j.id for j in _scheduler.get_jobs()]
    return resultado

@router.get("/vapid-public-key")
def get_vapid_key():
    return {"key": VAPID_PUBLIC_KEY}

@router.post("/push-subscribe")
async def push_subscribe(dados: dict = Body(...), uid: str = Depends(get_uid_from_token)):
    motorista_id = uid  # sempre do token
    subscription = dados.get("subscription")
    if not motorista_id or not subscription:
        return {"ok": False, "erro": "Dados incompletos"}
    try:
        endpoint = subscription.get("endpoint", "")[:500]
        ex = supabase.table("push_subscriptions").select("id").eq("motorista_id", motorista_id).eq("endpoint", endpoint).execute()
        if ex.data:
            supabase.table("push_subscriptions").update({"subscription": subscription}).eq("id", ex.data[0]["id"]).execute()
        else:
            supabase.table("push_subscriptions").insert({"motorista_id": motorista_id, "endpoint": endpoint, "subscription": subscription}).execute()
        log_info("push_subscribe_ok", motorista_id=motorista_id)
        return {"ok": True}
    except Exception as e:
        log_erro("push_subscribe_erro", err=str(e))
        return {"ok": False, "erro": str(e)}

@router.delete("/push-unsubscribe")
async def push_unsubscribe(dados: dict = Body(...), uid: str = Depends(get_uid_from_token)):
    try:
        supabase.table("push_subscriptions").delete().eq("motorista_id", uid).eq("endpoint", dados.get("endpoint","")[:500]).execute()
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "erro": str(e)}

@router.post("/push-teste")
async def push_teste_manual(dados: dict = Body(...), uid: str = Depends(get_uid_from_token)):
    mid = uid  # sempre do token
    if not mid: return {"ok": False}
    await _disparar_push_todos("Painel.IA — Teste 🧪", "Funcionou! Notificacoes ativas ✅", "/", "teste-manual", apenas_motorista_id=mid)
    return {"ok": True}

@router.get("/push-teste-agora/{mid}")
async def push_teste_agora(mid: str, uid: str = Depends(get_uid_from_token)):
    """Dispara notificacao de teste imediatamente para um motorista — so para debug"""
    if mid != uid: return {"ok": False, "erro": "Acesso negado"}
    if not _valid_uuid(mid): return {"ok": False, "erro": "ID invalido"}
    await _disparar_push_todos("Painel.IA — Teste 🧪", "Funcionou! Notificacoes ativas ✅", "/", "teste-agora", apenas_motorista_id=mid)
    return {"ok": True, "mid": mid}

