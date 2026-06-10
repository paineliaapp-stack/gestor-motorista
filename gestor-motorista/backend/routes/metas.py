"""Rotas de metas: meta diária, meta mensal e metas genéricas."""
from typing import Optional
from fastapi import APIRouter, Body
from pydantic import BaseModel
from core.supabase_client import supabase
from core.logging import log_erro

router = APIRouter()


class Meta(BaseModel):
    motorista_id: str
    valor_diario: Optional[float] = None
    valor_mensal: Optional[float] = None

@router.post("/meta-diaria/{motorista_id}")
async def salvar_meta_diaria(motorista_id: str, body: dict = Body(...)):
    nova_meta = body.get("meta")
    novo_comb = body.get("comb_diario")  # opcional
    try:
        update = {"meta_diaria": nova_meta}
        if novo_comb is not None:
            update["comb_diario"] = novo_comb
        supabase.table("motoristas").update(update).eq("id", motorista_id).execute()
        return {"ok": True, "meta_diaria": nova_meta, "comb_diario": novo_comb}
    except Exception as e:
        log_erro("meta_erro", erro=e)
        return {"ok": False, "erro": "Erro interno"}

@router.get("/meta-diaria/{motorista_id}")
async def buscar_meta_diaria(motorista_id: str):
    try:
        res = supabase.table("motoristas").select("meta_diaria,comb_diario").eq("id", motorista_id).execute()
        meta = res.data[0].get("meta_diaria", 150) if res.data else 150
        comb = res.data[0].get("comb_diario") if res.data else None
        return {"meta_diaria": meta or 150, "comb_diario": comb}
    except Exception as e:
        return {"meta_diaria": 150, "comb_diario": None}


@router.post("/meta-mensal/{motorista_id}")
def salvar_meta_mensal(motorista_id: str, body: dict = Body(...)):
    meta = body.get("meta_mensal")
    if not meta or float(meta) < 100:
        return {"ok": False, "erro": "Valor inválido"}
    try:
        supabase.table("motoristas").update({"meta_mensal": float(meta)}).eq("id", motorista_id).execute()
        return {"ok": True, "meta_mensal": float(meta)}
    except Exception as e:
        log_erro("endpoint_erro", erro=e)
        return {"ok": False, "erro": "Erro interno"}

@router.get("/meta-mensal/{motorista_id}")
def buscar_meta_mensal(motorista_id: str):
    try:
        res = supabase.table("motoristas").select("meta_mensal").eq("id", motorista_id).execute()
        meta = res.data[0].get("meta_mensal") if res.data else None
        return {"meta_mensal": meta}
    except Exception as e:
        return {"meta_mensal": None}


@router.post("/metas")
def criar_meta(m: Meta):
    res = supabase.table("metas").insert(m.dict()).execute()
    return res.data

@router.get("/metas/{motorista_id}")
def buscar_meta(motorista_id: str):
    res = supabase.table("metas").select("*").eq("motorista_id", motorista_id).execute()
    return res.data
