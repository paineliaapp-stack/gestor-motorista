"""Billing: trial automático, status de assinatura, checkout Mercado Pago, webhook."""
import os, httpx, secrets, string
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Body, Depends, HTTPException, Request
from core.supabase_client import supabase, _supabase_url, _supabase_service_key
from core.security import get_uid_from_token
from core.logging import log_info, log_erro

router = APIRouter(prefix="/billing", tags=["billing"])

MP_ACCESS_TOKEN = os.getenv("MP_ACCESS_TOKEN", "")
APP_URL = os.getenv("APP_URL", "https://gestor-motorista-production.up.railway.app")

PLANO_FUNDADOR_PRECO = 1900   # centavos
PLANO_PRO_PRECO      = 2900

# ── Helpers ─────────────────────────────────────────────────────────────────

def _agora():
    return datetime.now(timezone.utc)

def _buscar_assinatura(motorista_id: str):
    res = supabase.table("assinaturas").select("*").eq("motorista_id", motorista_id).order("criado_em", desc=True).limit(1).execute()
    return res.data[0] if res.data else None

def _criar_trial(motorista_id: str) -> dict:
    agora = _agora()
    trial_fim = agora + timedelta(hours=24)
    data = {
        "motorista_id": motorista_id,
        "plano_id": "fundador",
        "status": "trial",
        "trial_inicio": agora.isoformat(),
        "trial_fim": trial_fim.isoformat(),
    }
    res = supabase.table("assinaturas").insert(data).execute()
    return res.data[0]

# ── Rotas ────────────────────────────────────────────────────────────────────

@router.get("/status")
async def billing_status(uid: str = Depends(get_uid_from_token)):
    """Retorna o status atual da assinatura. Cria trial se for primeira vez."""
    try:
        ass = _buscar_assinatura(uid)
        if not ass:
            ass = _criar_trial(uid)
            log_info("trial_criado", motorista_id=uid)

        status = ass["status"]
        agora = _agora()

        # Trial expirou? Atualiza para 'expirado'
        if status == "trial" and ass.get("trial_fim"):
            trial_fim = datetime.fromisoformat(ass["trial_fim"].replace("Z", "+00:00"))
            if agora > trial_fim:
                supabase.table("assinaturas").update({"status": "expirado"}).eq("id", ass["id"]).execute()
                status = "expirado"

        # Assinatura paga expirou?
        if status == "ativo" and ass.get("periodo_fim"):
            periodo_fim = datetime.fromisoformat(ass["periodo_fim"].replace("Z", "+00:00"))
            if agora > periodo_fim:
                supabase.table("assinaturas").update({"status": "expirado"}).eq("id", ass["id"]).execute()
                status = "expirado"

        # Calcular horas restantes do trial
        horas_restantes = None
        if status == "trial" and ass.get("trial_fim"):
            trial_fim = datetime.fromisoformat(ass["trial_fim"].replace("Z", "+00:00"))
            diff = (trial_fim - agora).total_seconds()
            horas_restantes = max(0, int(diff / 3600))

        return {
            "status": status,
            "plano": ass.get("plano_id"),
            "trial_fim": ass.get("trial_fim"),
            "horas_restantes": horas_restantes,
            "periodo_fim": ass.get("periodo_fim"),
        }
    except Exception as e:
        log_erro("billing_status_erro", erro=e)
        # Em caso de erro, retorna trial para não bloquear usuário
        return {"status": "trial", "horas_restantes": 24, "erro": str(e)}


