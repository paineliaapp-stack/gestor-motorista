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
_PRECOS       = {"fundador": 19.00,  "pro": 29.00}
_PRECOS_ANUAL = {"fundador": 190.00, "pro": 290.00}
_NOMES        = {"fundador": "Plano Fundador", "pro": "Plano Pro"}


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


@router.post("/billing/checkout-publico")
async def checkout_publico(dados: dict = Body(...)):
    """Compra direta da landing — sem login. Vincula pelo email após o pagamento."""
    plano_id = "fundador"  # landing vende só o Fundador
    email = (dados.get("email") or "").strip().lower()
    if not email or "@" not in email:
        return {"erro": "Informe um email válido"}
    if _vagas_fundador() <= 0:
        return {"erro": "Vagas do Plano Fundador esgotadas"}
    token = os.getenv("MP_ACCESS_TOKEN", "")
    if not token:
        return {"erro": "Pagamento ainda não configurado — tente em instantes"}
    payload = {
        "reason": f"Painel.IA — {_NOMES[plano_id]}",
        "external_reference": f"email:{email}|{plano_id}",  # vincula por email
        "payer_email": email,
        "auto_recurring": {
            "frequency": 1, "frequency_type": "months",
            "transaction_amount": _PRECOS[plano_id], "currency_id": "BRL",
        },
        "back_url": f"{_APP_URL}/?pagamento=ok&email={email}",
        "status": "pending",
    }
    try:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.post(f"{_MP_API}/preapproval",
                             headers={"Authorization": f"Bearer {token}"}, json=payload)
            data = r.json()
        if r.status_code >= 400 or "init_point" not in data:
            log_warn("checkout_publico_falhou", status=r.status_code, body=str(data)[:300])
            return {"erro": "Não foi possível iniciar o pagamento — tente novamente"}
        log_info("checkout_publico_criado", email=email)
        return {"init_point": data["init_point"]}
    except Exception as e:
        log_erro("checkout_publico_erro", erro=e)
        return {"erro": "Falha de conexão"}


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


@router.post("/billing/checkout-pix")
async def checkout_pix(dados: dict = Body(...), uid: str = Depends(get_uid_from_token)):
    """Checkout Pro do MercadoPago — aceita PIX e cartão (mensal ou anual)."""
    plano_id = dados.get("plano_id", "fundador")
    ciclo    = dados.get("ciclo", "mensal")   # mensal | anual
    email    = (dados.get("email") or "").strip().lower()

    if plano_id not in _PRECOS:
        raise HTTPException(status_code=400, detail="Plano inválido")
    if ciclo not in ("mensal", "anual"):
        raise HTTPException(status_code=400, detail="Ciclo inválido")
    if plano_id == "fundador" and _vagas_fundador() <= 0:
        return {"erro": "Vagas do Plano Fundador esgotadas"}

    try:
        from core.supabase_client import supabase as _sb
        res = _sb.auth.admin.get_user_by_id(uid)
        if not email and res and res.user:
            email = res.user.email or ""
    except Exception:
        pass
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Email inválido")

    token = os.getenv("MP_ACCESS_TOKEN", "")
    if not token:
        return {"erro": "Pagamento ainda não configurado — tente em instantes"}

    preco = _PRECOS_ANUAL[plano_id] if ciclo == "anual" else _PRECOS[plano_id]
    dias  = 365 if ciclo == "anual" else 30
    desc  = f"Painel.IA — {_NOMES[plano_id]} ({'Anual' if ciclo == 'anual' else 'Mensal'})"

    payload = {
        "items": [{
            "id":          f"painelia_{plano_id}_{ciclo}",
            "title":       desc,
            "quantity":    1,
            "unit_price":  preco,
            "currency_id": "BRL",
        }],
        "payer":               {"email": email},
        "external_reference":  f"pix|email:{email}|{plano_id}|{ciclo}",
        "back_urls": {
            "success": f"{_APP_URL}/?pagamento=ok&email={email}&ciclo={ciclo}",
            "failure": f"{_APP_URL}/?pagamento=erro",
            "pending": f"{_APP_URL}/?pagamento=pendente",
        },
        "auto_return":         "approved",
        "payment_methods": {
            "excluded_payment_types": [{"id": "ticket"}],   # sem boleto
        },
        "statement_descriptor": "PAINELIA",
        "metadata": {"uid": uid, "plano_id": plano_id, "ciclo": ciclo, "dias": dias},
    }
    try:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.post(
                f"{_MP_API}/checkout/preferences",
                headers={"Authorization": f"Bearer {token}"},
                json=payload,
            )
            data = r.json()
        if r.status_code >= 400 or "init_point" not in data:
            log_warn("checkout_pix_falhou", status=r.status_code, body=str(data)[:300])
            return {"erro": "Não foi possível gerar o checkout PIX — tente novamente"}
        # Registrar referência na assinatura
        try:
            supabase.table("assinaturas").update({
                "email_pagamento": email,
                "plano_id": plano_id,
                "atualizado_em": _agora().isoformat(),
            }).eq("motorista_id", uid).execute()
        except Exception as e:
            log_erro("checkout_pix_save_erro", erro=e)
        log_info("checkout_pix_criado", uid=uid[:8], plano=plano_id, ciclo=ciclo, valor=preco)
        return {"init_point": data["init_point"], "preco": preco, "ciclo": ciclo}
    except Exception as e:
        log_erro("checkout_pix_erro", erro=e)
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
                ref, plano_id = ext.split("|", 1)
                # ref = uid direto, ou "email:x@y" (compra na landing → vincula por email)
                if ref.startswith("email:"):
                    _email = ref[6:]
                    uid = None
                    try:
                        # Tenta achar o usuário que já criou conta com esse email
                        _r = supabase.table("motoristas").select("id,email_pagamento").eq("email_pagamento", _email).limit(1).execute()
                        if _r.data:
                            uid = _r.data[0]["id"]
                    except Exception:
                        pass
                    # Registra o pagamento por email para vincular quando logar
                    try:
                        supabase.table("assinaturas").upsert({
                            "motorista_id": uid, "plano_id": plano_id,
                            "status": "active" if mp_status == "authorized" else "pending",
                            "email_pagamento": _email, "mp_subscription_id": str(rid),
                            "atualizado_em": _agora().isoformat(),
                        }).execute() if uid else None
                    except Exception:
                        pass
                    if not uid:
                        return {"ok": True}  # vincula no login
                else:
                    uid = ref
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


