"""Rotas de lançamentos, turnos e limpeza de duplicatas."""
from datetime import date
from typing import Optional
from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import BaseModel
from core.supabase_client import supabase
from core.config import hoje_brasil
from core.security import get_uid_from_token
from core.logging import log_erro

router = APIRouter()


class Lancamento(BaseModel):
    motorista_id: str
    tipo: str
    descricao: Optional[str] = None
    valor: float
    plataforma: Optional[str] = None
    horas_rodadas: Optional[float] = None
    km_rodados: Optional[float] = None
    data: Optional[date] = None

@router.get("/diag-lancamentos/{motorista_id}")
async def diag_lancamentos(motorista_id: str, uid: str = Depends(get_uid_from_token)):
    """Diagnóstico: mostra data vs created_at para achar lançamentos com data errada."""
    if motorista_id != uid:
        raise HTTPException(status_code=403, detail="Acesso negado")
    import datetime as _d
    hoje = (_d.datetime.utcnow() - _d.timedelta(hours=3)).date().isoformat()
    r = supabase.table("lancamentos").select("id,tipo,valor,descricao,plataforma,data,created_at").eq("motorista_id", motorista_id).eq("data", hoje).execute()
    out = []
    for l in (r.data or []):
        criado = str(l.get("created_at",""))[:10]
        out.append({
            "desc": l.get("descricao") or l.get("plataforma") or "?",
            "valor": l.get("valor"),
            "tipo": l.get("tipo"),
            "data": l.get("data"),
            "criado_em": criado,
            "data_bate_criacao": l.get("data") == criado
        })
    return {"hoje": hoje, "total_hoje": len(out), "lancamentos": out}


@router.post("/lancamentos")
async def criar_lancamento(l: Lancamento, uid: str = Depends(get_uid_from_token)):
    if l.motorista_id != uid: raise HTTPException(status_code=403, detail="Acesso negado")
    dados = l.dict()
    dados["data"] = str(dados.get("data") or hoje_brasil())
    res = supabase.table("lancamentos").insert(dados).execute()
    return res.data

@router.post("/turno")
async def salvar_turno(body: dict = Body(...), uid: str = Depends(get_uid_from_token)):
    motorista_id = uid  # sempre usa uid do token, nunca do body
    data = body.get("data", str(hoje_brasil()))
    inicio = body.get("inicio")
    fim = body.get("fim")
    horas = body.get("horas")

    if inicio and fim:
        from datetime import datetime
        fmt = "%H:%M"
        try:
            h = (datetime.strptime(fim, fmt) - datetime.strptime(inicio, fmt)).seconds / 3600
            horas = round(h, 2)
        except: pass

    try:
        existing = supabase.table("turnos").select("id").eq("motorista_id", motorista_id).eq("data", data).execute()
        if existing.data:
            supabase.table("turnos").update({"inicio": inicio, "fim": fim, "horas": horas}).eq("id", existing.data[0]["id"]).execute()
        else:
            supabase.table("turnos").insert({"motorista_id": motorista_id, "data": data, "inicio": inicio, "fim": fim, "horas": horas}).execute()
        return {"ok": True, "horas": horas}
    except Exception as e:
        log_erro("endpoint_erro", erro=e)
        return {"ok": False, "erro": "Erro interno"}

@router.get("/turnos/{motorista_id}")
async def get_turnos(motorista_id: str, uid: str = Depends(get_uid_from_token)):
    if motorista_id != uid: raise HTTPException(status_code=403, detail="Acesso negado")
    try:
        r = supabase.table("turnos").select("*").eq("motorista_id", motorista_id).order("data", desc=True).limit(60).execute()
        return r.data or []
    except:
        return []

@router.get("/lancamentos-futuros/{motorista_id}")
async def lancamentos_futuros(motorista_id: str, uid: str = Depends(get_uid_from_token)):
    if motorista_id != uid: raise HTTPException(status_code=403, detail="Acesso negado")
    """Retorna lançamentos do próximo mês (renda extra prevista)"""
    import datetime as _dt
    hoje = hoje_brasil()
    if hoje.month == 12:
        prox_mes = 1
        prox_ano = hoje.year + 1
    else:
        prox_mes = hoje.month + 1
        prox_ano = hoje.year
    inicio = f"{prox_ano}-{prox_mes:02d}-01"
    if prox_mes == 12:
        fim = f"{prox_ano+1}-01-01"
    else:
        fim = f"{prox_ano}-{prox_mes+1:02d}-01"
    res = supabase.table("lancamentos").select("*").eq("motorista_id", motorista_id).gte("data", inicio).lt("data", fim).execute()
    lancamentos = res.data or []
    RENDA_EXTRA_KEYS = ["seguro_desemprego","freelance","aluguel_recebido","venda","emprestimo_recebido","bonus","renda_extra"]
    total_renda_extra = sum(float(l["valor"]) for l in lancamentos if l.get("tipo") == "ganho" and l.get("plataforma") in RENDA_EXTRA_KEYS)
    return {"lancamentos": lancamentos, "total_renda_extra_prevista": total_renda_extra}

@router.delete("/lancamentos/{lancamento_id}")
async def deletar_lancamento(lancamento_id: str, uid: str = Depends(get_uid_from_token)):
    # Verifica ownership antes de deletar
    check = supabase.table("lancamentos").select("motorista_id").eq("id", lancamento_id).execute()
    if not check.data or check.data[0]["motorista_id"] != uid:
        raise HTTPException(status_code=403, detail="Acesso negado")
    supabase.table("lancamentos").delete().eq("id", lancamento_id).execute()
    return {"ok": True}

@router.post("/admin/limpar-duplicatas")
async def limpar_duplicatas(dados: dict = Body(...), uid: str = Depends(get_uid_from_token)):
    """Limpeza de duplicatas — só opera nos dados do próprio usuário autenticado."""
    mid = uid  # sempre do token, nunca do body
    r = supabase.table("lancamentos").select("id,data,valor,created_at").eq("motorista_id", mid).eq("tipo", "ganho").eq("plataforma", "99").gte("data", "2026-05-01").order("data", desc=False).order("created_at", desc=False).execute()
    lancs = r.data or []
    removidos = []
    vistos = {}
    for l in sorted(lancs, key=lambda x: x.get("created_at","")):
        chave = f"{l['data']}_{float(l['valor']):.2f}"
        if chave in vistos:
            supabase.table("lancamentos").delete().eq("id", l["id"]).execute()
            removidos.append({"id": l["id"], "data": l["data"], "valor": float(l["valor"]), "motivo": "duplicata"})
        else:
            vistos[chave] = l["id"]
    r2 = supabase.table("lancamentos").select("valor").eq("motorista_id", mid).eq("tipo", "ganho").eq("plataforma", "99").gte("data", "2026-05-01").execute()
    novo_total = sum(float(l["valor"]) for l in (r2.data or []))
    return {"ok": True, "removidos": len(removidos), "detalhes": removidos, "novo_total_99": round(novo_total, 2)}
