"""Competição estilo Strava — SEM expor valores em R$.
A métrica é % DA META: normaliza motoristas de qualquer faixa de ganho.
Retorna: % da meta hoje, streak de dias batendo a meta, patente e ranking percentil.
"""
import datetime as _dt
from fastapi import APIRouter, Depends
from core.supabase_client import supabase
from core.security import get_uid_from_token
from core.logging import log_erro

router = APIRouter()

_PATENTES = [
    (30, "👑 LENDA"),
    (15, "💎 DIAMANTE"),
    (7,  "🥇 OURO"),
    (3,  "🥈 PRATA"),
    (1,  "🥉 BRONZE"),
    (0,  "🚗 NA PISTA"),
]


def _hoje():
    return _dt.date.today()


def _ganhos_por_dia(mid: str, dias: int = 35) -> dict:
    """{date: total_ganhos} dos últimos N dias para um motorista."""
    ini = (_hoje() - _dt.timedelta(days=dias)).isoformat()
    r = supabase.table("lancamentos").select("data,valor,tipo").eq("motorista_id", mid) \
        .gte("data", ini).execute()
    out = {}
    for l in (r.data or []):
        if l.get("tipo") == "ganho":
            d = str(l.get("data", ""))[:10]
            try:
                out[d] = out.get(d, 0.0) + float(l.get("valor") or 0)
            except Exception:
                pass
    return out


@router.get("/competicao/{mid}")
async def competicao(mid: str, uid: str = Depends(get_uid_from_token)):
    try:
        # Meta do motorista
        m = supabase.table("motoristas").select("meta_diaria,nome").eq("id", mid).execute()
        row = (m.data or [{}])[0]
        meta = float(row.get("meta_diaria") or 150) or 150
        nome = (row.get("nome") or "Motorista").split()[0]

        ganhos = _ganhos_por_dia(mid)
        hoje_str = _hoje().isoformat()
        ganho_hoje = ganhos.get(hoje_str, 0.0)
        pct_hoje = round(ganho_hoje / meta * 100)

        # Streak: dias consecutivos batendo a meta (contando hoje se já bateu)
        streak = 0
        d = _hoje()
        if ganhos.get(d.isoformat(), 0) >= meta:
            streak = 1
            d -= _dt.timedelta(days=1)
        else:
            d -= _dt.timedelta(days=1)  # hoje ainda não bateu — conta a sequência até ontem
        while ganhos.get(d.isoformat(), 0) >= meta:
            streak += 1
            d -= _dt.timedelta(days=1)

        patente = next(p for lim, p in _PATENTES if streak >= lim)

        # Ranking nacional por % da meta HOJE (entre quem registrou algo hoje)
        rank_pos, rank_total, rank_pct = None, 0, None
        try:
            todos = supabase.table("lancamentos").select("motorista_id,valor,tipo") \
                .eq("data", hoje_str).execute()
            soma = {}
            for l in (todos.data or []):
                if l.get("tipo") == "ganho":
                    k = l["motorista_id"]
                    soma[k] = soma.get(k, 0.0) + float(l.get("valor") or 0)
            if soma:
                metas = supabase.table("motoristas").select("id,meta_diaria") \
                    .in_("id", list(soma.keys())).execute()
                meta_map = {r["id"]: float(r.get("meta_diaria") or 150) or 150 for r in (metas.data or [])}
                pcts = sorted(
                    (soma[k] / meta_map.get(k, 150) * 100 for k in soma),
                    reverse=True,
                )
                rank_total = len(pcts)
                melhor = pct_hoje
                rank_pos = 1 + sum(1 for p in pcts if p > melhor)
                rank_pct = round(rank_pos / rank_total * 100) if rank_total else None
        except Exception as e:
            log_erro("competicao_rank_erro", erro=e)

        return {
            "nome": nome,
            "pct_meta_hoje": pct_hoje,
            "bateu_meta": ganho_hoje >= meta,
            "streak": streak,
            "patente": patente,
            "rank_pos": rank_pos,
            "rank_total": rank_total,
            "rank_top_pct": rank_pct,
            "data": hoje_str,
        }
    except Exception as e:
        log_erro("competicao_erro", erro=e)
        return {"nome": "Motorista", "pct_meta_hoje": 0, "bateu_meta": False,
                "streak": 0, "patente": "🚗 NA PISTA", "rank_pos": None,
                "rank_total": 0, "rank_top_pct": None, "data": _hoje().isoformat()}
