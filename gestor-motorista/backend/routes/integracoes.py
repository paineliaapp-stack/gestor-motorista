"""Integrações com plataformas (Uber, 99, iFood) — ESTRUTURA PREPARADA, DESLIGADA.

Visão: quando houver parceria/API oficial, o motorista conecta a conta da
plataforma e os repasses entram automaticamente — zero digitação.

Estado atual (jun/2026): Uber e 99 não expõem API pública de ganhos de
motorista no Brasil. Este módulo deixa o contrato pronto para o dia em que
a parceria sair, sem nada visível para o usuário até lá.

Para ativar no futuro: setar env INTEGRACOES_ATIVAS=true e implementar o
provider correspondente em PROVIDERS.
"""
import os
from fastapi import APIRouter, Depends, HTTPException
from core.security import get_uid_from_token
from core.supabase_client import supabase
from core.logging import log_info

router = APIRouter()

INTEGRACOES_ATIVAS = os.getenv("INTEGRACOES_ATIVAS", "false").lower() == "true"

# Contrato de provider: cada plataforma implementa estas 3 operações.
# conectar(uid, credenciais) -> {ok, conta_id}
# sincronizar(uid) -> [{data, valor, plataforma, corridas}]
# desconectar(uid) -> {ok}
PROVIDERS = {
    # "uber": UberProvider(),   # aguardando parceria/API oficial
    # "99":   NoveNoveProvider(),
    # "ifood": IfoodProvider(),
}


@router.get("/integracoes")
async def listar_integracoes(uid: str = Depends(get_uid_from_token)):
    """Lista provedores disponíveis e status de conexão do motorista."""
    if not INTEGRACOES_ATIVAS:
        return {"ativas": False, "provedores": []}
    conexoes = supabase.table("integracoes_conexoes").select("provedor,status").eq("motorista_id", uid).execute()
    conectados = {c["provedor"]: c["status"] for c in (conexoes.data or [])}
    return {
        "ativas": True,
        "provedores": [
            {"id": p, "conectado": conectados.get(p) == "ativo"} for p in PROVIDERS
        ],
    }


@router.post("/integracoes/{provedor}/conectar")
async def conectar_integracao(provedor: str, uid: str = Depends(get_uid_from_token)):
    if not INTEGRACOES_ATIVAS or provedor not in PROVIDERS:
        raise HTTPException(status_code=404, detail="Integração indisponível")
    log_info("integracao_conectar", provedor=provedor, uid=uid)
    return PROVIDERS[provedor].conectar(uid)


@router.post("/integracoes/{provedor}/sincronizar")
async def sincronizar_integracao(provedor: str, uid: str = Depends(get_uid_from_token)):
    """Puxa os ganhos da plataforma e insere como lançamentos (idempotente por data+plataforma)."""
    if not INTEGRACOES_ATIVAS or provedor not in PROVIDERS:
        raise HTTPException(status_code=404, detail="Integração indisponível")
    ganhos = PROVIDERS[provedor].sincronizar(uid)
    inseridos = 0
    for g in ganhos:
        # substituir=True semântico: remove lançamentos manuais do mesmo dia/plataforma
        supabase.table("lancamentos").delete().eq("motorista_id", uid).eq("data", g["data"]).eq("plataforma", g["plataforma"]).execute()
        supabase.table("lancamentos").insert({
            "motorista_id": uid, "tipo": "ganho", "valor": g["valor"],
            "plataforma": g["plataforma"], "data": g["data"], "origem": "integracao",
        }).execute()
        inseridos += 1
    return {"ok": True, "lancamentos": inseridos}
