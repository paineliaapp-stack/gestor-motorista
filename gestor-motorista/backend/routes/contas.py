"""Rotas de contas a pagar (CRUD)."""
from fastapi import APIRouter, Body, Depends, HTTPException
from core.supabase_client import supabase
from core.security import _valid_uuid, get_uid_from_token
from core.cache import _cache_get, _cache_del

router = APIRouter()

@router.get("/contas/{motorista_id}")
async def listar_contas(motorista_id: str, uid: str = Depends(get_uid_from_token)):
    if motorista_id != uid: raise HTTPException(status_code=403, detail="Acesso negado")
    if not _valid_uuid(motorista_id): return []
    _cached = _cache_get(f"contas:{motorista_id}")
    if _cached is not None: return _cached
    res = supabase.table("contas").select("*").eq("motorista_id", motorista_id).order("vencimento").execute()
    return res.data

@router.post("/contas")
async def criar_conta(c: dict = Body(...)):
    res = supabase.table("contas").insert(c).execute()
    _cache_del(f"contas:{c.get('motorista_id','')}")
    _cache_del(f"resumo:{c.get('motorista_id','')}")
    return res.data

@router.patch("/contas/{conta_id}")
async def atualizar_conta(conta_id: str, dados: dict = Body(...), uid: str = Depends(get_uid_from_token)):
    check = supabase.table("contas").select("motorista_id").eq("id", conta_id).execute()
    if not check.data or check.data[0]["motorista_id"] != uid:
        raise HTTPException(status_code=403, detail="Acesso negado")
    # Remove campos que não devem ser alterados diretamente
    dados.pop("motorista_id", None); dados.pop("id", None)
    res = supabase.table("contas").update(dados).eq("id", conta_id).execute()
    return res.data

@router.delete("/contas/{conta_id}")
async def deletar_conta(conta_id: str, uid: str = Depends(get_uid_from_token)):
    check = supabase.table("contas").select("motorista_id").eq("id", conta_id).execute()
    if not check.data or check.data[0]["motorista_id"] != uid:
        raise HTTPException(status_code=403, detail="Acesso negado")
    supabase.table("contas").delete().eq("id", conta_id).execute()
    return {"ok": True}