@router.post("/checkout")
async def criar_checkout(
    dados: dict = Body(...),
    uid: str = Depends(get_uid_from_token)
):
    """Cria preferência de pagamento no Mercado Pago e retorna link."""
    plano_id = dados.get("plano_id", "fundador")
    email = dados.get("email", "")

    if not MP_ACCESS_TOKEN:
        raise HTTPException(status_code=503, detail="Pagamento não configurado ainda.")

    preco = PLANO_FUNDADOR_PRECO if plano_id == "fundador" else PLANO_PRO_PRECO
    titulo = "Painel.IA – Plano Fundador" if plano_id == "fundador" else "Painel.IA – Plano Pro"

    payload = {
        "items": [{
            "title": titulo,
            "quantity": 1,
            "unit_price": preco / 100,
            "currency_id": "BRL",
        }],
        "payer": {"email": email} if email else {},
        "back_urls": {
            "success": f"{APP_URL}/?pagamento=sucesso",
            "failure": f"{APP_URL}/?pagamento=falha",
            "pending": f"{APP_URL}/?pagamento=pendente",
        },
        "auto_return": "approved",
        "notification_url": f"{APP_URL}/billing/webhook",
        "external_reference": f"{uid}|{plano_id}",
        "statement_descriptor": "PAINEL.IA",
    }

    try:
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.post(
                "https://api.mercadopago.com/checkout/preferences",
                json=payload,
                headers={"Authorization": f"Bearer {MP_ACCESS_TOKEN}"}
            )
        if r.status_code != 201:
            log_erro("mp_checkout_erro", status=r.status_code, body=r.text[:200])
            raise HTTPException(status_code=502, detail="Erro ao criar pagamento.")

        data = r.json()
        # Salva email na assinatura para remarketing
        if email:
            ass = _buscar_assinatura(uid)
            if ass:
                supabase.table("assinaturas").update({"email_pagamento": email}).eq("id", ass["id"]).execute()

        log_info("checkout_criado", motorista_id=uid, plano=plano_id)
        return {"url": data.get("init_point"), "sandbox_url": data.get("sandbox_init_point")}

    except HTTPException:
        raise
    except Exception as e:
        log_erro("checkout_excecao", erro=e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/vagas-fundador")
async def vagas_fundador():
    """Retorna vagas restantes do plano fundador (endpoint público)."""
    try:
        res = supabase.table("planos").select("vagas_restantes").eq("id", "fundador").execute()
        vagas = res.data[0]["vagas_restantes"] if res.data else 50
        return {"vagas": vagas}
    except Exception:
        return {"vagas": 50}


@router.post("/criar-checkout-landing")
async def criar_checkout_landing(dados: dict = Body(...)):
    """
    Endpoint público para a landing page:
    1. Cria conta no Supabase Auth se não existir
    2. Inicia trial de 24h
    3. Gera link de checkout Mercado Pago
    """
    email = (dados.get("email") or "").strip().lower()
    plano_id = dados.get("plano_id", "fundador")

    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Email inválido.")

    headers = {
        "apikey": _supabase_service_key,
        "Authorization": f"Bearer {_supabase_service_key}",
        "Content-Type": "application/json",
    }
    motorista_id = None

    try:
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.get(
                f"{_supabase_url}/auth/v1/admin/users?email={email}",
                headers=headers,
            )
            if r.status_code == 200:
                users = r.json().get("users", [])
                if users:
                    motorista_id = users[0]["id"]

            if not motorista_id:
                senha_temp = secrets.token_urlsafe(16)
                r2 = await c.post(
                    f"{_supabase_url}/auth/v1/admin/users",
                    headers=headers,
                    json={
                        "email": email,
                        "password": senha_temp,
                        "email_confirm": True,
                        "user_metadata": {"origem": "landing"},
                    },
                )
                if r2.status_code not in (200, 201):
                    raise HTTPException(status_code=502, detail="Erro ao criar conta.")
                motorista_id = r2.json()["id"]
                log_info("conta_criada_landing", email=email, uid=motorista_id)

    except HTTPException:
        raise
    except Exception as e:
        log_erro("landing_auth_erro", erro=e)
        raise HTTPException(status_code=500, detail="Erro ao processar cadastro.")

    ass = _buscar_assinatura(motorista_id)
    if not ass:
        _criar_trial(motorista_id)

    checkout_url = None
    if MP_ACCESS_TOKEN:
        preco = PLANO_FUNDADOR_PRECO if plano_id == "fundador" else PLANO_PRO_PRECO
        titulo = "Painel.IA – Plano Fundador" if plano_id == "fundador" else "Painel.IA – Plano Pro"
        payload = {
            "items": [{"title": titulo, "quantity": 1, "unit_price": preco / 100, "currency_id": "BRL"}],
            "payer": {"email": email},
            "back_urls": {
                "success": f"{APP_URL}/?pagamento=sucesso",
                "failure": f"{APP_URL}/?pagamento=falha",
                "pending": f"{APP_URL}/?pagamento=pendente",
            },
            "auto_return": "approved",
            "notification_url": f"{APP_URL}/billing/webhook",
            "external_reference": f"{motorista_id}|{plano_id}",
            "statement_descriptor": "PAINEL.IA",
        }
        try:
            async with httpx.AsyncClient(timeout=10) as c:
                r = await c.post(
                    "https://api.mercadopago.com/checkout/preferences",
                    json=payload,
                    headers={"Authorization": f"Bearer {MP_ACCESS_TOKEN}"},
                )
            if r.status_code == 201:
                checkout_url = r.json().get("init_point")
        except Exception as e:
            log_erro("landing_checkout_mp_erro", erro=e)

    log_info("landing_checkout", email=email, uid=motorista_id, plano=plano_id, tem_mp=bool(checkout_url))
    return {
        "ok": True,
        "trial_ativo": True,
        "checkout_url": checkout_url,
        "uid": motorista_id,
    }


@router.post("/webhook")
async def webhook_mp(request: Request):
    """Recebe notificações do Mercado Pago e ativa assinatura."""
    try:
        body = await request.json()
    except Exception:
        return {"ok": True}

    tipo = body.get("type") or body.get("topic")
    if tipo not in ("payment", "preapproval"):
        return {"ok": True}

    payment_id = body.get("data", {}).get("id") or body.get("id")
    if not payment_id or not MP_ACCESS_TOKEN:
        return {"ok": True}

    try:
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.get(
                f"https://api.mercadopago.com/v1/payments/{payment_id}",
                headers={"Authorization": f"Bearer {MP_ACCESS_TOKEN}"}
            )
        if r.status_code != 200:
            return {"ok": True}

        pagamento = r.json()
        status_mp = pagamento.get("status")
        ref = pagamento.get("external_reference", "")
        valor = pagamento.get("transaction_amount", 0)

        if "|" not in ref:
            return {"ok": True}

        motorista_id, plano_id = ref.split("|", 1)

        if status_mp == "approved":
            agora = _agora()
            periodo_fim = agora + timedelta(days=30)
            ass = _buscar_assinatura(motorista_id)

            if ass:
                supabase.table("assinaturas").update({
                    "status": "ativo",
                    "plano_id": plano_id,
                    "periodo_inicio": agora.isoformat(),
                    "periodo_fim": periodo_fim.isoformat(),
                    "mp_subscription_id": str(payment_id),
                    "atualizado_em": agora.isoformat(),
                }).eq("id", ass["id"]).execute()

                # Registra pagamento
                supabase.table("pagamentos").insert({
                    "assinatura_id": ass["id"],
                    "motorista_id": motorista_id,
                    "mp_payment_id": str(payment_id),
                    "valor": valor,
                    "status": "aprovado",
                }).execute()
            else:
                # Cria assinatura ativa do zero (caso raro)
                nova = supabase.table("assinaturas").insert({
                    "motorista_id": motorista_id,
                    "plano_id": plano_id,
                    "status": "ativo",
                    "periodo_inicio": agora.isoformat(),
                    "periodo_fim": periodo_fim.isoformat(),
                    "mp_subscription_id": str(payment_id),
                }).execute()
                supabase.table("pagamentos").insert({
                    "assinatura_id": nova.data[0]["id"],
                    "motorista_id": motorista_id,
                    "mp_payment_id": str(payment_id),
                    "valor": valor,
                    "status": "aprovado",
                }).execute()

            # Decrementa vagas do plano fundador
            if plano_id == "fundador":
                supabase.rpc("decrementar_vaga_fundador", {}).execute()

            log_info("pagamento_aprovado", motorista_id=motorista_id, plano=plano_id, valor=valor)

    except Exception as e:
        log_erro("webhook_mp_erro", erro=e)

    return {"ok": True}