@router.post("/billing/verificar-pagamento")
async def verificar_pagamento(uid: str = Depends(get_uid_from_token)):
    """Usuário clica 'Já paguei' — busca pagamento aprovado no MP e ativa."""
    import urllib.parse
    token = os.getenv("MP_ACCESS_TOKEN", "")
    if not token:
        return {"ativado": False, "mensagem": "Pagamento não configurado"}
    try:
        agora = _agora()
        # Busca assinatura atual
        r = supabase.table("assinaturas").select("*").eq("motorista_id", uid).order("criado_em", desc=True).limit(1).execute()
        ass = (r.data or [None])[0]

        # Já está ativo?
        if ass and ass.get("status") in ("active", "ativo"):
            return {"ativado": True, "mensagem": "Plano já ativo", "plano": ass.get("plano_id")}

        # Busca pagamentos aprovados no MP por external_reference
        aprovado = None
        plano_ativado = None
        ciclo_ativado = "mensal"
        _email_user = await _email_do_usuario(uid)
        log_info("verificar_inicio", uid=str(uid)[:8], email=_email_user)
        async with httpx.AsyncClient(timeout=15) as c:
            # Formato 1: PIX/Checkout Pro → "pix|email:EMAIL|plano|ciclo" OU "email:EMAIL|plano"
            if _email_user:
                refs_tentar = []
                for plano in ["fundador", "pro"]:
                    refs_tentar.append((f"email:{_email_user}|{plano}", plano, "mensal"))
                    for ciclo in ["mensal", "anual"]:
                        refs_tentar.append((f"pix|email:{_email_user}|{plano}|{ciclo}", plano, ciclo))
                for ref_raw, plano, ciclo in refs_tentar:
                    ref = urllib.parse.quote(ref_raw, safe="")
                    r1 = await c.get(
                        f"{_MP_API}/v1/payments/search?external_reference={ref}&sort=date_created&criteria=desc&limit=5",
                        headers={"Authorization": f"Bearer {token}"}
                    )
                    if r1.status_code == 200:
                        for pg in r1.json().get("results", []):
                            if pg.get("status") == "approved":
                                aprovado = pg; plano_ativado = plano; ciclo_ativado = ciclo
                                break
                    if aprovado: break

            # Formato 2 (legado): "uid|plano"
            if not aprovado:
                for plano in ["fundador", "pro"]:
                    ref = urllib.parse.quote(f"{uid}|{plano}", safe="")
                    r2 = await c.get(
                        f"{_MP_API}/v1/payments/search?external_reference={ref}&sort=date_created&criteria=desc&limit=5",
                        headers={"Authorization": f"Bearer {token}"}
                    )
                    log_info("verificar_busca", plano=plano, status=r2.status_code)
                    if r2.status_code == 200:
                        for pg in r2.json().get("results", []):
                            if pg.get("status") == "approved":
                                aprovado = pg; plano_ativado = plano
                                break
                    if aprovado:
                        break

            if not aprovado:
                # Tenta também preapproval (assinatura recorrente)
                sub_id = ass.get("mp_subscription_id") if ass else None
                if sub_id:
                    r3 = await c.get(f"{_MP_API}/preapproval/{sub_id}",
                                     headers={"Authorization": f"Bearer {token}"})
                    if r3.status_code == 200:
                        pre = r3.json()
                        if pre.get("status") == "authorized":
                            plano_ativado = ass.get("plano_id", "fundador")
                            aprovado = {"id": sub_id, "transaction_amount": _PRECOS.get(plano_ativado, 19)}

        log_info("verificar_resultado", achou=bool(aprovado), plano=plano_ativado, ciclo=ciclo_ativado)
        if not aprovado:
            return {"ativado": False, "mensagem": "Pagamento aprovado não encontrado. Aguarde alguns minutos e tente novamente."}

        # ── PROTEÇÃO ANTI-REUSO ──
        # Um pagamento só vale UMA vez. Sem isto, o usuário clicaria todo mês e reativaria
        # com o mesmo pagamento antigo, sem pagar de novo.
        pg_id = str(aprovado.get("id", ""))
        # 1) O pagamento já foi usado para ativar antes? (mesmo mp_subscription_id já registrado)
        if pg_id and ass and str(ass.get("mp_subscription_id") or "") == pg_id:
            # Esse pagamento já ativou esta assinatura. Se está expirada, precisa de pagamento NOVO.
            return {"ativado": False, "mensagem": "Este pagamento já foi usado. Para renovar, faça um novo pagamento."}
        # 2) O pagamento é recente? (aprovado há no máximo 40 dias — cobre o ciclo de 30 dias + folga)
        try:
            data_aprov = aprovado.get("date_approved") or aprovado.get("date_created") or ""
            if data_aprov:
                dt_aprov = _dt.datetime.fromisoformat(str(data_aprov).replace("Z", "+00:00"))
                idade_dias = (agora - dt_aprov).total_seconds() / 86400
                limite = 400 if ciclo_ativado == "anual" else 40
                if idade_dias > limite:
                    return {"ativado": False, "mensagem": "Seu último pagamento expirou. Faça um novo pagamento para renovar o acesso."}
        except Exception as e:
            log_erro("validar_data_pagamento_erro", erro=str(e))

        # Garante que o motorista existe na tabela motoristas (foreign key da assinatura).
        # Sem isso dava erro 23503 (motorista_id ausente em motoristas).
        try:
            existe_mot = supabase.table("motoristas").select("id").eq("id", uid).limit(1).execute()
            if not existe_mot.data:
                nome_mot = (_email_user.split("@")[0] if _email_user else "motorista")
                supabase.table("motoristas").insert({
                    "id": uid, "nome": nome_mot, "telefone": str(uid)[:8],
                    "meta_diaria": 150, "setup_completo": False,
                }).execute()
                log_info("motorista_criado_na_ativacao", uid=str(uid)[:8])
        except Exception as e:
            log_erro("criar_motorista_erro", erro=str(e))

        # Ativa assinatura — SEMPRE faz UPDATE da linha existente (criada no trial).
        # Usa SÓ colunas que o webhook ja grava com sucesso (sem periodo_fim, que pode nao existir).
        dados_ativacao = {
            "status": "active",
            "plano_id": plano_ativado,
            "periodo_inicio": agora.isoformat(),
            "mp_subscription_id": str(aprovado.get("id", "")),
            "atualizado_em": agora.isoformat(),
        }
        try:
            if ass and ass.get("id"):
                supabase.table("assinaturas").update(dados_ativacao).eq("id", ass["id"]).execute()
            else:
                existe = supabase.table("assinaturas").select("id").eq("motorista_id", uid).limit(1).execute()
                if existe.data:
                    supabase.table("assinaturas").update(dados_ativacao).eq("motorista_id", uid).execute()
                else:
                    supabase.table("assinaturas").insert({**dados_ativacao, "motorista_id": uid}).execute()
        except Exception as e:
            log_erro("ativar_assinatura_erro", erro=str(e))
            return {"ativado": False, "mensagem": f"Erro ao ativar: {str(e)[:120]}"}

        # Decrementa vaga fundador
        if plano_ativado == "fundador":
            try:
                v = _vagas_fundador()
                supabase.table("planos").update({"vagas_restantes": max(0, v - 1)}).eq("id", "fundador").execute()
            except Exception:
                pass

        # Email de confirmação
        try:
            email = await _email_do_usuario(uid)
            if email:
                from services.email_service import email_pagamento_confirmado
                await email_pagamento_confirmado(email, _nome_do_motorista(uid), _NOMES.get(plano_ativado, plano_ativado), _PRECOS.get(plano_ativado, 0))
        except Exception as e:
            log_erro("email_confirmacao_erro", erro=e)

        log_info("pagamento_verificado_manual", uid=uid, plano=plano_ativado)
        return {"ativado": True, "plano": plano_ativado, "mensagem": f"Plano {plano_ativado} ativado!"}

    except Exception as e:
        log_erro("verificar_pagamento_erro", erro=e)
        return {"ativado": False, "mensagem": "Erro interno. Tente novamente."}


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
