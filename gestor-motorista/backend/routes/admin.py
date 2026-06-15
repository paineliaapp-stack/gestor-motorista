"""Admin: dashboard de métricas, listagem de usuários e liberação manual de trial/assinatura."""
import os
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Body, HTTPException, Request
from core.supabase_client import supabase
from core.logging import log_info, log_erro

router = APIRouter(prefix="/admin", tags=["admin"])

ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "")

# ── Auth simples por header ───────────────────────────────────────────────────

def _verificar_admin(request: Request):
    token = request.headers.get("X-Admin-Token", "")
    if not ADMIN_TOKEN or token != ADMIN_TOKEN:
        raise HTTPException(status_code=403, detail="Acesso negado")

# ── Rotas ─────────────────────────────────────────────────────────────────────

@router.get("/metricas")
async def metricas(request: Request):
    """Métricas gerais: totais, receita, churns."""
    _verificar_admin(request)
    try:
        agora = datetime.now(timezone.utc)

        # Totais por status
        todos = supabase.table("assinaturas").select("status, plano_id, criado_em").execute()
        dados = todos.data or []

        total        = len(dados)
        em_trial     = sum(1 for d in dados if d["status"] == "trial")
        ativos       = sum(1 for d in dados if d["status"] == "ativo")
        expirados    = sum(1 for d in dados if d["status"] == "expirado")
        fundadores   = sum(1 for d in dados if d["status"] == "ativo" and d["plano_id"] == "fundador")
        pro          = sum(1 for d in dados if d["status"] == "ativo" and d["plano_id"] == "pro")

        # Receita total dos pagamentos aprovados
        pags = supabase.table("pagamentos").select("valor").eq("status", "aprovado").execute()
        receita = sum(float(p["valor"] or 0) for p in (pags.data or []))

        # Novos nos últimos 7 dias
        sete_dias_atras = (agora - timedelta(days=7)).isoformat()
        novos_7d = sum(1 for d in dados if d["criado_em"] >= sete_dias_atras)

        # Vagas fundador restantes
        plano_fundador = supabase.table("planos").select("vagas_restantes, vagas_total").eq("id", "fundador").execute()
        vagas = plano_fundador.data[0] if plano_fundador.data else {}

        # Lançamentos: total e ranking de uso por motorista_id
        lanc_res = supabase.table("lancamentos").select("motorista_id, valor, tipo").execute()
        lanc_data = lanc_res.data or []

        total_lancamentos = len(lanc_data)

        # Agrupa por motorista_id
        from collections import defaultdict
        uso_por_user = defaultdict(lambda: {"count": 0, "receita": 0.0})
        for l in lanc_data:
            mid = l.get("motorista_id", "")
            if not mid:
                continue
            uso_por_user[mid]["count"] += 1
            if l.get("tipo") in ("ganho", "renda_extra", None):
                uso_por_user[mid]["receita"] += float(l.get("valor") or 0)

        usuarios_com_uso = len(uso_por_user)
        # Total de motoristas cadastrados (sem assinatura) vs com lançamentos
        todos_motoristas = supabase.table("motoristas").select("id").execute()
        total_motoristas = len(todos_motoristas.data or [])
        sem_uso = max(0, total_motoristas - usuarios_com_uso)

        # Ranking top 5 mais ativos
        ranking_raw = sorted(uso_por_user.items(), key=lambda x: x[1]["count"], reverse=True)[:5]
        # Enriquece com email
        ranking = []
        for mid, info in ranking_raw:
            ass_r = supabase.table("assinaturas").select("email_pagamento").eq("motorista_id", mid).limit(1).execute()
            email = (ass_r.data or [{}])[0].get("email_pagamento") or mid[:8] + "…"
            ranking.append({"email": email, "lancamentos": info["count"], "receita": round(info["receita"], 2)})

        # Tickets abertos
        try:
            tickets_res = supabase.table("tickets_suporte").select("id").eq("status", "aberto").execute()
            tickets_abertos = len(tickets_res.data or [])
        except Exception:
            tickets_abertos = 0

        # Sem assinatura (não tem linha em assinaturas)
        sem_assinatura = total_motoristas - total

        return {
            "total_usuarios": total_motoristas,
            "em_trial": em_trial,
            "ativos": ativos,
            "expirados": expirados,
            "sem_assinatura": max(0, sem_assinatura),
            "fundadores": fundadores,
            "pro": pro,
            "receita_total": round(receita, 2),
            "novos_7_dias": novos_7d,
            "vagas_fundador_restantes": vagas.get("vagas_restantes"),
            "vagas_fundador_total": vagas.get("vagas_total"),
            "total_lancamentos": total_lancamentos,
            "usuarios_com_uso": usuarios_com_uso,
            "sem_uso": sem_uso,
            "tickets_abertos": tickets_abertos,
            "ranking_uso": ranking,
        }
    except Exception as e:
        log_erro("admin_metricas_erro", erro=e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/usuarios")
async def listar_usuarios(request: Request, status: str = "", limit: int = 50):
    """Lista usuários com dados de assinatura. Filtra por status."""
    _verificar_admin(request)
    try:
        q = supabase.table("assinaturas").select(
            "id, motorista_id, status, plano_id, trial_inicio, trial_fim, periodo_fim, email_pagamento, criado_em"
        ).order("criado_em", desc=True).limit(limit)

        if status:
            q = q.eq("status", status)

        res = q.execute()

        # Enriquecer com nome do motorista
        usuarios = []
        for ass in (res.data or []):
            mid = ass["motorista_id"]
            mot = supabase.table("motoristas").select("nome, telefone").eq("id", mid).execute()
            nome = mot.data[0]["nome"] if mot.data else "—"
            tel  = mot.data[0].get("telefone", "—") if mot.data else "—"
            usuarios.append({**ass, "nome": nome, "telefone": tel})

        return {"usuarios": usuarios, "total": len(usuarios)}
    except Exception as e:
        log_erro("admin_usuarios_erro", erro=e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/pagamentos")
async def listar_pagamentos(request: Request, limit: int = 50):
    """Lista os últimos pagamentos aprovados."""
    _verificar_admin(request)
    try:
        res = supabase.table("pagamentos").select("*").eq("status", "aprovado").order("criado_em", desc=True).limit(limit).execute()
        return {"pagamentos": res.data or [], "total": len(res.data or [])}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/liberar")
async def liberar_acesso(request: Request, dados: dict = Body(...)):
    """
    Libera acesso manual para um motorista.
    Body: { "motorista_id": "uuid", "tipo": "trial" | "ativo", "dias": 30 }
    """
    _verificar_admin(request)
    mid  = dados.get("motorista_id", "").strip()
    tipo = dados.get("tipo", "trial")   # "trial" ou "ativo"
    dias = int(dados.get("dias", 30))

    if not mid:
        raise HTTPException(status_code=400, detail="motorista_id obrigatório")

    agora = datetime.now(timezone.utc)
    fim   = agora + timedelta(days=dias)

    try:
        ass = supabase.table("assinaturas").select("id").eq("motorista_id", mid).order("criado_em", desc=True).limit(1).execute()

        if tipo == "trial":
            update = {
                "status": "trial",
                "trial_inicio": agora.isoformat(),
                "trial_fim": fim.isoformat(),
                "atualizado_em": agora.isoformat(),
            }
        else:
            update = {
                "status": "ativo",
                "plano_id": dados.get("plano_id", "fundador"),
                "periodo_inicio": agora.isoformat(),
                "periodo_fim": fim.isoformat(),
                "atualizado_em": agora.isoformat(),
            }

        if ass.data:
            supabase.table("assinaturas").update(update).eq("id", ass.data[0]["id"]).execute()
        else:
            supabase.table("assinaturas").insert({"motorista_id": mid, **update, "plano_id": update.get("plano_id", "fundador")}).execute()

        log_info("acesso_liberado_manual", motorista_id=mid, tipo=tipo, dias=dias)
        return {"ok": True, "mensagem": f"Acesso liberado: {tipo} por {dias} dias"}
    except Exception as e:
        log_erro("admin_liberar_erro", erro=e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/emails-remarketing")
async def emails_remarketing(request: Request):
    """Retorna emails de quem testou e não assinou — para remarketing."""
    _verificar_admin(request)
    try:
        expirados = supabase.table("assinaturas").select(
            "motorista_id, email_pagamento, trial_fim, criado_em"
        ).eq("status", "expirado").execute()

        emails = []
        for e in (expirados.data or []):
            email = e.get("email_pagamento")
            if email:
                emails.append({
                    "email": email,
                    "trial_fim": e.get("trial_fim"),
                    "criado_em": e.get("criado_em"),
                })

        return {"emails": emails, "total": len(emails)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/bloquear")
async def bloquear_acesso(request: Request, dados: dict = Body(...)):
    """Bloqueia ou desbloqueia acesso de um motorista."""
    _verificar_admin(request)
    mid = dados.get("motorista_id", "").strip()
    if not mid:
        raise HTTPException(status_code=400, detail="motorista_id obrigatório")

    agora = datetime.now(timezone.utc)
    try:
        ass = supabase.table("assinaturas").select("id").eq("motorista_id", mid).order("criado_em", desc=True).limit(1).execute()
        update = {
            "status": "bloqueado",
            "atualizado_em": agora.isoformat(),
        }
        if ass.data:
            supabase.table("assinaturas").update(update).eq("id", ass.data[0]["id"]).execute()
        else:
            # Cria registro bloqueado com plano_id padrão para não violar NOT NULL
            supabase.table("assinaturas").insert({
                "motorista_id": mid,
                "plano_id": "sem_plano",
                "status": "bloqueado",
                "atualizado_em": agora.isoformat(),
                "criado_em": agora.isoformat(),
            }).execute()
        log_info("acesso_bloqueado", motorista_id=mid)
        return {"ok": True, "mensagem": "Acesso bloqueado"}
    except Exception as e:
        log_erro("admin_bloquear_erro", erro=e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/debug-auth")
async def debug_auth(request: Request):
    """Debug: retorna dados brutos do Supabase Auth."""
    _verificar_admin(request)
    try:
        import httpx as _hx
        from core.supabase_client import _supabase_url, _supabase_service_key
        headers = {
            "apikey": _supabase_service_key,
            "Authorization": f"Bearer {_supabase_service_key}",
        }
        async with _hx.AsyncClient(timeout=10) as c:
            r = await c.get(f"{_supabase_url}/auth/v1/admin/users?per_page=10", headers=headers)
        return {"status": r.status_code, "body": r.json()}
    except Exception as e:
        return {"erro": str(e)}
