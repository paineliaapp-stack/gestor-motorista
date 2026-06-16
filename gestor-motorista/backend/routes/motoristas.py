"""Rotas de motoristas: cadastro, upsert, setup e busca por telefone."""
from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import BaseModel
from core.supabase_client import supabase
from core.security import _valid_uuid, get_uid_from_token
from core.logging import log_erro

router = APIRouter()


class Motorista(BaseModel):
    nome: str
    telefone: str

@router.post("/motoristas")
def criar_motorista(m: Motorista, uid: str = Depends(get_uid_from_token)):
    res = supabase.table("motoristas").insert(m.dict()).execute()
    return res.data

@router.post("/upsert-motorista")
async def upsert_motorista(dados: dict = Body(...), uid: str = Depends(get_uid_from_token)):
    uid = uid  # usa uid do token, ignora body
    nome = dados.get("nome", "Usuário")
    if not _valid_uuid(uid):
        return {"ok": False, "erro": "ID inválido"}
    # Sanitiza nome — máximo 100 chars, sem HTML
    nome = str(nome)[:100].replace("<", "").replace(">", "").strip() or "Usuário"
    # Busca email do usuário no auth para salvar na tabela
    _email_usuario = None
    try:
        import os, httpx as _hx
        _sb_url = os.getenv("SUPABASE_URL", "")
        _sb_key = os.getenv("SUPABASE_SERVICE_KEY", "") or os.getenv("SUPABASE_KEY", "")
        async with _hx.AsyncClient(timeout=5) as _c:
            _r = await _c.get(f"{_sb_url}/auth/v1/admin/users/{uid}",
                headers={"apikey": _sb_key, "Authorization": f"Bearer {_sb_key}"})
            if _r.status_code == 200:
                _email_usuario = _r.json().get("email", "")
    except Exception:
        pass
    try:
        res = supabase.table("motoristas").select("id,meta_diaria,comb_diario,setup_completo,plataformas,tipo_veiculo").eq("id", uid).execute()
        if not res.data:
            # Usuário novo — cria registro e sinaliza is_new
            try:
                supabase.table("motoristas").insert({"id": uid, "nome": nome, "telefone": uid[:8], "meta_diaria": 150, "comb_diario": None, "setup_completo": False, "email": _email_usuario}).execute()
            except:
                supabase.table("motoristas").insert({"id": uid, "nome": nome, "telefone": uid[:8]}).execute()
            return {"ok": True, "meta_diaria": 150, "comb_diario": None, "is_new": True, "setup_completo": False}
        meta = res.data[0].get("meta_diaria", 150) or 150
        comb = res.data[0].get("comb_diario")
        setup_completo = res.data[0].get("setup_completo", True)  # True = usuários antigos já passam direto
        if setup_completo is None: setup_completo = True  # usuário antigo sem a coluna
        # Se setup_completo ainda é False mas usuário tem meta configurada (meta != 150 padrão),
        # significa que já usou o app — marca como completo automaticamente
        if setup_completo is False and meta and meta != 150:
            setup_completo = True
            try:
                supabase.table("motoristas").update({"setup_completo": True}).eq("id", uid).execute()
            except:
                pass
        # Verifica se tem lançamentos (usuário ativo) — se sim, setup_completo sempre True
        if setup_completo is False:
            try:
                lanc = supabase.table("lancamentos").select("id").eq("motorista_id", uid).limit(1).execute()
                if lanc.data:
                    setup_completo = True
                    supabase.table("motoristas").update({"setup_completo": True}).eq("id", uid).execute()
            except:
                pass
        plataformas = res.data[0].get("plataformas")
        tipo_veiculo = res.data[0].get("tipo_veiculo") or "carro"
        # Atualiza email se ainda não tem
        if _email_usuario and not res.data[0].get("email"):
            try:
                supabase.table("motoristas").update({"email": _email_usuario}).eq("id", uid).execute()
            except Exception:
                pass
        return {"ok": True, "meta_diaria": meta, "comb_diario": comb, "is_new": False, "setup_completo": setup_completo, "plataformas": plataformas, "tipo_veiculo": tipo_veiculo}
    except Exception as e:
        log_erro("upsert_erro", erro=e)
        return {"ok": True, "meta_diaria": 150, "comb_diario": None, "is_new": False, "setup_completo": True}

@router.post("/completar-setup")
async def completar_setup(dados: dict = Body(...), uid: str = Depends(get_uid_from_token)):
    """Marca setup como completo e salva dados coletados pelo Gestor."""
    # uid vem do token — ignora qualquer id do body
    if not _valid_uuid(uid):
        return {"ok": False, "erro": "ID inválido"}
    meta = dados.get("meta_diaria")
    comb = dados.get("comb_diario")
    plataformas = dados.get("plataformas")
    try:
        update = {"setup_completo": True}
        if meta: update["meta_diaria"] = float(meta)
        if comb: update["comb_diario"] = float(comb)
        if plataformas: update["plataformas"] = plataformas
        supabase.table("motoristas").update(update).eq("id", uid).execute()
        return {"ok": True}
    except Exception as e:
        log_erro("endpoint_erro", erro=e)
        return {"ok": False, "erro": "Erro interno"}

@router.get("/motoristas/{telefone}")
def buscar_motorista(telefone: str, uid: str = Depends(get_uid_from_token)):
    res = supabase.table("motoristas").select("*").eq("telefone", telefone).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Motorista não encontrado")
    # Só retorna se o registro pertence ao usuário autenticado
    if str(res.data[0].get("id")) != uid:
        raise HTTPException(status_code=403, detail="Acesso negado")
    return res.data[0]


@router.post("/salvar-localizacao")
async def salvar_localizacao(dados: dict = Body(...), uid: str = Depends(get_uid_from_token)):
    """Salva lat/lon e cidade do motorista (capturado via clima) para o mapa do admin."""
    lat = dados.get("lat")
    lon = dados.get("lon")
    cidade = dados.get("cidade")
    estado = dados.get("estado")
    if lat is None or lon is None:
        return {"ok": False, "erro": "lat/lon obrigatórios"}
    try:
        upd = {
            "lat": round(float(lat), 4),
            "lon": round(float(lon), 4),
        }
        if cidade: upd["cidade"] = cidade
        if estado: upd["estado"] = estado
        supabase.table("motoristas").update(upd).eq("id", uid).execute()
        return {"ok": True}
    except Exception as e:
        log_erro("salvar_localizacao_erro", erro=e)
        return {"ok": False}
