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

        return {
            "total_usuarios": total,
            "em_trial": em_trial,
            "ativos": ativos,
            "expirados": expirados,
            "fundadores": fundadores,
            "pro": pro,
            "receita_total": round(receita, 2),
            "novos_7_dias": novos_7d,
            "vagas_fundador_restantes": vagas.get("vagas_restantes"),
            "vagas_fundador_total": vagas.get("vagas_total"),
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
