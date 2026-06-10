"""Rotas de resumo financeiro e histórico semanal."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from core.supabase_client import supabase
from core.config import hoje_brasil
from core.security import _valid_uuid, get_uid_from_token
from core.cache import _cache_get
from core.logging import log_info, log_warn

router = APIRouter()

@router.get("/resumo/{motorista_id}")
async def resumo(motorista_id: str, mes: Optional[int] = None, ano: Optional[int] = None, uid: str = Depends(get_uid_from_token)):
    if motorista_id.lower().strip() != uid.lower().strip():
        log_warn("resumo_403", mid=motorista_id[:8])
        raise HTTPException(status_code=403, detail="Acesso negado")
    if not _valid_uuid(motorista_id): return {"erro": "ID inválido"}
    hoje = hoje_brasil()
    mes = mes or hoje.month
    ano = ano or hoje.year
    _cache_key = f"resumo:{motorista_id}:{mes}:{ano}"
    _cached = _cache_get(_cache_key)
    if _cached: return _cached
    inicio = f"{ano}-{mes:02d}-01"
    if mes == 12:
        fim = f"{ano+1}-01-01"
    else:
        fim = f"{ano}-{mes+1:02d}-01"
    res = supabase.table("lancamentos").select("*").eq("motorista_id", motorista_id).gte("data", inicio).lt("data", fim).execute()
    lancamentos = res.data
    ganhos = sum(float(l["valor"]) for l in lancamentos if l["tipo"] == "ganho")
    despesas = sum(float(l["valor"]) for l in lancamentos if l["tipo"] == "despesa")
    lucro = ganhos - despesas
    # Horas vem da tabela turnos (não de lancamentos, pois seria somado errado)
    try:
        tr = supabase.table("turnos").select("horas").eq("motorista_id", motorista_id).gte("data", inicio).lt("data", fim).execute()
        horas = sum(float(t.get("horas") or 0) for t in (tr.data or []))
    except:
        horas = 0
    km = sum(float(l.get("km_rodados") or 0) for l in lancamentos)
    return {
        "ganhos": ganhos,
        "despesas": despesas,
        "lucro": lucro,
        "horas_rodadas": horas,
        "km_rodados": km,
        "ganho_por_hora": round(ganhos / horas, 2) if horas > 0 else 0,
        "custo_por_km": round(despesas / km, 2) if km > 0 else 0,
        "lancamentos": lancamentos
    }



@router.get("/historico-semana/{motorista_id}")
async def historico_semana(motorista_id: str, uid: str = Depends(get_uid_from_token)):
    if motorista_id != uid: raise HTTPException(status_code=403, detail="Acesso negado")
    """Retorna média de faturamento por dia da semana (últimos 45 dias), excluindo outliers."""
    import datetime as _dt
    hoje = hoje_brasil()
    inicio = (hoje - _dt.timedelta(days=45)).isoformat()
    try:
        res = supabase.table("lancamentos").select("data,valor,tipo,plataforma").eq("motorista_id", motorista_id).gte("data", inicio).execute()
        lancamentos = res.data or []
    except:
        lancamentos = []

    # Busca meta_diaria configurada pelo motorista
    try:
        perf = supabase.table("motoristas").select("meta_diaria").eq("id", motorista_id).single().execute()
        meta_diaria = float((perf.data or {}).get("meta_diaria") or 0)
    except:
        meta_diaria = 0

    RENDA_EXTRA_KEYS = ["seguro_desemprego","freelance","aluguel_recebido","venda","emprestimo_recebido","bonus","renda_extra"]
    NOMES_DOW = ["Segunda","Terça","Quarta","Quinta","Sexta","Sábado","Domingo"]

    # Agrupa ganhos por data (exclui renda extra)
    ganhos_por_data = {}
    for l in lancamentos:
        if l["tipo"] == "ganho" and (l.get("plataforma") or "") not in RENDA_EXTRA_KEYS:
            d = l["data"]
            ganhos_por_data[d] = ganhos_por_data.get(d, 0) + float(l["valor"])

    # Remove outliers: dias com ganho > 2.5x a meta ou > 2000 (lançamento retroativo claramente)
    # Teto alto para não cortar dias normais de motorista que faz R$200-500/dia
    teto = 3000  # Só remove lançamentos retroativos óbvios (ex: R$3000 num dia só)
    ganhos_filtrados = {d: v for d, v in ganhos_por_data.items() if v <= teto and v > 1}

    # Calcula média por dia da semana
    soma_dow = {i: 0.0 for i in range(7)}
    cont_dow = {i: 0 for i in range(7)}
    for data_str, total in ganhos_filtrados.items():
        try:
            dow = _dt.date.fromisoformat(data_str).weekday()
            soma_dow[dow] += total
            cont_dow[dow] += 1
        except:
            pass

    dias_com_dado = sum(cont_dow.values())
    dias_semana_distintos = len([v for v in cont_dow.values() if v > 0])
    # Tem histórico se tem pelo menos 3 dias de dados (foi relaxado de 5 dias e 2 dias distintos)
    tem_historico = dias_com_dado >= 3  # 3 dias suficiente para ter padrão

    media_por_dia = {}
    for dow in range(7):
        if cont_dow[dow] > 0:
            media = round(soma_dow[dow] / cont_dow[dow], 0)
            if meta_diaria > 0:
                media = min(media, meta_diaria)
            media_por_dia[dow] = {
                "nome": NOMES_DOW[dow],
                "media": media,
                "amostras": cont_dow[dow]
            }

    media_geral = round(sum(v["media"] for v in media_por_dia.values()) / len(media_por_dia), 0) if media_por_dia else 0

    # Identifica dias fortes e fracos
    if len(media_por_dia) >= 3:
        ordenado = sorted(media_por_dia.items(), key=lambda x: x[1]["media"], reverse=True)
        dias_fortes = [media_por_dia[d]["nome"] for d, _ in ordenado[:2] if media_por_dia[d]["media"] >= media_geral * 0.9]
        dias_fracos = [media_por_dia[d]["nome"] for d, _ in ordenado[-2:] if media_por_dia[d]["media"] < media_geral * 0.75]
    else:
        dias_fortes = []
        dias_fracos = []

    import sys
    log_info("hist_semana", dias=dias_com_dado, tem_historico=tem_historico)

    return {
        "tem_historico": tem_historico,
        "dias_com_dado": dias_com_dado,
        "media_geral": media_geral,
        "media_por_dia": media_por_dia,
        "dias_fortes": dias_fortes,
        "dias_fracos": dias_fracos,
        "meta_diaria_configurada": meta_diaria
    }
