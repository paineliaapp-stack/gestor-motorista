"""Painel admin: métricas e usuários. Acesso via header X-Admin-Token == env ADMIN_TOKEN."""
import os
import datetime as _dt
from fastapi import APIRouter, Header, HTTPException, Query
from core.supabase_client import supabase
from core.logging import log_erro

router = APIRouter()


def _check(token: str):
    esperado = os.getenv("ADMIN_TOKEN", "")
    if not esperado or token != esperado:
        raise HTTPException(status_code=401, detail="Não autorizado")


@router.get("/admin/metricas")
async def metricas(x_admin_token: str = Header(default="")):
    _check(x_admin_token)
    out = {"mrr": 0.0, "usuarios_total": 0, "em_trial": 0, "ativos": 0, "expirados": 0,
           "cancelados": 0, "conversao_pct": 0.0, "vagas_fundador": 0,
           "novos_hoje": 0, "novos_semana": 0, "por_dia": []}
    try:
        m = supabase.table("motoristas").select("id,criado_em").execute()
        rows = m.data or []
        out["usuarios_total"] = len(rows)
        hoje = _dt.date.today()
        por_dia = {}
        for r in rows:
            try:
                d = str(r.get("criado_em", ""))[:10]
                if d:
                    por_dia[d] = por_dia.get(d, 0) + 1
                    dd = _dt.date.fromisoformat(d)
                    if dd == hoje:
                        out["novos_hoje"] += 1
                    if (hoje - dd).days <= 7:
                        out["novos_semana"] += 1
            except Exception:
                pass
        ult30 = [(hoje - _dt.timedelta(days=i)).isoformat() for i in range(29, -1, -1)]
        out["por_dia"] = [{"dia": d, "n": por_dia.get(d, 0)} for d in ult30]
    except Exception as e:
        log_erro("admin_motoristas_erro", erro=e)
    try:
        a = supabase.table("assinaturas").select("status,plano_id").execute()
        precos = {"fundador": 19.0, "pro": 29.0}
        finalizados = 0
        for r in (a.data or []):
            s = r.get("status")
            if s == "trial":
                out["em_trial"] += 1
            elif s == "active":
                out["ativos"] += 1
                out["mrr"] += precos.get(r.get("plano_id"), 0)
            elif s == "expired":
                out["expirados"] += 1
                finalizados += 1
            elif s == "cancelled":
                out["cancelados"] += 1
                finalizados += 1
        base = out["ativos"] + finalizados
        out["conversao_pct"] = round(out["ativos"] / base * 100, 1) if base else 0.0
        out["mrr"] = round(out["mrr"], 2)
    except Exception as e:
        log_erro("admin_assinaturas_erro", erro=e)
    try:
        p = supabase.table("planos").select("vagas_restantes").eq("id", "fundador").execute()
        out["vagas_fundador"] = int((p.data or [{}])[0].get("vagas_restantes") or 0)
    except Exception:
        pass
    return out


@router.get("/admin/usuarios")
async def usuarios(x_admin_token: str = Header(default=""),
                   page: int = Query(1, ge=1), limit: int = Query(20, le=100),
                   status: str = Query("all")):
    _check(x_admin_token)
    try:
        m = supabase.table("motoristas").select("id,nome,criado_em").order("criado_em", desc=True).execute()
        rows = m.data or []
        a = supabase.table("assinaturas").select("motorista_id,status,plano_id,trial_fim").execute()
        ass = {r["motorista_id"]: r for r in (a.data or [])}
        out = []
        for r in rows:
            s = ass.get(r["id"], {})
            item = {"id": r["id"], "nome": r.get("nome"), "criado_em": r.get("criado_em"),
                    "status": s.get("status", "sem_assinatura"), "plano": s.get("plano_id"),
                    "trial_fim": s.get("trial_fim")}
            if status == "all" or item["status"] == status:
                out.append(item)
        ini = (page - 1) * limit
        return {"total": len(out), "page": page, "usuarios": out[ini:ini + limit]}
    except Exception as e:
        log_erro("admin_usuarios_erro", erro=e)
        return {"total": 0, "page": page, "usuarios": []}
